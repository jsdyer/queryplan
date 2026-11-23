"""Exercise Query Plan Lab at a project subpath in Chromium."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import tempfile
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    screenshots = ROOT / "browser-checks"
    screenshots.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary:
        shutil.copytree(ROOT / "dist", Path(temporary) / "example-tool")
        server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=temporary))
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch()
                page = browser.new_page(viewport={"width": 1280, "height": 1000})
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(f"http://127.0.0.1:{server.server_port}/example-tool/")
                page.locator("#sample").click()
                assert page.locator("#results").is_visible()
                assert "Illustrative example" in page.locator("#status").inner_text()
                assert page.locator("#diff tr").count() == 2
                assert "50,000" in page.locator("#inspector").inner_text()
                page.locator("#show-after").click()
                assert "1,000" in page.locator("#inspector").inner_text()
                with page.expect_download() as download:
                    page.locator("#export-csv").click()
                assert download.value.suggested_filename == "query-plan-comparison.csv"
                page.screenshot(path=str(screenshots / "desktop.png"), full_page=True)
                page.set_viewport_size({"width": 390, "height": 844})
                assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
                page.screenshot(path=str(screenshots / "mobile.png"), full_page=True)
                page.locator("#clear").click()
                assert page.locator("#before").input_value() == ""
                assert page.locator("#results").is_hidden()
                page.locator("#before").fill('{"query_block":{"table":{"table_name":"<img src=x onerror=alert(1)>","access_type":"ALL","rows":1}}}')
                page.locator("#analyze").click()
                assert page.locator("img").count() == 0
                assert "<img src=x" in page.locator("#inspector").inner_text()
                page.locator("#before").fill('not JSON')
                page.locator("#analyze").click()
                assert "not valid JSON" in page.locator("#status").inner_text()
                assert page.locator("#results").is_hidden()
                assert not errors, errors
                browser.close()
            print("Browser checks passed: comparison, export, clear, safe text, error state and mobile layout")
        finally:
            server.shutdown()


if __name__ == "__main__":
    main()

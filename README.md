# Query Plan Lab

A local browser workbench for MySQL and MariaDB `EXPLAIN FORMAT=JSON` plans. Published at https://coolcode.ca/queryplan/.

<!-- coolcode:guide -->
Paste a MySQL or MariaDB JSON execution plan, or open a local JSON file, then choose **Visualize plan**. Add a second plan to compare access types, chosen indexes, row estimates, filtering and reported cost. Select any tree node to inspect the source JSON and any available MariaDB `r_rows` / `r_loops` measurements. The built-in comparison is an explicitly hand-written illustration, not a benchmark. Plans stay in memory in your browser; JSON and CSV downloads are optional. No account, API key or database connection is needed. Supports the traditional `query_block` JSON layout, including EXPLAIN-column exports; text/TREE output and MySQL JSON format version 2 are not supported.
<!-- /coolcode:guide -->

## Interpretation

- `ALL` is a full table scan; `index` is a full index scan. These can be reasonable choices. Filesort does not imply disk I/O.
- Root optimizer cost is displayed on its own, never added to nested costs. It is not elapsed time and is not comparable across engines, versions, data or settings.
- Estimates and MariaDB runtime `r_` observations have separate labels. `ANALYZE` executes a query; this tool never executes SQL.
- Table comparisons match name plus occurrence order. Review repeated names or reorganized subqueries manually.
- The original JSON remains inspectable, including fields the visualizer does not interpret. A lack of recognized warning flags is not a performance guarantee.
- Each input is limited to 2 MB, 1,000 nodes and a bounded traversal depth.

## Privacy

No pasted plan, SQL or local file is uploaded, stored in browser storage, or retained by the application. Refreshing or clearing the page discards input. CoolCode's independent aggregate visit counter does not receive plan contents. Explicitly downloaded reports contain potentially private schema names and expressions. Source and related-tool links are ordinary external navigations.

## Development

Source lives in `web/`. Build uses Python standard library, works offline and produces untracked `dist/`.

```sh
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -v
python3 scripts/build.py
```

GitHub Actions runs these checks plus `tests/browser_smoke.py` in Chromium and deploys successful main builds to GitHub Pages. There is no scheduled data collection because the application operates only on user-provided plans.

References: [MySQL EXPLAIN output](https://dev.mysql.com/doc/refman/8.4/en/explain-output.html), [MariaDB EXPLAIN FORMAT=JSON](https://mariadb.com/docs/server/reference/sql-statements/administrative-sql-statements/analyze-and-explain-statements/explain-format-json).

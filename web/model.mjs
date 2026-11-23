export const LIMIT = 2000000;
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const number = v => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const labels = {query_block:'Query block',nested_loop:'Nested loop',ordering_operation:'Ordering',grouping_operation:'Grouping',duplicates_removal:'Remove duplicates',union_result:'Union',query_specifications:'Query specifications',materialized_from_subquery:'Materialized subquery',attached_subqueries:'Attached subqueries',subqueries:'Subqueries',filesort:'Filesort',read_sorted_file:'Read sorted file',windowing:'Window functions',temporary_table:'Temporary table',block_nested_loop:'Block nested loop'};
export function parsePlan(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Paste an EXPLAIN FORMAT=JSON plan first.');
  if (text.length > LIMIT) throw new Error('Use a plan smaller than 2 MB.');
  let raw;
  try { raw = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')); }
  catch { throw new Error('This is not valid JSON. Use EXPLAIN FORMAT=JSON; text and TREE output are not supported.'); }
  if (Array.isArray(raw) && raw.length === 1 && object(raw[0])) raw = raw[0];
  if (object(raw) && ('EXPLAIN' in raw || 'ANALYZE' in raw)) {
    try { raw = typeof (raw.EXPLAIN ?? raw.ANALYZE) === 'string' ? JSON.parse(raw.EXPLAIN ?? raw.ANALYZE) : (raw.EXPLAIN ?? raw.ANALYZE); }
    catch { throw new Error('The EXPLAIN column does not contain valid JSON.'); }
  }
  if (!object(raw?.query_block)) throw new Error('Expected a query_block from MySQL or MariaDB EXPLAIN FORMAT=JSON. MySQL JSON format version 2 is not supported yet.');
  const nodes=[]; let visits=0;
  function walk(value,path,parent,depth) {
    if (++visits>20000 || depth>60) throw new Error('This plan is too deeply nested or complex to display safely.');
    if (Array.isArray(value)) { if(labels[path.split('.').at(-1)]) { const index=nodes.length; walk({items:value},path,parent,depth+1); nodes[index].raw=value; } else { value.forEach((v,i)=>walk(v,`${path}[${i}]`,parent,depth+1)); } return; }
    if (!object(value)) return;
    const tag=path.split('.').at(-1).replace(/\[\d+\]$/,'');
    let current=parent;
    if (value.table_name != null || labels[tag]) {
      if(nodes.length>=1000) throw new Error('This plan has more than 1,000 display nodes.');
      const flags=[];
      if(value.access_type==='ALL') flags.push('Full table scan');
      if(value.access_type==='index') flags.push('Full index scan');
      if(value.using_filesort===true || tag==='filesort') flags.push('Filesort');
      if(value.using_temporary_table===true || tag==='temporary_table') flags.push('Temporary table');
      current=nodes.length;
      nodes.push({id:current,parent,path,kind:value.table_name!=null?'table':'operation',label:String(value.table_name??labels[tag]),access:value.access_type??null,key:value.key??null,possibleKeys:value.possible_keys??[],rows:number(value.rows_examined_per_scan??value.rows),filtered:number(value.filtered),produced:number(value.rows_produced_per_join),actualRows:number(value.r_rows),actualLoops:number(value.r_loops),cost:number(value.cost_info?.query_cost??value.cost_info?.prefix_cost??value.cost),flags,raw:value});
    }
    for (const [key,child] of Object.entries(value)) if (object(child)||Array.isArray(child)) walk(child,`${path}.${key}`,current,depth+1);
  }
  walk(raw.query_block,'query_block',null,0);
  return {nodes,tableCount:nodes.filter(n=>n.kind==='table').length,cost:nodes[0]?.cost??null,warnings:nodes.filter(n=>n.flags.length),raw};
}
export function comparePlans(before,after) {
  const keyed=plan=>{const counts=new Map();return new Map(plan.nodes.filter(n=>n.kind==='table').map(n=>{const i=(counts.get(n.label)||0)+1;counts.set(n.label,i);return [`${n.label} #${i}`,n];}));};
  const a=keyed(before),b=keyed(after),fields=['access','key','rows','filtered','produced','actualRows','actualLoops','cost','flags'];
  return [...new Set([...a.keys(),...b.keys()])].map(label=>{const left=a.get(label),right=b.get(label);const changes=fields.filter(f=>JSON.stringify(left?.[f]??null)!==JSON.stringify(right?.[f]??null));return {label,status:!left?'Added':!right?'Removed':changes.length?'Changed':'Unchanged',before:left??null,after:right??null,changes};});
}
export function csv(rows) { return rows.map(row=>row.map(value=>{let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n'); }
export const examples = {
 before:{query_block:{select_id:1,cost_info:{query_cost:'85420.00'},ordering_operation:{using_filesort:true,nested_loop:[{table:{table_name:'customers',access_type:'ALL',possible_keys:['PRIMARY'],rows_examined_per_scan:50000,filtered:'2.00',attached_condition:"customers.region = 'BC'"}},{table:{table_name:'orders',access_type:'ref',key:'customer_id',rows_examined_per_scan:12,filtered:'25.00',rows_produced_per_join:3000}}]}}},
 after:{query_block:{select_id:1,cost_info:{query_cost:'1850.00'},ordering_operation:{using_filesort:true,nested_loop:[{table:{table_name:'customers',access_type:'ref',key:'region',rows_examined_per_scan:1000,filtered:'100.00',attached_condition:"customers.region = 'BC'"}},{table:{table_name:'orders',access_type:'ref',key:'customer_status',rows_examined_per_scan:3,filtered:'100.00',rows_produced_per_join:3000}}]}}}
};

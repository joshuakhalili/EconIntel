import { readFile } from 'node:fs/promises';
import { checkEditorialCompleteness } from '../src/server/lib/editorial-completeness.js';
const args=process.argv.slice(2);
const ledger=JSON.parse(await readFile(new URL('../docs/research/editorial-review-ledger.json',import.meta.url),'utf8'));
let snapshot;
if(args.includes('--database')) {
  const {query,closePool}=await import('../src/server/db/pool.js');
  try {
    const questions=(await query('SELECT id,is_active,answer_plain,answer_expert,theory,method,caveat FROM questions ORDER BY id')).rows;
    const figures=(await query(`SELECT f.*,COALESCE((SELECT json_agg(p ORDER BY p.series,p.label) FROM report_figure_points p WHERE p.figure_id=f.id),'[]') AS points FROM report_figures f ORDER BY f.id`)).rows;
    // pg date serialization is made equivalent to the checked-in snapshot.
    for(const f of figures) if(f.published instanceof Date)f.published=f.published.toISOString().slice(0,10);
    const lenses=(await query('SELECT id,is_active,subtitle,thesis_plain,thesis_expert FROM lenses ORDER BY id')).rows;
    const lens_readings=(await query('SELECT r.*,r.published::text AS published FROM question_reading r WHERE lens_id IS NOT NULL ORDER BY lens_id,url')).rows;
    const tickers=(await query('SELECT * FROM lens_tickers ORDER BY lens_id,sort_order')).rows;
    snapshot={questions,figures,lenses,lens_readings,tickers};
  } finally {await closePool();}
} else snapshot=JSON.parse(await readFile(new URL('../docs/research/editorial-review-snapshot.json',import.meta.url),'utf8'));
const result=checkEditorialCompleteness(snapshot,ledger);
console.log(JSON.stringify(result,null,2));
if(!result.ok)process.exitCode=1;

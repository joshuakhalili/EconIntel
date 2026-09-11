import { readFile } from 'node:fs/promises';
import { query } from '../db/pool.js';
import { checkEditorialCompleteness } from '../lib/editorial-completeness.js';

let ledgerPromise;
const loadLedger=()=>ledgerPromise??=readFile(new URL('../../../docs/research/editorial-review-ledger.json',import.meta.url),'utf8')
  .then(JSON.parse).catch(error=>{ledgerPromise=null;throw error;});

export async function editorialReviewForQuestion(questionId) {
  let ledger;
  try{ledger=await loadLedger();}catch(error){if(error.code==='ENOENT')return {status:'unavailable',note:'Granular editorial artifact is not available; no completed review is implied.'};throw error;}
  const {rows:[question]}=await query(`SELECT id,lens_id,is_active,answer_plain,answer_expert,theory,method,caveat
    FROM questions WHERE id=$1`,[questionId]);
  const {rows:figures}=await query(`SELECT f.*,f.published::text AS published,
    COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.series,p.label) FROM report_figure_points p WHERE p.figure_id=f.id),'[]'::jsonb) AS points
    FROM report_figures f WHERE f.question_id=$1 OR f.lens_id=$2 ORDER BY f.id`,[questionId,question.lens_id]);
  const {rows:lenses}=await query('SELECT id,is_active,subtitle,thesis_plain,thesis_expert FROM lenses WHERE id=$1',[question.lens_id]);
  const {rows:lensReadings}=await query('SELECT r.*,r.published::text AS published FROM question_reading r WHERE lens_id=$1 ORDER BY url',[question.lens_id]);
  const {rows:tickers}=await query('SELECT * FROM lens_tickers WHERE lens_id=$1 ORDER BY sort_order',[question.lens_id]);
  return evaluateEditorialReview({question,figures,lenses,lensReadings,tickers},ledger);
}

export function evaluateEditorialReview({question,figures,lenses,lensReadings,tickers},ledger){
  const questionId=question.id;
  const figureIds=new Set(figures.map(f=>f.id));
  const subset={schema_version:ledger.schema_version,review_actor:ledger.review_actor,
    questions:ledger.questions.filter(q=>q.question_id===questionId),
    lenses:(ledger.lenses??[]).filter(l=>l.lens_id===question.lens_id),
    lens_readings:(ledger.lens_readings??[]).filter(r=>r.lens_id===question.lens_id),
    tickers:(ledger.tickers??[]).filter(t=>t.lens_id===question.lens_id),
    report_points:ledger.report_points.filter(p=>figureIds.has(p.figure_id)),sources:ledger.sources};
  const gate=checkEditorialCompleteness({questions:[question],figures,lenses,lens_readings:lensReadings,tickers},subset);
  const sourceIds=new Set([...subset.questions.flatMap(q=>q.fields.flatMap(f=>f.spans.flatMap(s=>s.source_ids))),...subset.report_points.map(p=>p.source_id),...subset.lenses.flatMap(l=>l.fields.flatMap(f=>f.spans.flatMap(s=>s.source_ids))),...subset.lens_readings.flatMap(r=>r.source_ids),...subset.tickers.flatMap(t=>t.source_ids)]);
  return {status:gate.ok?'current_agent_disposition':'stale',gate,
    questions:subset.questions,lenses:subset.lenses,lens_readings:subset.lens_readings,tickers:subset.tickers,report_points:subset.report_points,sources:ledger.sources.filter(s=>sourceIds.has(s.id))};
}

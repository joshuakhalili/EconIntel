import assert from 'node:assert/strict';
import { researchWorkflowForQuestion } from '../src/server/repositories/research-workflow.js';
import { query,closePool } from '../src/server/db/pool.js';
try {
  const result=await researchWorkflowForQuestion('productivity');
  assert.ok(result);assert.ok(Array.isArray(result.review_queue));
  assert.equal(result.corpus_benchmark.denominator,6);
  assert.ok(result.source_refreshes.every(row=>row.evidence_id&&row.claim_id));
  assert.equal(await researchWorkflowForQuestion('nonexistent-integration-question'),null);
  const {rows:latestRuns}=await query('SELECT DISTINCT ON(question_id) question_id,status FROM research_discovery_runs ORDER BY question_id,id DESC');
  const {rows:refreshStatuses}=await query(`SELECT COALESCE(f.status,'never_checked') AS status,count(*)::int AS bindings,count(DISTINCT c.question_id)::int AS questions
    FROM research_evidence e JOIN research_claims c ON c.id=e.claim_id LEFT JOIN LATERAL
    (SELECT status FROM research_source_refresh_events f WHERE f.evidence_id=e.id AND f.source_url=e.source_url ORDER BY id DESC LIMIT 1) f ON true GROUP BY f.status`);
  const {rows:[usage]}=await query(`SELECT count(*)::int AS runs,sum((provider_usage->>'attempts')::int) AS attempts,
    sum((provider_usage->>'credits_used')::numeric) AS reported_credits,sum((provider_usage->>'cost_usd')::numeric) AS reported_usd,
    sum((provider_usage->>'cost_unreported')::int) AS unreported_cost_responses FROM research_discovery_runs`);
  console.log(JSON.stringify({status:'PASS',candidate_families:result.candidates.length,runs:result.runs.length,
    all_question_latest_status:latestRuns,source_refresh_status:refreshStatuses,discovery_usage:usage,granular_review_status:result.granular_review.status,granular_issues:result.granular_review.gate?.issues,
    reviews_queued:result.review_queue.length,source_bindings:result.source_refreshes.length,
    sentinel_recall:`${result.corpus_benchmark.found}/${result.corpus_benchmark.denominator}`,
    run_status:result.runs.map(r=>({id:r.id,status:r.status,usage:r.provider_usage,error:r.error}))},null,2));
}finally{await closePool();}

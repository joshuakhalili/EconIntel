import { query, withTransaction } from '../db/pool.js';
import { questionDiscoveryPlan, discoverQuestion } from '../ingestion/research-discovery.js';
import { openAlexBudget } from '../ingestion/openalex-budget.js';
import { benchmarkRecall,BENCHMARK } from '../lib/research-benchmark.js';
import { editorialReviewForQuestion } from './editorial-review.js';

export async function upsertStudyVersion(client,version) {
  await client.query(`INSERT INTO research_study_families(id,canonical_title,identity_basis,identity_note)
    VALUES($1,$2,'provider_work','OpenAlex grouped locations; independent work IDs require an explicit reviewed link.')
    ON CONFLICT(id) DO NOTHING`,[version.family_id,version.title]);
  await client.query(`INSERT INTO research_study_versions
    (id,family_id,provider_work_id,title,doi,source_url,version_label,publication_date,affiliation_countries,metadata)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,doi=EXCLUDED.doi,
      publication_date=EXCLUDED.publication_date,version_label=EXCLUDED.version_label,source_url=EXCLUDED.source_url,
      affiliation_countries=EXCLUDED.affiliation_countries,metadata=EXCLUDED.metadata,fetched_at=now()`,
  [version.id,version.family_id,version.provider_work_id,version.title,version.doi,version.source_url,
    version.version_label,version.publication_date,version.affiliation_countries,JSON.stringify(version.metadata)]);
}

export async function runResearchDiscovery(questionId,{maxRequests=6,maxPages=1,maxStages=4,sharedBudget=null}={}) {
  const {rows:[question]}=await query('SELECT id,question FROM questions WHERE id=$1',[questionId]);
  if(!question)throw new Error('Unknown research question');
  const plan=questionDiscoveryPlan(question);
  const {rows:[previous]}=await query(`SELECT checkpoint,plan,status FROM research_discovery_runs
    WHERE question_id=$1 ORDER BY id DESC LIMIT 1`,[questionId]);
  const resume=previous?.plan?.version===plan.version && previous.status!=='complete'?previous.checkpoint:{};
  const {rows:[run]}=await query(`INSERT INTO research_discovery_runs(question_id,plan,status)
    VALUES($1,$2,'running') RETURNING id`,[questionId,JSON.stringify(plan)]);
  const budget=sharedBudget??openAlexBudget({maxRequests,onUsage:usage=>query('UPDATE research_discovery_runs SET provider_usage=$2 WHERE id=$1',[run.id,JSON.stringify(usage)])});
  const beforeUsage=structuredClone(budget.usage);
  const persistSharedUsage=async current=>{
    const delta={...current,scope:'This run within a shared batch; remaining is the latest provider response'};
    for(const field of ['attempts','responses','credits_used','credits_unreported','cost_usd','cost_unreported'])delta[field]-=beforeUsage[field];
    await query('UPDATE research_discovery_runs SET provider_usage=$2 WHERE id=$1',[run.id,JSON.stringify(delta)]);
  };
  if(sharedBudget)budget.setUsageSink(persistSharedUsage);
  try {
    const result=await discoverQuestion({plan,checkpoint:resume,request:budget.request,maxPages,maxStages,
      savePage:async(versions,route,checkpoint)=>withTransaction(async client=>{
        for(const version of versions) {
          await upsertStudyVersion(client,version);
          await client.query(`INSERT INTO research_discovery_candidates(question_id,version_id,routes,first_run_id)
            VALUES($1,$2,ARRAY[$3],$4) ON CONFLICT(question_id,version_id) DO UPDATE
            SET routes=ARRAY(SELECT DISTINCT unnest(research_discovery_candidates.routes||EXCLUDED.routes) ORDER BY 1)`,
          [questionId,version.id,route,run.id]);
        }
        await client.query('UPDATE research_discovery_runs SET checkpoint=$2 WHERE id=$1',[run.id,JSON.stringify(checkpoint)]);
      })});
    await query('UPDATE research_discovery_runs SET status=$2,finished_at=now() WHERE id=$1',[run.id,result.complete?'complete':'bounded']);
    return {...result,run_id:run.id,usage:budget.usage};
  }catch(error) {
    // Provider errors can contain page text. Save only a controlled error class.
    await query("UPDATE research_discovery_runs SET status='failed',finished_at=now(),error=$2 WHERE id=$1",[run.id,error.name==='HttpError'?`Provider HTTP ${error.status??'network/budget'}: ${error.message.slice(0,180)}`:'Discovery validation/persistence failed']);
    throw error;
  }finally {
    if(sharedBudget) {
      try{await persistSharedUsage(budget.usage);}finally{budget.setUsageSink(null);}
    }
  }
}

export async function researchWorkflowForQuestion(slug) {
  const {rows:[question]}=await query('SELECT id FROM questions WHERE slug=$1 AND is_active',[slug]);
  if(!question)return null;
  const [candidates,runs,queue,refreshes,benchmarkRows,granular]=await Promise.all([
    query(`SELECT f.id AS family_id,f.canonical_title,f.identity_basis,
      jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'url',v.source_url,'version',v.version_label,
       'doi',v.doi,'affiliation_countries',v.affiliation_countries,'routes',c.routes) ORDER BY v.id) AS versions
      FROM research_discovery_candidates c JOIN research_study_versions v ON v.id=c.version_id
      JOIN research_study_families f ON f.id=v.family_id WHERE c.question_id=$1
      GROUP BY f.id ORDER BY f.canonical_title LIMIT 100`,[question.id]),
    query('SELECT id,plan,provider_usage,status,started_at,finished_at,error FROM research_discovery_runs WHERE question_id=$1 ORDER BY id DESC LIMIT 3',[question.id]),
    query('SELECT * FROM research_review_queue WHERE question_id=$1 ORDER BY claim_id',[question.id]),
    query(`SELECT e.id AS evidence_id,e.claim_id,e.source_url,f.status,f.checked_at,f.detail,
      CASE WHEN f.status='changed' THEN 'Inspect the changed original; update source version and review the claim again.'
       WHEN f.status='inaccessible' THEN 'Obtain an accessible original or mark the source unverified; never infer unchanged content.'
       WHEN f.id IS NULL THEN 'Fetch an allowlisted original to establish a byte-hash baseline.' END AS next_action
      FROM research_evidence e JOIN research_claims c ON c.id=e.claim_id
      LEFT JOIN LATERAL (SELECT * FROM research_source_refresh_events f
        WHERE f.evidence_id=e.id AND f.source_url=e.source_url ORDER BY id DESC LIMIT 1) f ON true
      WHERE c.question_id=$1 ORDER BY e.id`,[question.id]),
    query(`SELECT v.id,v.title,v.doi FROM research_study_versions v
      WHERE regexp_replace(lower(v.title),'[^a-z0-9]','','g')=ANY($1::text[])
       OR replace(lower(v.doi),'https://doi.org/','')=ANY($2::text[])`,[
      BENCHMARK.studies.map(s=>s.title.toLowerCase().replace(/[^a-z0-9]/g,'')),BENCHMARK.studies.map(s=>s.doi)]),
    editorialReviewForQuestion(question.id),
  ]);
  return {candidates:candidates.rows,runs:runs.rows,review_queue:queue.rows,source_refreshes:refreshes.rows,
    corpus_benchmark:benchmarkRecall(benchmarkRows.rows),
    granular_review:granular,
    note:'Candidates are not approved evidence. Affiliation countries describe authors, never the geography studied. Family groups follow provider work identity, not independent replications.'};
}

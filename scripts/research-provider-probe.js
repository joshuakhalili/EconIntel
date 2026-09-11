import { query,closePool } from '../src/server/db/pool.js';
import { discoveryUrl } from '../src/server/ingestion/research-discovery.js';
import { openAlexBudget } from '../src/server/ingestion/openalex-budget.js';
import { citationProbeTargets } from '../src/server/ingestion/research-probe-targets.js';
try {
  const record=process.argv.includes('--record');
  const {rows:[row]}=await query("SELECT checkpoint FROM research_discovery_runs WHERE jsonb_array_length(COALESCE(checkpoint->'references','[]'::jsonb))>0 AND jsonb_array_length(COALESCE(checkpoint->'seeds','[]'::jsonb))>0 ORDER BY id DESC LIMIT 1");
  const state=row?.checkpoint??{};
  const targets=citationProbeTargets(state);
  const budget=openAlexBudget({maxRequests:2});
  const results=[];
  for(const [lane,filter] of targets) {
    try {const data=await budget.request(discoveryUrl({filter,per_page:'1'}),{retries:0,timeoutMs:15000});if(!Array.isArray(data.results))throw new Error('Missing results array');const result={lane,status:'ok',count:data.meta?.count,returned:data.results.length};results.push(result);console.log(JSON.stringify(result));}
    catch(error){const result={lane,status:error.status??'network',message:error.message};results.push(result);console.log(JSON.stringify(result));}
  }
  console.log(JSON.stringify({usage:budget.usage}));
  const verificationState=results.every(r=>r.status==='ok')?'verified':'failed';
  if(record)await query(`INSERT INTO source_verifications(source_id,state,method,scope,detail)
    VALUES('openalex',$1,'live_discovery_contract_probe','One outgoing reference and one incoming citation; not a corpus completeness guarantee',$2)
    ON CONFLICT(source_id) DO UPDATE SET checked_at=now(),state=EXCLUDED.state,method=EXCLUDED.method,scope=EXCLUDED.scope,detail=EXCLUDED.detail`,[verificationState,JSON.stringify(results)]);
  if(verificationState==='failed')process.exitCode=1;
}finally{await closePool();}

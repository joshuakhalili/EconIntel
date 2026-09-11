import { query,withTransaction,closePool } from '../src/server/db/pool.js';
import { fetchSourceHash,sourceRefreshStatus } from '../src/server/lib/research-source-refresh.js';
import { pathToFileURL } from 'node:url';

export async function refreshQuestionSources(questionId,{execute=false,maxUrls=6,cache=null}={}) {
  if(!Number.isInteger(maxUrls)||maxUrls<1||maxUrls>6)throw new Error('Source refresh maxUrls must be 1–6');
  if(!questionId||!/^[a-z0-9-]+$/.test(questionId))throw new Error('Usage: research-refresh.js QUESTION_ID [--execute]');
  const {rows}=await query(`SELECT e.id,e.source_url,e.content_hash,
    (SELECT max(f.checked_at) FROM research_source_refresh_events f WHERE f.evidence_id=e.id AND f.source_url=e.source_url) AS last_checked
    FROM research_evidence e JOIN research_claims c ON c.id=e.claim_id
    WHERE c.question_id=$1 ORDER BY last_checked NULLS FIRST,e.id`,[questionId]);
  // Bound unique URLs, then update all evidence bindings for each selected URL.
  const urls=[...new Set(rows.map(r=>r.source_url))].slice(0,maxUrls);
  if(!execute)return {mode:'preview',question_id:questionId,unique_urls:urls,remaining_urls:new Set(rows.map(r=>r.source_url)).size-urls.length};
  else {
    const results=[];
    for(const url of urls) {
      let observed=null,detail='Bytes compared; source fidelity and interpretation still require review.';
      if(cache?.has(url)){({observed,detail}=cache.get(url));}
      else {
        try{observed=await fetchSourceHash(url);}catch(error){detail=error.message;}
        cache?.set(url,{observed,detail});
      }
      await withTransaction(async client=>{
        const {rows:bindings}=await client.query(`SELECT e.id,e.content_hash FROM research_evidence e
          JOIN research_claims c ON c.id=e.claim_id WHERE c.question_id=$1 AND e.source_url=$2 FOR UPDATE OF e`,[questionId,url]);
        for(const e of bindings) {
          const status=sourceRefreshStatus(e.content_hash,observed?.hash);
          // A first fetched baseline is not a source review. Never adopt changed
          // bytes silently; accepting a new baseline is an explicit editorial edit.
          if(status==='baseline')await client.query('UPDATE research_evidence SET content_hash=$2 WHERE id=$1',[e.id,observed.hash]);
          await client.query(`INSERT INTO research_source_refresh_events
            (evidence_id,source_url,status,observed_hash,baseline_hash,content_type,bytes,detail)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[e.id,url,status,observed?.hash??null,e.content_hash??observed?.hash??null,observed?.contentType??null,observed?.bytes??null,detail]);
        }
      });
      results.push({url,accessible:Boolean(observed),bytes:observed?.bytes??null,detail});
    }
    return {question_id:questionId,results};
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const args=process.argv.slice(2);
    if(args.includes('--all')) {
      const {rows}=await query('SELECT id FROM questions ORDER BY id');
      const cache=new Map();
      for(const row of rows){const result=await refreshQuestionSources(row.id,{execute:args.includes('--execute'),cache});console.log(JSON.stringify(result));}
    } else console.log(JSON.stringify(await refreshQuestionSources(args.find(a=>!a.startsWith('--')),{execute:args.includes('--execute')}),null,2));
  }catch(error){console.error(error.message);process.exitCode=1;}finally{await closePool();}
}

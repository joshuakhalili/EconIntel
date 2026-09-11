/** Daily bounded rotation, or one explicit all-question staging/release pass.
 * No observations or editorial assertions are generated from search results.
 */
import { query,closePool } from '../src/server/db/pool.js';
import { runResearchDiscovery } from '../src/server/repositories/research-workflow.js';
import { openAlexBudget } from '../src/server/ingestion/openalex-budget.js';
import { refreshQuestionSources } from './research-refresh.js';

try {
  const args=process.argv.slice(2),execute=args.includes('--execute'),all=args.includes('--all');
  const failedOnly=args.includes('--failed');
  if(args.some(a=>!['--execute','--all','--failed'].includes(a)))throw new Error('Usage: research-rotate.js [--all] [--failed] [--execute]');
  const limit=all?40:5,maxRequests=all?180:20;
  const {rows:questions}=await query(`SELECT q.id,max(r.started_at) AS last_search
    FROM questions q LEFT JOIN research_discovery_runs r ON r.question_id=q.id
    WHERE NOT $2::boolean OR (SELECT status FROM research_discovery_runs x WHERE x.question_id=q.id ORDER BY id DESC LIMIT 1)='failed'
    GROUP BY q.id ORDER BY max(r.started_at) NULLS FIRST,q.id LIMIT $1`,[limit,failedOnly]);
  if(!execute)console.log(JSON.stringify({mode:'preview',questions:questions.map(q=>q.id),max_requests:maxRequests,
    source_refresh_urls_per_question:all?1:2},null,2));
  else {
    const budget=openAlexBudget({maxRequests,maxCostUsd:all?0.09:0.03});
    const sourceCache=new Map();
    const results=[];
    for(const question of questions) {
      if(budget.usage.attempts>=maxRequests || budget.usage.remaining!==null&&budget.usage.remaining<10 || budget.usage.cost_usd>=(all?0.089:0.029))break;
      let result;
      try{const run=await runResearchDiscovery(question.id,{sharedBudget:budget});result={question:question.id,status:run.complete?'complete':'bounded',kept:run.kept};}
      catch(error){result={question:question.id,status:'failed',error:error.status??error.name};}
      const refreshed=await refreshQuestionSources(question.id,{execute:true,maxUrls:all?1:2,cache:sourceCache});
      result.source_checks=refreshed.results.length;
      results.push(result);console.log(JSON.stringify(result));
    }
    console.log(JSON.stringify({selected:questions.length,visited:results.length,failed:results.filter(r=>r.status==='failed').length,usage:budget.usage}));
    if(results.some(r=>r.status==='failed')||results.length<questions.length)process.exitCode=1;
  }
}finally{await closePool();}

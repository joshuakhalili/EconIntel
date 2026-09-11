import { query,closePool } from '../src/server/db/pool.js';
import { questionDiscoveryPlan } from '../src/server/ingestion/research-discovery.js';
import { runResearchDiscovery } from '../src/server/repositories/research-workflow.js';

try {
  const args=process.argv.slice(2),execute=args.includes('--execute');
  const questionId=args.find(a=>!a.startsWith('--'));
  if(!questionId||!/^[a-z0-9-]+$/.test(questionId))throw new Error('Usage: research-discover.js QUESTION_ID [--execute]');
  const {rows:[question]}=await query('SELECT id,question FROM questions WHERE id=$1',[questionId]);
  if(!question)throw new Error('Unknown question');
  console.log(JSON.stringify(execute?await runResearchDiscovery(questionId):{mode:'preview',plan:questionDiscoveryPlan(question),max_requests:6},null,2));
}catch(error){console.error(error.name==='HttpError'?'OpenAlex request/budget failure; inspect the saved discovery run.':error.message);process.exitCode=1;}
finally{await closePool();}

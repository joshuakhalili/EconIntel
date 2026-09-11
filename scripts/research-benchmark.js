import { query,closePool } from '../src/server/db/pool.js';
import { benchmarkRecall } from '../src/server/lib/research-benchmark.js';
try {
  // Never fetch the sentinel DOIs to pad search recall. Compare independently
  // selected sentinels against actually held corpus and targeted candidates.
  const {rows:legacy}=await query("SELECT id::text,title,raw->>'doi' AS doi FROM documents WHERE kind='research'");
  const {rows:targeted}=await query('SELECT id,title,doi FROM research_study_versions');
  console.log(JSON.stringify({legacy:benchmarkRecall(legacy),targeted:benchmarkRecall(targeted),combined:benchmarkRecall([...legacy,...targeted])},null,2));
}finally{await closePool();}

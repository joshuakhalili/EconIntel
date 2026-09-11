import { readFile } from 'node:fs/promises';
import { withTransaction,closePool } from '../src/server/db/pool.js';
if(process.env.DIFFUSION_STAGING_TEST!=='1')throw new Error('Isolated staging only');
try {
  const seed=process.argv[2] ?? '059_report_point_adjudication.sql';
  if(!['059_report_point_adjudication.sql','060_lens_and_study_synthesis.sql','061_policy_ticker_measurements.sql','062_ticker_measurement_scope.sql','064_structured_workplace_evidence.sql'].includes(seed))throw new Error('Unapproved staging seed');
  await withTransaction(async client=>client.query(await readFile(new URL(`../db/seeds/${seed}`,import.meta.url),'utf8')));
  console.log(`Applied ${seed} in one staging transaction.`);
}finally{await closePool();}

/** Explicit reviewed grouping for different provider work IDs. Preview first.
 * JSON: {family_id,title,version_ids:[...],source_url,reason,reviewer,actor:'agent'|'human'}
 * A title match alone is never evidence that two papers are one study.
 */
import { readFile } from 'node:fs/promises';
import { query,withTransaction,closePool } from '../src/server/db/pool.js';
import { httpsUrl } from '../src/server/ingestion/research-discovery.js';
try {
  const [path,flag]=process.argv.slice(2);if(!path)throw new Error('Usage: research-link-versions.js REVIEW.json [--execute]');
  const review=JSON.parse(await readFile(path,'utf8'));
  if(!/^reviewed:[a-z0-9-]+$/.test(review.family_id??'')||!review.title?.trim()||!review.reason?.trim()||!review.reviewer?.trim()||!['agent','human'].includes(review.actor)||!httpsUrl(review.source_url)||!Array.isArray(review.version_ids)||review.version_ids.length<2||review.version_ids.length>20||new Set(review.version_ids).size!==review.version_ids.length)throw new Error('Incomplete explicit study-family review');
  const {rows:versions}=await query('SELECT id,family_id,title,source_url FROM research_study_versions WHERE id=ANY($1::text[])',[review.version_ids]);
  if(versions.length!==review.version_ids.length)throw new Error('Every version must already be discovered');
  if(flag==='--execute')await withTransaction(async client=>{
    await client.query(`INSERT INTO research_study_families(id,canonical_title,identity_basis,identity_note)
      VALUES($1,$2,'reviewed_link',$3)`,[review.family_id,review.title,JSON.stringify({...review,previous_families:versions.map(v=>({id:v.id,family_id:v.family_id}))})]);
    await client.query('UPDATE research_study_versions SET family_id=$1 WHERE id=ANY($2::text[])',[review.family_id,review.version_ids]);
    await client.query('UPDATE research_evidence SET study_family_id=$1 WHERE study_version_id=ANY($2::text[])',[review.family_id,review.version_ids]);
  });
  else if(flag)throw new Error('Unknown option');
  console.log(JSON.stringify({mode:flag==='--execute'?'linked':'preview',family_id:review.family_id,versions},null,2));
}catch(error){console.error(error.message);process.exitCode=1;}finally{await closePool();}

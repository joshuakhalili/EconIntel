/** Export only discovery metadata and source-check provenance, never users,
 * secrets, observations, editorial assertions or copyrighted originals.
 * Import is preview-only unless --execute; --verify always rolls back.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {pool,query,withTransaction,closePool} from '../src/server/db/pool.js';
import {upsertStudyVersion} from '../src/server/repositories/research-workflow.js';
import {canonical} from '../src/server/lib/editorial-completeness.js';
import {orderSourceRefreshes} from '../src/server/lib/research-bootstrap-policy.js';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const args=process.argv.slice(2),mode=args[0],path=args[1];
if(!['export','import'].includes(mode)||!path)throw new Error('Usage: research-bootstrap.js export FILE | import FILE [--execute|--verify]');
const rollback=Object.assign(new Error('Verification rollback'),{rollback:true});
try {
  if(mode==='export'){
    const data=await withTransaction(async client=>{
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const rows=async sql=>(await client.query(sql)).rows;
      return {schema_version:1,origin:'isolated-staging-research-verification',exported_at:new Date().toISOString(),
        families:await rows('SELECT * FROM research_study_families ORDER BY id'),
        versions:await rows('SELECT * FROM research_study_versions ORDER BY id'),
        runs:await rows('SELECT * FROM research_discovery_runs ORDER BY id'),
        candidates:await rows('SELECT * FROM research_discovery_candidates ORDER BY question_id,version_id'),
        bindings:await rows('SELECT id,source_url,source_version,content_hash FROM research_evidence ORDER BY id'),
        refreshes:await rows('SELECT * FROM research_source_refresh_events ORDER BY id')};
    });
    await writeFile(path,JSON.stringify({sha256:hash(data),data}),{flag:'wx',mode:0o600});
    console.log(JSON.stringify({exported:true,sha256:hash(data),families:data.families.length,versions:data.versions.length,runs:data.runs.length,candidates:data.candidates.length,refreshes:data.refreshes.length}));
  }else{
    const envelope=JSON.parse(await readFile(path,'utf8')),data=envelope.data;
    if(hash(data)!==envelope.sha256||data.schema_version!==1||data.origin!=='isolated-staging-research-verification')throw new Error('Research bootstrap identity/checksum mismatch');
    const families=new Map(data.families.map(f=>[f.id,f])),versions=new Map(data.versions.map(v=>[v.id,v])),runs=new Map(data.runs.map(r=>[String(r.id),r]));
    if(families.size!==data.families.length||versions.size!==data.versions.length||runs.size!==data.runs.length)throw new Error('Duplicate bootstrap identity');
    if(data.versions.some(v=>!families.has(v.family_id))||data.candidates.some(c=>!versions.has(c.version_id)||!runs.has(String(c.first_run_id))))throw new Error('Broken family/version/run references');
    const orderedRefreshes=orderSourceRefreshes(data.refreshes);
    if(!args.includes('--execute')&&!args.includes('--verify'))console.log(JSON.stringify({mode:'preview',sha256:envelope.sha256,families:families.size,versions:versions.size,runs:runs.size,candidates:data.candidates.length,refreshes:data.refreshes.length}));
    else {
      const stats={families:0,versions:0,runs:0,candidates:0,refreshes:0,skipped_bindings:0,skipped_historical_refreshes:0};
      try{await withTransaction(async client=>{
        await client.query("SELECT pg_advisory_xact_lock(hashtext('research-bootstrap-v1'))");
        // Refresh writers lock evidence rows before appending events. Acquire
        // evidence EXCLUSIVE first (blocks SELECT FOR UPDATE, permits SELECT),
        // then event INSERT protection. Existing writers finish before these
        // locks are granted; later writers cannot invalidate the cutoff map.
        await client.query('LOCK TABLE research_evidence IN EXCLUSIVE MODE');
        await client.query('LOCK TABLE research_source_refresh_events IN SHARE ROW EXCLUSIVE MODE');
        await client.query('LOCK TABLE research_discovery_runs IN SHARE ROW EXCLUSIVE MODE');
        let newerFixture;
        if(args.includes('--verify')){
          const b=data.bindings.find(b=>data.refreshes.some(f=>f.evidence_id===b.id));
          if(b){const {rows:[inserted]}=await client.query(`INSERT INTO research_source_refresh_events(evidence_id,source_url,checked_at,status,detail)
            VALUES($1,$2,'2099-01-01','inaccessible','Rollback-only newer production-state fixture') RETURNING id`,[b.id,b.source_url]);newerFixture={...b,event_id:inserted.id};}
          if(b){
            const contender=await pool.connect();
            try{
              for(const sql of [
                {text:'SELECT id FROM research_evidence WHERE id=$1 FOR UPDATE',values:[b.id]},
                {text:"INSERT INTO research_source_refresh_events(evidence_id,source_url,status,detail) VALUES($1,$2,'inaccessible','Concurrent rollback-only fixture')",values:[b.id,b.source_url]},
              ]){
                await contender.query('BEGIN');await contender.query("SET LOCAL lock_timeout='100ms'");
                await assert.rejects(contender.query(sql),error=>error.code==='55P03');
                await contender.query('ROLLBACK');
              }
              // Ordinary application reads remain available during bootstrap.
              await contender.query('SELECT id FROM research_evidence WHERE id=$1',[b.id]);
            }finally{await contender.query('ROLLBACK');contender.release();}
          }
        }
        const {rows:currentRefreshes}=await client.query('SELECT evidence_id,source_url,max(checked_at) AS checked_at FROM research_source_refresh_events GROUP BY evidence_id,source_url');
        const latestRefresh=new Map(currentRefreshes.map(f=>[JSON.stringify([f.evidence_id,f.source_url]),new Date(f.checked_at).getTime()]));
        const incomingLatest=new Map();
        for(const r of data.runs)incomingLatest.set(r.question_id,Math.max(incomingLatest.get(r.question_id)??0,new Date(r.started_at).getTime()));
        const {rows:targetRuns}=await client.query("SELECT question_id,max(started_at) AS started_at,bool_or(status='running') AS running FROM research_discovery_runs GROUP BY question_id");
        if(targetRuns.some(r=>r.running||incomingLatest.has(r.question_id)&&new Date(r.started_at).getTime()>incomingLatest.get(r.question_id)))throw new Error('Target has running or newer discovery state; bootstrap must not overwrite its cursor history');
        for(const f of data.families){
          const {rows:[existing]}=await client.query('SELECT * FROM research_study_families WHERE id=$1',[f.id]);
          if(existing&&(existing.canonical_title!==f.canonical_title||existing.identity_basis!==f.identity_basis||existing.identity_note!==f.identity_note))throw new Error(`Family conflict: ${f.id}`);
          if(!existing){await client.query('INSERT INTO research_study_families(id,canonical_title,identity_basis,identity_note) VALUES($1,$2,$3,$4)',[f.id,f.canonical_title,f.identity_basis,f.identity_note]);stats.families++;}
        }
        for(const v of data.versions){
          const {rows:[existing]}=await client.query('SELECT * FROM research_study_versions WHERE id=$1',[v.id]);
          if(existing){
            for(const key of ['family_id','provider_work_id','source_url','version_label','title','doi'])if(existing[key]!==v[key])throw new Error(`Version conflict: ${v.id}/${key}`);
            const date=value=>value==null?null:new Date(value).toISOString().slice(0,10);
            if(date(existing.publication_date)!==date(v.publication_date)||JSON.stringify(canonical(existing.metadata))!==JSON.stringify(canonical(v.metadata))||JSON.stringify(existing.affiliation_countries)!==JSON.stringify(v.affiliation_countries))throw new Error(`Version semantic metadata conflict: ${v.id}`);
          }else{await upsertStudyVersion(client,v);await client.query('UPDATE research_study_versions SET fetched_at=$2 WHERE id=$1',[v.id,v.fetched_at]);stats.versions++;}
        }
        const runMap=new Map();
        for(const r of data.runs){
          const provenance={origin:data.origin,original_run_id:String(r.id),artifact_sha256:envelope.sha256,original_started_at:r.started_at};
          const {rows:[existing]}=await client.query("SELECT id FROM research_discovery_runs WHERE provider_usage->'import_provenance'->>'origin'=$1 AND provider_usage->'import_provenance'->>'original_run_id'=$2 LIMIT 1",[data.origin,String(r.id)]);
          let id=existing?.id;
          if(!id){const {rows:[inserted]}=await client.query(`INSERT INTO research_discovery_runs(question_id,plan,checkpoint,provider_usage,status,started_at,finished_at,error)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[r.question_id,r.plan,r.checkpoint,{...r.provider_usage,import_provenance:provenance},r.status==='running'?'failed':r.status,r.started_at,r.finished_at,r.status==='running'?'Imported interrupted staging run':r.error]);id=inserted.id;stats.runs++;}
          runMap.set(String(r.id),id);
        }
        for(const c of data.candidates){await client.query(`INSERT INTO research_discovery_candidates(question_id,version_id,routes,first_run_id) VALUES($1,$2,$3,$4)
          ON CONFLICT(question_id,version_id) DO UPDATE SET routes=ARRAY(SELECT DISTINCT unnest(research_discovery_candidates.routes||EXCLUDED.routes) ORDER BY 1)`,[c.question_id,c.version_id,c.routes,runMap.get(String(c.first_run_id))]);stats.candidates++;}
        const accepted=new Set();
        for(const b of data.bindings){
          const {rows:[current]}=await client.query('SELECT source_url,source_version,content_hash FROM research_evidence WHERE id=$1 FOR UPDATE',[b.id]);
          if(!current||current.source_url!==b.source_url||current.source_version!==b.source_version||(current.content_hash&&current.content_hash!==b.content_hash)){stats.skipped_bindings++;continue;}
          if(!current.content_hash&&b.content_hash)await client.query('UPDATE research_evidence SET content_hash=$2 WHERE id=$1',[b.id,b.content_hash]);
          accepted.add(b.id);
        }
        for(const f of orderedRefreshes){
          if(!accepted.has(f.evidence_id))continue;
          if(new Date(f.checked_at).getTime()<=(latestRefresh.get(JSON.stringify([f.evidence_id,f.source_url]))??-Infinity)){stats.skipped_historical_refreshes++;continue;}
          const detail=`Imported staging verification event ${f.id}; original checked_at ${new Date(f.checked_at).toISOString()}. ${f.detail??''}`;
          const {rows:[existing]}=await client.query('SELECT id FROM research_source_refresh_events WHERE evidence_id=$1 AND detail=$2',[f.evidence_id,detail]);
          if(!existing){await client.query(`INSERT INTO research_source_refresh_events(evidence_id,source_url,checked_at,status,observed_hash,baseline_hash,content_type,bytes,detail)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[f.evidence_id,f.source_url,f.checked_at,f.status,f.observed_hash,f.baseline_hash,f.content_type,f.bytes,detail]);stats.refreshes++;}
        }
        const {rows:[broken]}=await client.query('SELECT count(*)::int AS n FROM research_discovery_candidates c LEFT JOIN research_study_versions v ON v.id=c.version_id LEFT JOIN research_discovery_runs r ON r.id=c.first_run_id WHERE v.id IS NULL OR r.id IS NULL');
        if(broken.n)throw new Error('Post-import referential integrity failed');
        if(newerFixture){const {rows:[latest]}=await client.query('SELECT id,status FROM research_source_refresh_events WHERE evidence_id=$1 AND source_url=$2 ORDER BY id DESC LIMIT 1',[newerFixture.id,newerFixture.source_url]);if(latest.id!==newerFixture.event_id||latest.status!=='inaccessible')throw new Error('Import overwrote newer production source state');}
        if(args.includes('--verify'))throw rollback;
      });}catch(error){if(error!==rollback)throw error;}
      console.log(JSON.stringify({mode:args.includes('--verify')?'verified_and_rolled_back':'imported',...stats,origin:data.origin}));
    }
  }
}finally{await closePool();}

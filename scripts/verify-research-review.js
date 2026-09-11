/** Transaction-rolled-back integration check. Use only with an isolated test DB. */
import assert from 'node:assert/strict';
import { pool } from '../src/server/db/pool.js';
import { researchForQuestion } from '../src/server/repositories/research.js';
import { upsertStudyVersion } from '../src/server/repositories/research-workflow.js';

if (process.env.DIFFUSION_STAGING_TEST !== '1') {
  throw new Error('Set DIFFUSION_STAGING_TEST=1 only for an isolated staging database');
}
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const version={id:'integration-study-version',family_id:'integration-study-family',provider_work_id:'https://openalex.org/W123',title:'Test study',doi:null,
    source_url:'https://www.nber.org/fixture',version_label:'submittedVersion',publication_date:'2024-01-01',affiliation_countries:['US'],metadata:{geography_studied:null}};
  await upsertStudyVersion(client,version);
  await upsertStudyVersion(client,{...version,publication_date:'2024-02-01'});
  const {rows:[correctedVersion]}=await client.query("SELECT publication_date::text FROM research_study_versions WHERE id='integration-study-version'");
  assert.equal(correctedVersion.publication_date,'2024-02-01','provider publication-date corrections persist');
  const { rows: [question] } = await client.query('SELECT id, lens_id FROM questions ORDER BY id LIMIT 1');
  assert.ok(question, 'fixture requires one question');
  await client.query(`INSERT INTO research_claims VALUES
    ('integration-review-fixture', $1, 'Test claim', 'descriptive', 'qualified',
     'USA', '2026', 'Test limitation', 'New evidence')`, [question.id]);
  await client.query(`INSERT INTO research_evidence
    (id, claim_id, source_url, source_title, source_version, locator, finding,
     method, limitations, relationship, relevance, access_basis, publication_stage)
    VALUES ('integration-evidence-fixture', 'integration-review-fixture',
      'https://example.org/fixture', 'Test source', 'v1', 'Table 1', 'Test finding',
      'Test method', 'Test limit', 'supports', 'Test relevance', 'full_text', 'report')`);
  const read = client.query.bind(client);
  const current = async () => (await researchForQuestion(question.id, read)).find(c => c.id === 'integration-review-fixture');
  let claim = await current();
  assert.equal(claim.review_status, 'draft');
  const { rows: [review] } = await client.query(`INSERT INTO research_review_events
    (claim_id, fingerprint, snapshot, actor_type, reviewer, notes)
    VALUES ($1, $2, $3, 'agent', 'integration fixture', 'Test only') RETURNING id`,
    [claim.id, claim.fingerprint, JSON.stringify(claim)]);
  assert.equal((await current()).review_status, 'agent_checked');
  await client.query('SAVEPOINT source_refresh_check');
  await client.query('SAVEPOINT missing_hash_check');
  await assert.rejects(client.query("INSERT INTO research_source_refresh_events(evidence_id,source_url,status,detail) VALUES('integration-evidence-fixture','https://example.org/fixture','unchanged','Rollback missing-hash fixture')"),/research_refresh_success_hash_required/);
  await client.query('ROLLBACK TO SAVEPOINT missing_hash_check');
  const initialHash='a'.repeat(64),changedHash='b'.repeat(64);
  await client.query(`INSERT INTO research_source_refresh_events(evidence_id,source_url,status,observed_hash,baseline_hash,detail)
    VALUES('integration-evidence-fixture','https://example.org/fixture','baseline',$1,$1,'Test baseline')`,[initialHash]);
  const sourceBaseline=await current();
  await client.query(`INSERT INTO research_review_events(claim_id,fingerprint,snapshot,actor_type,reviewer,notes)
    VALUES($1,$2,$3,'agent','integration fixture','Source identity baseline')`,[sourceBaseline.id,sourceBaseline.fingerprint,JSON.stringify(sourceBaseline)]);
  assert.equal((await current()).review_status,'agent_checked');
  await client.query(`INSERT INTO research_source_refresh_events(evidence_id,source_url,status,observed_hash,baseline_hash,detail)
    VALUES('integration-evidence-fixture','https://example.org/fixture','unchanged',$1,$1,'Same bytes on later fetch')`,[initialHash]);
  assert.equal((await current()).review_status,'agent_checked','unchanged source fetch must retain review');
  await client.query(`INSERT INTO research_source_refresh_events(evidence_id,source_url,status,observed_hash,baseline_hash,detail)
    VALUES('integration-evidence-fixture','https://example.org/fixture','changed',$1,$2,'Changed source bytes')`,[changedHash,initialHash]);
  assert.equal((await current()).review_status,'stale','changed bytes invalidate');
  const {rows:queued}=await client.query("SELECT reason,next_action FROM research_review_queue WHERE claim_id='integration-review-fixture'");
  assert.equal(queued[0].reason,'stale');assert.ok(queued[0].next_action);
  await client.query('SAVEPOINT refresh_immutable_check');
  await assert.rejects(client.query("UPDATE research_source_refresh_events SET detail='changed' WHERE evidence_id='integration-evidence-fixture'"),/append-only/);
  await client.query('ROLLBACK TO SAVEPOINT refresh_immutable_check');
  await client.query(`INSERT INTO research_source_refresh_events(evidence_id,source_url,status,detail)
    VALUES('integration-evidence-fixture','https://example.org/fixture','inaccessible','Original unavailable')`);
  assert.equal((await current()).review_status,'stale','inaccessible source is not assumed unchanged');
  await client.query('ROLLBACK TO SAVEPOINT source_refresh_check');
  assert.equal((await current()).review_status,'agent_checked');
  await client.query('SAVEPOINT observation_check');
  const { rows: [fact] } = await client.query(`SELECT o.id FROM observations o
    JOIN indicators i ON i.id=o.indicator_id
    JOIN question_indicators qi ON qi.indicator_id=o.indicator_id
    WHERE qi.question_id=$1 AND o.value IS NOT NULL
      AND (NOT i.has_country_dim OR o.country_iso3=COALESCE(qi.country_iso3,i.default_country_iso3))
    ORDER BY o.id LIMIT 1`, [question.id]);
  assert.ok(fact, 'fixture requires a plotted observation');
  await client.query('UPDATE observations SET value=value+1 WHERE id=$1', [fact.id]);
  assert.equal((await current()).review_status, 'stale');
  await client.query('ROLLBACK TO SAVEPOINT observation_check');
  assert.equal((await current()).review_status, 'agent_checked');
  await client.query('SAVEPOINT caption_check');
  await client.query("UPDATE question_indicators SET caption_plain=COALESCE(caption_plain,'') || ' revised' WHERE question_id=$1", [question.id]);
  assert.equal((await current()).review_status, 'stale');
  await client.query('ROLLBACK TO SAVEPOINT caption_check');
  const { rows: [indicator] } = await client.query(`SELECT i.id, i.source_id FROM indicators i
    JOIN question_indicators qi ON qi.indicator_id=i.id WHERE qi.question_id=$1
    ORDER BY i.id LIMIT 1`, [question.id]);
  const checkMetadataChange = async (sql, params) => {
    await client.query('SAVEPOINT metadata_check');
    await client.query(sql, params);
    assert.equal((await current()).review_status, 'stale', 'indicator/source metadata invalidates');
    await client.query('ROLLBACK TO SAVEPOINT metadata_check');
    assert.equal((await current()).review_status, 'agent_checked');
  };
  await checkMetadataChange("UPDATE indicators SET source_url='https://example.org/revised-source' WHERE id=$1", [indicator.id]);
  await checkMetadataChange("UPDATE indicators SET quantity_kind=CASE WHEN quantity_kind='rate' THEN 'magnitude'::quantity_kind ELSE 'rate'::quantity_kind END WHERE id=$1", [indicator.id]);
  await checkMetadataChange("UPDATE sources SET attribution_text=COALESCE(attribution_text,'') || ' revised' WHERE id=$1", [indicator.source_id]);
  // An empty indicator must have its own dependency, not rely on an observation
  // join. The unique source ensures no populated series can mask this test.
  await client.query('SAVEPOINT empty_indicator_check');
  await client.query("INSERT INTO sources(id,name) VALUES ('integration-empty-source','Empty fixture source')");
  await client.query(`INSERT INTO indicators(id,name,pillar,quantity_kind,cadence,confidence_tier,unit,source_id)
    SELECT 'integration-empty-indicator','Empty fixture indicator',pillar,quantity_kind,cadence,confidence_tier,unit,'integration-empty-source'
    FROM indicators WHERE id=$1`, [indicator.id]);
  await client.query(`INSERT INTO question_indicators(question_id,indicator_id)
    VALUES ($1,'integration-empty-indicator')`, [question.id]);
  assert.equal((await current()).review_status, 'stale', 'new empty placement invalidates');
  const emptyBaseline = await current();
  await client.query(`INSERT INTO research_review_events
    (claim_id,fingerprint,snapshot,actor_type,reviewer,notes)
    VALUES ($1,$2,$3,'agent','integration fixture','Empty-series baseline test only')`,
  [emptyBaseline.id,emptyBaseline.fingerprint,JSON.stringify(emptyBaseline)]);
  assert.equal((await current()).review_status, 'agent_checked');
  await checkMetadataChange("UPDATE indicators SET source_url='https://example.org/empty-revision' WHERE id='integration-empty-indicator'", []);
  await checkMetadataChange("UPDATE sources SET name='Revised empty source' WHERE id='integration-empty-source'", []);
  await checkMetadataChange("UPDATE indicators SET source_id=$1 WHERE id='integration-empty-indicator'", [indicator.source_id]);
  await client.query("UPDATE indicators SET last_ingested_at=now(),updated_at=now(),refresh_interval=INTERVAL '2 days' WHERE id='integration-empty-indicator'");
  assert.equal((await current()).review_status, 'agent_checked', 'operational refresh metadata does not invalidate');
  await client.query('ROLLBACK TO SAVEPOINT empty_indicator_check');
  assert.equal((await current()).review_status, 'agent_checked');
  for (const [scope, parentId] of [['question_id', question.id], ['lens_id', question.lens_id]]) {
    // Fixture inserts also prove newly linked evidence invalidates a review.
    // Rollback each change so subsequent assertions test independent causes.
    await client.query('SAVEPOINT report_dependency_check');
    const { rows: [reading] } = await client.query(`INSERT INTO question_reading
      (${scope}, title, publisher, url, kind, takeaway, takeaway_source, review_actor, takeaway_ref)
      SELECT $1, title, publisher, 'https://example.org/review-fixture', kind, 'Test takeaway', 'extracted', 'agent', 'Test page'
      FROM question_reading ORDER BY id LIMIT 1 RETURNING id`, [parentId]);
    assert.ok(reading, 'fixture requires one existing reading');
    assert.equal((await current()).review_status, 'stale', `${scope} reading insertion`);
    await client.query('ROLLBACK TO SAVEPOINT report_dependency_check');
    assert.equal((await current()).review_status, 'agent_checked');
    await client.query('SAVEPOINT report_dependency_check');
    const { rows: [existing] } = await client.query(`SELECT id FROM question_reading WHERE ${scope}=$1 ORDER BY id LIMIT 1`, [parentId]);
    assert.ok(existing, `fixture requires ${scope} reading`);
    await client.query("UPDATE question_reading SET title=title || ' revised', takeaway=takeaway || ' revised' WHERE id=$1", [existing.id]);
    assert.equal((await current()).review_status, 'stale', `${scope} source/takeaway update`);
    await client.query('ROLLBACK TO SAVEPOINT report_dependency_check');
    assert.equal((await current()).review_status, 'agent_checked');
  }
  const { rows: [figure] } = await client.query(`SELECT f.id FROM report_figures f
    WHERE (f.question_id=$1 OR f.lens_id=$2)
      AND EXISTS (SELECT 1 FROM report_figure_points p WHERE p.figure_id=f.id)
    ORDER BY f.id LIMIT 1`, [question.id, question.lens_id]);
  assert.ok(figure, 'fixture requires linked report figure with points');
  for (const sql of [
    "UPDATE report_figures SET note=note || ' revised' WHERE id=$1",
    'UPDATE report_figure_points SET value=value+1 WHERE figure_id=$1',
  ]) {
    await client.query('SAVEPOINT report_dependency_check');
    await client.query(sql, [figure.id]);
    assert.equal((await current()).review_status, 'stale', 'figure metadata or values');
    await client.query('ROLLBACK TO SAVEPOINT report_dependency_check');
    assert.equal((await current()).review_status, 'agent_checked');
  }
  await client.query("UPDATE research_evidence SET source_version='v2' WHERE id='integration-evidence-fixture'");
  assert.equal((await current()).review_status, 'stale');
  await client.query("UPDATE research_evidence SET source_version='v1' WHERE id='integration-evidence-fixture'");
  assert.equal((await current()).review_status, 'agent_checked');
  await client.query("UPDATE questions SET answer_plain=COALESCE(answer_plain,'') || ' changed' WHERE id=$1", [question.id]);
  assert.equal((await current()).review_status, 'stale');
  await client.query('SAVEPOINT immutable_check');
  await assert.rejects(client.query('UPDATE research_review_events SET notes=$1 WHERE id=$2', ['changed', review.id]), /append-only/);
  await client.query('ROLLBACK TO SAVEPOINT immutable_check');
  console.log('PASS: draft → agent checked; observation, caption, indicator/source metadata (including empty series), question/lens reading, report metadata/values, source and editorial changes invalidate; operational refreshes do not; historical events immutable. Rolled back.');
} finally {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
}

/** Transaction-rolled-back integration check. Use only with an isolated test DB. */
import assert from 'node:assert/strict';
import { pool } from '../src/server/db/pool.js';
import { researchForQuestion } from '../src/server/repositories/research.js';

if (process.env.DIFFUSION_STAGING_TEST !== '1') {
  throw new Error('Set DIFFUSION_STAGING_TEST=1 only for an isolated staging database');
}
const client = await pool.connect();
try {
  await client.query('BEGIN');
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
  console.log('PASS: draft → agent checked; observation, caption, question/lens reading, report metadata/values, source and editorial changes invalidate; historical events immutable. Rolled back.');
} finally {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
}

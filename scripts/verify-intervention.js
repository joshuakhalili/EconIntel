/** End-to-end staging check with production authentication rules.
 * Creates/reuses one synthetic reader on the isolated DB. Never use production.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
if (process.env.DIFFUSION_STAGING_TEST !== '1') throw new Error('Isolated staging database required');
process.env.NODE_ENV = 'production';
process.env.SESSION_SECRET = randomBytes(32).toString('hex');
const { app } = await import('../src/server/app.js');
const { closePool } = await import('../src/server/db/pool.js');
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let cookie = '';
const get = async path => {
  const response = await fetch(base + path, { headers: { cookie } });
  assert.equal(response.status, 200, path);
  return response.json();
};
try {
  for (const path of ['/api/countries', '/api/countries/GBR', '/api/questions/adoption', '/api/series?ids=fred.GDPC1', '/api/questions/productivity/research-workflow']) {
    assert.equal((await fetch(base + path)).status, 401, `signed out: ${path}`);
  }
  const login = await fetch(base + '/auth/email', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ name: 'Diffusion staging QA', email: 'diffusion-staging-qa@example.com' }),
  });
  assert.equal(login.status, 200);
  cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const { countries } = await get('/api/countries');
  assert.equal(countries.filter(c => !c.is_aggregate).length, 99);
  const { questions } = await get('/api/questions');
  for (const { slug } of questions) {
    const result = await get(`/api/questions/${slug}`);
    const question = result;
    assert.ok(question.research.length >= 4, `${slug}: claim inventory`);
    assert.ok(question.answer_plain && question.method && question.theory && question.caveat, `${slug}: editorial package`);
    assert.ok(question.indicators.every(i => i.caption_plain), `${slug}: captions`);
  }
  const { series } = await get('/api/series?ids=wb.NY.GDP.MKTP.KD.ZG&countries=GBR');
  assert.equal(series[0].country, 'GBR');
  assert.ok(series[0].points.length > 0);
  const { lenses } = await get('/api/lenses');
  for (const {slug} of lenses) {
    const lens = await get(`/api/lenses/${slug}`);
    assert.equal(lens.narration?.grounding?.renderer_version, 'typed-facts-v2-2026-09-10', `${slug}: deterministic narration`);
    assert.ok(lens.narration.grounding.selection.factIds.every(id => lens.narration.grounding.facts.some(f => f.id === id)));
  }
  const run = await get('/api/simulations/ai-capex-dotcom/run?country=USA');
  const { tickers: policyTickers } = await get('/api/lenses/regulation/tickers');
  assert.equal(policyTickers.length, 4);
  assert.ok(policyTickers.every(t => /publications/i.test(t.label)), 'Policy tickers must name publication flows');
  assert.ok(policyTickers.every(t => !/already law|leads binding rules by|three counts above decompose/i.test(t.why)), 'Policy interpretation must not imply a legal stock or unsupported lag');
  assert.equal(run.narration?.grounding?.renderer_version, 'typed-facts-v2-2026-09-10', 'simulation: deterministic narration');
  assert.match(run.narration.body, /not an observed outcome/);
  const workflow = await get('/api/questions/productivity/research-workflow');
  assert.ok(Array.isArray(workflow.review_queue));
  assert.ok(workflow.runs.length > 0, 'Discovery must have execution evidence, not only schema');
  assert.equal(workflow.corpus_benchmark.denominator, 6);
  console.log(`PASS: production auth gate; signed-in reader; ${questions.length} question packages; 99 economies; UK-specific series. Staging only.`);
  console.log(`PASS: ${lenses.length} current lens narrations and a default simulation narration expose verified fact IDs.`);
} finally {
  await new Promise(resolve => server.close(resolve));
  await closePool();
}

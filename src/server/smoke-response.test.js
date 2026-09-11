import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smokeResponseBody } from '../../scripts/smoke-response.js';

test('large research JSON is parsed whole, not silently truncated at shell sample size', async () => {
  const payload = { claims: Array.from({ length: 1000 }, (_, id) => ({ id, finding: 'A source-bound finding with limitations.' })) };
  const response = new Response(JSON.stringify(payload), { headers: { 'content-type': 'application/json; charset=utf-8' } });
  assert.deepEqual(JSON.parse(await smokeResponseBody(response)), payload);
});
test('HTML remains a bounded sample and oversized JSON fails explicitly', async () => {
  assert.equal((await smokeResponseBody(new Response('x'.repeat(30_000)))).length, 20_000);
  await assert.rejects(smokeResponseBody(new Response('x'.repeat(4 * 1024 * 1024 + 1), { headers: { 'content-type': 'application/json' } })), /exceeds 4 MiB/);
});

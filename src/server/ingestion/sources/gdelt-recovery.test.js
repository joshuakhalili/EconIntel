import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recoverLatestCompleteMonth, fetchWithBackoff } from './gdelt.js';
import { HttpError } from '../../lib/http.js';
const now = new Date('2026-03-10T00:00:00Z');
const days = Array.from({ length: 28 }, (_, i) => ({ date: `2026-02-${String(i + 1).padStart(2, '0')}`, value: 2, norm: 10 }));
test('GDELT recovery requests one complete month and weights numerator/denominator', async () => {
  const rows = await recoverLatestCompleteMonth({ now, fetch: async ({ from, to }) => {
    assert.equal(from.toISOString().slice(0, 10), '2026-02-01');
    assert.equal(to.toISOString().slice(0, 10), '2026-03-01');
    return days;
  } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value, 20);
  assert.equal(rows[0].periodEnd, '2026-02-28');
});
test('GDELT incomplete, duplicate, impossible and zero denominator months fail closed', async () => {
  for (const points of [days.slice(1), [...days.slice(1), days[1]], days.map((p) => ({ ...p, norm: 0 })), days.map((p) => ({ ...p, value: 11 }))]) {
    await assert.rejects(recoverLatestCompleteMonth({ now, fetch: async () => points }), /incomplete|invalid/);
  }
});
test('GDELT recovery retries transient failures only within its budget', async () => {
  let clock = 0, calls = 0;
  const result = await fetchWithBackoff('https://fixture.invalid', { now: () => clock, wait: async (ms) => { clock += ms; },
    request: async () => { if (++calls === 1) throw new HttpError('throttle', { status: 429 }); return { timeline: [] }; },
  });
  assert.deepEqual(result, { timeline: [] });
  assert.equal(calls, 2);
  await assert.rejects(fetchWithBackoff('https://fixture.invalid', { totalBudgetMs: 10_000, request: async () => { throw new HttpError('outage', { status: 503 }); } }), /budget/);
});

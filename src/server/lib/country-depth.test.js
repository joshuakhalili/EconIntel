import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priorityDepth, evidenceRole } from './country-depth.js';
test('generic macro coverage cannot satisfy direct AI-use coverage', () => {
  const rows = [{ iso3: 'USA', question_id: 'adoption', indicator_id: 'wb.IT.NET.USER.ZS', observation_count: 5, last_period: '2025-01-01' }];
  const adoption = priorityDepth(rows).find((row) => row.iso3 === 'USA' && row.domain === 'adoption');
  assert.equal(adoption.indicator_count, 1);
  assert.equal(adoption.direct_ai_measures, 0);
  assert.match(adoption.gap, /no direct AI-use/);
  assert.equal(evidenceRole({ indicator_id: 'oecd.ai_any.USA' }), 'direct_ai_adoption_measure');
});
test('missing cells stay gaps and repeated placements do not inflate depth', () => {
  const row = { iso3: 'USA', question_id: 'jobs', indicator_id: 'fred.USINFO', observation_count: 5 };
  const depth = priorityDepth([row, { ...row, question_id: 'clerical' }]);
  assert.equal(depth.length, 45);
  assert.equal(depth.find((cell) => cell.iso3 === 'USA' && cell.domain === 'labour').indicator_count, 1);
  assert.equal(depth.find((cell) => cell.iso3 === 'IND' && cell.domain === 'adoption').indicator_count, 0);
});

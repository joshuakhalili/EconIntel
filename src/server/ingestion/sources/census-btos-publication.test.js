import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBtosPublication } from './census-btos-publication.js';
// Recorded subset of the official publication fetched 2026-09-10.
const fixture = [{ xmltag: 'Current AI Use (Last Two Weeks)', Estimate: 17.3, Date: '2025-11-30' },
  { xmltag: 'Expected AI Use (Next Six Months)', Estimate: 25.9, Date: '2026-08-23' }];
test('current use is kept separately from expected use with correct biweek bounds', () => {
  const rows = parseBtosPublication(fixture);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value, 17.3);
  assert.equal(rows[0].periodStart, '2025-11-17');
  assert.equal(rows[0].periodEnd, '2025-11-30');
});
test('source drift and implausible estimates fail closed', () => {
  for (const change of [{ xmltag: 'AI use' }, { Date: '2025-02-30' }, { Date: '2024-11-30' }, { Estimate: 101 }, { Estimate: '17.3' }]) {
    assert.throws(() => parseBtosPublication([{ ...fixture[0], ...change }]));
  }
  assert.throws(() => parseBtosPublication([fixture[0], fixture[0]]), /Duplicate/);
  assert.throws(() => parseBtosPublication([fixture[1]]), /no usable/);
});
test('suppression never becomes zero', () => {
  const rows = parseBtosPublication([fixture[0], { ...fixture[0], Date: '2025-12-14', Estimate: 'S' }]);
  assert.equal(rows[1].value, null);
  assert.equal(rows[1].valueStatus, 'suppressed');
});
test('current-use estimates cannot become measurements of a future reference period', () => {
  const now = new Date('2026-09-10T23:59:59Z');
  assert.throws(() => parseBtosPublication([{ ...fixture[0], Date: '2030-01-13' }], { now }), /in the future/);
  assert.throws(() => parseBtosPublication([{ ...fixture[0], Date: '2026-09-11' }], { now }), /in the future/);
  assert.equal(parseBtosPublication([{ ...fixture[0], Date: '2026-09-10' }], { now }).length, 1);
  assert.throws(() => parseBtosPublication(fixture, { now: new Date('invalid') }), /validation date/);
});

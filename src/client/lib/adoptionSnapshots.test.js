import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adoptionSnapshots } from './adoptionSnapshots.js';

test('heterogeneous rates stay in editorial order with explicit estimand/source labels', () => {
  const rows = [
    { indicator_id: 'derived.sec_ai_mention_rate', latest_value: 2, quantity_kind: 'rate' },
    { indicator_id: 'dbn.OECD.test', latest_value: 90, quantity_kind: 'rate' },
    { indicator_id: 'unknown', latest_value: 3, quantity_kind: 'rate' },
    { indicator_id: 'missing', latest_value: null, quantity_kind: 'rate' },
  ];
  const result = adoptionSnapshots(rows);
  assert.deepEqual(result.map((r) => r.indicator_id), rows.slice(0, 3).map((r) => r.indicator_id));
  assert.match(result[0].sourceFamily, /text mentions, not measured adoption/);
  assert.match(result[1].sourceFamily, /country-specific scope/);
  assert.match(result[2].sourceFamily, /Source-specific rate/);
  assert.equal(rows[0].sourceFamily, undefined);
});

test('growth signature does not visualize rates on a ranked shared scale', () => {
  const source = readFileSync(new URL('../components/lens/LensSignature.jsx', import.meta.url), 'utf8');
  const growth = source.slice(source.indexOf('function AdoptionSpread'), source.indexOf('function Contested'));
  assert.doesNotMatch(growth, /\.sort\(|ceiling|width:|read the ordering/);
  assert.match(growth, /Neither their levels nor their ordering/);
  assert.match(growth, /row.sourceFamily/);
  assert.match(growth, /row.latest_period/);
  assert.match(growth, /row.latest_status/);
  assert.match(growth, /Reference period not complete/);
  assert.match(growth, /Read the definition and source/);
  assert.match(growth, /\/data\/\$\{encodeURIComponent\(row.indicator_id\)\}/);
  const lens = readFileSync(new URL('../routes/LensPage.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(lens, /prices are tracked|The prices underneath/);
});

test('source snapshots disclose current unfinished reference periods', () => {
  const rows = ['2026-12-31', '2026-09-11', '2025-12-31', null].map(latest_period_end => ({ latest_value: 5, quantity_kind: 'rate', latest_period_end }));
  assert.deepEqual(adoptionSnapshots(rows, '2026-09-11').map(r => r.referencePeriodIncomplete), [true, true, false, false]);
});

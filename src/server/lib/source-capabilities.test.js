import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceCapabilities } from './source-capabilities.js';
test('configuration, implementation and last success remain independent', () => {
  const rows = sourceCapabilities([
    { name: 'FRED', ready: false }, { name: 'Ember', implemented: false, configured: true }, { name: 'World Bank', ready: true },
  ], [{ id: 'fred', last_success: '2026-09-09', latest_period: '2026-08-01' }]);
  assert.equal(rows[0].implemented, true);
  assert.equal(rows[0].configured, false);
  assert.equal(rows[0].latest_success, '2026-09-09');
  assert.equal(rows[1].implemented, false);
  assert.equal(rows[1].configured, true);
  assert.equal(rows[1].latest_success, null);
  assert.equal(rows[2].configured, 'not_required');
});

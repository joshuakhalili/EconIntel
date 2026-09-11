import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceCapabilities } from './source-capabilities.js';
import { gdeltFreshness } from './source-freshness.js';
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

test('provider verification is independent, scoped and expires', () => {
  const now = new Date('2026-09-10');
  const integration = [{ name: 'World Bank', configured: true }];
  assert.equal(sourceCapabilities(integration, [], now)[0].provider_verification, 'not_checked');
  for (const [state, date, expected] of [['verified','2026-09-09','verified'],['verified','2026-07-01','expired'],['failed','2026-09-09','failed']]) {
    const result = sourceCapabilities(integration, [{ id: 'worldbank', verification_state: state, verified_at: date, verification_scope: 'metadata only' }], now)[0];
    assert.equal(result.provider_verification, expected);
    assert.equal(result.verification_scope, 'metadata only');
  }
});
test('GDELT freshness distinguishes absent, stale, current and impossible periods', () => {
  const now = new Date('2026-09-10');
  assert.equal(gdeltFreshness(null, now).state, 'missing');
  assert.equal(gdeltFreshness('2026-01-31', now).state, 'stale');
  assert.equal(gdeltFreshness('2026-08-31', now).stale, false);
  assert.equal(gdeltFreshness('2027-01-31', now).state, 'invalid_future');
});

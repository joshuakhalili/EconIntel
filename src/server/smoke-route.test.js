import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { smokeRoute } from '../../scripts/smoke-route.js';
import { APP_ROUTES } from '../../scripts/vercel-config.js';

test('simulation smoke URL uses the seeded scenario, not the question adoption slug', () => {
  const seed = readFileSync(new URL('../../db/seeds/034_scenario_ai-capex-dotcom.sql', import.meta.url), 'utf8');
  assert.match(seed, /INSERT INTO simulation_scenarios[\s\S]*?'ai-capex-dotcom',\s*'ai-capex-dotcom'/);
  assert.equal(smokeRoute('/simulate/:slug'), '/simulate/ai-capex-dotcom');
  assert.equal(smokeRoute('/q/:slug'), '/q/adoption');
});
test('every declared app pattern has an explicit concrete smoke URL', () => {
  for (const route of APP_ROUTES) assert.ok(!smokeRoute(route).includes(':'), route);
  assert.throws(() => smokeRoute('/new-feature/:slug'), /Missing smoke route example/);
  assert.equal(smokeRoute('/overview'), '/overview');
});

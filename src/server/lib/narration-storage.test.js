import { test } from 'node:test';
import assert from 'node:assert/strict';
import { narrate, buildLensGrounding, PROMPT_VERSION } from './narration.js';
import { typedNarration, narrationFacts } from './narration-facts.js';

const grounding = { series: [{ name: 'Output', latest: 12, previous: 10, country: 'GBR',
  unit: 'GBP bn', period: '2026', previous_period: '2025' },
  { name: 'Prices', latest: 3, country: 'GBR', unit: '%', period: '2026' }] };

test('storage uses deterministic rendering without model credentials or network', async () => {
  const calls = [];
  const read = async (sql, params) => { calls.push({sql, params}); return { rows: [] }; };
  const result = await narrate({ scope: 'test', grounding, read, instruction: 'Invent a forecast of 99%' });
  assert.equal(result.body, typedNarration(grounding).body);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].params[5], 'deterministic:typed-facts');
  assert.equal(calls[1].params[6], PROMPT_VERSION);
  assert.equal(JSON.parse(calls[1].params[3]).facts.length, 2);
});
test('read boundary rejects poisoned cached prose and writes a safe replacement', async () => {
  const cached = typedNarration(grounding);
  let writes = 0;
  const read = async sql => sql.startsWith('SELECT')
    ? { rows: [{ ...cached, body: cached.body.replace('GBR', 'USA') }] }
    : (writes++, { rows: [] });
  const result = await narrate({ scope: 'test', grounding, read });
  assert.equal(result.cached, false);
  assert.equal(writes, 1);
  assert.equal(result.body, cached.body);
});
test('valid cache is read-only; an explicit new selection bypasses the old choice', async () => {
  const cached = typedNarration(grounding), calls = [];
  const read = async (sql, params) => { calls.push({sql, params}); return { rows: [cached] }; };
  assert.equal((await narrate({ scope: 'test', grounding, read })).cached, true);
  assert.equal(calls.length, 1);
  const selection = {factIds:[narrationFacts(grounding)[1].id]};
  const selected = await narrate({ scope: 'test', grounding, read, selection });
  assert.equal(selected.body, typedNarration(grounding, selection).body);
  assert.equal(calls.length, 2);
  assert.match(calls[1].sql, /INSERT/);
});
test('invalid selection cannot reach storage', async () => {
  let reads = 0;
  await assert.rejects(narrate({ scope: 'test', grounding, selection: {factIds:['fake']},
    read: async () => { reads++; return {rows:[]}; } }), /Unknown/);
  assert.equal(reads, 0);
});
test('geography uses observation or declared default, never infers global from dimension absence', () => {
  const ticker = { name:'Output', latest_value:12, has_country_dim:false, default_country_iso3:'USA' };
  assert.equal(buildLensGrounding({name:'Output'}, [ticker]).series[0].country, 'USA');
  assert.equal(buildLensGrounding({name:'Output'}, [{...ticker, default_country_iso3:null}]).series[0].country, null);
  assert.equal(buildLensGrounding({name:'Output'}, [{...ticker, has_country_dim:true, default_country_iso3:null}]).series[0].comparison_blocked, true);
});
test('full measurement units and unfinished reference periods survive grounding', () => {
  const row = buildLensGrounding({name:'Prices'}, [{name:'Copper', latest_value:12, previous_value:10,
    unit:'USD per metric tonne', unit_symbol:'$', latest_period:'2026-09-01',
    latest_period_end:'2026-09-30', previous_period:'2026-08-01'}], '2026-09-11').series[0];
  assert.equal(row.unit, 'USD per metric tonne');
  assert.equal(row.comparison_blocked, true);
  assert.match(typedNarration({series:[row]}).body, /reference_period_not_complete/);
  assert.doesNotMatch(typedNarration({series:[row]}).body, /higher than/);
});

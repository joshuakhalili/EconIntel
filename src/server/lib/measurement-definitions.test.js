import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measurementDefinition } from './measurement-definitions.js';
test('matched country concepts carry sourced population, estimand and uncertainty', () => {
  const worker = measurementDefinition({ indicator_id: 'wb.SL.GDP.PCAP.EM.KD' });
  assert.match(worker.estimand, /2021 PPP/);
  assert.match(worker.estimand, /not output per hour/);
  assert.match(worker.limitations, /imputed/);
  assert.match(worker.definition_source, /worldbank.org/);
  assert.match(measurementDefinition({ id: 'wb.SL.EMP.TOTL.SP.ZS' }).population, /15/);
});
test('an indicator name or geography never invents a statistical population', () => {
  const unknown = measurementDefinition({ indicator_id: 'unknown', source_url: 'https://example.org' });
  assert.equal(unknown.population, null);
  assert.equal(unknown.estimand, null);
  assert.equal(unknown.definition_status, 'not_verified');
});
test('derived recipes describe counting units without upgrading them to provider verification', () => {
  const clusters = measurementDefinition({ id: 'epoch.gpu_cluster_count' });
  assert.match(clusters.estimand, /first operational/);
  assert.match(clusters.limitations, /not cumulative/);
  assert.equal(clusters.definition_status, 'adapter_recipe_verified');
  assert.match(measurementDefinition({ id: 'derived.sec_ai_mention_rate' }).limitations, /not unique firms/);
});

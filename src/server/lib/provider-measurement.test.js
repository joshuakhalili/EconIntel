import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dbnomicsDefinition, fredDefinition } from './provider-measurement.js';
test('mirror metadata decodes scope without claiming a complete survey population', () => {
  const result = dbnomicsDefinition({ series: { docs: [{ series_name: 'AI use', dimensions: { SIZE: 'GE10' } }] },
    dataset: { dimensions_labels: { SIZE: 'Enterprise size' }, dimensions_values_labels: { SIZE: { GE10: '10 or more persons employed' } } } }, 'OECD/test/example');
  assert.match(result.population, /not a full sampling frame/);
  assert.match(result.population, /10 or more/);
  assert.equal(result.estimand, 'AI use');
  assert.equal(result.definition_status, 'mirror_metadata_verified');
  assert.throws(() => dbnomicsDefinition({}, 'x'), /missing/);
});
test('FRED metadata retains notes but never invents a population', () => {
  const result = fredDefinition({ seriess: [{ id: 'X', title: 'Employment', notes: 'Includes part-time employees.', units: 'Thousands', frequency: 'Monthly' }] }, 'X');
  assert.equal(result.population, null);
  assert.equal(result.provider_notes, 'Includes part-time employees.');
  assert.equal(result.provider_units, 'Thousands');
  assert.throws(() => fredDefinition({ seriess: [] }, 'X'), /missing/);
});

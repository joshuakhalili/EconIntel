import { test } from 'node:test';
import assert from 'node:assert/strict';
import { narrationFacts, validateFactSelection, typedNarration, verifiedNarration } from './narration-facts.js';

const grounding = { series: [{ indicator_id: 'gdp', name: 'Output', country: 'GBR', unit: 'GBP bn',
  latest: 120, previous: 100, period: '2026-06-01', previous_period: '2026-03-01',
  value_status: 'provisional', source_url: 'https://example.org/official' }] };

test('values, country, unit, dates and qualification render from one bound fact', () => {
  const result = typedNarration(grounding);
  assert.match(result.body, /Output — GBR: 120 GBP bn \(2026-06-01; reported value; provider status: provisional\)/);
  assert.match(result.body, /higher than 100 GBP bn \(2026-03-01/);
  assert.equal(verifiedNarration(result, grounding)?.body, result.body);
});
for (const [field, replacement] of [['country','USA'], ['unit','USD bn'], ['period','2025-06-01'],
  ['latest',100], ['previous',120], ['value_status','projected'], ['source_url','https://example.org/other']]) {
  test(`a ${field} swap invalidates the selected fact and cached prose`, () => {
    const prior = typedNarration(grounding);
    const changed = { series: [{ ...grounding.series[0], [field]: replacement }] };
    assert.equal(validateFactSelection(prior.grounding.selection, narrationFacts(changed)).ok, false);
    assert.equal(verifiedNarration(prior, changed), null);
    assert.equal(validateFactSelection({ ...prior.grounding.selection, [field]: replacement }, narrationFacts(grounding)).ok, false);
  });
}
test('a real number attached to a false sentence is rejected at the read boundary', () => {
  const result = typedNarration(grounding);
  assert.equal(verifiedNarration({ ...result, body: result.body.replace('GBR', 'USA') }, grounding), null);
  assert.equal(verifiedNarration({ ...result, body: result.body.replace('higher', 'lower') }, grounding), null);
});
test('null is not zero; a missing period does not invent a comparison', () => {
  assert.equal(typedNarration({ series: [{ name: 'Empty', latest: null }] }), null);
  const result = typedNarration({ series: [{ name: 'Zero', latest: 0, previous: 1 }] });
  assert.match(result.body, /0 unit not recorded \(period not recorded/);
  assert.doesNotMatch(result.body, /lower than/);
});
test('breaks and incompatible geography withhold comparisons', () => {
  for (const change of [{ value_status: 'OBSV_STATUS=B (Break in series)' }, { comparison_blocked: true }]) {
    const result = typedNarration({ series: [{ ...grounding.series[0], ...change }] });
    assert.match(result.body, /comparison withheld/);
    assert.doesNotMatch(result.body, /higher than/);
  }
});
test('forecast, unverified outturn and scenario remain explicit', () => {
  for (const [status, label] of [['projected','projection, not a measurement'], ['projected;status_unverified','outturn unverified']]) {
    assert.ok(typedNarration({ series: [{ ...grounding.series[0], value_status: status }] }).body.includes(label));
  }
  assert.match(typedNarration({ ...grounding, scenario: 'Policy experiment' }).body, /model scenario, not an observed outcome/);
});
test('selection accepts IDs only, without duplicate or unbounded paragraphs', () => {
  const facts = narrationFacts(grounding), id = facts[0].id;
  for (const selection of [null, {factIds:[]}, {factIds:[id,id]}, {factIds:['unknown']},
    {factIds:[id],body:'120 countries'}, {factIds:[{id}]}, {factIds:[id,id,id]}]) {
    assert.equal(validateFactSelection(selection, facts).ok, false);
  }
});

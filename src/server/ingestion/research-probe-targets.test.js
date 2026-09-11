import {test} from 'node:test';
import assert from 'node:assert/strict';
import {citationProbeTargets} from './research-probe-targets.js';

test('missing or malformed checkpoint fails before either provider request', () => {
  for (const checkpoint of [undefined, {}, {references:['W123']}, {references:['W123'],seeds:['undefined']}, {references:['https://untrusted.test/W123'],seeds:['W456']}]) {
    let requests = 0;
    assert.throws(() => {for (const target of citationProbeTargets(checkpoint)) requests++;}, /no provider requests sent/);
    assert.equal(requests, 0);
  }
});
test('valid checkpoint produces the two bounded citation filter contracts', () => {
  assert.deepEqual(citationProbeTargets({references:['https://openalex.org/W123'],seeds:['W456']}),
    [['references','openalex:W123'],['cited-by','cites:W456']]);
});

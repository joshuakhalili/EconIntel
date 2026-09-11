import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateClaim } from './research-validation.js';
import { reviewLabel } from '../../client/lib/reviewLabel.js';

const source = { id:'e', claim_id:'c', source_url:'https://example.org/paper', source_title:'Study',
  source_version:'2026 working paper', locator:'Table 2', finding:'An association', method:'Panel model',
  limitations:'Selection remains possible', relevance:'Measures the outcome in this population',
  access_basis:'full_text', publication_stage:'working_paper', relationship:'supports' };
const claim = { id:'c', question_id:'jobs', statement:'Employment differs by exposure', claim_type:'descriptive',
  verdict:'qualified', geography:'USA', period:'2024–2026', limitations:'Not a causal estimate',
  change_trigger:'New estimates controlling for selection', evidence:[source] };

test('complete qualified evidence passes without inventing a review', () => {
  assert.deepEqual(validateClaim(claim), []);
});
test('missing source linkage, version and locator fail', () => {
  assert.ok(validateClaim({...claim, evidence:[]}).some(e=>e.includes('no source')));
  const errors=validateClaim({...claim,evidence:[{...source,source_version:'',locator:''}]});
  assert.equal(errors.length,2);
});
test('metadata cannot justify supported verdict and abstract cannot justify causal claim', () => {
  assert.ok(validateClaim({...claim,verdict:'supported',evidence:[{...source,access_basis:'metadata'}]}).some(e=>e.includes('substantive')));
  assert.ok(validateClaim({...claim,claim_type:'causal',evidence:[{...source,access_basis:'abstract'}]}).some(e=>e.includes('full-text')));
});
test('cross-claim evidence, unsafe links and changed reviews fail', () => {
  const errors=validateClaim({...claim,review_status:'stale',evidence:[{...source,claim_id:'other',source_url:'javascript:alert(1)'}]});
  assert.equal(errors.length,3);
});
test('legacy and agent reviews never imply a human check', () => {
  assert.match(reviewLabel('reviewed',null),/reviewer not recorded/);
  assert.match(reviewLabel('reviewed','agent'),/no human review recorded/);
  assert.match(reviewLabel('reviewed','human'),/Checked by a person/);
  assert.match(reviewLabel('extracted','human'),/verification pending/);
});
test('structured estimates require units and explicit uncertainty/geography shapes',()=>{
  const errors=evidence=>validateClaim({...claim,evidence:[{...source,...evidence}]});
  assert.ok(errors({estimate:15}).some(e=>e.includes('explicit unit')));
  assert.ok(errors({estimate:'not numeric',estimate_unit:'percent'}).some(e=>e.includes('explicit unit')));
  assert.ok(errors({uncertainty:{lower:5,upper:2}}).some(e=>e.includes('reversed')));
  assert.ok(errors({geography_studied:'US'}).some(e=>e.includes('geography')));
  assert.deepEqual(errors({estimate:19,estimate_unit:'percent longer completion time',uncertainty:{kind:'not_reported'},geography_studied:null}),[]);
});

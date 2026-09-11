import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderSourceRefreshes} from './research-bootstrap-policy.js';
test('backdated higher-ID import cannot supersede a more recent source check',()=>{
  const newer={id:'2',checked_at:'2026-09-11T01:00:00Z',status:'inaccessible'};
  const backdated={id:'999',checked_at:'2026-09-10T01:00:00Z',status:'unchanged'};
  const original=[newer,backdated];
  const ordered=orderSourceRefreshes(original);
  assert.deepEqual(ordered,[backdated,newer]);assert.equal(ordered.at(-1).status,'inaccessible');
  assert.deepEqual(original,[newer,backdated]);
});
test('same-time checks retain numeric sequence order without lossy integer conversion',()=>{
  const events=[{id:'9007199254740993',checked_at:'2026-09-11'},{id:'9007199254740992',checked_at:'2026-09-11'}];
  assert.equal(orderSourceRefreshes(events).at(-1).id,'9007199254740993');
  assert.throws(()=>orderSourceRefreshes([{id:'1',checked_at:'not a date'}]),/ordering identity/);
});

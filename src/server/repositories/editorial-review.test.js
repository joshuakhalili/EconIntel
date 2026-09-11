import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateEditorialReview} from './editorial-review.js';
const ledger=JSON.parse(await readFile(new URL('../../../docs/research/editorial-review-ledger.json',import.meta.url),'utf8'));
const snapshot=JSON.parse(await readFile(new URL('../../../docs/research/editorial-review-snapshot.json',import.meta.url),'utf8'));
test('question reader live binding includes scoped ticker explanations and invalidates their changes',()=>{
  const q=snapshot.questions[0];
  const lensId=ledger.tickers[0].lens_id;
  const input={question:{...q,lens_id:lensId},figures:snapshot.figures.filter(f=>f.question_id===q.id||f.lens_id===lensId),
    lenses:snapshot.lenses.filter(l=>l.id===lensId),lensReadings:snapshot.lens_readings.filter(r=>r.lens_id===lensId),tickers:snapshot.tickers.filter(t=>t.lens_id===lensId)};
  const current=evaluateEditorialReview(input,ledger);
  assert.equal(current.status,'current_agent_disposition');assert.ok(current.tickers.length);
  const changed=structuredClone(input);changed.tickers[0].why+=' Changed justification.';
  const stale=evaluateEditorialReview(changed,ledger);
  assert.equal(stale.status,'stale');assert.ok(stale.gate.issues.some(i=>i.kind==='changed_ticker'));
});

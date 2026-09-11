import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkEditorialCompleteness} from './editorial-completeness.js';
const snapshot=JSON.parse(fs.readFileSync(new URL('../../../docs/research/editorial-review-snapshot.json',import.meta.url)));
const ledger=JSON.parse(fs.readFileSync(new URL('../../../docs/research/editorial-review-ledger.json',import.meta.url)));
// These deliberate same-count mutations prove that counts alone cannot pass.
test('complete checked-in editorial bindings pass without promoting truth',()=>{const r=checkEditorialCompleteness(snapshot,ledger);assert.equal(r.ok,true);assert.equal(r.counts.questions,40);assert.equal(r.counts.report_points,422);assert.match(r.meaning,/not human/);});
for(const [name,change] of [
 ['question text',s=>s.questions[0].answer_plain+=' Unsupported effect.'],
 ['point value',s=>s.figures[0].points[0].value+=1],
 ['point label',s=>s.figures[0].points[0].label+=' changed'],
 ['point qualifier',s=>s.figures[0].points[0].value_note='new qualifier'],
 ['figure source URL',s=>s.figures[0].source_url='https://example.org/different'],
 ['lens thesis',s=>s.lenses[0].thesis_plain+=' AI causes everything.'],
 ['reading takeaway',s=>s.lens_readings[0].takeaway='changed'],
 ['ticker explanation',s=>s.tickers[0].why='Unsupported claim'],
 ['activation state',s=>s.questions[0].is_active=!s.questions[0].is_active]
])test('rejects changed '+name,()=>{const s=structuredClone(snapshot);change(s);assert.equal(checkEditorialCompleteness(s,ledger).ok,false);});
test('rejects missing atomic span even with an unchanged field hash',()=>{const l=structuredClone(ledger);l.questions[0].fields[0].spans.splice(0,1);assert.equal(checkEditorialCompleteness(snapshot,l).ok,false);});
test('rejects report source hash mismatch',()=>{const l=structuredClone(ledger);l.report_points[0].source_pdf_sha256='0'.repeat(64);assert.equal(checkEditorialCompleteness(snapshot,l).ok,false);});
test('rejects missing hashes on both sides',()=>{const l=structuredClone(ledger);delete l.report_points[0].source_pdf_sha256;delete l.sources.find(s=>s.id===l.report_points[0].source_id).pdf_sha256;assert.equal(checkEditorialCompleteness(snapshot,l).ok,false);});
test('rejects duplicate source IDs',()=>{const l=structuredClone(ledger);l.sources.push(l.sources[0]);assert.equal(checkEditorialCompleteness(snapshot,l).ok,false);});
test('rejects a changed source transcription on a qualified point',()=>{const l=structuredClone(ledger);l.report_points.find(p=>p.disposition==='qualified_report').source_value+=1;assert.equal(checkEditorialCompleteness(snapshot,l).ok,false);});
test('rejects missing point and unresolved without documented attempt',()=>{let l=structuredClone(ledger);l.report_points.pop();assert.equal(checkEditorialCompleteness(snapshot,l).ok,false);l=structuredClone(ledger);l.report_points[0].disposition='unresolved';l.report_points[0].attempts=[];assert.equal(checkEditorialCompleteness(snapshot,l).ok,false);});

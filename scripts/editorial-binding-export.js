import fs from 'node:fs';
import {editorialHash,pointBinding,figureBinding,readingBinding} from '../src/server/lib/editorial-completeness.js';
const s=JSON.parse(fs.readFileSync('docs/research/editorial-review-snapshot.json'));
const seg=new Intl.Segmenter('en',{granularity:'sentence'});
function fields(o,keys){return keys.map(field=>{const t=o[field]??'';const spans=[];for(const x of seg.segment(t)){const chunks=x.segment.matchAll(/[^;]+;?/g);for(const c of chunks){const exact_text=c[0].trim();if(exact_text){const start=x.index+c.index+c[0].indexOf(exact_text);spans.push({start,end:start+exact_text.length,exact_text,content_sha256:editorialHash(exact_text)});}}}return {field,content_sha256:editorialHash(t),spans};});}
const kind=process.argv[2],start=Number(process.argv[3]??0);
const data=kind==='questions'?s.questions.slice(start,start+10).map(q=>({question_id:q.id,is_active:q.is_active,fields:fields(q,['answer_plain','answer_expert','theory','method','caveat'])})):kind==='lenses'?s.lenses.map(l=>({lens_id:l.id,is_active:l.is_active,fields:fields(l,['subtitle','thesis_plain','thesis_expert'])})):kind==='points'?s.figures.slice(start,start+14).flatMap(f=>f.points.map(p=>({...pointBinding(f.id,p),binding_sha256:editorialHash(pointBinding(f.id,p)),figure_sha256:editorialHash(figureBinding(f))}))):s.lens_readings.map(r=>({lens_id:r.lens_id,url:r.url,content_sha256:editorialHash(readingBinding(r))}));
console.log('RESULT'+JSON.stringify(data));

import { createHash } from 'node:crypto';

export const EDITORIAL_FIELDS = ['answer_plain','answer_expert','theory','method','caveat'];
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export const editorialHash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex');
export const pointBinding = (figureId, point) => ({ figure_id: figureId, series: point.series ?? '', label: point.label,
  value: point.value == null ? null : Number(point.value), basis: point.basis ?? null, value_note: point.value_note ?? null });
export const pointKey = p => JSON.stringify([p.figure_id,p.series ?? '',p.label]);
export const figureBinding = f => ({...Object.fromEntries(['id','question_id','lens_id','publisher','source_title','source_url','published','title','subtitle','unit','unit_symbol','decimals','axis_kind','note','page_ref'].map(k=>[k,f[k]??null])),quote_sha256:f.quote_sha256??editorialHash(f.quote??'')});
export const readingBinding = r => Object.fromEntries(['lens_id','question_id','title','publisher','published','url','kind','stance','takeaway','takeaway_ref','takeaway_source','review_actor'].map(k=>[k,r[k]??null]));

// This is a binding/completeness gate, not a truth oracle. An explicit unresolved
// disposition is assessed coverage, never verified evidence or a human review.
export function checkEditorialCompleteness(snapshot, ledger) {
  const issues=[];
  const fail=(kind,id)=>issues.push({kind,id});
  if (ledger?.schema_version !== 1 || ledger?.review_actor !== 'agent') fail('invalid_ledger','header');
  const sourceMap=new Map((ledger.sources??[]).map(s=>[s.id,s]));
  if(sourceMap.size!==(ledger.sources??[]).length)fail('duplicate_source','ledger');
  const reviewMap=new Map((ledger.questions??[]).map(q=>[q.question_id,q]));
  if(reviewMap.size!==(ledger.questions??[]).length) fail('duplicate_question','ledger');
  const currentIds=new Set(snapshot.questions.map(q=>q.id));
  for(const id of reviewMap.keys()) if(!currentIds.has(id)) fail('extra_question',id);
  let spans=0;
  for(const q of snapshot.questions) {
    const review=reviewMap.get(q.id);
    if(!review) {fail('missing_question',q.id);continue;}
    if(review.is_active!==q.is_active)fail('changed_activation',q.id);
    if(review.fields.length!==EDITORIAL_FIELDS.length)fail('field_count',q.id);
    for(const field of EDITORIAL_FIELDS) {
      const text=q[field]??'';
      const matches=review.fields.filter(f=>f.field===field);
      const reviewed=matches[0];
      if(matches.length!==1) {fail('missing_or_duplicate_field',`${q.id}.${field}`);continue;}
      if(reviewed.content_sha256!==editorialHash(text))fail('changed_field',`${q.id}.${field}`);
      let end=0;
      for(const span of [...reviewed.spans].sort((a,b)=>a.start-b.start)) {
        spans++;
        if(!Number.isInteger(span.start)||!Number.isInteger(span.end)||span.start<end||span.end<=span.start||span.end>text.length)fail('invalid_span',span.id);
        if(text.slice(end,span.start).trim())fail('uncovered_text',`${q.id}.${field}:${end}`);
        if(span.exact_text!==text.slice(span.start,span.end)||span.content_sha256!==editorialHash(span.exact_text))fail('changed_span',span.id);
        if(!span.assessment?.trim()||!span.limitations?.trim()||!['qualified','supported','unresolved','not_empirical'].includes(span.verdict))fail('missing_assessment',span.id);
        if(!span.source_ids?.length||span.source_ids.some(id=>!sourceMap.has(id)))fail('missing_source_binding',span.id);
        if(span.verdict==='unresolved'&&!span.attempts?.length)fail('unresolved_without_attempt',span.id);
        end=span.end;
      }
      if(text.slice(end).trim())fail('uncovered_text',`${q.id}.${field}:${end}`);
    }
  }
  const points=new Map((ledger.report_points??[]).map(p=>[pointKey(p),p]));
  if(points.size!==(ledger.report_points??[]).length)fail('duplicate_point','ledger');
  const seen=new Set();
  for(const f of snapshot.figures) for(const p of f.points??[]) {
    const binding=pointBinding(f.id,p),key=pointKey(binding),r=points.get(key);seen.add(key);
    if(!r){fail('missing_point',key);continue;}
    if(r.binding_sha256!==editorialHash(binding)||editorialHash(pointBinding(r.figure_id,r))!==editorialHash(binding))fail('changed_point',key);
    if(r.figure_sha256!==editorialHash(figureBinding(f)))fail('changed_figure',key);
    const source=sourceMap.get(r.source_id);
    if(!source||!(/^[a-f0-9]{64}$/i.test(source.pdf_sha256??''))||!(/^[a-f0-9]{64}$/i.test(r.source_pdf_sha256??''))||source.pdf_sha256!==r.source_pdf_sha256||!r.locator?.trim())fail('changed_or_missing_source',key);
    if(!r.assessment?.trim()||!r.limitations?.trim()||!['matched_report','qualified_report','corrected','unresolved'].includes(r.disposition))fail('missing_point_assessment',key);
    if(r.disposition==='unresolved'&&!r.attempts?.length)fail('unresolved_without_attempt',key);
    if(['matched_report','qualified_report'].includes(r.disposition)&&r.source_value!==binding.value)fail('source_value_mismatch',key);
    if(binding.value===null&&!binding.value_note)fail('missing_qualitative_finding',key);
  }
  for(const key of points.keys())if(!seen.has(key))fail('extra_point',key);
  // Lens prose is a separate editorial surface, not implicitly certified by
  // the question records. Reuse the same exact-span validation with its fields
  // represented in a local five-field adapter; no duplicate report checking.
  if(snapshot.lenses) {
    const lensSnapshot={questions:snapshot.lenses.map(l=>({id:l.id,is_active:l.is_active,
      answer_plain:l.thesis_plain,answer_expert:l.thesis_expert,theory:l.subtitle,method:'',caveat:''})),figures:[]};
    const lensLedger={schema_version:1,review_actor:'agent',sources:ledger.sources,
      questions:(ledger.lenses??[]).map(l=>({question_id:l.lens_id,is_active:l.is_active,
        fields:[...l.fields.map(f=>({...f,field:({thesis_plain:'answer_plain',thesis_expert:'answer_expert',subtitle:'theory'})[f.field]})),
          {field:'method',content_sha256:editorialHash(''),spans:[]},{field:'caveat',content_sha256:editorialHash(''),spans:[]}]})),report_points:[]};
    const lensResult=checkEditorialCompleteness(lensSnapshot,lensLedger);
    for(const issue of lensResult.issues)fail(`lens_${issue.kind}`,issue.id);
  }
  if(snapshot.lens_readings) {
    const reviews=new Map((ledger.lens_readings??[]).map(r=>[JSON.stringify([r.lens_id,r.url]),r]));
    if(reviews.size!==(ledger.lens_readings??[]).length)fail('duplicate_reading','lens');
    for(const r of snapshot.lens_readings) {
      const key=JSON.stringify([r.lens_id,r.url]),review=reviews.get(key);
      if(!review) {fail('missing_reading',key);continue;}
      if(review.content_sha256!==editorialHash(readingBinding(r)))fail('changed_reading',key);
      if(!review.assessment?.trim()||!review.source_ids?.length||review.source_ids.some(id=>!sourceMap.has(id)))fail('unassessed_reading',key);
      reviews.delete(key);
    }
    for(const key of reviews.keys())fail('extra_reading',key);
  }
  if(snapshot.tickers) {
    const reviews=new Map((ledger.tickers??[]).map(t=>[JSON.stringify([t.lens_id,t.indicator_id]),t]));
    if(reviews.size!==(ledger.tickers??[]).length)fail('duplicate_ticker','ledger');
    for(const t of snapshot.tickers) {
      const key=JSON.stringify([t.lens_id,t.indicator_id]),r=reviews.get(key);
      if(!r){fail('missing_ticker',key);continue;}
      if(r.content_sha256!==editorialHash({lens_id:t.lens_id,indicator_id:t.indicator_id,label:t.label,why:t.why}))fail('changed_ticker',key);
      if(!r.assessment?.trim()||!r.source_ids?.length||r.source_ids.some(id=>!sourceMap.has(id)))fail('unassessed_ticker',key);
      reviews.delete(key);
    }
    for(const key of reviews.keys())fail('extra_ticker',key);
  }
  return {ok:issues.length===0,issues,counts:{questions:snapshot.questions.length,fields:snapshot.questions.length*EDITORIAL_FIELDS.length,
    atomic_spans:spans,report_points:seen.size,unresolved_spans:(ledger.questions??[]).flatMap(q=>q.fields.flatMap(f=>f.spans)).filter(s=>s.verdict==='unresolved').length,
    unresolved_points:(ledger.report_points??[]).filter(p=>p.disposition==='unresolved').length,
    lenses:snapshot.lenses?.length??0,lens_readings:snapshot.lens_readings?.length??0,tickers:snapshot.tickers?.length??0},
    meaning:'Agent disposition coverage and exact current-content binding; not human review or independent replication.'};
}

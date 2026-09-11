import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

const STATUS = {
  draft: 'Evidence review draft', stale: 'Review needs updating: the argument or sources changed',
  agent_checked: 'Evidence checked by an AI agent; no human review recorded',
  human_reviewed: 'Evidence reviewed by a person',
};

/** Claim-level evidence stays attached to the argument it actually bears on. */
export default function ResearchReview({ claims }) {
  const {slug}=useParams();
  const request=useQuery({queryKey:['research-workflow',slug],enabled:Boolean(slug),
    queryFn:async({signal})=>{const response=await fetch(`/api/questions/${encodeURIComponent(slug)}/research-workflow`,{signal});if(!response.ok)throw new Error('Research workflow unavailable');return response.json();}});
  // An additive deployment can temporarily pair this client with an older API.
  // Missing new review fields mean unavailable, never reviewed or an empty audit.
  const workflow={...request,data:request.data?{review_queue:[],candidates:[],source_refreshes:[],runs:[],
    corpus_benchmark:{found:'unknown',denominator:'unknown',selection:'Benchmark unavailable from this server version.'},
    ...request.data,granular_review:request.data.granular_review??{status:'unavailable',note:'Granular review unavailable from this server version; no completed review is implied.'}}:null};
  if (!claims?.length) return null;
  return <section className="mt-10">
    <details>
    <summary className="cursor-pointer text-body-medium text-text-primary">The argument and its evidence — {claims.length} claim records</summary>
    <p className="mt-2 text-body-regular text-text-secondary">Inspect the reasoning, source access and review status behind this answer. A linked source or draft record is not a completed verification.</p>
    {claims.map(claim => <article key={claim.id} className="mt-4 rounded-2xl border border-border-button-default p-4">
      <h2 className="text-body-medium text-text-primary">{claim.statement}</h2>
      <p className="mt-2 text-caption-1-regular text-text-tertiary">
        {claim.verdict} · {claim.claim_type} · {claim.geography} · {claim.period}
      </p>
      <p className="mt-2 text-caption-1-medium text-text-secondary">{STATUS[claim.review_status] ?? STATUS.draft}</p>
      <p className="prose-measure mt-3 text-body-regular text-text-secondary">{claim.limitations}</p>
      <p className="prose-measure mt-2 text-body-regular text-text-secondary">What would change this conclusion: {claim.change_trigger}</p>
      <details className="mt-3 text-body-regular text-text-secondary">
        <summary className="cursor-pointer">Inspect the evidence ({claim.evidence?.length ?? 0} sources)</summary>
        {!claim.evidence?.length && <p className="mt-2">No source has been linked to this claim yet.</p>}
        {(claim.evidence ?? []).map(e => <div key={e.id} className="mt-4 border-t border-border-button-default pt-3">
          <a className="underline" href={e.source_url} target="_blank" rel="noopener noreferrer">{e.source_title}</a>
          <p className="mt-1 text-caption-1-regular text-text-tertiary">{e.source_version} · {e.locator} · {e.access_basis.replaceAll('_', ' ')} · {e.publication_stage.replaceAll('_', ' ')}</p>
          <p className="prose-measure mt-2">{e.finding}</p>
          <p className="prose-measure mt-2">Method: {e.method}</p>
          <p className="prose-measure mt-2">Relevance ({e.relationship}): {e.relevance}</p>
          <p className="prose-measure mt-2">Limits: {e.limitations}</p>
          <dl className="mt-2 text-caption-1-regular">
            {['sample','exposure','outcome','identification','study_period','estimate_unit'].map(field=><div key={field}><dt>{field.replaceAll('_',' ')}</dt><dd>{e[field]??'Not assessed'}</dd></div>)}
            <dt>Estimate</dt><dd>{e.estimate??'Not assessed'}</dd>
            <dt>Uncertainty</dt><dd>{e.uncertainty?JSON.stringify(e.uncertainty):'Not assessed; absence is not precision'}</dd>
            <dt>Geography studied</dt><dd>{e.geography_studied?.join(', ')??'Not assessed; not inferred from author affiliation'}</dd>
            <dt>Bound study version</dt><dd>{e.study_version?.version_label??'No discovery version linked'}</dd>
          </dl>
        </div>)}
      </details>
    </article>)}
    <h2 className="mt-6 text-body-medium">Research discovery and review worklist</h2>
    {workflow.isPending&&<p>Loading research workflow…</p>}
    {workflow.isError&&<p>Research workflow could not be loaded. Its absence is not a completed review.</p>}
    {workflow.data&&<>
      <p className="mt-2 text-caption-1-regular">{workflow.data.note}</p>
      <p className="mt-2">{workflow.data.review_queue.length} claim reviews need action; {workflow.data.candidates.length} candidate study families displayed (up to 100).</p>
      <p className="mt-2 text-caption-1-regular">Targeted-corpus sentinel recall: {workflow.data.corpus_benchmark.found}/{workflow.data.corpus_benchmark.denominator}. {workflow.data.corpus_benchmark.selection}</p>
      <details className="mt-3"><summary>Every argumentative span and report point</summary>
        <p className="mt-2">{workflow.data.granular_review.status.replaceAll('_',' ')} — {workflow.data.granular_review.gate?.meaning??workflow.data.granular_review.note}</p>
        {workflow.data.granular_review.gate?.issues.map((issue,i)=><p key={i}>{issue.kind}: {issue.id}</p>)}
        {workflow.data.granular_review.questions?.flatMap(q=>q.fields).map(field=><div key={field.field} className="mt-4"><h3>{field.field.replaceAll('_',' ')}</h3>{field.spans.map(span=><div key={span.id} className="mt-3"><p>{span.exact_text}</p><p>{span.verdict}: {span.assessment}</p><p>Limits: {span.limitations}</p><p>Sources: {span.source_ids.join(', ')}</p></div>)}</div>)}
        {workflow.data.granular_review.report_points?.map(point=><div key={`${point.figure_id}:${point.series}:${point.label}`} className="mt-3"><p>{point.label}: {point.value??point.value_note} — {point.disposition}</p><p>{point.assessment}</p><p>{point.locator} · {point.limitations}</p></div>)}
        {workflow.data.granular_review.sources?.map(source=><p key={source.id} className="mt-2"><a className="underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.id}: {source.title}</a> · {source.version} · {source.locator}</p>)}
        {workflow.data.granular_review.lenses?.flatMap(l=>l.fields).map(field=><div key={`lens:${field.field}`} className="mt-4"><h3>Lens {field.field.replaceAll('_',' ')}</h3>{field.spans.map(span=><div key={span.id} className="mt-3"><p>{span.exact_text}</p><p>{span.verdict}: {span.assessment}</p><p>Limits: {span.limitations}</p><p>Sources: {span.source_ids.join(', ')}</p></div>)}</div>)}
        {workflow.data.granular_review.lens_readings?.map(reading=><div key={reading.url} className="mt-3"><p>Lens reading: {reading.title??reading.url}</p><p>{reading.assessment}</p><p>{reading.limitations}</p></div>)}
        {workflow.data.granular_review.tickers?.map(ticker=><div key={ticker.indicator_id} className="mt-3"><p>Ticker: {ticker.indicator_id}</p><p>{ticker.assessment}</p><p>{ticker.limitations}</p></div>)}
      </details>
      <details className="mt-2"><summary>Review queue and source refresh</summary>
        {workflow.data.review_queue.map(row=><p key={row.claim_id} className="mt-2">{row.reason}: {row.statement} — {row.next_action}</p>)}
        {workflow.data.source_refreshes.filter(row=>row.next_action).map(row=><p key={row.evidence_id} className="mt-2"><a className="underline" href={row.source_url} target="_blank" rel="noopener noreferrer">{row.evidence_id}</a>: {row.status??'Never refreshed'} — {row.next_action}</p>)}
      </details>
      <details className="mt-2"><summary>Search runs and provider budget</summary>
        {!workflow.data.runs.length&&<p>No targeted discovery run recorded yet.</p>}
        {workflow.data.runs.map(run=><div key={run.id} className="mt-2"><p>{run.status} · {run.started_at}</p>{run.provider_usage.import_provenance&&<p>Imported staging verification run; these were not production API requests.</p>}<p>Attempts: {run.provider_usage.attempts??'unknown'}; provider-reported cost: ${run.provider_usage.cost_usd??'unknown'}; requests without USD telemetry: {run.provider_usage.cost_unreported??'unknown'}.</p><p>{run.plan.queries.map(q=>q.search).join(' / ')}</p></div>)}
      </details>
      <details className="mt-2"><summary>Candidate studies, not approved claims</summary>
        {workflow.data.candidates.map(family=><div key={family.family_id} className="mt-3"><h3>{family.canonical_title}</h3>{family.versions.map(v=><p key={v.id}><a className="underline" href={v.url} target="_blank" rel="noopener noreferrer">{v.version}</a> · discovered via {v.routes.join(', ')} · author affiliations: {v.affiliation_countries.join(', ')||'unavailable'}; study geography unassessed.</p>)}</div>)}
      </details>
    </>}
    </details>
  </section>;
}

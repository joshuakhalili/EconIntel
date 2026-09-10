const STATUS = {
  draft: 'Evidence review draft', stale: 'Review needs updating: the argument or sources changed',
  agent_checked: 'Evidence checked by an AI agent; no human review recorded',
  human_reviewed: 'Evidence reviewed by a person',
};

/** Claim-level evidence stays attached to the argument it actually bears on. */
export default function ResearchReview({ claims }) {
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
        </div>)}
      </details>
    </article>)}
    </details>
  </section>;
}

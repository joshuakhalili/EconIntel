/** Structural and editorial checks are not a claim that a paper is true. */
export function validateClaim(claim) {
  const errors = [];
  for (const key of ['id','question_id','statement','geography','period','limitations','change_trigger']) {
    if (typeof claim[key] !== 'string' || !claim[key].trim()) errors.push(`${key}: required`);
  }
  for (const [key, choices] of Object.entries({
    claim_type: ['descriptive','causal','forecast','mechanism'],
    verdict: ['supported','qualified','contested','unresolved'],
  })) if (!choices.includes(claim[key])) errors.push(`${key}: invalid`);
  const evidence = Array.isArray(claim.evidence) ? claim.evidence : [];
  if (!evidence.length) errors.push('evidence: no source linked');
  const ids = new Set();
  for (const e of evidence) {
    if (ids.has(e.id)) errors.push(`evidence ${e.id}: duplicate`);
    ids.add(e.id);
    for (const key of ['id','source_title','source_version','locator','finding','method','limitations','relevance']) {
      if (typeof e[key] !== 'string' || !e[key].trim()) errors.push(`evidence ${e.id}: ${key} required`);
    }
    try { if (new URL(e.source_url).protocol !== 'https:') throw new Error(); }
    catch { errors.push(`evidence ${e.id}: HTTPS source required`); }
    if (!['full_text','abstract','metadata'].includes(e.access_basis)) errors.push(`evidence ${e.id}: access_basis invalid`);
    if (!['supports','challenges','context','mixed'].includes(e.relationship)) errors.push(`evidence ${e.id}: relationship invalid`);
    if (!['published','working_paper','report','official_data'].includes(e.publication_stage)) errors.push(`evidence ${e.id}: publication_stage invalid`);
    if (e.claim_id && e.claim_id !== claim.id) errors.push(`evidence ${e.id}: wrong claim`);
  }
  if (claim.verdict === 'supported' && !evidence.some(e => e.relationship === 'supports' && e.access_basis !== 'metadata')) {
    errors.push('supported verdict needs substantive supporting evidence');
  }
  if (claim.claim_type === 'causal' && !evidence.some(e => e.access_basis === 'full_text' && ['supports','mixed'].includes(e.relationship))) {
    errors.push('causal claim needs full-text methodological review');
  }
  if (claim.review_status === 'stale') errors.push('review: source or editorial content changed');
  return errors;
}

/** Validate both checkpoint lanes before any diagnostic request consumes budget. */
export function citationProbeTargets(checkpoint) {
  const workId = value => typeof value === 'string'
    ? /^(?:https:\/\/openalex\.org\/)?(W\d+)$/.exec(value)?.[1] : null;
  const reference = workId(checkpoint?.references?.[0]);
  const seed = workId(checkpoint?.seeds?.[0]);
  if (!reference || !seed) throw new Error('Citation probe requires a valid discovery checkpoint with both reference and seed OpenAlex work IDs; no provider requests sent');
  return [['references', `openalex:${reference}`], ['cited-by', `cites:${seed}`]];
}

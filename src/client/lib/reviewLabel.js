/** Legacy flags do not identify the reviewer. Never infer a human from one. */
export function reviewLabel(status, actor) {
  if (status !== 'reviewed') return 'Extracted from the source; verification pending';
  if (actor === 'human') return 'Checked by a person against the source';
  if (actor === 'agent') return 'Checked by an AI agent against the source; no human review recorded';
  return 'Previously marked reviewed; reviewer not recorded';
}

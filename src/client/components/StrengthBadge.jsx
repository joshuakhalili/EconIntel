/**
 * How far the evidence on a page can be pushed.
 *
 * Shared by the question page and the lens listing so the two cannot drift
 * into describing the same value differently — the wording here IS the
 * definition a reader gets, and two versions of it would be two claims.
 *
 * `insufficient` is deliberately not styled as an error. On this subject it is
 * frequently the honest answer, and a page that cannot say so ends up implying
 * more than it found.
 */
export const STRENGTH = {
  insufficient: {
    label: 'Evidence insufficient',
    detail: 'The data cannot answer this yet. Saying so is the finding.',
    tone: 'border-warn/40 text-warn',
  },
  suggestive: {
    label: 'Suggestive',
    detail: 'Early signs, from too few measures or too short a series to lean on.',
    tone: 'border-border-button-default text-text-secondary',
  },
  consistent: {
    label: 'Consistent',
    detail: 'Several independent measures point the same way.',
    tone: 'border-pos/40 text-pos',
  },
  contested: {
    label: 'Contested',
    detail: 'Credible sources disagree. The disagreement is the finding.',
    tone: 'border-warn/40 text-warn',
  },
};

export default function StrengthBadge({ strength }) {
  const meta = STRENGTH[strength];
  if (!meta) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-caption-1-medium ${meta.tone}`}
      title={meta.detail}
    >
      {meta.label}
    </span>
  );
}

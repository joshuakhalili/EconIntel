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

/**
 * @param {object} props
 * @param {string} props.strength
 * @param {'default'|'onFill'} [props.variant]
 *
 * `onFill` is for the electric-blue question card, where the coloured tones
 * above are unusable: on that fill `text-pos` measures 2.29:1, `text-warn`
 * 3.03:1 and `text-neg` 1.68:1, and the reflex repair — a `bg-white/15` pill —
 * drops the white label to 3.88:1. So on the fill the badge is transparent
 * with a white border and a white label.
 *
 * Nothing is lost by that. The strength was always carried by the WORD —
 * "Contested", "Consistent", "Evidence insufficient" — and the colour was
 * doing redundant work. On a site whose chart palette notes warn against
 * hue-only encoding, dropping it here is more consistent, not less.
 */
export default function StrengthBadge({ strength, variant = 'default' }) {
  const meta = STRENGTH[strength];
  if (!meta) return null;

  const tone = variant === 'onFill' ? 'border-white/50 text-on-fill' : meta.tone;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-caption-1-medium ${tone}`}
      title={meta.detail}
    >
      {meta.label}
    </span>
  );
}

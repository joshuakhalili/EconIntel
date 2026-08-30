import { Link } from 'react-router-dom';
import { RiArrowRightLine } from '@remixicon/react';
import StrengthBadge from '@/components/StrengthBadge';
import { FILL, FILL_HOVER } from '@/lib/lensAccent';

/**
 * A question, as the thing you click.
 *
 * Filled, not outlined. Everything else on this site sits on near-black, so a
 * painted card is the one element that cannot be scrolled past — which is
 * right, because the questions are what the site is for.
 *
 * THE FILL IS THE SAME ON EVERY LENS, AND THE RING IS NOT
 *
 * The obvious design is to paint each lens's cards in its own colour. It
 * cannot be built: white text on the five lens accents measures 2.52, 1.48,
 * 1.52, 2.30 and 2.85 to one, and darkening them until white works collides
 * two of them with the chart palette. The full reasoning is in
 * `lib/lensAccent.js`.
 *
 * So the fill is the electric blue on every lens and the lens hue moves to the
 * border, where it sits against the page rather than under the text.
 *
 * WHAT YOU MAY NOT DO ON THIS CARD
 *
 * White on the fill is 5.03:1. The floor is 4.5. That half-point of headroom
 * is entirely spent, and three things which look harmless will spend it:
 *
 *   `text-white/90`      composites to 4.38:1   FAILS
 *   a `bg-white/10` pill  under white text 4.23:1   FAILS
 *   brightening on hover  #4573ff is 4.08:1     FAILS
 *
 * So there is no dimmed white here — hierarchy comes from size, weight and
 * leading — badges on the fill are transparent with a white border, and hover
 * DEEPENS to #2b59e3, where white rises to 5.77:1. The card gets more legible
 * under the cursor rather than less, which is the opposite of the usual trade.
 * Both hexes are checked by `scripts/check-contrast.js`, so changing one turns
 * the build red instead of turning the card unreadable.
 */
export default function QuestionCard({ question, accent, index = 0 }) {
  return (
    <Link
      to={`/q/${question.slug}`}
      className="lift group relative flex flex-col overflow-hidden rounded-2xl p-6"
      style={{
        background: FILL,
        // The lens's own hue, on the one surface where it is legible.
        boxShadow: `inset 0 0 0 1.5px ${accent.ring}`,
        '--fill-hover': FILL_HOVER,
        '--i': index,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = FILL_HOVER;
        e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${accent.hex}, 0 8px 32px ${accent.glow}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = FILL;
        e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${accent.ring}`;
      }}
    >
      <span className="flex items-start justify-between gap-4">
        <span className="text-title-3-medium leading-snug text-on-fill">{question.question}</span>
        <RiArrowRightLine
          className="mt-1 size-4 shrink-0 text-on-fill transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>

      {question.subtitle && (
        <span className="mt-1 text-caption-1-regular text-on-fill">{question.subtitle}</span>
      )}

      {/* Two lines, not three. The excerpt cannot recede by going grey on this
          surface, so it recedes by being short. */}
      {question.answer_plain && (
        <span className="mt-3 line-clamp-2 text-body-regular leading-relaxed text-on-fill">
          {question.answer_plain}
        </span>
      )}

      <span className="mt-4 flex items-center gap-3">
        <StrengthBadge strength={question.strength} variant="onFill" />
        {question.indicator_count != null && (
          <span className="figure text-caption-1-regular text-on-fill">
            {question.indicator_count} indicators
          </span>
        )}
      </span>
    </Link>
  );
}

import { withUnit } from '@/lib/format';

/**
 * A continuously scrolling band of prices, at the top of Prices & Markets.
 *
 * WHY THIS IS A SEPARATE COMPONENT AND NOT A MODE OF `TickerStrip`
 *
 * A marquee duplicates its content so that a -50% translate loops on identical
 * pixels. Bolting that onto `TickerStrip` breaks five things at once: `openId`
 * would match two DOM nodes; the arrow buttons and the `scrollLeft`-based edge
 * detection are meaningless on a translating track; the tab order would contain
 * every price twice; a screen reader would read every price twice; and CSS
 * `translate` fights `scrollLeft` on the same element in a way that cannot be
 * reconciled.
 *
 * So this is the decorative half and `TickerStrip` is the interactive half.
 * The landing page's own marquee is applied to a non-interactive row for
 * exactly this reason, and that is the model.
 *
 * IT IS HIDDEN FROM ASSISTIVE TECHNOLOGY, ON PURPOSE
 *
 * Every value here appears again, interactively and accessibly, in the ticker
 * strip further down the same page. Putting a duplicated, non-interactive copy
 * into the accessibility tree is pure noise — so the whole band is
 * `aria-hidden`, and nothing is lost.
 *
 * AND IT DOES NOT RENDER AT ALL UNDER REDUCED MOTION
 *
 * Not "renders static". A stopped marquee is a truncated row of prices
 * duplicated from the strip below it, which is worse than nothing. The strip
 * alone carries the information unchanged, which is what makes removing this
 * safe rather than a loss.
 */
export default function PriceMarquee({ tickers }) {
  const rows = (tickers ?? []).filter((t) => Number.isFinite(t.latest_value));
  if (rows.length < 3) return null;

  /*
   * Duration scales with the number of tiles, so adding a price lengthens the
   * loop instead of speeding the row up. The landing page's own marquee
   * records that exact bug in a comment — "72s, not 60s: the track grew from 5
   * cards to 6" — and this is the version that cannot have it.
   */
  const duration = `${rows.length * 6}s`;

  return (
    <div
      className="motion-safe:block relative -mx-4 mb-8 hidden overflow-hidden border-y border-border-button-default py-3 sm:-mx-6"
      aria-hidden="true"
    >
      {/* Fades at both edges so the loop reads as continuing rather than as
          content being cut off. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-linear-to-r from-page to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-linear-to-l from-page to-transparent" />

      <div className="marquee-track flex w-max gap-8" style={{ '--marquee-dur': duration }}>
        {/* Twice, so -50% lands on identical pixels. The second copy is inert
            for the same reason the band is aria-hidden. */}
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 gap-8">
            {rows.map((t) => {
              const delta = change(t);
              return (
                <span
                  key={`${copy}-${t.indicator_id}`}
                  className="flex shrink-0 items-baseline gap-2 whitespace-nowrap"
                >
                  <span className="text-caption-1-regular text-text-tertiary">
                    {t.label ?? t.name}
                  </span>
                  <span className="figure text-caption-1-medium text-text-primary">
                    {withUnit(t.latest_value, t)}
                  </span>
                  {delta && (
                    <span
                      className="figure text-caption-1-regular"
                      style={{ color: delta.value >= 0 ? 'var(--color-pos)' : 'var(--color-neg)' }}
                    >
                      {delta.value >= 0 ? '↑' : '↓'} {Math.abs(delta.value).toFixed(1)}
                      {delta.unit}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Percentage change, or percentage POINTS for a rate.
 *
 * The same rule `TickerStrip` applies, and it matters: an unemployment rate
 * moving from 4% to 5% has risen one point, not twenty-five percent, and
 * reporting the latter is the single most common way a dashboard overstates a
 * labour-market move.
 */
function change(ticker) {
  const { latest_value: to, previous_value: from } = ticker;
  if (to == null || from == null || !Number.isFinite(to) || !Number.isFinite(from)) return null;
  if (ticker.quantity_kind === 'rate') return { value: to - from, unit: 'pp' };
  if (!from) return null;
  return { value: ((to - from) / Math.abs(from)) * 100, unit: '%' };
}

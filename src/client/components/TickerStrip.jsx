import { useCallback, useEffect, useRef, useState } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react';
import { Chip } from '@/components/base/badges/chip';
import { withUnit, fmtDate, fmt } from '@/lib/format';
import { figureDelta, isStale } from '@/components/periodModel';
import Sheet from '@/components/Sheet';

/**
 * The prices a lens depends on, each stating why it is here.
 *
 * This is the reason the lens layer exists at all. A copper price in a
 * "Markets" tab answers nothing. The same price beside data-centre
 * construction, carrying a sentence about why it is relevant *to that lens*,
 * is evidence. So the rationale belongs to the placement, not to the series —
 * copper means something different on Money than on Infrastructure.
 *
 * Staleness is shown rather than hidden. A price that stopped updating is a
 * different thing from a price that did not move, and a reader must be able to
 * tell them apart.
 *
 * A period still in progress is shown the same way. `change()` and the
 * partial-period test both live in periodModel.js now, because the overview's
 * lens rows were doing the same arithmetic differently — see the note at the
 * top of that file.
 */
export default function TickerStrip({ tickers }) {
  const [openId, setOpenId] = useState(null);
  const scroller = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  /**
   * Which edges have more behind them.
   *
   * The strip previously had no affordance at all: it scrolled, but nothing
   * said so, so a reader saw a row that appeared to be cut off rather than one
   * that continues. This drives both the fades and whether an arrow is
   * offered.
   */
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = { left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 };

    // Returning the SAME object when nothing has changed keeps this from
    // re-rendering on every frame of every scroll — this fires continuously
    // while a reader drags the strip, and a fresh object each time would
    // re-render the whole row for nothing.
    setEdges((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
  }, []);

  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el) return undefined;
    // ResizeObserver as well as scroll: the arrows must disappear when the
    // window gets wide enough to show every tile.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, tickers]);

  /**
   * Move the strip by roughly a screenful.
   *
   * CSS `scroll-behavior: smooth` is deliberately NOT set on the container:
   * it would apply to the reader's own gestures too, making a flick feel
   * laggy instead of native. Passing the behavior per call keeps the
   * animation to the arrows, where it is wanted, and honours reduced-motion.
   */
  const nudge = (direction) => {
    const el = scroller.current;
    if (!el) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({
      left: direction * Math.max(el.clientWidth * 0.8, 200),
      behavior: reduced ? 'auto' : 'smooth',
    });
  };

  if (!tickers?.length) return null;

  const open = tickers.find((t) => t.indicator_id === openId);
  const openDelta = figureDelta(open);

  return (
    <div className="mb-8">
      <div className="relative">
        {/* Fades, not a hard edge, so it reads as "continues" rather than
            "ends". pointer-events-none or they swallow clicks on the tiles
            underneath. */}
        {edges.left && (
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-linear-to-r from-background-full to-transparent"
            aria-hidden
          />
        )}
        {edges.right && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-linear-to-l from-background-full to-transparent"
            aria-hidden
          />
        )}

        {[
          { side: 'left', dir: -1, show: edges.left, Icon: RiArrowLeftSLine },
          { side: 'right', dir: 1, show: edges.right, Icon: RiArrowRightSLine },
        ].map(({ side, dir, show, Icon }) =>
          show ? (
            <button
              key={side}
              type="button"
              onClick={() => nudge(dir)}
              aria-label={`Scroll prices ${side}`}
              className={`absolute top-1/2 z-20 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-border-button-default bg-background-primary-default text-text-secondary shadow-sm tint hover:bg-background-secondary-hover ${
                side === 'left' ? 'left-1' : 'right-1'
              }`}
            >
              <Icon className="size-5" aria-hidden />
            </button>
          ) : null
        )}

        {/* NO scroll snapping. It was the reason this strip felt like it
            refused to move: the row overflows by well under one tile (92px at
            desktop width for six tickers), so any scroll gesture overshoots
            the end, and snapping then pulled it straight back to the first
            tile. A reader flicks the strip and it returns to where it started.
            Free scrolling is right for a short row of small tiles; the fades
            and arrows are what communicate that more exists.

            items-stretch keeps every tile the height of the tallest, and the
            scrollbar is hidden because the fades already say the same thing
            more quietly. */}
        <ul
          ref={scroller}
          onScroll={measure}
          className="flex items-stretch gap-3 overflow-x-auto overscroll-x-contain pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
        {tickers.map((ticker) => {
          const stale = isStale(ticker);
          const { delta, toDate } = figureDelta(ticker);
          const isOpen = ticker.indicator_id === openId;
          return (
            <li key={ticker.indicator_id} className="flex">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : ticker.indicator_id)}
                aria-expanded={isOpen}
                className={`flex h-full w-44 shrink-0 flex-col items-start gap-0.5 rounded-2lg border px-3 py-2 text-left tint ${
                  isOpen
                    ? 'border-accent-500 bg-background-secondary-default'
                    : 'border-border-button-default bg-background-primary-default hover:bg-background-secondary-hover'
                }`}
              >
                <span className="w-full truncate text-caption-1-medium text-text-tertiary">
                  {ticker.label}
                </span>
                {/* Kept to one line. Some units spell out in full ("Cent per
                    kilowatthour"), which wraps to three lines and, because the
                    tiles stretch to match, drags the whole strip taller. The
                    full value stays available on hover. */}
                <span
                  className="w-full truncate text-title-3-medium tabular-nums text-text-primary"
                  title={withUnit(ticker.latest_value, ticker.unit_symbol ?? ticker.unit)}
                >
                  {withUnit(ticker.latest_value, ticker.unit_symbol ?? ticker.unit)}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {delta && (
                    <Chip
                      variant="caption"
                      color={delta.value > 0 ? 'lime' : delta.value < 0 ? 'rose' : 'neutral'}
                    >
                      {delta.value > 0 ? '↑' : delta.value < 0 ? '↓' : '→'}{' '}
                      {Math.abs(delta.value).toFixed(1)}
                      {delta.unit}
                    </Chip>
                  )}
                  {stale && (
                    <Chip variant="caption" color="yellow">
                      stale
                    </Chip>
                  )}
                  {/* "month to date" sits in the same tertiary type as the
                      period, not in a coloured chip: it qualifies the figure,
                      it is not something to act on, and the house rule is that
                      colour is reserved for the latter. It replaces a delta
                      rather than joining one — figureDelta never returns
                      both. */}
                  <span className="text-caption-1-regular text-text-tertiary">
                    {ticker.latest_period
                      ? fmtDate(ticker.latest_period.slice(0, 10), 'monthly')
                      : ''}
                    {toDate ? ` · ${toDate}` : ''}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        </ul>
      </div>

      {/* The rationale is the point, so it gets a sheet rather than a tooltip.
          It used to be an inline panel below the whole strip — not beside the
          tile you clicked, because the strip is inside `overflow-x-auto` and
          anything anchored to a tile would be clipped by the scroller. The
          sheet is portalled, so that constraint is gone. */}
      <Sheet isOpen={Boolean(open)} onClose={() => setOpenId(null)} label={open?.name ?? 'Price'}>
        {open && (
          <>
            <p className="figure text-caption-1-regular uppercase tracking-[0.12em] text-on-fill">
              {open.label ?? open.name}
            </p>

            <p className="figure mt-3 text-[clamp(2.5rem,6vw,3.5rem)] leading-none text-on-fill">
              {withUnit(open.latest_value, open)}
            </p>

            {open.latest_period && (
              <p className="figure mt-2 text-caption-1-regular text-on-fill">
                {fmtDate(open.latest_period.slice(0, 10), open.cadence ?? 'monthly')}
              </p>
            )}

            {/* Direction by glyph and word, not by hue. `text-pos` measures
                2.29:1 on this fill and `text-neg` 1.68:1, so both are
                unusable — and a chip that carries direction in its wording is
                the better version anyway, which is the same argument the chart
                palette notes make about colour-only encoding. */}
            {openDelta.delta && (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/50 px-3 py-1 text-caption-1-medium text-on-fill">
                <span aria-hidden>{openDelta.delta.value >= 0 ? '↑' : '↓'}</span>
                <span className="figure">
                  {fmt(Math.abs(openDelta.delta.value), 1)}
                  {openDelta.delta.unit}
                </span>
                <span>since the previous period</span>
              </p>
            )}

            {/* Where the period has not finished, the sentence a reader needs
                is why there is no comparison, not a comparison. Said in full
                here because this is the panel with room for it. */}
            {openDelta.toDate && (
              <p className="mt-4 inline-flex items-center rounded-full border border-white/50 px-3 py-1 text-caption-1-medium text-on-fill">
                {openDelta.toDate} — not yet comparable with the period before it
              </p>
            )}

            {/* The payload: why this price is on this specific lens. */}
            <p className="prose-measure mt-6 text-headline-regular leading-relaxed text-on-fill">
              {open.why}
            </p>

            {open.source_url && (
              <a
                href={open.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="tint mt-6 inline-block text-caption-1-medium text-on-fill underline underline-offset-4 hover:opacity-80"
              >
                {open.source_name ?? 'Source'}
              </a>
            )}
          </>
        )}
      </Sheet>
    </div>
  );
}


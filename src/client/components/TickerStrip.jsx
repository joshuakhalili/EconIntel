import { useState } from 'react';
import { Chip } from '@/components/base/badges/chip';
import { withUnit, fmtDate } from '@/lib/format';

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
 */
export default function TickerStrip({ tickers }) {
  const [openId, setOpenId] = useState(null);

  if (!tickers?.length) return null;

  const open = tickers.find((t) => t.indicator_id === openId);

  return (
    <div className="mb-8">
      <ul className="flex snap-x gap-3 overflow-x-auto pb-2">
        {tickers.map((ticker) => {
          const stale = isStale(ticker);
          const delta = change(ticker);
          const isOpen = ticker.indicator_id === openId;
          return (
            <li key={ticker.indicator_id} className="snap-start">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : ticker.indicator_id)}
                aria-expanded={isOpen}
                className={`flex min-w-44 flex-col items-start gap-0.5 rounded-2lg border px-3 py-2 text-left transition-colors ${
                  isOpen
                    ? 'border-accent-500 bg-background-secondary-default'
                    : 'border-border-secondary bg-background-primary-default hover:bg-background-secondary-hover'
                }`}
              >
                <span className="text-caption-medium text-text-tertiary">{ticker.label}</span>
                <span className="text-title-medium tabular-nums text-text-primary">
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
                  <span className="text-caption-regular text-text-tertiary">
                    {ticker.latest_period
                      ? fmtDate(ticker.latest_period.slice(0, 10), 'monthly')
                      : ''}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* The rationale is the point, so it gets room to be read rather than
          being squeezed into the tile as a tooltip. */}
      {open && (
        <div className="mt-2 rounded-2lg border border-border-secondary bg-background-secondary-default p-4">
          <p className="text-body-medium text-text-primary">{open.name}</p>
          <p className="mt-1 text-body-regular text-text-secondary">{open.why}</p>
          {open.source_url && (
            <a
              href={open.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-caption-regular text-accent-600 underline"
            >
              Source
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A price is stale when it is older than about two of its own periods.
 *
 * The spacing is measured from latest_period to previous_period rather than
 * read from a cadence field, because the ticker payload has no cadence field —
 * and even where one exists it is not trustworthy: several series are annual
 * in fact while declared quarterly. Judged this way an annual figure from
 * January is current in August, while a daily price from January is not.
 */
function isStale(ticker) {
  if (!ticker.latest_period) return true;
  const age = (Date.now() - new Date(ticker.latest_period).getTime()) / 86_400_000;
  const period = periodDays(ticker);
  return age > period * 2.2;
}

function periodDays(ticker) {
  if (!ticker.previous_period || !ticker.latest_period) return 31;
  const gap =
    (new Date(ticker.latest_period).getTime() - new Date(ticker.previous_period).getTime()) /
    86_400_000;
  return gap > 0 ? gap : 31;
}

/**
 * Change since the previous observation.
 *
 * A RATE moves in percentage POINTS. A share going from 49.7% to 60.9% is
 * +11.2 points; reporting it as "+22%" is arithmetically defensible, useless,
 * and reads as a bug.
 */
function change(ticker) {
  const { latest_value: to, previous_value: from } = ticker;
  if (to == null || from == null || !Number.isFinite(to) || !Number.isFinite(from)) return null;
  if (ticker.quantity_kind === 'rate') {
    return { value: to - from, unit: 'pp' };
  }
  if (!from) return null;
  return { value: ((to - from) / Math.abs(from)) * 100, unit: '%' };
}

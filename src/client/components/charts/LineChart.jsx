import { useMemo, useState } from 'react';
import {
  LineChart as RLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { fmt, fmtDate } from '@/lib/format';
import { useSeriesPalette, colorAt } from './palette';
import ChartTooltip from './ChartTooltip';
import SeriesLegend from './SeriesLegend';

/**
 * The line chart.
 *
 * ONE Y-AXIS, ALWAYS. Series on different scales are rebased server-side to
 * index 100 at a shared base period before they reach this component — see
 * /api/series?index=true. Recharts makes a second axis a one-prop change; that
 * is exactly the mistake this rule exists to prevent. Two measures that cannot
 * share a scale become two charts, never two axes.
 *
 * Behaviours carried over from the hand-built SVG version, each of which was
 * arrived at by getting it wrong first:
 *
 *   - A gap in the data breaks the line. A straight segment across missing
 *     months asserts data that was never collected (connectNulls={false}).
 *   - Y-axis tick precision follows the data range rather than a fixed format,
 *     so a series that moves between 0.2 and 0.9 does not render as "0, 0, 1".
 *   - When x labels collide, the LAST one is kept rather than the first: the
 *     most recent period is the one a reader is looking for.
 *   - Clicking a point opens the context drawer for that period.
 */
export default function LineChart({
  series = [],
  cadence = 'monthly',
  unit,
  height = 260,
  onPick,
}) {
  const palette = useSeriesPalette();

  // Colour follows the entity, not its position after filtering — so hidden
  // series are tracked by label and the remaining ones keep their own colour.
  const [hidden, setHidden] = useState(() => new Set());

  const { rows, ticks, domain, tickFormatter, duplicateDates } = useMemo(
    () => buildChartModel(series, cadence),
    [series, cadence]
  );

  // A series holding two values for one date cannot be drawn as a line without
  // silently picking one of them. That means the request was missing a filter
  // (usually a country), and saying so beats drawing a confident wrong shape.
  if (duplicateDates) {
    return (
      <div
        style={{ height }}
        className="grid place-items-center px-6 text-center text-body-regular text-text-tertiary"
      >
        This indicator holds several values per period — pick a country to draw it.
      </div>
    );
  }

  if (!series.length || !rows.length) {
    return (
      <div
        style={{ height }}
        className="grid place-items-center text-body-regular text-text-tertiary"
      >
        No data for this selection.
      </div>
    );
  }

  const visible = series.filter((s) => !hidden.has(s.label));

  return (
    <div className="min-w-0">
      <ResponsiveContainer width="100%" height={height}>
        <RLineChart
          data={rows}
          // The right margin exists so the final x label — the most recent
          // period, and the one a reader looks for first — is not clipped by
          // the frame edge.
          margin={{ top: 8, right: 28, bottom: 4, left: 4 }}
          onClick={(state) => {
            const iso = state?.activeLabel;
            if (iso && onPick) onPick(iso, cadence);
          }}
          style={onPick ? { cursor: 'pointer' } : undefined}
        >
          {/* Grid and axes are recessive: they orient, they do not compete. */}
          <CartesianGrid
            stroke="var(--color-border-secondary)"
            strokeDasharray="0"
            vertical={false}
          />

          <XAxis
            dataKey="date"
            type="category"
            ticks={ticks}
            tickFormatter={(iso) => fmtDate(iso, cadence)}
            tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border-secondary)' }}
            interval={0}
            minTickGap={0}
          />

          <YAxis
            domain={domain}
            tickFormatter={tickFormatter}
            tick={{ fill: 'var(--color-text-tertiary)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={52}
          />

          <Tooltip
            content={<ChartTooltip cadence={cadence} unit={unit} palette={palette} series={series} />}
            cursor={{ stroke: 'var(--color-text-tertiary)', strokeWidth: 1 }}
            isAnimationActive={false}
          />

          {visible.map((s) => {
            // The index into the ORIGINAL list, so hiding one series never
            // recolours another.
            const index = series.indexOf(s);
            return (
              <Line
                key={s.label}
                type="linear"
                dataKey={s.label}
                stroke={colorAt(palette, index)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            );
          })}
        </RLineChart>
      </ResponsiveContainer>

      {/* A legend is always present for two or more series, so identity is
          never carried by colour alone. */}
      {series.length > 1 && (
        <SeriesLegend
          series={series}
          palette={palette}
          hidden={hidden}
          onToggle={(label) =>
            setHidden((current) => {
              const next = new Set(current);
              if (next.has(label)) next.delete(label);
              // Hiding the last visible series leaves an empty chart with no
              // way back, so the final one cannot be turned off.
              else if (series.length - next.size > 1) next.add(label);
              return next;
            })
          }
        />
      )}
    </div>
  );
}

/**
 * Turn the API's per-series point lists into the row-per-date shape Recharts
 * wants, and work out the axis ticks.
 *
 * A missing date for a series becomes null rather than a skipped key, which is
 * what lets connectNulls={false} break the line at a real gap.
 */
function buildChartModel(series, cadence) {
  const dates = [
    ...new Set(series.flatMap((s) => s.points.map((p) => p.date))),
  ].sort();

  // Detected rather than resolved. Collapsing duplicates here would hide a
  // missing filter behind a plausible-looking line.
  const duplicateDates = series.some((s) => {
    const seen = new Set();
    return s.points.some((p) => p.value != null && (seen.has(p.date) || !seen.add(p.date)));
  });

  const rows = dates.map((date) => {
    const row = { date };
    for (const s of series) {
      const point = s.points.find((p) => p.date === date);
      row[s.label] = point?.value ?? null;
    }
    return row;
  });

  const values = series
    .flatMap((s) => s.points.map((p) => p.value))
    .filter((v) => v != null && Number.isFinite(v));

  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || Math.abs(max) || 1;

  return {
    rows,
    duplicateDates,
    ticks: pickTicks(dates),
    // Zero is included only when the data already sits near it. Forcing a zero
    // baseline onto an index that moves between 95 and 108 flattens the entire
    // shape into a line at the top of the frame.
    domain: [min >= 0 && min < range * 0.35 ? 0 : niceFloor(min, range), 'auto'],
    tickFormatter: (value) => fmt(value, precisionFor(range)),
  };
}

/** Pad the low end so the lowest point is not welded to the axis. */
function niceFloor(min, range) {
  return min - range * 0.08;
}

/**
 * How many decimals a Y tick needs, from the range being shown.
 *
 * A fixed format renders a series that moves between 0.2 and 0.9 as "0, 0, 1".
 */
function precisionFor(range) {
  if (range >= 100) return 0;
  if (range >= 10) return 1;
  if (range >= 1) return 2;
  return 3;
}

/**
 * Choose x labels that will not collide.
 *
 * Strided from the END, so the most recent period always gets a label — that
 * is the one a reader is looking for, and striding from the start drops it
 * whenever the count is not an exact multiple.
 */
function pickTicks(dates, maxLabels = 6) {
  if (dates.length <= maxLabels) return dates;
  const stride = Math.ceil(dates.length / maxLabels);
  const kept = [];
  for (let i = dates.length - 1; i >= 0; i -= stride) kept.unshift(dates[i]);
  // The first label is worth having when it does not crowd the second.
  if (kept[0] !== dates[0] && dates.indexOf(kept[0]) > stride / 2) {
    kept.unshift(dates[0]);
  }
  return kept;
}

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
import { fmtDate } from '@/lib/format';
import { useSeriesPalette, colorAt } from './palette';
import {
  buildChartModel,
  projectedKey,
  readProjectedKey,
  describeSeriesChart,
  seriesTableModel,
} from './chartModel';
import ChartTooltip from './ChartTooltip';
import ChartDataTable from './ChartDataTable';
import SeriesLegend from './SeriesLegend';

/*
 * The thirteen chart honesty behaviours this project treats as non-negotiable
 * are written down once, next to this file, in HONESTY.md — with the file and
 * line implementing each, and which of them a test can reach. Six of them are
 * in this component. Read it before changing anything here.
 */

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
 *   - A point the source publishes as a PROJECTION is drawn on its own dashed
 *     line, so a forecast is never rendered as if it were a measurement. See
 *     splitProjected.
 */

/*
 * Re-exported rather than moved outright: ChartTooltip imports
 * `readProjectedKey` from this module, and the pair reads as part of the chart
 * even though it now lives in chartModel.js so a test can reach it.
 */
export { projectedKey, readProjectedKey };

export default function LineChart({
  series = [],
  cadence = 'monthly',
  unit,
  height = 260,
  onPick,
  // True only when every value on this chart is an index (rebased to 100 at a
  // shared base period). Only an index scale is allowed a non-zero floor —
  // see buildChartModel.
  indexed = false,
}) {
  const palette = useSeriesPalette();

  // Colour follows the entity, not its position after filtering — so hidden
  // series are tracked by label and the remaining ones keep their own colour.
  const [hidden, setHidden] = useState(() => new Set());

  const { rows, ticks, domain, tickFormatter, duplicateDates, axisTruncated, projected } = useMemo(
    () => buildChartModel(series, cadence, indexed),
    [series, cadence, indexed]
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
      {/* A padded floor moves the bottom of the frame off zero, which is the
          textbook way to exaggerate a trend. Allowed only for an index scale
          (see buildChartModel) — and even there, said out loud rather than
          left for a reader to notice or not. */}
      {axisTruncated && (
        <p className="mb-1 text-right text-caption-1-medium text-text-tertiary">
          Axis does not start at 0 — index scale
        </p>
      )}
      {/*
        Recharts renders bare SVG: no role, no label, no text alternative. To a
        screen reader every chart on this site was silence, on a site whose
        whole argument is that you should check the working. `role="img"` plus
        a label built from the same points the lines are drawn from is the
        equivalent of glancing at it; the table below is the equivalent of
        reading it. The legend stays OUTSIDE the wrapper, because role="img"
        makes everything inside it one opaque graphic and its buttons have to
        stay reachable.
      */}
      <div
        role="img"
        aria-label={describeSeriesChart(series, { cadence, unit, indexed })}
      >
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
            stroke="var(--color-border-button-default)"
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
            axisLine={{ stroke: 'var(--color-border-button-default)' }}
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

          {visible.flatMap((s) => {
            // The index into the ORIGINAL list, so hiding one series never
            // recolours another.
            const index = series.indexOf(s);
            const lines = [
              <Line
                key={s.label}
                type="linear"
                dataKey={s.label}
                stroke={colorAt(palette, index)}
                strokeWidth={2}
                // A series the server could not index (its anchor value was 0)
                // is drawn dashed, because it shares this axis in raw units
                // while its siblings are index points — a shared axis without
                // a shared scale has to look different, not just say so in a
                // caption a reader may not read.
                strokeDasharray={s.raw ? '5 4' : undefined}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                connectNulls={false}
                isAnimationActive={false}
              />,
            ];

            // The projected tail is a SECOND line over the same rows, holding
            // the forecast values plus the last measured one so the two meet
            // rather than leaving a visible break. Same colour, because colour
            // on this site means series identity and nothing else; the dash is
            // the same 5 4 the raw-units case uses, because "this is not what
            // the solid line is" is one idea and deserves one pattern.
            if (projected.has(s.label)) {
              lines.push(
                <Line
                  key={projectedKey(s.label)}
                  type="linear"
                  dataKey={projectedKey(s.label)}
                  stroke={colorAt(palette, index)}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              );
            }

            return lines;
          })}
        </RLineChart>
      </ResponsiveContainer>
      </div>

      <ChartDataTable
        model={seriesTableModel(series, { cadence })}
        caption={`Every point in this chart as numbers: ${series.length} series by period.`}
      />

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

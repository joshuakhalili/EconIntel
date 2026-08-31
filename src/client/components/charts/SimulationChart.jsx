import { useMemo } from 'react';
import {
  LineChart as RLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useSeriesPalette, colorAt } from './palette';

/**
 * A projection, drawn so it can never be mistaken for a measurement.
 *
 * EVERY LINE ON THIS CHART IS DASHED, AND THAT IS NOT A STYLE CHOICE.
 *
 * `LineChart` already dashes the projected tail of a measured series — a source
 * publishing a forecast for 2027 gets a dashed segment so a reader can see
 * where the record stops and the guess begins. This chart is that tail and
 * nothing else: not one value on it was observed by anyone. Drawing it in the
 * solid line the rest of the site uses for real data would be the single most
 * dishonest pixel in the product, so the dash is applied unconditionally and
 * there is no prop to turn it off.
 *
 * The baseline is drawn too, flat, as a reference line. A projection shown
 * alone invites reading its level as a forecast of the level; shown against the
 * baseline it came from, what the model actually claims — the DISTANCE between
 * the two — is the thing the eye lands on.
 *
 * One Y-axis, like every other chart here. Unemployment, wage growth and
 * inflation are all in percent, so they legitimately share a scale; anything
 * that does not belongs in a second chart, never on a second axis.
 */
export default function SimulationChart({
  years = [],
  series = [],
  baseline,
  height = 300,
}) {
  const palette = useSeriesPalette();

  const rows = useMemo(
    () =>
      years.map((year) => {
        const row = { year: `Year ${year.year}` };
        for (const s of series) row[s.label] = year[s.key];
        return row;
      }),
    [years, series]
  );

  if (rows.length === 0) return null;

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <RLineChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} className="stroke-border-button-default" />
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            className="fill-text-tertiary"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            width={44}
            tickFormatter={(v) => `${v}%`}
            className="fill-text-tertiary"
          />

          {/*
            The no-shock line. Labelled rather than left as a bare rule: an
            unlabelled reference line reads as a target or a threshold, and this
            is neither — it is where the model says the economy sits if nothing
            is injected at all.
          */}
          {baseline !== undefined && baseline !== null && (
            <ReferenceLine
              y={baseline}
              strokeDasharray="4 4"
              className="stroke-text-tertiary"
              label={{
                value: 'no injection',
                position: 'insideTopRight',
                fontSize: 10,
                className: 'fill-text-tertiary',
              }}
            />
          )}

          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ fontSize: 12, borderRadius: 12 }}
            formatter={(value, name) => [`${value}%`, name]}
          />

          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.label}
              stroke={colorAt(palette, i)}
              strokeWidth={2}
              /* Unconditional. See the note at the top of this file. */
              strokeDasharray="5 4"
              dot={{ r: 2.5 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </RLineChart>
      </ResponsiveContainer>

      <p className="mt-2 text-caption-1-regular text-text-tertiary">
        Every line is dashed because every value is modelled, not measured.
      </p>
    </div>
  );
}

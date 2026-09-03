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
 *
 * AND IT STOPS WHERE THE MODEL STOPS.
 *
 * `run.validity` says whether the equations produced something that can exist.
 * Where they did not, the years from the first impossible one onwards are not
 * drawn — see `OutOfRange` below, and `checkRange` in `lib/simulation.js` for
 * what counts as impossible. This is the same decision `ChartGroup` makes when
 * it has more series than it has validated hues: a wrong chart that renders is
 * worse than one that refuses, because nobody investigates it. A dashed line to
 * −1.6% unemployment is not a caveat a reader can be expected to apply for
 * themselves; it is the page asserting something false in the medium readers
 * trust most.
 */
export default function SimulationChart({
  years = [],
  series = [],
  baseline,
  validity,
  height = 300,
}) {
  const palette = useSeriesPalette();

  /*
   * An absent `validity` means "not checked", which is not the same as
   * "failed". Every run from model version v3 carries one, so a payload without
   * it is something older or something else, and inventing a refusal for it
   * would hide a chart that is fine. The version bump is what makes that safe —
   * a cached v2 run can no longer be served. See the note on MODEL_VERSION.
   */
  const cutoffYear = validity?.ok === false ? validity.first_invalid_year : null;

  const rows = useMemo(
    () =>
      years
        .filter((year) => cutoffYear === null || year.year < cutoffYear)
        .map((year) => {
          const row = { year: `Year ${year.year}` };
          for (const s of series) row[s.label] = year[s.key];
          return row;
        }),
    [years, series, cutoffYear]
  );

  if (years.length === 0) return null;

  /* Nothing survived the check: year one is already impossible, so there is no
     honest chart to put above the explanation and only the explanation runs. */
  if (rows.length === 0) {
    return <OutOfRange validity={validity} drawnYears={0} horizonYears={years.length} />;
  }

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
              /*
               * Widen the axis to fit the baseline rather than dropping it.
               *
               * Recharts' default is to DISCARD a reference line that falls
               * outside the domain the data implies, silently. That was mostly
               * hidden until the chart began stopping at the first impossible
               * year: truncate Italy at $1000bn to its one drawable year and the
               * axis spans 0–2.4%, so the 6.5% no-injection line vanished — at
               * exactly the moment the gap between projection and baseline is
               * the largest thing on the page.
               *
               * A projection drawn without the line it is a deviation FROM
               * invites reading its level as a forecast, which is the failure
               * the reference line exists to prevent. So the axis gives way.
               */
              ifOverflow="extendDomain"
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

      {cutoffYear !== null && (
        <OutOfRange
          validity={validity}
          drawnYears={rows.length}
          horizonYears={years.length}
        />
      )}
    </div>
  );
}

/**
 * What is shown instead of the years that could not have happened.
 *
 * A blank would be worse than the wrong chart. A reader who drags a slider and
 * watches the line disappear learns that the site is broken, which is both
 * untrue and the opposite of the point — the model breaking down at this scale
 * is the single most interesting thing the page can tell them about it. So this
 * says which year it stopped at, what the arithmetic actually produced, why
 * that is the model's limit rather than a result, and what to do about it.
 *
 * `reasons[0].message` is the server's sentence, quoted rather than rewritten.
 * It carries the figure — "unemployment reaches −2.5% in year two" — and the
 * figure is the whole of the explanation. Restating it here would be a second
 * place for it to drift out of step with the number the engine actually
 * computed.
 */
function OutOfRange({ validity, drawnYears, horizonYears }) {
  const reason = validity?.reasons?.[0];

  /* "Year 5 is" or "Years 3 to 5 are" — built here rather than inline, because
     a sentence assembled out of three ternaries in the JSX is a sentence nobody
     will read before changing it. */
  const undrawn =
    horizonYears - drawnYears === 1
      ? `Year ${horizonYears} is`
      : `Years ${drawnYears + 1} to ${horizonYears} are`;

  return (
    <div className="mt-3 rounded-2xl border border-border-button-default p-5">
      <p className="text-body-medium text-warn">
        {drawnYears > 0
          ? `Not drawn past year ${drawnYears}.`
          : 'Not drawn: an injection this large leaves the model behind immediately.'}
      </p>

      {reason && (
        <p className="mt-2 text-body-regular text-text-secondary">{reason.message}</p>
      )}

      {/* Written to cover both bounds. The below-zero case is the one a reader
          will meet, but a large enough withdrawal breaks the other end, and a
          sentence that only mentions zero would be wrong there rather than
          merely vague. */}
      <p className="mt-2 text-body-regular text-text-secondary">
        That is the model running out of road, not a projection. It is linear: every
        extra dollar moves unemployment by exactly as much as the one before it, and
        nothing in the equations knows that an unemployment rate has to stay between
        nought and the whole labour force. Past that point it keeps going anyway.{' '}
        {undrawn} arithmetic rather than a result, and left off the chart instead of
        drawn as one.
      </p>

      {/*
        Said explicitly because the tabs above make it look otherwise. Wage
        growth and inflation are both computed from the same unemployment gap
        that went impossible, so switching series does not switch to a run that
        worked — it shows the same broken run measured differently.
      */}
      <p className="mt-2 text-body-regular text-text-secondary">
        Every series here comes out of that same number, so switching to inflation or
        wage growth stops at the same year.
      </p>

      <p className="mt-2 text-caption-1-regular text-text-tertiary">
        A smaller injection brings the whole horizon back inside what this model can
        say. The size you chose has been kept exactly as you set it — nothing was
        quietly reduced to make a chart appear.
      </p>
    </div>
  );
}

import { useMemo } from 'react';
import LineChart from './LineChart';
import { inferCadence, displayUnit, fmtDate } from '@/lib/format';

const CADENCE_RANK = { daily: 0, weekly: 1, monthly: 2, quarterly: 3, annual: 4 };

/*
 * The thirteen chart honesty behaviours this project treats as non-negotiable
 * are written down once, next to this file, in HONESTY.md — with the file and
 * line implementing each. Three of them are here: the "(raw units)" label, the
 * cadence-mismatch warning, and the named-and-dated forecast note. Read it
 * before changing anything.
 */

/**
 * Adapts an /api/series response to the chart.
 *
 * Three decisions live here rather than in the chart:
 *
 *   - Cadence is inferred PER SERIES from the observation dates, not read from
 *     the indicator's declared cadence — several series are annual in fact
 *     while declared quarterly, which put "vs 2015 Q1" under points a year
 *     apart, and the upstream audit found the same fault at source. Nothing
 *     stops a chart_group pairing an annual series with a monthly one (only
 *     matching units is enforced), so the finest cadence present is used for
 *     the axis and a mismatch is surfaced rather than blended away — inferring
 *     from every series' dates flattened together can land on a cadence
 *     neither series actually reports at.
 *   - The unit label is only shown when every series shares it. Mixed units
 *     mean the response was indexed, and the axis is then index points.
 *   - A series the server could not index — its value was 0 at the shared
 *     base period, see /api/series — is flagged `raw` so the chart can draw
 *     it distinctly instead of letting it share an axis with true index
 *     points while looking identical to them.
 *   - A series carrying values the source publishes as PROJECTIONS gets a
 *     written note as well as the dashed tail LineChart draws. The dash is
 *     the same treatment the raw-units case uses and the same rule applies:
 *     on this site a visual difference is not a disclosure, because a reader
 *     who does not know the convention reads a dashed line as a line.
 */
export default function SeriesChart({ payload, height, onPick }) {
  const { series, cadence, cadenceMismatch, unit, projectedNote } = useMemo(() => {
    const list = payload?.series ?? [];
    const indexed = payload?.indexed === true;

    const mapped = list.map((s) => {
      const raw = indexed && s.indexed === false;
      // Dashing the line (in LineChart) is not enough on its own — this
      // project's own rule is that identity never rests on a visual cue
      // alone, so the legend and tooltip need the same fact in words.
      return { label: raw ? `${labelFor(s, list)} (raw units)` : labelFor(s, list), points: s.points ?? [], raw };
    });

    // Display form, so two series whose provider notes differ but whose real
    // unit matches are not read as a mismatch — see ChartGroup.
    const units = new Set(list.map((s) => displayUnit(s.meta?.unit)).filter(Boolean));

    const perSeriesCadence = mapped
      .filter((s) => s.points.some((p) => p.value != null))
      .map((s) => inferCadence(s.points));
    const distinctCadences = [...new Set(perSeriesCadence)];
    const cadence =
      distinctCadences.length === 0
        ? 'annual'
        : distinctCadences.sort((a, b) => CADENCE_RANK[a] - CADENCE_RANK[b])[0];

    // Named per series and dated, because "part of this chart is a forecast"
    // is not usable — a reader needs to know WHICH line and FROM WHEN before
    // they can decide how much of the shape to believe.
    const forecasts = mapped
      .map((s) => ({
        label: s.label,
        from: s.points.find((p) => p.value != null && p.value_status === 'projected')?.date,
      }))
      .filter((f) => f.from);

    return {
      series: mapped,
      cadence,
      cadenceMismatch: distinctCadences.length > 1 ? distinctCadences : null,
      unit: indexed ? '' : units.size === 1 ? [...units][0] : '',
      projectedNote:
        forecasts.length === 0
          ? null
          : forecasts.length === 1 && mapped.length === 1
            ? `From ${fmtDate(forecasts[0].from, cadence)} these are projections, not measurements — drawn dashed.`
            : `Projections, not measurements — drawn dashed: ${forecasts
                .map((f) => `${f.label} from ${fmtDate(f.from, cadence)}`)
                .join('; ')}.`,
    };
  }, [payload]);

  return (
    <div>
      {cadenceMismatch && (
        <p className="mb-2 text-caption-1-medium text-warn">
          These series report at different cadences ({cadenceMismatch.join(', ')}) but share one
          chart — spacing on this axis follows the finer one, not both evenly.
        </p>
      )}
      {projectedNote && <p className="mb-2 text-caption-1-medium text-warn">{projectedNote}</p>}
      <LineChart
        series={series}
        cadence={cadence}
        unit={unit}
        height={height}
        onPick={onPick}
        indexed={payload?.indexed === true}
      />
    </div>
  );
}

/**
 * Name a series.
 *
 * The country is only appended when it distinguishes anything — "Copper Price"
 * reads better than "Copper Price — USA" on a chart that has one country.
 */
function labelFor(s, all) {
  const base = s.meta?.name ?? s.id;
  if (!s.country) return base;
  const sameIndicator = all.filter((other) => other.id === s.id);
  return sameIndicator.length > 1 ? `${base} — ${s.country}` : base;
}

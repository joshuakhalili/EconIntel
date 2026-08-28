import { useMemo } from 'react';
import LineChart from './LineChart';
import { inferCadence } from '@/lib/format';

const CADENCE_RANK = { daily: 0, weekly: 1, monthly: 2, quarterly: 3, annual: 4 };

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
 */
export default function SeriesChart({ payload, height, onPick }) {
  const { series, cadence, cadenceMismatch, unit } = useMemo(() => {
    const list = payload?.series ?? [];
    const indexed = payload?.indexed === true;

    const mapped = list.map((s) => {
      const raw = indexed && s.indexed === false;
      // Dashing the line (in LineChart) is not enough on its own — this
      // project's own rule is that identity never rests on a visual cue
      // alone, so the legend and tooltip need the same fact in words.
      return { label: raw ? `${labelFor(s, list)} (raw units)` : labelFor(s, list), points: s.points ?? [], raw };
    });

    const units = new Set(list.map((s) => s.meta?.unit).filter(Boolean));

    const perSeriesCadence = mapped
      .filter((s) => s.points.some((p) => p.value != null))
      .map((s) => inferCadence(s.points));
    const distinctCadences = [...new Set(perSeriesCadence)];
    const cadence =
      distinctCadences.length === 0
        ? 'annual'
        : distinctCadences.sort((a, b) => CADENCE_RANK[a] - CADENCE_RANK[b])[0];

    return {
      series: mapped,
      cadence,
      cadenceMismatch: distinctCadences.length > 1 ? distinctCadences : null,
      unit: indexed ? '' : units.size === 1 ? [...units][0] : '',
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

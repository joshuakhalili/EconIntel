import { useMemo } from 'react';
import LineChart from './LineChart';
import { inferCadence } from '@/lib/format';

/**
 * Adapts an /api/series response to the chart.
 *
 * Two decisions live here rather than in the chart:
 *
 *   - Cadence is inferred from the observation dates, not read from the
 *     indicator's declared cadence. Several series are annual in fact while
 *     declared quarterly, which put "vs 2015 Q1" under points a year apart.
 *     The upstream audit found the same fault at source, so the dates are the
 *     only trustworthy statement of spacing.
 *   - The unit label is only shown when every series shares it. Mixed units
 *     mean the response was indexed, and the axis is then index points.
 */
export default function SeriesChart({ payload, height, onPick }) {
  const { series, cadence, unit } = useMemo(() => {
    const list = payload?.series ?? [];

    const mapped = list.map((s) => ({
      label: labelFor(s, list),
      points: s.points ?? [],
    }));

    const units = new Set(list.map((s) => s.meta?.unit).filter(Boolean));
    const allPoints = mapped.flatMap((s) => s.points);

    return {
      series: mapped,
      cadence: inferCadence(allPoints),
      unit: payload?.indexed ? '' : units.size === 1 ? [...units][0] : '',
    };
  }, [payload]);

  return <LineChart series={series} cadence={cadence} unit={unit} height={height} onPick={onPick} />;
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

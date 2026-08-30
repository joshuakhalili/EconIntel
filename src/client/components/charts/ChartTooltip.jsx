import { fmtDate, withUnit } from '@/lib/format';
import { colorAt } from './palette';
import { readProjectedKey } from './LineChart';

/**
 * Crosshair tooltip.
 *
 * Values wear text tokens, not the series colour — the swatch beside them
 * carries identity. Coloured numbers on a coloured surface are the thing that
 * makes a tooltip hard to read.
 */
export default function ChartTooltip({ active, payload, label, cadence, unit, palette, series }) {
  if (!active || !payload?.length) return null;

  const present = payload.filter((entry) => entry.value != null);

  // A projected series is drawn as two lines, and at the period where they
  // join both carry the same number — that period is a measurement, so the
  // measured row wins and the duplicate goes.
  const measured = new Set(present.filter((e) => !readProjectedKey(e.dataKey)).map((e) => e.dataKey));
  const rows = present
    .filter((entry) => {
      const base = readProjectedKey(entry.dataKey);
      return base === null || !measured.has(base);
    })
    // Naming it here as well as on the chart: the dash says a value is a
    // forecast to someone who notices the dash, and the reader hovering a
    // single point is the one most likely to quote the number.
    .map((entry) => {
      const base = readProjectedKey(entry.dataKey);
      return base === null
        ? { key: entry.dataKey, name: entry.dataKey, value: entry.value, isProjected: false }
        : { key: entry.dataKey, name: base, value: entry.value, isProjected: true };
    });

  if (!rows.length) return null;

  return (
    <div className="rounded-lg border border-border-button-default bg-background-primary-default px-3 py-2 shadow-dropdown">
      <p className="mb-1 text-caption-1-medium text-text-secondary">{fmtDate(label, cadence)}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((entry) => {
          // Index into the original series list so the swatch matches the line
          // even when other series are hidden.
          const index = series.findIndex((s) => s.label === entry.name);
          return (
            <li key={entry.key} className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: colorAt(palette, index === -1 ? 0 : index) }}
                aria-hidden
              />
              <span className="text-body-regular text-text-secondary">
                {entry.name}
                {entry.isProjected && (
                  <span className="ml-1.5 text-caption-1-medium text-warn">projected</span>
                )}
              </span>
              <span className="ml-auto pl-3 text-body-medium tabular-nums text-text-primary">
                {withUnit(entry.value, unit)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

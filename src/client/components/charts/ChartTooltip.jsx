import { fmtDate, withUnit } from '@/lib/format';
import { colorAt } from './palette';

/**
 * Crosshair tooltip.
 *
 * Values wear text tokens, not the series colour — the swatch beside them
 * carries identity. Coloured numbers on a coloured surface are the thing that
 * makes a tooltip hard to read.
 */
export default function ChartTooltip({ active, payload, label, cadence, unit, palette, series }) {
  if (!active || !payload?.length) return null;

  const rows = payload.filter((entry) => entry.value != null);
  if (!rows.length) return null;

  return (
    <div className="rounded-lg border border-border-secondary bg-background-primary-default px-3 py-2 shadow-dropdown">
      <p className="mb-1 text-caption-medium text-text-secondary">{fmtDate(label, cadence)}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((entry) => {
          // Index into the original series list so the swatch matches the line
          // even when other series are hidden.
          const index = series.findIndex((s) => s.label === entry.dataKey);
          return (
            <li key={entry.dataKey} className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: colorAt(palette, index === -1 ? 0 : index) }}
                aria-hidden
              />
              <span className="text-body-regular text-text-secondary">{entry.dataKey}</span>
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

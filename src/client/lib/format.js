/**
 * Number, date and change formatting.
 *
 * Ported unchanged from the pre-React front end. These are pure functions and
 * several of them encode a decision that was got wrong once — the comments are
 * the record of that, so they travel with the code.
 */

/** Validated categorical order — see the note in styles/charts.css. Never reordered. */
export const SERIES_COLORS = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'];

/** Resolve a palette variable to a real colour, for SVG attributes that cannot take var(). */
export function seriesColor(index) {
  const name = SERIES_COLORS[index % SERIES_COLORS.length];
  if (typeof window === 'undefined') return '#1F7A4D';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#1F7A4D';
}

export function fmt(value, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${(value / 1e3).toFixed(1)}k`;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: abs < 10 ? decimals : 0,
    maximumFractionDigits: abs < 10 ? decimals : 1,
  });
}

export function fmtDate(iso, cadence) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (cadence === 'annual') return String(d.getUTCFullYear());
  if (cadence === 'quarterly') {
    return `${d.getUTCFullYear()} Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
  }
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Cadence from the observations, not from the indicator's own metadata.
 *
 * Several series are annual in fact while declared quarterly, which put
 * "vs 2015 Q1" under points a year apart. The upstream audit found the same
 * problem at source — RBA series tagged daily that are quarterly — so the
 * dates are the only trustworthy statement of spacing.
 */
export function inferCadence(points) {
  const dates = points.filter((p) => p.value != null).map((p) => p.date);
  if (dates.length < 2) return 'annual';
  const gaps = [];
  for (let i = 1; i < Math.min(dates.length, 8); i += 1) {
    gaps.push((new Date(dates[i]) - new Date(dates[i - 1])) / 86400000);
  }
  gaps.sort((a, b) => a - b);
  const m = gaps[Math.floor(gaps.length / 2)];
  return m > 200 ? 'annual' : m > 60 ? 'quarterly' : m > 20 ? 'monthly' : m > 4 ? 'weekly' : 'daily';
}

/**
 * Change over a trailing window. A RATE is reported in percentage POINTS:
 * a share moving 0.5% to 60.9% is +60.4 points, and "+11,831%" is
 * arithmetically true, useless, and reads as a bug.
 */
export function delta(points, isRate, cadence) {
  const vals = points.filter((p) => p.value != null);
  if (vals.length < 2) return null;
  const window = cadence === 'annual' ? 3 : cadence === 'quarterly' ? 12 : 36;
  const from = vals[Math.max(0, vals.length - 1 - window)];
  const to = vals[vals.length - 1];
  if (from === to) return null;
  const since = fmtDate(from.date, cadence);
  if (isRate) return { value: to.value - from.value, unit: 'pp', since };
  if (!from.value) return null;
  const ratio = to.value / from.value;
  if (ratio >= 3) return { value: ratio, unit: '×', since, multiple: true };
  return { value: ((to.value - from.value) / Math.abs(from.value)) * 100, unit: '%', since };
}

/**
 * Direction of a change, for badge styling.
 *
 * Flat only when genuinely nil. At a wider threshold a small FALL was classed
 * flat and had its sign stripped, so a decline read as a rise.
 */
export function deltaDirection(d) {
  if (d == null || !Number.isFinite(d.value)) return 'flat';
  return d.value > 0.001 ? 'up' : d.value < -0.001 ? 'down' : 'flat';
}

export function deltaLabel(d) {
  if (d == null || !Number.isFinite(d.value)) return '—';
  const dir = deltaDirection(d);
  const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
  if (d.multiple) return `↑ ${d.value.toFixed(1)}×`;
  const mag = Math.abs(d.value);
  return `${arrow} ${mag >= 1000 ? fmt(mag, 0) : mag.toFixed(1)}${d.unit}`;
}

/**
 * A unit string fit to put on screen.
 *
 * `indicators.unit` is provider metadata, not a label. 45 of them carry notes
 * that were never meant to be read by anyone but whoever wired the adapter:
 *
 *   "ten thousand persons (2026-06 value 6,846 = 68.46 million employed)"
 *   "Thousands of vacancies (NA-sentinel strings present; filter them)"
 *   "index, 2015 = 100 (2015-01 = 99.9; 2024-04 = 114.0)"
 *
 * Rendering those verbatim is a real part of why this interface reads as
 * unfinished. Cleaning them at the source would be a 45-row edit that the next
 * ingestion undoes, so the fix belongs at the point of display — and it has to
 * survive units this project has not seen yet, since more sources are coming.
 *
 * The comma rule is the fiddly one: splitting on a comma turns "10,000 yuan"
 * into "10", so it only splits where a non-digit follows.
 *
 * The full string is never thrown away — callers put it in a `title` so the
 * provider's own wording stays one hover away.
 */
export function displayUnit(unit) {
  if (typeof unit !== 'string') return '';

  let text = unit.split('(')[0].split(';')[0].trim();

  // Long but legitimate descriptions ("Millions of Dollars, seasonally
  // adjusted annual rate") keep only their head clause.
  if (text.length > 30) text = text.split(/,(?!\d)/)[0].trim();

  return text.replace(/[\s,;:–-]+$/, '');
}

export const isRateUnit = (unit) => /%|percent|share|rate|pp/i.test(unit ?? '');

export function withUnit(value, unit) {
  if (value == null || !Number.isFinite(value)) return '—';
  if (!unit) return fmt(value);
  if (unit === 'USD' || unit === 'usd') return `$${fmt(value)}`;
  if (isRateUnit(unit)) return `${fmt(value)}%`;
  // Never the raw provider string — see displayUnit.
  return `${fmt(value)} ${displayUnit(unit)}`;
}

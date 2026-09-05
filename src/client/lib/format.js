/**
 * Number, date and change formatting.
 *
 * Ported unchanged from the pre-React front end. These are pure functions and
 * several of them encode a decision that was got wrong once — the comments are
 * the record of that, so they travel with the code.
 *
 * ONE LOCALE, en-GB, DELIBERATELY.
 *
 * `fmt` and `fmtDate` used to pass `undefined` as the locale, which means the
 * READER's browser locale. Nothing else on the site follows the reader: the
 * document declares `lang="en"`, every sentence is hand-written English quoting
 * figures in English convention, and the abbreviations below — k, M, B, T — and
 * the leading `$` are hardcoded English too. So a German reader met a caveat
 * saying "copper is $13,542 a tonne" beside a ticker reading "13.542" and an
 * axis reading "1.234,5": three conventions on one screen, on a site whose
 * whole claim is that its numbers can be trusted.
 *
 * Genuinely following the reader is a much larger job than a locale argument —
 * the prose would have to stop quoting formatted figures, and "B" for billion
 * is not safe outside English. Until that is worth doing, one convention beats
 * three, and it is the one the prose already uses. Changing this line changes
 * every number on the site, so it is recorded here rather than passed at each
 * call site.
 */
const LOCALE = 'en-GB';

/** Validated categorical order — see the note in styles/charts.css. Never reordered. */
export const SERIES_COLORS = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'];

/** Resolve a palette variable to a real colour, for SVG attributes that cannot take var(). */
export function seriesColor(index) {
  const name = SERIES_COLORS[index % SERIES_COLORS.length];
  if (typeof window === 'undefined') return '#1F7A4D';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#1F7A4D';
}

/**
 * `decimals` is the indicator's own declared precision, and it is a CEILING as
 * well as a floor.
 *
 * `indicators.decimals` holds 0 for every count on the site — federal documents
 * per month, data-centre megawatts — and it was being ignored, so a count of
 * one federal rule rendered as "1.0". Nobody writes "1.0 documents", and it
 * makes an integer look like a measurement carrying a precision it does not
 * have.
 *
 * Above 10 the cap stays at one place regardless, because a four-figure index
 * printed to three decimals is noise; `Math.min` is what lets decimals: 0 pull
 * that down to none rather than only pushing it up.
 */
export function fmt(value, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return '—';
  // A caller reading a nullable column can hand us null; that is "unstated",
  // which is the default, not "zero decimal places".
  const dp = Number.isInteger(decimals) ? Math.max(0, Math.min(4, decimals)) : 1;
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e4) return `${(value / 1e3).toFixed(1)}k`;
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: abs < 10 ? dp : 0,
    maximumFractionDigits: abs < 10 ? dp : Math.min(dp, 1),
  });
}

export function fmtDate(iso, cadence) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (cadence === 'annual') return String(d.getUTCFullYear());
  if (cadence === 'quarterly') {
    return `${d.getUTCFullYear()} Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
  }
  return d.toLocaleDateString(LOCALE, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * A single day: "30 Aug 2026".
 *
 * `fmtDate` deliberately drops the day, because an observation dated the 1st
 * describes a whole month and printing "1 Aug" would assert a precision the
 * series does not have. A generated-at timestamp is the opposite case — it is a
 * real instant, and the day is the useful part of it. Accepts a date or a full
 * timestamp; the time is discarded, not shown.
 */
export function fmtDay(iso) {
  if (typeof iso !== 'string' || iso.length < 10) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
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
 * The most recent ISO date in a list of periods, or null.
 *
 * Deliberately strict about the shape. A simulation narration's `period` is a
 * sentence — "no injection → year 5", "one-off, in year one" — and comparing
 * one of those against a ticker date would either throw or, worse, quietly
 * decide that a simulation is out of date. Only YYYY-MM-DD is a period this
 * will reason about; everything else is not a date and is skipped. ISO dates
 * sort correctly as strings, which is why no Date is constructed.
 */
export function latestIsoPeriod(values) {
  const dates = (values ?? [])
    .filter((v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.slice(0, 10)))
    .map((v) => v.slice(0, 10));
  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (a > b ? a : b));
}

/**
 * Has a stored narration fallen behind the live figures printed beside it?
 *
 * Narrations are generated offline and cached; tickers are read live. On
 * /lens/regulation that put four tiles reading September 2026 forty pixels
 * above a machine-written paragraph describing August 2026 — under a heading
 * asserting the paragraph came from those tiles. One screen, two irreconcilable
 * sets of numbers for the same four series, with nothing saying so.
 *
 * Both halves are already on the page: `narration.grounding.series[].period` is
 * what the model was given, and `tickers[].latest_period` is what the reader is
 * looking at. This is the comparison, kept here rather than in the component so
 * it can be tested without a DOM.
 *
 * Returns null periods rather than throwing when either side is missing or is
 * not date-shaped, and `stale` is false in that case — an unknown period is not
 * evidence of disagreement.
 */
export function narrationStaleness(series, tickers) {
  const narrationPeriod = latestIsoPeriod((series ?? []).map((row) => row?.period));
  const tickerPeriod = latestIsoPeriod((tickers ?? []).map((t) => t?.latest_period));
  return {
    narrationPeriod,
    tickerPeriod,
    stale: Boolean(narrationPeriod && tickerPeriod && narrationPeriod < tickerPeriod),
  };
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
 * into "10", so it only splits where a digit does not follow.
 *
 * THE OTHER SHAPE OF BAD UNIT: MACHINE IDENTIFIERS.
 *
 * The paren rule above was written for one shape and shipped without the other.
 * A second family of provider strings is a bare column name — `percent_of_gdp`,
 * `thousands_of_persons`, `billions_of_chained_2017_usd` — and those were being
 * printed to readers verbatim as the unit of a series, underscores and all. The
 * comment above calls these "provider metadata, not a label"; an identifier is
 * the purest case of that.
 *
 * Enumerated from the live table rather than guessed: on 4 September 2026,
 * `SELECT DISTINCT unit FROM indicators` returns 73 strings, 23 of which
 * contain `_` or `=`, and eight of those are snake_case. The eight are named
 * below, because "% of GDP" is a translation and not something a regex can
 * derive. The general rules — swap `_` for a space, and space out an `=` —
 * catch the rest, and catch the next source's identifiers too.
 *
 * The full string is never thrown away — callers put it in a `title` so the
 * provider's own wording stays one hover away.
 */
// A Map, not an object literal: the key is a provider string this project does
// not control, and `UNIT_LABELS['constructor']` on an object literal returns a
// function rather than undefined.
const UNIT_LABELS = new Map([
  ['percent_of_gdp', '% of GDP'],
  ['constant_2015_usd', 'constant 2015 US dollars'],
  ['billions_of_chained_2017_usd', 'billions of chained 2017 dollars'],
  ['thousands_of_persons', 'thousands of persons'],
  ['index_2015=100', 'index, 2015 = 100'],
  ['index_2017=100', 'index, 2017 = 100'],
  ['index_2017=1', 'index, 2017 = 1'],
  ['score_-100_to_100', 'score, −100 to 100'],
]);

export function displayUnit(unit) {
  if (typeof unit !== 'string') return '';

  const known = UNIT_LABELS.get(unit.trim().toLowerCase());
  if (known) return known;

  let text = unit.split('(')[0].split(';')[0].trim();

  // Long but legitimate descriptions ("Millions of Dollars, seasonally
  // adjusted annual rate") keep only their head clause.
  //
  // The lookahead allows whitespace before the digit, which it did not. Without
  // that, "Index, 2023 = 100, seasonally adjusted" split at the FIRST comma and
  // rendered as "Index" — an index with its base year removed, which is not a
  // unit at all. It now keeps "Index, 2023 = 100" and drops only the tail.
  if (text.length > 30) text = text.split(/,(?!\s*\d)/)[0].trim();

  // `percent_of_gdp` → `percent of gdp` for anything not in the table above.
  if (text.includes('_')) text = text.replace(/_/g, ' ');

  // "Index Dec 1998=100" → "Index Dec 1998 = 100". A base year jammed against
  // its own equals sign reads as a token rather than as a statement.
  text = text.replace(/\s*=\s*/g, ' = ');

  return text.replace(/[\s,;:–-]+$/, '');
}

export const isRateUnit = (unit) => /%|percent|share|rate|pp/i.test(unit ?? '');

/**
 * Symbols that go BEFORE the number, which in English is every currency.
 *
 * `withUnit` special-cased the literal string 'USD' and nothing else, so an
 * indicator whose `unit_symbol` is '$' — which is all thirteen of them — fell
 * through to the generic "value then unit" branch and copper rendered as
 * "13.5k $" in the largest type on the front page. Today `unit_symbol` only
 * ever holds '$', '%' or 'MW' — but the table already carries euro-denominated
 * series ("Million euro", "EUR per kilowatt-hour"), so £ and € are here to stop
 * the first one that gets a symbol repeating the bug.
 */
const PREFIX_SYMBOLS = new Map([
  ['$', '$'],
  ['£', '£'],
  ['€', '€'],
  ['¥', '¥'],
  ['USD', '$'],
  ['usd', '$'],
]);

/**
 * The prefix a symbol takes before a number, or null when it follows it.
 *
 * Exported because the narration audit panel prints its figures VERBATIM — the
 * point of that panel is that the reader sees exactly what the model was given,
 * so it cannot go through `withUnit` and be abbreviated — and it still has to
 * put the dollar sign on the correct side.
 */
export function prefixSymbol(unit) {
  if (typeof unit !== 'string') return null;
  return PREFIX_SYMBOLS.get(unit.trim()) ?? null;
}

/**
 * A value with its unit, as a reader would write it.
 *
 * The second argument takes either a unit string or the indicator-shaped row
 * itself — `{ unit, unit_symbol, decimals }`. Two call sites already passed the
 * whole ticker object (TickerStrip's sheet, PriceMarquee), where it hit
 * `displayUnit`'s non-string guard and returned '', so those numbers rendered
 * with no unit at all and a trailing space. Accepting the row is also the only
 * way `decimals` reaches `fmt`, which is what stops a count of one federal
 * document rendering as "1.0".
 */
export function withUnit(value, unit, decimals) {
  if (value == null || !Number.isFinite(value)) return '—';

  let symbol = unit;
  let dp = decimals;
  if (unit && typeof unit === 'object') {
    symbol = unit.unit_symbol || unit.unit;
    if (dp == null) dp = unit.decimals;
  }

  if (typeof symbol !== 'string' || !symbol.trim()) return fmt(value, dp);
  const raw = symbol.trim();

  const prefix = prefixSymbol(raw);
  if (prefix) return `${prefix}${fmt(value, dp)}`;

  // Tested against the CLEANED label, not the provider's string. "Millions of
  // Dollars, seasonally adjusted annual rate" contains "rate" and was being
  // rendered as a percentage; cleaned, it is "Millions of Dollars" and is not.
  const label = displayUnit(raw);
  if (isRateUnit(label)) return `${fmt(value, dp)}%`;

  // Never the raw provider string — see displayUnit.
  return `${fmt(value, dp)} ${label}`;
}

/**
 * What a confidence tier means, in the words a reader can act on.
 *
 * `confidence_tier` is a Postgres enum and it was being printed to readers as
 * its own identifier — "official", "news_derived" — with no definition anywhere
 * on the site. A tier tells a reader how far to trust a number, which is the
 * one thing it cannot do while it is a bare word with no scale attached.
 *
 * The wording is paraphrased from the enum's own comment in
 * db/migrations/0001_enums.sql, which is where the definitions actually live.
 * Ordered most to least trusted, because the order IS the information.
 */
export const CONFIDENCE_TIERS = [
  {
    id: 'official',
    label: 'Official',
    definition: 'Published by a statistical agency or central bank.',
  },
  {
    id: 'derived',
    label: 'Derived',
    definition: 'Computed here in SQL from official inputs. Deterministic and reproducible.',
  },
  {
    id: 'survey',
    label: 'Survey',
    definition: 'From a published survey or report. Periodic rather than live.',
  },
  {
    id: 'modelled',
    label: 'Modelled',
    definition: 'Estimated, with the assumptions stated.',
  },
  {
    id: 'news_derived',
    label: 'News-derived',
    definition:
      'Extracted or classified from news or filing text, possibly by a model. Least trusted.',
  },
];

export function confidenceLabel(tier) {
  return CONFIDENCE_TIERS.find((t) => t.id === tier)?.label ?? displayUnit(tier);
}

export function confidenceDefinition(tier) {
  return CONFIDENCE_TIERS.find((t) => t.id === tier)?.definition ?? '';
}

/**
 * The arithmetic behind the two figures a reader meets first — the ticker
 * tiles on a lens page and the lead number on each overview row.
 *
 * WHY THIS IS A MODULE AND NOT A FUNCTION IN EACH COMPONENT
 *
 * It used to be both. `TickerStrip.change()` reported a rate in percentage
 * POINTS, with a comment saying that reporting it as a percentage is
 * "arithmetically defensible, useless, and reads as a bug". `LensRow` on the
 * overview did exactly that: ((latest − previous) / |previous|) × 100 for
 * everything. So the same series — SEC filings mentioning AI, 49.69 → 60.84 —
 * printed "↑ 22.4%" on the home page and "↑ 11.2pp" one click later, and the
 * site's own code called the home page's version the bug. Two pages cannot
 * disagree about arithmetic when there is one function, so there is now one
 * function.
 *
 * WHAT A PARTIAL PERIOD DOES TO A COMPARISON
 *
 * On 3 September 2026 the home page read "Rules in force / 1.0 / documents per
 * month / ↓ 90.0% / Sept 2026". September was three days old and August was
 * complete: one tenth of a month against a whole one. Nothing in either
 * component had any concept of a period still being in progress, so the front
 * page of a site about AI's economic effect asserted that US AI rulemaking had
 * collapsed by 90% — a claim about the world that was entirely an artefact of
 * the calendar.
 *
 * A period is judged in progress from the spacing between the two observations
 * themselves, not from a declared cadence. That is the same decision
 * `isStale()` records below and `inferCadence()` in lib/format.js records for
 * charts: several series are annual in fact while declared quarterly, so the
 * dates are the only trustworthy statement of spacing. The 20-, 60- and
 * 200-day boundaries here are `inferCadence`'s, deliberately, so a series
 * cannot be monthly to a chart and weekly to a ticker.
 *
 * Below monthly this is not applied at all. A daily price for yesterday is a
 * complete observation of yesterday; only periods that ACCUMULATE across weeks
 * are the ones a calendar can misrepresent.
 */

const DAY_MS = 86_400_000;

/**
 * Spacing at or above which a period is worth testing for completeness, and
 * the boundaries between month, quarter and year. Identical to the cutoffs
 * `inferCadence()` uses in lib/format.js — see the note above.
 */
const MONTHLY_OR_SLOWER = 20;
const QUARTERLY = 60;
const ANNUAL = 200;

/** Midnight UTC on an ISO date, or null when the input is not one. */
function utcDay(iso) {
  if (typeof iso !== 'string' || iso.length < 10) return null;
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(t) ? null : t;
}

/**
 * Today, as midnight UTC.
 *
 * Periods on this site are UTC dates — `fmtDate` renders them with
 * `timeZone: 'UTC'` for the same reason — so "is this period still running"
 * has to be asked in UTC too, or a reader in Auckland sees a period close a
 * day early and one in Los Angeles sees it close a day late.
 */
function utcToday(now) {
  const d = now instanceof Date ? now : new Date(now ?? Date.now());
  if (Number.isNaN(d.getTime())) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Whole days from the previous observation to the latest one.
 *
 * Null when either date is missing or the pair is out of order — an unknown
 * spacing is not evidence of anything, and every caller here treats it as
 * "make no claim" rather than as a default cadence.
 */
export function periodSpacingDays(latestPeriod, previousPeriod) {
  const latest = utcDay(latestPeriod);
  const previous = utcDay(previousPeriod);
  if (latest == null || previous == null) return null;
  const gap = (latest - previous) / DAY_MS;
  return gap > 0 ? gap : null;
}

/**
 * Is the period beginning at `latestPeriod` still in progress?
 *
 * The period is assumed to run for as long as the gap to the one before it,
 * which is the only length the data itself states. A period that has not
 * started yet — a published forecast — is not "in progress"; that is a
 * different problem and it is labelled as a projection where it appears.
 */
export function isPeriodRunning(latestPeriod, spacingDays, now) {
  const start = utcDay(latestPeriod);
  const today = utcToday(now);
  if (start == null || today == null || spacingDays == null) return false;
  if (today < start) return false;
  return today < start + spacingDays * DAY_MS;
}

/** "month to date" / "quarter to date" / "year to date" for a given spacing. */
export function toDateLabel(spacingDays) {
  if (spacingDays == null) return null;
  if (spacingDays > ANNUAL) return 'year to date';
  if (spacingDays > QUARTERLY) return 'quarter to date';
  if (spacingDays >= MONTHLY_OR_SLOWER) return 'month to date';
  return null;
}

/**
 * Change since the previous observation.
 *
 * A RATE moves in percentage POINTS. A share going from 49.7% to 60.9% is
 * +11.2 points; reporting it as "+22%" is arithmetically defensible, useless,
 * and reads as a bug.
 *
 * WHERE THE QUANTITY KIND IS UNKNOWN, NOTHING IS REPORTED.
 *
 * Percent-of-previous and percentage-points are different claims about a
 * number, and which one is right is decided by `indicators.quantity_kind`.
 * Without that field the honest answer is that we cannot say how much this
 * moved — the same rule the charts follow when they refuse to draw. It is not
 * guessable from the unit either: of the 134 active indicators, 33 rates carry
 * the symbol "%" but 16 more carry no symbol at all, and one series that is
 * NOT a rate carries "%" — so a unit-based guess would be wrong in both
 * directions. `/api/lenses/:slug/tickers` supplies the field; `/api/overview`
 * does not yet, which is why the overview rows currently show a value and a
 * period and no arrow.
 */
export function change(figure) {
  const to = figure?.latest_value;
  const from = figure?.previous_value;
  if (to == null || from == null || !Number.isFinite(to) || !Number.isFinite(from)) return null;
  const kind = figure?.quantity_kind;
  if (kind == null) return null;
  if (kind === 'rate') return { value: to - from, unit: 'pp' };
  if (!from) return null;
  return { value: ((to - from) / Math.abs(from)) * 100, unit: '%' };
}

/**
 * What a figure may honestly say about its own movement.
 *
 * Returns `delta` (null where no comparison can be made) and `toDate` (the
 * label to print in place of a comparison, where the latest period has not
 * finished). Never both.
 */
export function figureDelta(figure, now) {
  const spacing = periodSpacingDays(figure?.latest_period, figure?.previous_period);
  if (
    spacing != null &&
    spacing >= MONTHLY_OR_SLOWER &&
    isPeriodRunning(figure.latest_period, spacing, now)
  ) {
    return { delta: null, toDate: toDateLabel(spacing) };
  }
  return { delta: change(figure), toDate: null };
}

/**
 * A price is stale when it is older than about two of its own periods.
 *
 * The spacing is measured from latest_period to previous_period rather than
 * read from a cadence field, because the ticker payload has no cadence field —
 * and even where one exists it is not trustworthy: several series are annual
 * in fact while declared quarterly. Judged this way an annual figure from
 * January is current in August, while a daily price from January is not.
 */
export function isStale(ticker, now) {
  if (!ticker?.latest_period) return true;
  const today = utcToday(now);
  const latest = utcDay(ticker.latest_period);
  if (today == null || latest == null) return true;
  const age = (today - latest) / DAY_MS;
  return age > periodDays(ticker) * 2.2;
}

/** The observed spacing, falling back to a month where there is only one point. */
export function periodDays(ticker) {
  return periodSpacingDays(ticker?.latest_period, ticker?.previous_period) ?? 31;
}

/**
 * Is a period later than today — a published forecast rather than a
 * measurement?
 *
 * `/data` and `/pipeline` print a series' newest period as its coverage. One
 * series in the catalogue today (UK total factor productivity, from AMECO)
 * carries a valued row dated a year into the future, flagged `projected` in
 * the observations table but not in either page's payload. A date after today
 * cannot be a measurement whatever the flag says, so that much is decidable
 * here; distinguishing the last MEASURED period from the forecast tail is not,
 * and needs the server to publish it.
 */
export function isFuturePeriod(period, now) {
  const start = utcDay(period);
  const today = utcToday(now);
  if (start == null || today == null) return false;
  return start > today;
}

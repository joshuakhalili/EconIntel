/**
 * The decisions a line chart makes before anything is drawn.
 *
 * WHY THIS IS NOT INSIDE LineChart.jsx
 *
 * Eight of the thirteen chart honesty behaviours (see HONESTY.md, next to this
 * file) are pure functions of the data: whether the axis may leave zero,
 * whether a series holds two values for one period, which points are forecasts
 * and which measured point has to be repeated so the dashed line joins the
 * solid one. All of that used to live as module-private functions in
 * LineChart.jsx, which imports Recharts and React — so `node --test` could not
 * reach any of it, and not one of the twelve had a test.
 *
 * Moving the pure half here changes no behaviour. It makes the half that CAN
 * be checked without a DOM checkable, which is the whole point: a behaviour
 * with no test is one refactor away from silently disappearing, and this
 * project has lost behaviours that way before.
 *
 * Anything needing a DOM stays in LineChart.jsx and is listed as an honest gap
 * at the top of honesty.test.js.
 *
 * @see ./HONESTY.md
 */

import { fmt, fmtDate, displayUnit } from '../../lib/format.js';

/**
 * Row key for the dashed projected half of a series.
 *
 * A suffix rather than a parallel structure because Recharts addresses data by
 * string key, and ChartTooltip has to be able to get back to the series it
 * belongs to — see readProjectedKey.
 */
export function projectedKey(label) {
  return `${label} (projected)`;
}

/** The series label behind a projected key, or null if this is not one. */
export function readProjectedKey(key) {
  const suffix = ' (projected)';
  return typeof key === 'string' && key.endsWith(suffix) ? key.slice(0, -suffix.length) : null;
}

/**
 * Turn the API's per-series point lists into the row-per-date shape Recharts
 * wants, and work out the axis ticks.
 *
 * A missing date for a series becomes null rather than a skipped key, which is
 * what lets connectNulls={false} break the line at a real gap.
 */
export function buildChartModel(series, cadence, indexed) {
  const dates = [
    ...new Set(series.flatMap((s) => s.points.map((p) => p.date))),
  ].sort();

  // Detected rather than resolved. Collapsing duplicates here would hide a
  // missing filter behind a plausible-looking line.
  const duplicateDates = series.some((s) => {
    const seen = new Set();
    return s.points.some((p) => p.value != null && (seen.has(p.date) || !seen.add(p.date)));
  });

  // Which series carry projections, and which of their dates belong to the
  // dashed line — worked out once rather than per row.
  const splits = new Map(series.map((s) => [s.label, splitProjected(s.points)]));
  const projected = new Set(
    series.filter((s) => splits.get(s.label).projectedDates.size > 0).map((s) => s.label)
  );

  const rows = dates.map((date) => {
    const row = { date };
    for (const s of series) {
      const point = s.points.find((p) => p.date === date);
      const split = splits.get(s.label);
      const value = point?.value ?? null;

      // A projected value is withheld from the solid line entirely, so the
      // measured line stops where the measurements stop.
      row[s.label] = split.projectedDates.has(date) ? null : value;

      if (projected.has(s.label)) {
        row[projectedKey(s.label)] =
          split.projectedDates.has(date) || split.bridgeDates.has(date) ? value : null;
      }
    }
    return row;
  });

  const values = series
    .flatMap((s) => s.points.map((p) => p.value))
    .filter((v) => v != null && Number.isFinite(v));

  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || Math.abs(max) || 1;

  // Zero is included whenever the data already sits near it OR the chart is
  // not an index scale — a raw-unit chart floors at zero (or at the true
  // negative minimum) by default, full stop. A padded floor below the
  // observed minimum is a real trend-exaggeration technique, so it is only
  // permitted for an index that moves in a tight band around 100, where
  // forcing zero would flatten the whole shape into a line at the top of the
  // frame — and even then it says so on the chart (see axisTruncated below).
  const nearZero = min >= 0 && min < range * 0.35;
  const floor = nearZero ? 0 : indexed ? niceFloor(min, range) : Math.min(0, min);

  return {
    rows,
    duplicateDates,
    ticks: pickTicks(dates),
    domain: [floor, 'auto'],
    axisTruncated: floor > 0,
    projected,
    tickFormatter: (value) => fmt(value, precisionFor(range)),
  };
}

/**
 * Which dates of a series are projections, and which measured points have to
 * be repeated on the dashed line so it joins the solid one.
 *
 * Judged PER POINT from `value_status`, not as "everything after the first
 * projection". The two agree for what is marked today — seed 029 keys on a
 * future period, so projections are always a tail — but a source that revises
 * a forecast year into an outturn would leave a measured point after a
 * projected one, and inferring a tail would then draw that measurement as a
 * forecast. Reading each point's own status cannot make that mistake; it
 * breaks the dashed line at the seam instead, which is what happened.
 */
export function splitProjected(points) {
  const projectedDates = new Set();
  const bridgeDates = new Set();

  points.forEach((p, i) => {
    if (p.value == null || p.value_status !== 'projected') return;
    projectedDates.add(p.date);
    // The measured point immediately before is drawn on both lines: without
    // it the forecast floats detached from the history it continues.
    const previous = points[i - 1];
    if (previous && previous.value != null && previous.value_status !== 'projected') {
      bridgeDates.add(previous.date);
    }
  });

  return { projectedDates, bridgeDates };
}

/** Pad the low end so the lowest point is not welded to the axis. */
export function niceFloor(min, range) {
  return min - range * 0.08;
}

/**
 * How many decimals a Y tick needs, from the range being shown.
 *
 * A fixed format renders a series that moves between 0.2 and 0.9 as "0, 0, 1".
 */
export function precisionFor(range) {
  if (range >= 100) return 0;
  if (range >= 10) return 1;
  if (range >= 1) return 2;
  return 3;
}

/**
 * Choose x labels that will not collide.
 *
 * Strided from the END, so the most recent period always gets a label — that
 * is the one a reader is looking for, and striding from the start drops it
 * whenever the count is not an exact multiple.
 */
export function pickTicks(dates, maxLabels = 6) {
  if (dates.length <= maxLabels) return dates;
  const stride = Math.ceil(dates.length / maxLabels);
  const kept = [];
  for (let i = dates.length - 1; i >= 0; i -= stride) kept.unshift(dates[i]);
  // The first label is worth having when it does not crowd the second.
  if (kept[0] !== dates[0] && dates.indexOf(kept[0]) > stride / 2) {
    kept.unshift(dates[0]);
  }
  return kept;
}

// ===========================================================================
// The ranked bar form, and its dates
// ===========================================================================

/**
 * How long one period of each cadence is, in days.
 *
 * Used only to answer "is this bar's reading materially older than the newest
 * one on the chart" — so the numbers are the OUTSIDE of each period (366 for a
 * year, 31 for a month), which makes the test "more than one whole period
 * behind" rather than "more than the average period behind". A December-to-
 * January pair of annual surveys must not read as stale.
 */
const PERIOD_DAYS = { daily: 1, weekly: 7, monthly: 31, quarterly: 92, annual: 366 };

const DAY = 86400000;

/** Whole days from one ISO date to another. Negative if `later` is earlier. */
export function daysBetween(earlier, later) {
  return Math.round((new Date(`${later}T00:00:00Z`) - new Date(`${earlier}T00:00:00Z`)) / DAY);
}

/**
 * The ranked horizontal bar form: one bar per entity, sorted by its latest
 * value, with a muted bar behind it for its earlier reading.
 *
 * WHY THIS FORM EXISTS AT ALL
 *
 * Sixteen countries cannot share six hues. The answer is a chart where colour
 * carries no meaning: every bar is drawn in one hue, rank does the work colour
 * was doing, and the palette ceiling stops applying because nothing is being
 * distinguished by colour. See HONESTY.md behaviour 10.
 *
 * EVERY BAR CARRIES ITS OWN DATE, AND THIS IS THE WHOLE POINT
 *
 * `oecd.ai_any.USA` holds three observations and stops at 2021 (5.65%).
 * Denmark reaches 42.0% in 2025. Ranked together with no dates, a reader sees
 * the United States near the bottom of a diffusion chart and concludes it is
 * far behind — when the two readings are FOUR YEARS APART. Today that is
 * hidden only because the chart refuses to draw at all; drawing it without the
 * dates would make the site assert something false that it does not currently
 * assert.
 *
 * So `latest.date` is returned per entity, `stale` is set for any entity whose
 * reading is more than one whole period behind the newest reading on the
 * chart, and the component prints both — in words, not only as a shading.
 *
 * THE EARLIER BAR
 *
 * A shared baseline is used when one exists: the latest of every entity's
 * first period, if every entity actually has a value at exactly that period.
 * Where that fails — the adoption panel is the live case, since the UK holds
 * only 2020 and Eurostat has no 2020 at all — each entity falls back to its
 * OWN earliest reading and the caller is told the baselines differ, because
 * "since 2021" across a set where four countries start elsewhere is a claim
 * about comparability that the data does not support.
 */
export function rankEntities(series, { cadence = 'annual' } = {}) {
  const drawn = series
    .map((s) => ({ ...s, values: s.points.filter((p) => p.value != null && Number.isFinite(p.value)) }))
    .filter((s) => s.values.length > 0);

  if (drawn.length === 0) {
    return {
      entities: [],
      newestDate: null,
      sharedBaselineDate: null,
      baselinesDiffer: false,
      staleCount: 0,
      olderCount: 0,
      domain: [0, 1],
    };
  }

  const newestDate = drawn
    .map((s) => s.values.at(-1).date)
    .reduce((a, b) => (a > b ? a : b));

  const sharedBaselineDate = findSharedBaseline(drawn);

  const entities = drawn
    .map((s) => {
      const latest = s.values.at(-1);
      const baseline = sharedBaselineDate
        ? s.values.find((p) => p.date === sharedBaselineDate)
        : s.values[0];
      const usable = baseline && baseline.date !== latest.date ? baseline : null;
      const behind = daysBetween(latest.date, newestDate);

      return {
        label: s.label,
        panel: s.panel ?? null,
        latest: { date: latest.date, value: latest.value },
        baseline: usable ? { date: usable.date, value: usable.value } : null,
        readings: s.values.length,
        // Strictly MORE than one whole period, so the ordinary publication lag
        // between two monthly releases is not dressed up as a warning.
        stale: behind > (PERIOD_DAYS[cadence] ?? PERIOD_DAYS.annual),
      };
    })
    // Descending by the latest value, then by name so the order is stable when
    // two entities read the same.
    .sort((a, b) => b.latest.value - a.latest.value || a.label.localeCompare(b.label));

  const values = entities.flatMap((e) => [e.latest.value, e.baseline?.value]).filter((v) => v != null);

  return {
    entities,
    newestDate,
    sharedBaselineDate,
    baselinesDiffer:
      sharedBaselineDate === null &&
      new Set(entities.map((e) => e.baseline?.date).filter(Boolean)).size > 1,
    staleCount: entities.filter((e) => e.stale).length,
    // Every reading not from the newest period, whether or not it is far enough
    // behind to be marked. This is what "taken before X" means, and it is the
    // number the reader-facing sentence has to use.
    olderCount: entities.filter((e) => e.latest.date < newestDate).length,
    /*
     * A BAR CHART MAY NEVER TRUNCATE — HONESTY.md behaviour 4. The encoding is
     * length, so a floor above zero rescales the claim rather than the view.
     * Clamped here rather than left to the component, so there is nowhere for a
     * prop to be added later.
     */
    domain: [Math.min(0, ...values), Math.max(0, ...values)],
  };
}

/** The latest first-period that every entity actually holds a value at, or null. */
function findSharedBaseline(drawn) {
  const candidate = drawn.map((s) => s.values[0].date).reduce((a, b) => (a > b ? a : b));
  const everyoneHasIt = drawn.every((s) => s.values.some((p) => p.date === candidate));
  const isSomeonesLatest = drawn.some((s) => s.values.at(-1).date === candidate);
  return everyoneHasIt && !isSomeonesLatest ? candidate : null;
}

/**
 * Split ranked entities into the panels the editorial layer declared.
 *
 * Two instruments that are not comparable at the level must not be ranked
 * against each other in one column — Eurostat's `isoc_eb_ai` is one harmonised
 * survey run to one definition, while OECD's `DSD_ICT_B` compiles whatever each
 * national statistics office asked. db/seeds/020_ai_adoption_panel.sql says so
 * in its own header and in the chart's stored caption; this is that statement
 * made visible instead of only written down.
 *
 * A group with no declared panels is one panel, unnamed. The label is never
 * inferred from an indicator id prefix: which instrument a series belongs to is
 * an editorial fact and it comes from the editorial layer.
 */
export function panelsOf(entities) {
  const panels = [];
  const byName = new Map();
  for (const entity of entities) {
    const name = entity.panel ?? '';
    if (!byName.has(name)) {
      const panel = { name, entities: [] };
      byName.set(name, panel);
      panels.push(panel);
    }
    byName.get(name).entities.push(entity);
  }
  return panels;
}

// ===========================================================================
// Behaviour 13 — what a chart says to a reader who cannot see it
// ===========================================================================

/**
 * The sentence a screen reader is given instead of the picture.
 *
 * Everything in it is read off the same points the chart draws: how many
 * series, at what cadence, in what unit, over what range, and for each series
 * where it ended and where it started. Nothing is characterised — no "sharp
 * rise", no "broadly flat" — because that would be the front end authoring a
 * claim, which is the one thing it does not do.
 */
export function describeSeriesChart(series, { cadence = 'annual', unit = '', indexed = false } = {}) {
  const drawn = series
    .map((s) => ({ label: s.label, values: s.points.filter((p) => p.value != null) }))
    .filter((s) => s.values.length > 0);

  if (drawn.length === 0) return 'Line chart with no data drawn.';

  const scale = indexed
    ? 'index points, 100 at the first shared period'
    : displayUnit(unit) || 'unstated units';

  const head =
    `Line chart. ${drawn.length} ${drawn.length === 1 ? 'series' : 'series'}, ` +
    `${cadence}, measured in ${scale}.`;

  const bodies = drawn.map((s) => {
    const first = s.values[0];
    const last = s.values.at(-1);
    if (s.values.length === 1) {
      return `${s.label}: one reading, ${fmt(last.value)} in ${fmtDate(last.date, cadence)}.`;
    }
    const direction =
      last.value > first.value ? 'up from' : last.value < first.value ? 'down from' : 'level with';
    return (
      `${s.label}: ${fmt(last.value)} in ${fmtDate(last.date, cadence)}, ` +
      `${direction} ${fmt(first.value)} in ${fmtDate(first.date, cadence)}.`
    );
  });

  return [head, ...bodies].join(' ');
}

/**
 * The same, for the ranked bar form — where the periods are the load-bearing
 * part, and where the panels are.
 *
 * Described PANEL BY PANEL when there is more than one, because a single
 * "highest / lowest" across two panels is exactly the one ranking the panels
 * exist to deny: a Eurostat reading and an OECD one are not comparable at the
 * level, so a spoken version that ranks them together would say something the
 * drawn version refuses to.
 */
export function describeRankedChart(ranked, { unit = '', cadence = 'annual', decimals = 1 } = {}) {
  const { entities, newestDate, staleCount } = ranked;
  if (entities.length === 0) return 'Ranked bar chart with no data drawn.';

  const scale = displayUnit(unit) || 'unstated units';
  const panels = panelsOf(entities);

  const head =
    `Ranked bar chart. ${entities.length} entities ordered by their most recent reading, ` +
    `measured in ${scale}` +
    (panels.length > 1
      ? `, in ${panels.length} panels ranked separately because they are not comparable at the level.`
      : '.');

  const ends = panels.map((panel) => {
    const top = panel.entities[0];
    const bottom = panel.entities.at(-1);
    const where = panel.name ? `${panel.name} — h` : 'H';
    return (
      `${where}ighest ${top.label}, ${fmt(top.latest.value, decimals)} in ` +
      `${fmtDate(top.latest.date, cadence)}. Lowest ${bottom.label}, ` +
      `${fmt(bottom.latest.value, decimals)} in ${fmtDate(bottom.latest.date, cadence)}.`
    );
  });

  const older = entities.filter((e) => e.latest.date < newestDate);
  const marked = entities.filter((e) => e.stale);

  const vintage =
    older.length === 0
      ? `Every reading is from ${fmtDate(newestDate, cadence)}.`
      : `${older.length} of these ${entities.length} ` +
        `${older.length === 1 ? 'readings is' : 'readings are'} older than ` +
        `${fmtDate(newestDate, cadence)}, so they are not measurements of the same moment: ` +
        older.map((e) => `${e.label} ${fmtDate(e.latest.date, cadence)}`).join(', ') +
        '. ' +
        (marked.length > 0
          ? `${marked.length} of those ${marked.length === 1 ? 'is' : 'are'} more than one ` +
            `period behind and ${marked.length === 1 ? 'is' : 'are'} marked on the chart. `
          : '') +
        'Each bar is labelled with its own period.';

  return [head, ...ends, vintage].join(' ');
}

/**
 * How many rows of a hidden data table are worth rendering.
 *
 * A 439-point monthly series times eight countries is 3,500 cells of hidden
 * DOM per chart, and a question page carries several. The table is capped and
 * the cap is STATED in its caption with the true total, because a silently
 * shortened table is the same failure as a silently truncated axis — and the
 * indicator page holds the whole series either way.
 */
export const TABLE_ROW_CAP = 240;

/** The chart's points as a table: one row per period, one column per series. */
export function seriesTableModel(series, { cadence = 'annual', cap = TABLE_ROW_CAP } = {}) {
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const kept = dates.slice(Math.max(0, dates.length - cap));

  const byLabel = series.map((s) => [s.label, new Map(s.points.map((p) => [p.date, p.value]))]);

  return {
    columns: ['Period', ...series.map((s) => s.label)],
    rows: kept.map((date) => ({
      key: date,
      cells: [
        fmtDate(date, cadence),
        ...byLabel.map(([, points]) => {
          const value = points.get(date);
          return value == null ? 'no data' : fmt(value);
        }),
      ],
    })),
    total: dates.length,
    truncated: dates.length > kept.length,
  };
}

/** The ranked form as a table: one row per entity, both readings and both periods. */
export function rankedTableModel(ranked, { cadence = 'annual', decimals = 1 } = {}) {
  return {
    columns: ['Entity', 'Latest reading', 'Period of that reading', 'Earlier reading', 'Period of the earlier reading'],
    rows: ranked.entities.map((e) => ({
      key: e.label,
      cells: [
        e.panel ? `${e.label} (${e.panel})` : e.label,
        fmt(e.latest.value, decimals),
        fmtDate(e.latest.date, cadence),
        e.baseline ? fmt(e.baseline.value, decimals) : 'no earlier reading',
        e.baseline ? fmtDate(e.baseline.date, cadence) : '—',
      ],
    })),
    total: ranked.entities.length,
    truncated: false,
  };
}

/** A report figure's bars as a table. `basis` is a column only when one is recorded. */
export function figureTableModel(points, { decimals = 0, unitSymbol = '' } = {}) {
  const hasSeries = points.some((p) => (p.series ?? '') !== '');
  const hasBasis = points.some((p) => p.basis);

  return {
    columns: [
      'Label',
      ...(hasSeries ? ['Series'] : []),
      'Value',
      ...(hasBasis ? ['What this number is'] : []),
    ],
    rows: points.map((p, i) => ({
      key: `${p.series ?? ''}-${p.label}-${i}`,
      cells: [
        p.label,
        ...(hasSeries ? [p.series || '—'] : []),
        `${fmt(Number(p.value), decimals)}${unitSymbol ?? ''}`,
        ...(hasBasis ? [BASIS_WORDS[p.basis] ?? 'not recorded'] : []),
      ],
    })),
    total: points.length,
    truncated: false,
  };
}

/**
 * What each `basis` value means to a reader, in words rather than a category.
 *
 * `measured` is deliberately spelled out too. Seed 029 established that a
 * forecast drawn in the ink of a measurement is the failure this project
 * exists to prevent; the counterpart is that a measurement sitting beside a
 * forecast has to be named as one, or the distinction rests on the absence of
 * a marker — which nobody reads.
 */
export const BASIS_WORDS = {
  measured: 'measured or reported as already happened',
  projected: 'a projection, not a measurement',
  scenario: 'one scenario of several, not a forecast',
  expectation: 'what respondents expect, not what has been measured',
};

/** The note that goes ABOVE a figure whose bars are not all measurements. */
export function figureBasisNote(points) {
  const marked = points.filter((p) => p.basis && p.basis !== 'measured');
  if (marked.length === 0) return null;

  const kinds = [...new Set(marked.map((p) => p.basis))];
  const allOfThem = marked.length === points.length;

  // Named per series where a series carries the distinction, because "part of
  // this figure is a forecast" leaves a reader unable to tell which bars.
  const named = [...new Set(marked.map((p) => p.series).filter(Boolean))];

  const what = kinds.map((k) => BASIS_WORDS[k]).join('; ');

  if (allOfThem) return `Every bar here is ${what} — drawn hatched, not solid.`;
  if (named.length > 0) {
    return `Drawn hatched, not solid: ${named.join(' and ')} — ${what}.`;
  }
  return `${marked.length} of these ${points.length} bars are ${what} — drawn hatched, not solid.`;
}

/**
 * The sentence a screen reader gets instead of a report figure's bars.
 *
 * Same rule as the series version: read off the points, characterise nothing.
 * The basis is named where one is recorded, because "projected" is the single
 * most load-bearing word on some of these figures and it is currently carried
 * only by the title.
 */
export function describeFigureChart(points, { unit = '', decimals = 0, unitSymbol = '' } = {}) {
  if (points.length === 0) return 'Figure with no bars drawn.';

  const seriesNames = [...new Set(points.map((p) => p.series ?? '').filter(Boolean))];
  const head =
    `Bar chart, ${points.length} bars` +
    (seriesNames.length > 1 ? ` across ${seriesNames.length} series` : '') +
    `, measured in ${displayUnit(unit) || 'unstated units'}, drawn from a zero baseline.`;

  const bars = points.map((p) => {
    const name = p.series ? `${p.series}, ${p.label}` : p.label;
    const basis = p.basis && p.basis !== 'measured' ? ` — ${BASIS_WORDS[p.basis]}` : '';
    return `${name}: ${fmt(Number(p.value), decimals)}${unitSymbol}${basis}.`;
  });

  return [head, ...bars].join(' ');
}

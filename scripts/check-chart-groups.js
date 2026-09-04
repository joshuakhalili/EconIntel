/**
 * Chart-group width verification.
 *
 * WHY THIS EXISTS
 *
 * A `chart_group` is the editorial statement that these indicators belong on
 * one pair of axes. There are exactly six CVD-validated hues, so six is also
 * the honest maximum number of series on a chart that encodes identity BY
 * COLOUR: beyond it two different countries are drawn in the same colour under
 * a legend claiming they are distinguishable.
 *
 * `ChartGroup` already refuses to draw past that (`exceedsPalette`, see
 * components/charts/palette.js and HONESTY.md behaviour 10) — but a refusal is
 * a run-time event on a page a reader is already looking at. `/q/adoption`
 * shipped with `ai-adoption-panel` holding 16 country series and nobody knew:
 * the page rendered "Could not load Germany — Enterprises using AI", then a
 * box of apology where the evidence should be. Nothing in the build had
 * anything to say about it, because the fault is in the DATA, and every
 * file-reading guard this repo owns is quantified over source.
 *
 * This asks the database the one question that would have caught it.
 *
 *     npm run check:charts
 *
 * TWO CORRECTIONS TO THE FIRST VERSION OF THIS FILE
 *
 * 1. IT COUNTED PER GROUP, AND THE FRONT END DRAWS PER QUESTION.
 *
 *    `repositories/questions.js` fetches indicators `WHERE qi.question_id = $1`
 *    and `lib/groupIndicators.js` groups what comes back, so the number of
 *    series on one chart is the count per (chart_group, question_id) — never
 *    the count per chart_group. `enterprise-ai` has eight rows: four on
 *    `adoption` and four DIFFERENT ones on `diffusion-speed`. It was reported
 *    as a third broken group, in this file's own header and in the QA brief,
 *    and it has never refused to draw on any page. Counting it the way the app
 *    reads it is the only count that means anything.
 *
 * 2. THE CEILING IS A FACT ABOUT COLOUR, SO IT ONLY BINDS COLOUR-CODED FORMS.
 *
 *    `chart_forms.form` (db/migrations/0025) records the form a person chose
 *    for a group. A `ranked-bars` group draws every bar in ONE hue — colour
 *    encodes nothing there — so more entities than hues makes nothing
 *    ambiguous and the ceiling does not apply. Exempting it is not a loosening:
 *    a group with no ruling is still a line chart and still bound, which is
 *    what the two flagship failures were.
 *
 * WHY IT IS STILL NOT IN THE `build` CHAIN
 *
 * Two reasons, and the first is temporary. 0025 and db/seeds/037_chart_form.sql
 * are written but NOT YET APPLIED — the live database has neither `chart_forms`
 * nor the rulings in it — so this gate is still red on ai-adoption-panel and
 * youth-unemployment until someone runs the migration and the seed. Wiring a
 * red gate into `build` trains people to skip it, which is how the nightly
 * ingest's permanent failure taught everyone to ignore a red X.
 *
 * The second reason is permanent, and it is the one check-data.js gives: this
 * needs a reachable database, and a front-end build that fails when Postgres is
 * asleep is a build people learn to work around.
 *
 * Exit code is non-zero if any group is over the ceiling.
 */

import { pool, closePool } from '../src/server/db/pool.js';
import { SERIES_COLORS } from '../src/client/lib/format.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/**
 * The ceiling is the palette, read from the palette.
 *
 * Not a literal 6. Written as a number here it would be a second place to
 * update, and the failure of restating a list rather than deriving it is
 * exactly what let check-contrast.js miss a seventh hue for months.
 */
const MAX_SERIES = SERIES_COLORS.length;

/**
 * Which charts are over the ceiling, and which are exempt from it.
 *
 * Exported and self-contained so `honesty.test.js` can read it out of this
 * file and exercise it without a database — the same trick it already uses on
 * palette.js. A gate whose decision has never been run against a case it
 * should REJECT has proved nothing.
 *
 * A form is bound by the palette only if colour carries series identity in it.
 * `ranked-bars` draws every bar in one hue, so more entities than hues makes
 * nothing ambiguous. A group with NO declared form is treated as a line chart,
 * because that is what it will render as.
 */
export function classifyGroups(rows, max) {
  const COLOUR_CODED = new Set(['line']);
  const wide = rows.filter((r) => r.members > max);
  return {
    over: wide.filter((r) => COLOUR_CODED.has(r.form ?? 'line')),
    exempt: wide.filter((r) => !COLOUR_CODED.has(r.form ?? 'line')),
  };
}

/*
 * `chart_forms` may not exist yet: 0025 is written and may not be applied. A
 * gate that crashes on a pending migration reports nothing about the thing it
 * was written to catch, so the absence is handled as "no group has a ruling",
 * which is exactly what it means.
 */
const { rows: formTable } = await pool.query(`SELECT to_regclass('chart_forms') IS NOT NULL AS present`);
const formsExist = formTable[0].present;

const { rows } = await pool.query(
  `SELECT qi.chart_group,
          qi.question_id,
          count(*)::int                                    AS members,
          ${formsExist ? 'cf.form::text' : 'NULL::text'}    AS form,
          string_agg(qi.indicator_id || coalesce('/' || qi.country_iso3, ''),
                     ', ' ORDER BY qi.sort_order, qi.indicator_id) AS member_list
     FROM question_indicators qi
     ${formsExist ? 'LEFT JOIN chart_forms cf ON cf.chart_group = qi.chart_group' : ''}
    WHERE qi.chart_group IS NOT NULL
    GROUP BY qi.chart_group, qi.question_id${formsExist ? ', cf.form' : ''}
   ORDER BY count(*) DESC, qi.chart_group, qi.question_id`
);

await closePool();

const { over, exempt } = classifyGroups(rows, MAX_SERIES);

if (!formsExist) {
  console.log(
    `${YELLOW}!${RESET} ${DIM}chart_forms does not exist in this database — ` +
      `db/migrations/0025 is not applied, so every group is being read as a line chart.${RESET}`
  );
}

for (const row of exempt) {
  console.log(
    `${DIM}·${RESET} ${row.chart_group} on ${row.question_id} holds ${row.members} series and is ` +
      `exempt: ${DIM}form '${row.form}' does not encode by colour${RESET}`
  );
}

if (over.length === 0) {
  console.log(
    `${GREEN}✓${RESET} every colour-coded chart fits the palette ` +
      `${DIM}(${rows.length} group/question pairs, none over ${MAX_SERIES} series)${RESET}`
  );
  process.exit(0);
}

console.error(
  `\n${RED}✗ ${over.length} chart(s) hold more series than there are validated hues${RESET}`
);
console.error(
  `  ${DIM}The palette is ${MAX_SERIES} hues (${SERIES_COLORS.join(' ')}). A colour-coded chart ` +
    `with more\n  series than that cannot be drawn honestly, so ChartGroup refuses — and a reader ` +
    `of a\n  live page gets a box of apology where the evidence should be.${RESET}`
);

for (const row of over) {
  console.error(
    `\n  ${RED}${row.chart_group}${RESET} — ${row.members} members ` +
      `${DIM}(${row.members - MAX_SERIES} over the ceiling)${RESET}`
  );
  console.error(`    ${YELLOW}on${RESET} ${row.question_id}`);
  console.error(`    ${DIM}${row.member_list}${RESET}`);
}

console.error(
  `\n  ${DIM}The fix is editorial, not a code change: give the group a row in chart_forms\n` +
    `  naming a form that does not encode by colour (ranked-bars), or split it so each\n` +
    `  chart holds at most ${MAX_SERIES}. See db/seeds/037_chart_form.sql.${RESET}`
);

process.exit(1);

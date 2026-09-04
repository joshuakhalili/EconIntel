/**
 * Grounded narration — the LLM layer, and the gate that makes it safe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULE THIS FILE EXISTS TO ENFORCE
 *
 *   An LLM is never asked to invent a number or a citation. It is handed
 *   SQL-computed values and stored claims, and asked to connect them in a
 *   sentence.
 *
 * That rule has been written down since `0006_analysis.sql`. Until this file
 * existed it was enforced by nothing at all — a grill session on 2026-08-28
 * found it stated in STATUS.md as governing fact with zero code behind it, and
 * STATUS has carried an explicit "this is schema, not enforcement" warning ever
 * since. This is the enforcement.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * HOW IT IS ENFORCED: THE OUTPUT IS CHECKED, NOT THE PROMPT
 *
 * A prompt that says "do not invent numbers" is a request. Models comply with
 * it most of the time, which is the worst possible reliability profile for a
 * site whose entire claim is that its figures are real: the failure is rare,
 * silent, and indistinguishable from success.
 *
 * So the prompt is not the control. `validate()` is. Every numeric token in the
 * model's output must appear in the grounding it was given. One that does not
 * fails the whole narration, and a failed narration is NOT STORED and NOT
 * SHOWN — the page renders without it. Fail closed, always: a missing
 * paragraph costs a reader nothing, and a fabricated figure costs this project
 * the only thing it has.
 *
 * WHY THE CHECK IS ON NUMBERS AND NOT ON MEANING
 *
 * Checking whether prose is *true* needs a judge as capable as the writer, and
 * a second model marking the first one's work is not a control, it is a second
 * opinion. Checking whether every number is one we supplied is decidable — it
 * is set membership — and it happens to catch the failure that actually
 * matters here. A model that writes "productivity rose sharply" from data
 * showing a rise is doing its job. A model that writes "rose 4.2%" when 4.2
 * was never given to it has fabricated a measurement, and that is the thing
 * this site cannot ship.
 *
 * WHAT THE CHECK CANNOT CATCH, STATED PLAINLY
 *
 *   - Numbers written as words. "rose by three percent" passes. Mitigated by
 *     instructing digits and by NUMBER_WORDS below, not eliminated.
 *   - A real number used to say something false. 74,041 is in the grounding;
 *     "74,041 countries" would pass. The numbers are guaranteed, the sentences
 *     around them are not.
 *   - Attribution. Handled separately: any URL, DOI or quotation mark in the
 *     output is rejected outright, because a citation is exactly what this
 *     model is never allowed to produce.
 *
 * These are limits, not excuses. They are why every narration renders labelled
 * as machine-written with its grounding available — see `NarrationBlock` on
 * the client.
 *
 * MEASURED, NOT ASSUMED (2026-08-30, @cf/meta/llama-3.1-8b-instruct)
 *
 * Six generations from the real prompt against real lens data: 6 accepted, 0
 * rejected. So the gate is not so strict that the feature can never render,
 * which is the failure mode a strict gate usually has.
 *
 * Four generations from a deliberately adversarial prompt — one that asked for
 * percentage changes, historical context and the name of the publishing agency,
 * i.e. for exactly the three things the rules forbid: 4 rejected, 0 accepted.
 * What it caught, verbatim from the run:
 *
 *   -3.7%          arithmetic the model performed on two supplied levels
 *   2021, 2022,    invented historical context for a series it was handed
 *   2023           two data points of
 *   0.6, 0.8, 0.9  figures with no origin at all
 *
 * One of those four also wrote that the index "has been trending upward"
 * about a series that went 30.1 to 29.0. The gate rejected it — but on the
 * numbers, not on the falsehood, and that is worth keeping in mind. It
 * guarantees arithmetic, not truth.
 */

import { createHash } from 'node:crypto';
import { query } from '../db/pool.js';
import { config } from '../config.js';

/**
 * Bump to invalidate every cached narration at once.
 *
 * The cache key is (scope, input_hash, prompt_version). Changing the prompt
 * without changing this returns prose written by the OLD prompt from the
 * cache, indefinitely, which is the kind of bug that is discovered months
 * later by reading something that sounds wrong.
 */
export const PROMPT_VERSION = 'v1-2026-08-30';

/** Never invent, never cite, never round. Short because the model is 8B. */
const SYSTEM_PROMPT = [
  'You describe economic data for a public dashboard.',
  '',
  'ABSOLUTE RULES:',
  '1. Use ONLY the numbers given to you in the DATA block. Never calculate a',
  '   new number, never estimate, never round, never convert units.',
  '2. Write every number exactly as it appears in the DATA block, digits and all.',
  '3. Never name a source, never give a URL, never quote anything.',
  '4. If the data does not support a claim, do not make it.',
  '5. Two sentences maximum. Plain English. No adjectives like "dramatic",',
  '   "explosive", "staggering".',
  '',
  'You are describing what the numbers show. You are not interpreting what it',
  'means for the future, and you never speculate about causes.',
].join('\n');

/**
 * Numbers a model may legitimately write without being handed them.
 *
 * Deliberately tiny. These are the counting words that appear in ordinary
 * English prose ("both of these", "the three series") rather than measurements.
 * Anything above ten is a figure and must come from the data.
 */
const NUMBER_WORDS = new Set([
  'zero', 'one', 'two', 'three', 'four', 'five',
  'six', 'seven', 'eight', 'nine', 'ten',
]);

/* ── The grounding ───────────────────────────────────────────────────────── */

/**
 * Every form of a number a model might reasonably write it in.
 *
 * The grounding holds 13.48; the model may write 13.48, 13.5, 13 or 13.480.
 * All four are the same measurement and rejecting the last three would make
 * the gate unusable while catching nothing — a fabricated figure is a
 * DIFFERENT number, not the same number with fewer decimals.
 *
 * What it must never do is admit a number that rounds to something in the
 * grounding but was not derived from it. That is why only the value itself is
 * expanded, never a range around it.
 */
function numericForms(value) {
  const forms = new Set();
  const n = Number(value);
  if (!Number.isFinite(n)) return forms;

  const add = (s) => {
    if (s === undefined || s === null) return;
    forms.add(String(s));
    // Thousands separators, both directions.
    forms.add(String(s).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  };

  add(n);
  for (const dp of [0, 1, 2, 3]) add(n.toFixed(dp));
  // Trailing-zero variants: 13.50 and 13.5 are one number.
  for (const form of [...forms]) {
    if (form.includes('.')) add(form.replace(/\.?0+$/, ''));
  }
  add(Math.round(n));
  add(Math.abs(n));
  return forms;
}

/**
 * Pull every number out of a grounding payload, whatever its shape.
 *
 * Walks the whole structure rather than reading known keys, because the
 * grounding is built per scope and a key added later must be covered
 * automatically. A number the model was shown but that this misses would be
 * rejected as a fabrication — annoying but safe; the reverse would not be.
 */
export function allowedNumbers(grounding) {
  const allowed = new Set();

  const walk = (node) => {
    if (node === null || node === undefined) return;
    if (typeof node === 'number') {
      for (const form of numericForms(node)) allowed.add(form);
      return;
    }
    if (typeof node === 'string') {
      // Dates and numeric strings. '2026-08-30' licenses 2026, 08, 30 and the
      // whole string: a model writing "in 2026" from a date it was given has
      // invented nothing.
      for (const token of node.match(/\d[\d,.]*/g) ?? []) {
        allowed.add(token);
        allowed.add(token.replace(/,/g, ''));
        for (const form of numericForms(Number(token.replace(/,/g, '')))) {
          allowed.add(form);
        }
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === 'object') {
      Object.values(node).forEach(walk);
    }
  };

  walk(grounding);
  return allowed;
}

/* ── The shapes a grounding comes in ─────────────────────────────────────── */

/**
 * WHY THE BUILDERS LIVE HERE AND NOT IN THE SCRIPTS THAT CALL THEM.
 *
 * Both of them started in `scripts/`, one per generator, and both moved for the
 * same reason: what a grounding LOOKS like is not a detail of the script that
 * happens to write one. Three other things depend on it, and each of them broke
 * once because the shape was decided somewhere they could not see.
 *
 *   `wrongDirection` has to be able to read the movement a grounding asserts.
 *   When the simulation script invented its own shape, the direction check went
 *   silently inert for every simulation narration — see `directionPairs`.
 *
 *   `NarrationBlock` on the client renders `grounding.series` and tells the
 *   reader it is showing the whole of what the model received. When the shape
 *   had no `series` key it rendered an empty list under that sentence.
 *
 *   A freshness check needs to rebuild today's grounding and compare its hash
 *   against the stored one. A builder locked inside a script is not importable
 *   by the repository that serves the page, so the check cannot be written.
 *
 * One exported shape, one place, one set of tests. `series` rows are
 * `{name, previous, latest, unit, period}` — `previous` may be null for a figure
 * with no comparison, and the client handles that.
 */

/**
 * A lens grounding: the ticker strip, as the site displays it.
 *
 * Every value is read from the database and NOT pre-differenced. It would be
 * easy to hand the model a `change` field and let it describe that, and it
 * would also mean the number a reader sees was produced here rather than by SQL
 * over stored observations. The levels and the periods are the facts; if a
 * change belongs on the page it should become an indicator.
 *
 * ROUNDED TO THE INDICATOR'S OWN `decimals`, AND THAT MATTERS
 *
 * The first run of the lens generator produced "the price of Copper moved down
 * from $13552.04090909091" — the raw double, straight out of Postgres. Two
 * things wrong with that, and the second is the real one:
 *
 *   - It is unreadable, and a summary written in sixteen significant figures is
 *     worse than no summary.
 *   - It DISAGREES WITH THE PAGE. The ticker beside it renders 13,552.04,
 *     because `indicators.decimals` says two. A reader seeing two different
 *     numbers for one price has no way to know which is the real one, and the
 *     honest answer — they are the same number — is not available to them.
 *
 * `decimals` is stored metadata, set per indicator, and it is what every other
 * surface on the site already formats with. Using it here is not a computation
 * the model is being spared; it is the grounding speaking the same language as
 * the chart. The validator accepts a value written to fewer decimals than it was
 * given, so this narrows what the model may write rather than widening it.
 *
 * Capped at six series. The whole point is a summary, and an 8B model handed
 * fourteen rows writes a list — which the labour lens proved on the first run.
 */
export function buildLensGrounding(lens, tickers) {
  const usable = (tickers ?? [])
    .filter((t) => Number.isFinite(t.latest_value))
    .slice(0, 6);

  /** As the site displays it. `decimals` is per-indicator and stored. */
  const asDisplayed = (value, decimals) => {
    if (!Number.isFinite(value)) return null;
    return Number(value.toFixed(decimals ?? 2));
  };

  return {
    lens: lens.name,
    series: usable.map((t) => ({
      name: t.label ?? t.name,
      unit: t.unit_symbol ?? t.unit ?? null,
      latest: asDisplayed(t.latest_value, t.decimals),
      previous: asDisplayed(t.previous_value, t.decimals),
      period: t.latest_period ?? null,
    })),
  };
}

/**
 * The output series a simulation's narration may write about — and no others.
 *
 * THE RULE: A FIGURE GOES IN THE GROUNDING ONLY IF THE PAGE DRAWS IT.
 *
 * These three are tabs a reader can actually put on the chart —
 * `SERIES_OPTIONS` in `routes/SimulationPage.jsx`. That list is no longer
 * identical to this one and this comment used to claim it was: the page added
 * an Output tab, so it now offers four and these are three of them. The rule
 * above is a floor, not an equality — the page may draw a figure this file
 * withholds, but this file must never narrate one the page does not draw. A run
 * also carries `output_gap_pp`, `unemployment_gap_pp` and `inflation_gap_pp`,
 * and each is left out on purpose rather than by oversight — see
 * `SIMULATION_WITHHELD`, which now carries the reason the fourth tab is not the
 * fourth row here.
 *
 * Unemployment and inflation are LEVELS and carry a published baseline; wage
 * growth is a DEVIATION because nobody publishes trend nominal wage growth and
 * deriving one would be this project inventing the number it says it never
 * invents. The labels are the page's labels, so a reader comparing the paragraph
 * against the chart is reading the same words.
 */
const SIMULATION_SERIES = [
  { key: 'unemployment_pct', label: 'Unemployment', unit: '%' },
  { key: 'inflation_pct', label: 'Inflation', unit: '%' },
  { key: 'wage_growth_gap_pp', label: 'Wage growth vs trend', unit: 'pp' },
];

/**
 * Run outputs deliberately withheld, and why each one.
 *
 * `year` indexes the row. The three `_gap_pp` figures are the same information
 * as the level beside them — a level IS its baseline plus its gap — so including
 * them would hand an 8B model two ways to say one thing and a set of small,
 * similar decimals to confuse with each other, for nothing a reader gains.
 * `output_gap_pp` is the first link in the chain and genuinely interesting, and
 * it is still withheld — but NOT for the reason this comment used to give. It
 * said the page has no tab for it. The page has had one since the Output tab
 * was added, so that reason is gone and a truer one has to stand in its place,
 * or the next person reading this adds the row and ships a hole.
 *
 * THE REAL REASON: A ROW HERE IS ONLY DIRECTION-CHECKED IF IT HAS A `previous`.
 *
 * `directionPairs` builds its pairs from (`previous`, `latest`), and skips any
 * row whose `previous` is not a finite number — correctly, since `Number(null)`
 * is 0 and coercing would invent a movement from zero that nothing claimed. A
 * simulation grounding takes `previous` from `run.baseline`, and the baseline
 * carries no `output_gap_pp`: the model reports output as a deviation and never
 * states a no-injection level for it. So an Output row would arrive with
 * `previous: null`, produce no pair, and `wrongDirection` would decline to look
 * at any sentence written about it. Measured on the real USA run at the
 * scenario's default: the grounding holds five series rows and `directionPairs`
 * returns three — the two shock rows, which also carry `previous: null`, are
 * the other two it cannot see.
 *
 * That is the same silence the wage series was in until the vocabulary was
 * fixed below, arriving by a different route, and it is why the tidy-looking
 * change is the wrong one. Making Output narratable means giving the model's
 * baseline an `output_gap_pp` of zero first — which is a change to the SHAPE of
 * a run, and therefore a `MODEL_VERSION` bump. Owner's call, not a comment fix.
 *
 * Declared as a list rather than simply not selected, so that a metric added to
 * the model later is neither silently narrated nor silently dropped — see the
 * unaccounted-key branch below.
 */
const SIMULATION_WITHHELD = new Set([
  'year',
  'output_gap_pp',
  'unemployment_gap_pp',
  'inflation_gap_pp',
]);

/**
 * A simulation grounding: the run, as the series rows the client renders and
 * the gate can read.
 *
 * `previous` is the NO-INJECTION baseline and `latest` is the final year of the
 * horizon, because that pair is the model's actual claim: this is what the shock
 * did. Both figures are drawn on the page — the baseline as the dashed line, the
 * final year as the last point of the solid one — so every number the model may
 * write is one the reader can find on the chart above it.
 *
 * Intermediate years are not included, which narrows what the model may say to
 * the two endpoints. That is a real loss and the right one: the alternative is
 * fifteen rows in an audit panel and five near-identical decimals per metric for
 * a two-sentence summary to confuse.
 *
 * @param {string} scenarioName
 * @param {string} countryIso3
 * @param {{years: object[], baseline: object, shock: object}} run
 */
export function buildSimulationGrounding(scenarioName, countryIso3, run) {
  const last = run.years[run.years.length - 1];
  const horizon = last.year;
  /* Digits, not "year five". `allowedNumbers` licenses numbers it can see in the
     grounding, and the model writes the horizon both ways; spelling it in words
     here would leave "year 5" as a fabricated figure and reject an otherwise
     honest sentence. */
  const period = `no injection → year ${horizon}`;

  const series = [
    {
      name: 'New capital spending',
      previous: null,
      latest: run.shock.usd_bn,
      unit: '$bn',
      /* The flag, in words. `sustained: true` would put a bare 1 or 0 in the
         grounding and license it as a figure the model may write. */
      period: run.shock.sustained ? 'repeated every year' : 'one-off, in year one',
    },
    {
      name: 'That spending as a share of output',
      previous: null,
      latest: run.shock.share_of_gdp_pct,
      unit: '%',
      period: null,
    },
  ];

  const baselineOf = (key) =>
    Number.isFinite(run.baseline?.[key]) ? run.baseline[key] : null;

  for (const { key, label, unit } of SIMULATION_SERIES) {
    if (!Number.isFinite(last[key])) continue;
    series.push({ name: label, previous: baselineOf(key), latest: last[key], unit, period });
  }

  /*
   * A model output that is in neither list is a mistake somewhere, and the safe
   * direction is loud. Dropping it silently would rebuild the bug this shape
   * exists to fix — a number in the model's world that the audit panel does not
   * show — and narrating it silently would put an unlabelled figure in front of
   * a reader. So it goes in under its raw key, which is ugly enough to notice.
   */
  for (const [key, value] of Object.entries(last)) {
    if (SIMULATION_WITHHELD.has(key)) continue;
    if (SIMULATION_SERIES.some((s) => s.key === key)) continue;
    if (!Number.isFinite(value)) continue;
    console.warn(
      `[narration] "${key}" is a model output with no label — add it to ` +
        'SIMULATION_SERIES or SIMULATION_WITHHELD in lib/narration.js'
    );
    series.push({ name: key, previous: baselineOf(key), latest: value, unit: null, period });
  }

  return { scenario: scenarioName, country: countryIso3, series };
}

/* ── The gate ────────────────────────────────────────────────────────────── */

/**
 * Check a narration against the data it was given.
 *
 * @returns {{ok: true} | {ok: false, reason: string, offending: string[]}}
 */
export function validate(body, grounding) {
  if (typeof body !== 'string' || body.trim().length === 0) {
    return { ok: false, reason: 'empty', offending: [] };
  }

  /*
   * A citation is the one thing this model may never produce, and it is
   * cheap to detect. Rejected outright rather than stripped: a model that
   * reached for a source has misunderstood the task, and the rest of what it
   * wrote is not more trustworthy for having had the URL removed.
   */
  if (/https?:\/\/|www\.|doi\.org|\b10\.\d{4}\//i.test(body)) {
    return { ok: false, reason: 'contains a URL or DOI', offending: [] };
  }
  if (/["“”]/.test(body)) {
    return { ok: false, reason: 'contains a quotation', offending: [] };
  }
  /*
   * "according to", "sources say", "reported by" — attribution without a URL
   * is still attribution, and this model has no sources to attribute to.
   */
  const attribution = body.match(
    /\b(according to|as reported|sources? (say|suggest|indicate)|cited by|per the)\b/i
  );
  if (attribution) {
    return { ok: false, reason: `attributes a source ("${attribution[0]}")`, offending: [] };
  }

  const allowed = allowedNumbers(grounding);
  const offending = [];

  for (const token of body.match(/\d[\d,]*(?:\.\d+)?/g) ?? []) {
    const bare = token.replace(/,/g, '');
    if (allowed.has(token) || allowed.has(bare)) continue;
    // A percentage the model wrote as 13.5 from a grounding value of 0.135 is
    // still a calculation it was told not to do — so no unit conversion is
    // admitted here on purpose.
    offending.push(token);
  }

  if (offending.length > 0) {
    return {
      ok: false,
      reason: `${offending.length} number(s) not in the grounding`,
      offending,
    };
  }

  const backwards = wrongDirection(body, grounding);
  if (backwards) {
    return { ok: false, reason: `states the wrong direction (${backwards})`, offending: [] };
  }

  return { ok: true };
}

/*
 * The direction vocabulary.
 *
 * `ris(?:e|es|en|ing)` is spelled out rather than written `ris\w*` for one
 * reason: `ris\w*` matches "risk", which is a word this prose uses constantly
 * and which claims no direction at all. Every other verb here can take `\w*`
 * safely because no unrelated word shares its stem.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * `grow\w*` MATCHED "growth", AND THAT SWITCHED THE CHECK OFF FOR A WHOLE SERIES
 *
 * The noun is not a claim about direction; it is part of the NAME of a
 * measurement. `SIMULATION_SERIES` calls its third row "Wage growth vs trend",
 * so every clause a model writes about that series carried a rising word before
 * it said anything at all. Put a falling verb beside it — the ordinary way to
 * describe a wage path that drops — and the clause holds one word from each
 * list, which this function treats as undecidable and skips. Measured on the
 * real USA run at the scenario's default slider position:
 *
 *   "Wage growth vs trend falls from 0 with no injection to 0.08 by year five."
 *     → validate() returned {ok: true}
 *
 * Both figures are in the grounding, so the number gate passed it, and 0 → 0.08
 * is a RISE. The same sentence about unemployment or inflation was rejected. One
 * of the three series the page draws had no direction gate at all.
 *
 * It is not only the simulation. Four active indicators are named "… Growth"
 * (wb.NY.GDP.MKTP.KD.ZG, "GDP Growth (annual %)", among them) and one of the
 * five lenses is called "Growth & Productivity" — every one of those names
 * reaches a grounding, so the lens path had the same hole under different words.
 *
 * So the verb forms stay and the noun goes: `grow`, `grows`, `growing`, `grown`
 * and `grew` all claim a direction, "growth" does not. The cost is a sentence
 * whose ONLY direction word is that noun — "growth from 4.0 to 5.0" — which is
 * now read as undecidable and passes unchecked. That is the cheaper mistake by
 * a distance: it loses a check on one unusual phrasing, where the old spelling
 * lost every check on any series whose name contains the word.
 *
 * THE RULE THIS LEAVES BEHIND, for whoever adds a word here: a term that can
 * appear in the NAME of a measurement must not be in either list. "fall",
 * "drop", "decline" and "lower" are all nouns or adjectives too, and none of
 * them is currently in any indicator name — checked, all 134 active rows — but
 * the day one is, the same silence comes back on the falling side.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * IT USED TO SAY `rise`, WITH A WORD BOUNDARY, AND SO IT NEVER MATCHED "rises".
 *
 * Found while reproducing the simulation gap below: `\brise\b` fails on
 * "rises" and on "risen", which is the ordinary third person a model writes in
 * — "Unemployment rises from 4.02 to 3.72" registered as NO direction word at
 * all, the clause was read as undecidable, and the check declined to look. That
 * is a hole in the LENS path too, not only the simulation one, and it is the
 * quietest possible kind: the gate returns "nothing wrong here" rather than
 * failing.
 *
 * `shrink\w*` for the same reason — the list already carried `shrank` and only
 * `shrank`, so the present tense of a verb it had already decided to cover fell
 * through.
 */
const FALLING =
  /\b(decreas\w*|fell|fall\w*|drop\w*|declin\w*|down|lower|shrank|shrink\w*|slid)\b/i;
const RISING =
  /\b(increas\w*|rose|ris(?:e|es|en|ing)|grew|grow(?:s|n|ing)?|climb\w*|up|higher|gain\w*|jump\w*)\b/i;

/**
 * Keys in a projection row that index the row rather than measure anything.
 *
 * `year` counts 1, 2, 3 … so first-to-last is always "a rise" and always
 * meaningless. Pairing on it would let a clause about a real fall be matched
 * against the horizon and rejected, which is a false accusation on a correct
 * sentence — the one failure a gate this strict cannot afford.
 */
const PROJECTION_INDEX_KEYS = new Set(['year', 'period', 't']);

/**
 * Every (previous, latest) pair the grounding asserts, at any depth.
 *
 * TWO SHAPES, BECAUSE THERE ARE TWO KINDS OF GROUNDING AND ONE OF THEM WAS
 * INVISIBLE HERE.
 *
 * A lens grounding states its pairs outright: each series row carries
 * `previous` and `latest`, so the true sign is written down. That is the shape
 * this function was built for and it is checked first.
 *
 * A simulation grounding states them structurally instead. It carries a
 * `baseline` — where the model says things sit with no injection — and a
 * `years` array running the projection forward, and the movement it claims is
 * the distance between them. Neither object holds a key called `previous` or
 * `latest`, so the walk found NOTHING, `pairs` came back empty, and
 * `wrongDirection` returned null before doing any work. `validate()` therefore
 * returned `{ok: true}` for
 *
 *   "Unemployment rises from 4.02 in year one to 3.72 by year five"
 *
 * on the real USA run at the default slider position: both figures are in the
 * grounding, so the number gate passes, and 4.02 → 3.72 is a FALL. An
 * investment boom raising unemployment is the sign of the model's central
 * claim reversed, and it would have been stored and shown. The whole reason
 * this check exists — a measured incident on the labour lens, quoted in the
 * docblock below — applied to lenses and to nothing else.
 *
 * WHICH PAIRS A PROJECTION ASSERTS
 *
 *   baseline → final year   what the shock did, which is what the page argues
 *   first year → final year the shape of the path the chart draws
 *
 * Both, because the model is instructed to compare against the baseline and
 * writes about the path, and a sentence quoting either one honestly must not
 * be able to reverse it. Intermediate years are deliberately NOT paired
 * against each other: a five-year horizon would produce twenty pairs whose
 * numbers start colliding with each other, and a collision here rejects a
 * correct sentence.
 *
 * Exported for the tests, which assert the pairs directly rather than only
 * through a sentence — a check that silently finds nothing passes every test
 * written from the accepting side, which is exactly how this went unnoticed.
 */
export function directionPairs(grounding) {
  const pairs = [];

  /* Only a genuine number counts, unchanged from the original walk. `null` is
     the trap: `Number(null)` is 0, so coercing here would turn a row with no
     previous value — the shock rows in a simulation grounding — into a pair
     starting at zero, and invent a movement nothing claimed. */
  const add = (previous, latest, name) => {
    if (!Number.isFinite(previous) || !Number.isFinite(latest)) return;
    if (previous === latest) return;
    if (pairs.some((p) => p.previous === previous && p.latest === latest && p.name === name)) {
      return;
    }
    pairs.push({ previous, latest, name });
  };

  const addProjection = (node) => {
    const years = node.years;
    if (!Array.isArray(years) || years.length === 0) return;

    const first = years[0];
    const last = years[years.length - 1];
    if (!first || typeof first !== 'object' || !last || typeof last !== 'object') return;

    const baseline =
      node.baseline && typeof node.baseline === 'object' && !Array.isArray(node.baseline)
        ? node.baseline
        : null;

    for (const [key, value] of Object.entries(last)) {
      if (PROJECTION_INDEX_KEYS.has(key)) continue;
      if (!Number.isFinite(value)) continue;
      add(first[key], value, key);
      if (baseline) add(baseline[key], value, key);
    }
  };

  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    add(node.previous, node.latest, node.name);
    addProjection(node);
    Object.values(node).forEach(walk);
  };

  walk(grounding);
  return pairs;
}

/**
 * Catch a narration that describes a real movement backwards.
 *
 * THIS EXISTS BECAUSE THE NUMBER CHECK IS NOT ENOUGH, AND THAT WAS MEASURED.
 *
 * The first working run of the generator produced, on the labour lens:
 *
 *   "US graduate unemployment decreased slightly from 3.7% to 3.8%"
 *
 * Both figures are real and both are in the grounding, so the number gate
 * passed it. It is also plainly wrong — 3.7 to 3.8 is a rise — and it is the
 * kind of wrong a reader notices immediately and cannot un-notice, because it
 * says the site cannot read its own data.
 *
 * Direction is decidable in the same way membership is: the grounding holds
 * `previous` and `latest` for each series, so the true sign is known. This
 * looks for the shape the model actually writes — a direction word followed by
 * "from A to B", or by "to B from A" — checks whether A and B are a real pair
 * from the grounding, and rejects when the sign disagrees.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It does not parse the sentence. It splits the text into CLAUSES — on full
 * stops, semicolons and commas — and asks of each clause independently: does
 * this clause contain a from/to pair I recognise, and does it contain a
 * direction word that disagrees with it?
 *
 * Splitting on commas is what makes "chip prices fell, while gold rose from
 * 4190.2 to 4218.55" safe. Taking the nearest direction word instead attaches
 * "fell" to gold's rise and rejects a perfectly correct sentence; taking the
 * nearest WORD, which an earlier version of this did, captures "slightly" and
 * silently checks nothing at all.
 *
 * A clause with two direction words, or none, is left alone. This is a check
 * for the unambiguous case, which is the case the model actually gets wrong.
 *
 * WHAT THAT COSTS, MEASURED RATHER THAN GUESSED AT (4 Sep 2026)
 *
 * A direction word in one clause and the figures in the next is not checked,
 * because the clause holding the pair has no direction word of its own. On the
 * real USA run at the scenario's default position, all three of these are
 * backwards and all three are accepted:
 *
 *   "Unemployment is higher, moving from 4.02 with no injection to 3.72 by year five."
 *   "Inflation is lower, moving from 2 with no injection to 2.06 by year five."
 *   "Wage growth vs trend is lower, moving from 0 with no injection to 0.08 by year five."
 *
 * It is the SAME gap on each of the three, which is the thing worth knowing:
 * the shape that once made this check blind on the wage series alone is closed,
 * and what is left is uniform and structural. Fixing it means letting a clause
 * borrow the previous clause's verb, and that is the change that reinstates the
 * false accusation the comma split exists to prevent — "chip prices fell, while
 * gold rose from 4190.2 to 4218.55" would be rejected. A missed check costs a
 * paragraph nobody reads; a false rejection on correct prose costs a paragraph
 * that was right, and it is unexplainable to whoever has to debug it. So this
 * stays, and it is written down instead.
 */
export function wrongDirection(body, grounding) {
  const pairs = directionPairs(grounding);
  if (pairs.length === 0) return null;

  /*
   * Take the first well-formed number out of the capture.
   *
   * Stripping non-digits and calling Number() is not enough: a sentence ending
   * "…to 4218.55." hands over "4218.55." — two decimal points — which is NaN,
   * and a NaN silently matches no pair, so the check passes anything that
   * happens to end in a figure. It did exactly that until this was found.
   */
  const numeric = (raw) => {
    const match = String(raw).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : Number.NaN;
  };
  const sameNumber = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9;

  const NUM = String.raw`[$£€]?[\d,.]+%?`;

  /*
   * What may sit between the figure and the preposition that follows it.
   *
   * `\s+` alone required them to be adjacent — "from 4.02 to 3.72" and nothing
   * else. That is not how the sentence gets written. The simulation prompt asks
   * the model to name periods, so it produces "from 4.02 IN YEAR ONE to 3.72 BY
   * YEAR FIVE", the pattern found no pair, and the check quietly declined to
   * look. Same silent shape as the vocabulary gap above.
   *
   * Lazy, so it binds to the NEAREST following preposition rather than the
   * furthest, and NO DIGITS, which is the load-bearing part: allowing a figure
   * inside the gap would let the pattern skip over one number and pair the two
   * either side of it, and a mis-paired match can only ever produce a FALSE
   * ACCUSATION against prose that is correct. Refusing to check "from 30.1 in
   * 2024 to 29.0" costs a check; pairing 30.1 with something it was never
   * compared to costs a rejection nobody can explain. Clause punctuation stays
   * excluded for the reason the clause split exists at all.
   */
  const GAP = String.raw`[^.;,\d]*?`;
  const patterns = [
    { re: new RegExp(String.raw`\bfrom\s+(${NUM})${GAP}\bto\s+(${NUM})`, 'gi'), order: 'from-to' },
    { re: new RegExp(String.raw`\bto\s+(${NUM})${GAP}\bfrom\s+(${NUM})`, 'gi'), order: 'to-from' },
  ];

  /*
   * One clause per direction claim. Commas included: "fell, while gold rose
   * from A to B" must not let gold borrow the first clause's verb.
   *
   * The lookarounds are load-bearing, and getting them slightly wrong fails
   * in both directions.
   *
   * Splitting on a bare `[.;,]` splits inside every number — "3.7%" becomes
   * "3" and "7%" — so no from/to pair survives and the check silently matches
   * nothing. It passed every test that way, because every test was asking
   * whether correct sentences are accepted.
   *
   * Refusing to split on any comma between digits then over-corrects:
   * "…from 29.75, and gold declined…" stays as one clause, both direction
   * words appear in it, and the check gives up as undecidable. A thousands
   * separator is distinguishable — it is always followed by EXACTLY three
   * digits — so that is what the lookahead tests, rather than "a digit".
   */
  for (const clause of body.split(/(?<!\d)\.(?!\d)|,(?!\d{3}(?!\d))|;/)) {
    if (!clause) continue;
    const claimsFall = FALLING.test(clause);
    const claimsRise = RISING.test(clause);
    if (claimsFall === claimsRise) continue; // none, or both — not decidable

    for (const { re, order } of patterns) {
      for (const match of clause.matchAll(re)) {
        const first = numeric(match[1]);
        const second = numeric(match[2]);
        const [from, to] = order === 'from-to' ? [first, second] : [second, first];

        const pair = pairs.find(
          (p) => sameNumber(p.previous, from) && sameNumber(p.latest, to)
        );
        if (!pair) continue;

        const actuallyRose = pair.latest > pair.previous;
        if ((claimsRise && !actuallyRose) || (claimsFall && actuallyRose)) {
          const said = (claimsRise ? RISING : FALLING).exec(clause)[0];
          return `${pair.name ?? 'a series'} went ${pair.previous} to ${pair.latest}, text says "${said}"`;
        }
      }
    }
  }

  return null;
}

/** sha256 of the grounding, key-sorted so key order cannot change the hash. */
export function groundingHash(grounding) {
  const canonical = JSON.stringify(grounding, Object.keys(flatten(grounding)).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/** Flatten to collect every key name, for a stable JSON.stringify replacer. */
function flatten(node, out = {}, prefix = '') {
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    for (const [k, v] of Object.entries(node)) {
      out[k] = true;
      flatten(v, out, `${prefix}${k}.`);
    }
  } else if (Array.isArray(node)) {
    node.forEach((v) => flatten(v, out, prefix));
  }
  return out;
}

/* ── The call ────────────────────────────────────────────────────────────── */

/**
 * Ask Workers AI for prose. Returns the raw string; validation is the caller's.
 *
 * Chosen over OpenAI and Anthropic for one reason: 10,000 neurons a day on the
 * free tier with no card on file. That is enough for this, and this project
 * does not need a better writer — the gate below is what determines whether
 * the output is usable, and a more capable model would fail it in subtler ways
 * rather than fewer.
 */
async function callModel(prompt, { signal } = {}) {
  const { accountId, model } = config.cloudflare;
  const token = config.keys.cloudflare;

  if (!accountId || !token) {
    throw new Error(
      'Workers AI is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.'
    );
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        // Two sentences. A larger budget produces a third that wanders.
        max_tokens: 160,
        // Low but not zero: at 0 this model repeats stock phrasings across
        // every lens, which reads worse than variation.
        temperature: 0.3,
      }),
      signal: signal ?? AbortSignal.timeout(30_000),
    }
  );

  if (!response.ok) {
    // The token is in the header, not the URL, so the message is safe to store.
    throw new Error(`Workers AI returned ${response.status}`);
  }

  const payload = await response.json();
  const content =
    payload?.result?.choices?.[0]?.message?.content ??
    payload?.result?.response ??
    null;

  if (typeof content !== 'string') {
    throw new Error('Workers AI returned no content');
  }
  return content.trim();
}

/**
 * Render a grounding payload as the DATA block the model sees.
 *
 * Deliberately flat and dull. Prose in the prompt invites prose back that
 * paraphrases the prompt rather than the data, and every line here is a
 * `label: value` the validator can find again.
 */
function renderGrounding(grounding) {
  const lines = [];
  const walk = (node, prefix = '') => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${prefix}[${i + 1}]`));
      return;
    }
    if (typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        walk(value, prefix ? `${prefix}.${key}` : key);
      }
      return;
    }
    lines.push(`${prefix}: ${node}`);
  };
  walk(grounding);
  return lines.join('\n');
}

/* ── The public entry point ──────────────────────────────────────────────── */

/**
 * Get a narration for `scope`, from cache or by generating one.
 *
 * @param {object} options
 * @param {string} options.scope        e.g. 'lens:prices'
 * @param {object} options.grounding    SQL-computed facts, the only numbers allowed
 * @param {string} options.instruction  what to write, one line
 * @param {string[]} [options.indicatorIds] what it was allowed to discuss
 * @param {boolean} [options.force]     bypass the cache
 * @param {string} [options.inputHash]  cache key, when the caller addresses this
 *   row by something other than the grounding's own hash. Simulations need it:
 *   a scenario page finds its narration from the run's inputs, before it has
 *   built a grounding to hash — see `runSimulation()`. Defaults to
 *   `groundingHash(grounding)`, which is what every other caller wants.
 * @returns {Promise<{body: string, cached: boolean} | null>} null when it could
 *   not produce something that passes the gate. Callers MUST handle null by
 *   rendering nothing.
 */
export async function narrate({
  scope,
  grounding,
  instruction,
  indicatorIds = [],
  force = false,
  attempts = 2,
  inputHash: inputHashOverride,
}) {
  /*
   * The cache key. Normally the grounding's own hash — same numbers, same
   * prose, and a changed figure is automatically a new row.
   *
   * A caller may override it when it needs to FIND this row from something it
   * has before it has a grounding. Scenario pages do: a reader arrives with
   * slider values, and the run they identify has to resolve to a narration
   * without the page reconstructing the exact grounding object this script
   * built. Overriding the key is safe because the guarantee that matters is
   * unchanged — the stored `grounding` column still holds the numbers the prose
   * was checked against, and `validate()` still ran against them.
   */
  const inputHash = inputHashOverride ?? groundingHash(grounding);

  if (!force) {
    const { rows } = await query(
      `SELECT body FROM narrations
        WHERE scope = $1 AND input_hash = $2 AND prompt_version = $3
          AND (expires_at IS NULL OR expires_at > now())
        LIMIT 1`,
      [scope, inputHash, PROMPT_VERSION]
    );
    if (rows.length > 0) return { body: rows[0].body, cached: true };
  }

  const prompt = [
    instruction,
    '',
    'DATA (these are the only numbers you may write):',
    renderGrounding(grounding),
  ].join('\n');

  /*
   * Retried, but never repaired. A failed narration is regenerated from the
   * same prompt — it is not handed its own mistake and asked to fix it, which
   * turns the gate into a negotiation and tends to produce output that games
   * the check rather than obeying the rule.
   */
  const failures = [];
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let body;
    try {
      body = await callModel(prompt);
    } catch (error) {
      failures.push(`call failed: ${error.message}`);
      continue;
    }

    const verdict = validate(body, grounding);
    if (!verdict.ok) {
      failures.push(
        `${verdict.reason}${verdict.offending.length ? `: ${verdict.offending.join(', ')}` : ''}`
      );
      continue;
    }

    await query(
      `INSERT INTO narrations
         (scope, input_hash, body, grounding, indicator_ids, model, prompt_version)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       ON CONFLICT (scope, input_hash, prompt_version) DO UPDATE
         SET body = EXCLUDED.body, generated_at = now()`,
      [
        scope,
        inputHash,
        body,
        JSON.stringify(grounding),
        indicatorIds,
        config.cloudflare.model,
        PROMPT_VERSION,
      ]
    );

    return { body, cached: false };
  }

  /*
   * Nothing is stored and nothing is returned. The page renders without a
   * narration, which is the correct outcome: the reader loses a paragraph of
   * summary and keeps every guarantee the site makes about its numbers.
   */
  console.warn(`[narration] ${scope} produced nothing usable — ${failures.join(' | ')}`);
  return null;
}

export const __testing = { numericForms, renderGrounding, SYSTEM_PROMPT };

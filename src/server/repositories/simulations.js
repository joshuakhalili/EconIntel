/**
 * Simulations — reading side, and the run cache.
 *
 * A scenario page is shaped like a lens page: a thesis, a caveat, controls, a
 * chart and a paragraph. The one structural difference is where the hero
 * numbers come from — a lens reads `observations`, a scenario runs
 * `lib/simulation.js` over a cited parameter set — so this file's job is to
 * fetch parameters, hand them to a pure function, and cache what comes back.
 *
 * TWO THINGS THIS FILE WILL NOT DO
 *
 * It will not default a missing coefficient. `runScenario()` throws on one and
 * that throw is allowed to reach the route, which turns it into a 500. A 500 on
 * a page nobody has finished researching is the correct outcome; a chart drawn
 * from an invented number is not, and it would look identical to a real one.
 *
 * It will not call a language model. Narration is READ FROM CACHE ONLY, exactly
 * as `getLens()` does — see the note there. `scripts/generate-simulation-
 * narrations.js` writes those rows ahead of time.
 */

import { query } from '../db/pool.js';
import {
  runScenario,
  runHash,
  MODEL_VERSION,
} from '../lib/simulation.js';
/* Only the version constant — importing narration's module does NOT bring a
   model call into the web tier. Nothing here calls `narrate()`. */
import { PROMPT_VERSION } from '../lib/narration.js';

/**
 * Which real series and which real deals sit alongside each scenario.
 *
 * Config rather than a table. These are editorial choices about which evidence
 * frames an argument — the same kind of decision `lens_tickers.why` carries —
 * and there are four of them. A join table would add a migration, a seed and a
 * query to express what a literal expresses exactly as well, and would make the
 * binding harder to read rather than easier.
 *
 * The indicator ids are the ones confirmed to exist and to carry real history.
 * An id that does not resolve is dropped by the query rather than erroring: a
 * missing evidence chart should cost a reader one panel, not the page.
 */
const SCENARIO_EVIDENCE = {
  'ai-capex-dotcom': {
    /* The dot-com era read through the same instruments we use to read now.
       Semiconductor prices and information-sector employment are the two series
       that span both booms, which is the entire reason this comparison is
       possible at all. */
    indicatorIds: [
      'fred.PCU334413334413', // semiconductor & related device PPI, back to 1990
      'fred.USINFO',          // information-sector employment
      'fred.A679RC1Q027SBEA', // info-processing equipment & software investment
      'fred.SPASTT01USM661N', // broad US share prices
    ],
    /* The live side: real money moving between real AI companies, from the
       financing graph. Not simulated, and labelled as such on the page. */
    entitySectors: ['ai_lab', 'chipmaker', 'hyperscaler', 'neocloud'],
    eventsSince: '2023-01-01',
  },
};

/* ── Scenarios ───────────────────────────────────────────────────────────── */

/** Published scenarios, for navigation. */
export async function listScenarios() {
  const { rows } = await query(
    `SELECT s.id, s.slug, s.name, s.subtitle, s.thesis_plain, s.horizon_years,
            s.countries, s.sort_order,
            count(DISTINCT p.country_iso3)::int AS country_count
       FROM simulation_scenarios s
       LEFT JOIN simulation_parameters p ON p.scenario_id = s.id
      WHERE s.status = 'published'
      GROUP BY s.id
      ORDER BY s.sort_order, s.name`
  );
  return rows;
}

/**
 * One scenario, with everything the page needs before a single run happens:
 * its thesis, its caveat, its controls, and the citations behind its numbers.
 *
 * The citations ship with the page rather than with each run because they do
 * not change as a slider moves, and because a reader should be able to audit
 * the model's sources without running it. Burying provenance behind an
 * interaction is how provenance stops being read.
 */
export async function getScenario(slug) {
  const { rows } = await query(
    `SELECT id, slug, name, subtitle, thesis_plain, thesis_expert, caveat,
            horizon_years, model_key, countries, status
       FROM simulation_scenarios
      WHERE slug = $1 AND status = 'published'`,
    [slug]
  );
  if (rows.length === 0) return null;
  const scenario = rows[0];

  const { rows: inputs } = await query(
    `SELECT key, label, unit, unit_symbol, min_value, max_value,
            default_value, step, help_text
       FROM simulation_inputs
      WHERE scenario_id = $1
      ORDER BY sort_order, key`,
    [scenario.id]
  );

  const { rows: parameters } = await query(
    `SELECT p.country_iso3, c.name AS country_name, p.param_key, p.value,
            p.value_low, p.value_high, p.confidence_tier,
            p.citation_text, p.citation_url, p.as_of_year, p.notes,
            s.name AS source_name, s.homepage_url AS source_url
       FROM simulation_parameters p
       JOIN countries c ON c.iso3 = p.country_iso3
       LEFT JOIN sources s ON s.id = p.source_id
      WHERE p.scenario_id = $1
      ORDER BY p.country_iso3, p.param_key`,
    [scenario.id]
  );

  return { ...scenario, inputs, parameters };
}

/* ── Running ─────────────────────────────────────────────────────────────── */

/**
 * Validate slider values against the bounds the page was rendered from.
 *
 * Server-side because the client's bounds and the server's must be the same
 * bounds, and the only way to guarantee that is for both to come from
 * `simulation_inputs`. Out of range is a 400, not a clamp: a clamp silently
 * computes a different scenario from the one the URL describes, and the reader
 * who shares that URL is sharing a result nobody can reproduce.
 *
 * @returns {{ok: true, values: object} | {ok: false, error: string}}
 */
export function validateInputs(definitions, supplied) {
  const values = {};

  for (const def of definitions) {
    const raw = supplied[def.key];
    /* Absent means "use the default" rather than an error. A URL that names
       only the slider a reader actually moved is a better URL, and the defaults
       are already public in the scenario payload. */
    if (raw === undefined || raw === '') {
      values[def.key] = Number(def.default_value);
      continue;
    }

    /*
     * Only a number, or a string that parses as one.
     *
     * `Number()` alone lets two shapes through that Express actually produces.
     * A duplicated query parameter — `?shock_usd_bn=1&shock_usd_bn=2` — arrives
     * as an ARRAY, and `Number(['5'])` is 5, so a request naming the same
     * slider twice would quietly run one of the two values. `Number(true)` is
     * 1 and `Number([])` is 0 for the same reason. None of those are a reader
     * setting a slider, so none of them should compute a scenario.
     */
    const value =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? Number(raw)
          : Number.NaN;

    if (!Number.isFinite(value)) {
      return { ok: false, error: `"${def.key}" must be a number, got "${raw}"` };
    }
    if (value < Number(def.min_value) || value > Number(def.max_value)) {
      return {
        ok: false,
        error: `"${def.key}" must be between ${def.min_value} and ${def.max_value}, got ${value}`,
      };
    }
    values[def.key] = value;
  }

  return { ok: true, values };
}

/**
 * Run a scenario for one country, from cache where possible.
 *
 * The cache is not here for speed — the arithmetic is microseconds. It is here
 * so that a run has a stable identity: the same inputs produce the same stored
 * row, which is what lets a narration written about those numbers be found
 * again, and what makes a shared link show the reader what the sharer saw.
 *
 * @returns {Promise<object|null>} null when the scenario or country is unknown
 * @throws when a parameter is missing — deliberately not caught here
 */
export async function runSimulation(slug, countryIso3, suppliedInputs) {
  const scenario = await getScenario(slug);
  if (!scenario) return null;

  const country = String(countryIso3 || '').toUpperCase();
  if (!scenario.countries.includes(country)) {
    return {
      error: `"${scenario.name}" cannot be run for ${country}. ` +
        `Available: ${scenario.countries.join(', ')}`,
      status: 400,
    };
  }

  const validated = validateInputs(scenario.inputs, suppliedInputs);
  if (!validated.ok) return { error: validated.error, status: 400 };
  const inputs = validated.values;

  /*
   * The coefficients are fetched BEFORE the cache is consulted, not after.
   *
   * They are part of the cache key — see `runHash`. This used to read them only
   * on a miss, which is why the key could not contain them, which is why a
   * corrected coefficient never reached a reader who had already visited that
   * slider position. It costs one extra query on the hit path; the arithmetic
   * behind it is microseconds and the cache was never here for speed (see the
   * note above), so that is the cheapest correctness this file buys.
   */
  const parameters = await getParameters(scenario.id, country);

  const inputHash = runHash({
    scenarioId: scenario.id,
    countryIso3: country,
    inputs,
    parameters,
  });

  const { rows: cached } = await query(
    `SELECT results FROM simulation_runs
      WHERE scenario_id = $1 AND country_iso3 = $2
        AND input_hash = $3 AND model_version = $4
      LIMIT 1`,
    [scenario.id, country, inputHash, MODEL_VERSION]
  );

  let results;
  if (cached.length > 0) {
    results = cached[0].results;
  } else {
    results = runScenario({
      modelKey: scenario.model_key,
      inputs,
      parameters,
      horizonYears: scenario.horizon_years,
    });

    /* ON CONFLICT DO NOTHING rather than DO UPDATE: two concurrent requests for
       the same run compute the same numbers, so the loser of the race has
       nothing to correct. */
    await query(
      `INSERT INTO simulation_runs
         (scenario_id, country_iso3, inputs, input_hash, results, model_key, model_version)
       VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6, $7)
       ON CONFLICT (scenario_id, country_iso3, input_hash, model_version) DO NOTHING`,
      [
        scenario.id,
        country,
        JSON.stringify(inputs),
        inputHash,
        JSON.stringify(results),
        scenario.model_key,
        MODEL_VERSION,
      ]
    );
  }

  /*
   * The narration, READ FROM CACHE ONLY — never generated in a request.
   *
   * Most runs will not have one, and that is by design rather than a gap.
   * Narrations are pre-generated for each scenario's default position; a slider
   * moved anywhere else is a set of numbers no model has ever been shown. The
   * page renders without a paragraph, which costs a reader a summary of a chart
   * that is directly in front of them.
   *
   * The alternative — generating on demand — would put a ~400ms model call in
   * the path of every slider drag, and would put prose that has not passed the
   * grounding gate one bug away from a reader.
   */
  const { rows: narrations } = await query(
    `SELECT body, grounding, model, generated_at
       FROM narrations
      WHERE scope = $1 AND input_hash = $2 AND prompt_version = $3
        AND (expires_at IS NULL OR expires_at > now())
      LIMIT 1`,
    [narrationScope(scenario.slug, country), inputHash, PROMPT_VERSION]
  );

  return {
    scenario: { id: scenario.id, slug: scenario.slug, name: scenario.name },
    country,
    inputs,
    horizon_years: scenario.horizon_years,
    model_key: scenario.model_key,
    model_version: MODEL_VERSION,
    /*
     * The run's identity, returned rather than left implicit.
     *
     * `scripts/generate-simulation-narrations.js` has to write its narration
     * under the SAME hash this function looks one up by, or the page never
     * finds what the script wrote. It used to recompute that hash itself from
     * the same arguments — a comment in the script even said "same function,
     * same inputs", which was true right up to the moment `runHash` started
     * needing the coefficients too. Handing the hash back means there is one
     * computation of it and no way for the two ends to drift apart.
     */
    input_hash: inputHash,
    ...results,
    narration: narrations[0] ?? null,
  };
}

/**
 * Delete cached runs from a superseded model version.
 *
 * They are already unreachable — `model_version` is in the cache key, so
 * nothing can be served from them — which is why this is housekeeping rather
 * than a correctness fix. It is worth doing anyway: the table gains a whole
 * generation of rows on every version bump, and the rows left behind by the v2
 * → v3 bump are the ones that drew NEGATIVE unemployment, which is not a thing
 * to keep lying around in a table whose stated purpose includes "regression
 * evidence".
 *
 * Called from `scripts/generate-simulation-narrations.js`, because that script
 * is what has to run after a MODEL_VERSION bump anyway: a bump invalidates every
 * run, and the prose describing those runs has to be rewritten against the new
 * numbers. Anything it deletes was unreachable before it started.
 *
 * @returns {Promise<number>} rows removed
 */
export async function pruneStaleRuns() {
  const result = await query(
    'DELETE FROM simulation_runs WHERE model_version <> $1',
    [MODEL_VERSION]
  );
  return result.rowCount ?? 0;
}

/**
 * A country's full parameter set, as a flat map for the engine.
 *
 * Returned as `{param_key: value}` with no country in sight: the engine has no
 * country-conditional logic anywhere, and swapping the UK in for the US is
 * this query returning different numbers. That is the whole of the
 * "G7-specific" claim, and it is deliberately this small.
 */
export async function getParameters(scenarioId, countryIso3) {
  const { rows } = await query(
    `SELECT param_key, value FROM simulation_parameters
      WHERE scenario_id = $1 AND country_iso3 = $2`,
    [scenarioId, countryIso3]
  );
  return Object.fromEntries(rows.map((r) => [r.param_key, r.value]));
}

/** Cache scope for a scenario's narration. Shared with the generator script. */
export function narrationScope(slug, countryIso3) {
  return `simulation:${slug}:${countryIso3}`;
}

/* ── Evidence ────────────────────────────────────────────────────────────── */

/**
 * The real data that frames a scenario — measured, not simulated.
 *
 * This exists because a page of projections needs something underneath it that
 * actually happened. The flagship's argument is a comparison between two
 * investment waves, and a comparison with only one side drawn is an assertion.
 *
 * Deliberately a separate endpoint from the run: this does not change when a
 * slider moves, so folding it into `/run` would refetch decades of observations
 * on every drag.
 */
export async function scenarioEvidence(slug) {
  const config = SCENARIO_EVIDENCE[slug];
  if (!config) return { series: [], events: [] };

  const { rows: series } = await query(
    `SELECT i.id, i.name, i.unit, i.unit_symbol, i.decimals, i.quantity_kind,
            i.confidence_tier, i.source_url,
            json_agg(
              json_build_object('period', o.period_start, 'value', o.value)
              ORDER BY o.period_start
            ) AS points
       FROM indicators i
       JOIN observations o ON o.indicator_id = i.id
      WHERE i.id = ANY($1::text[])
      GROUP BY i.id
      ORDER BY array_position($1::text[], i.id)`,
    [config.indicatorIds ?? []]
  );

  /*
   * Real deals from the financing graph.
   *
   * Reads `events` directly rather than `financingGraph()`, which groups into
   * pairs to detect circular arrangements — a different question from "what
   * money moved". It must never read `monthly_investment`: that view sums
   * opposite-facing legs of the same arrangement, so its totals describe
   * nothing that happened.
   */
  const { rows: events } = await query(
    `SELECT e.id, e.kind, e.amount_usd, e.amount_is_estimate,
            e.announced_date::text AS announced_date,
            f.name AS from_name, f.sector AS from_sector,
            t.name AS to_name,   t.sector AS to_sector
       FROM events e
       JOIN entities f ON f.id = e.from_entity_id
       JOIN entities t ON t.id = e.to_entity_id
      WHERE e.status <> 'cancelled'
        AND e.announced_date >= $1::date
        AND (f.sector = ANY($2::text[]) OR t.sector = ANY($2::text[]))
      ORDER BY e.amount_usd DESC NULLS LAST, e.announced_date DESC
      LIMIT 12`,
    [config.eventsSince ?? '1900-01-01', config.entitySectors ?? []]
  );

  return { series, events };
}

export const __testing = { SCENARIO_EVIDENCE };

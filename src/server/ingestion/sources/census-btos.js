/**
 * US Census Business Trends and Outlook Survey (BTOS) — AI supplement.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ NOT WIRED, AND NOT WIRABLE AS WRITTEN. BTOS IS NOT ON THE CENSUS API.   │
 * │ Nothing imports this file. `runner.js` has no `census` handler.         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * The original version of this comment opened by calling BTOS "the most
 * important source in the project", in the present tense, on a module that no
 * code path had ever reached. It then noted, further down, that the endpoint
 * was unverified because the machine had no network access. Both halves were
 * true; together they read as a working integration with a small caveat, which
 * is the failure mode this project has already been bitten by more than once.
 *
 * WHAT WAS ACTUALLY CHECKED, 2026-08-30, with network access
 *
 * `discoverDatasets()` was run against the live catalogue. It returned zero
 * matches. Going direct to `https://api.census.gov/data.json` — 1,798 datasets,
 * the complete list — and searching the full JSON of every entry:
 *
 *     "btos"                      0 datasets
 *     "business trends"           0 datasets
 *     "outlook survey"            0 datasets
 *     "artificial intelligence"   0 datasets
 *
 * So this is not a wrong path to be corrected. BTOS is published as
 * downloadable files (census.gov/hfp/btos/data — live, 200) and is not an API
 * product at all. `fetchBtos()` cannot work against any endpoint, because
 * there is no endpoint.
 *
 * WHY THE ARGUMENT FOR IT STILL STANDS
 *
 * Every other source here measures either an INPUT to AI (compute, capex,
 * energy, papers) or a LAGGING OUTPUT (employment, productivity). BTOS
 * measures the causal middle term — what share of real firms actually use AI,
 * by sector, state and firm size, across a sample of ~1.2 million businesses.
 * That is worth having. It is just a different job from this one: parsing
 * published spreadsheets on a schedule, with a shape that changes between
 * releases, not calling a JSON API.
 *
 * The gap is partly covered already. `eurostat.ai_any.*` and `oecd.ai_any.*`
 * carry firm-level adoption rates for 17 countries including the USA, and the
 * Growth lens's adoption module draws from those.
 *
 * WHAT TO DO WITH THIS FILE
 *
 * Kept, not deleted, for two reasons: `discoverDatasets()` is how you re-check
 * whether Census has since published BTOS as an API — run it, and if it
 * returns anything the rest of this module is most of the adapter — and
 * deleting it loses the record that the question was investigated and
 * answered, which invites the next person to propose it again from scratch.
 *
 * Do not import it until that check returns a real endpoint.
 */

import { fetchJson, HttpError } from '../../lib/http.js';
import { config } from '../../config.js';

const BASE = 'https://api.census.gov/data';

function requireKey() {
  if (!config.keys.census) {
    throw new Error(
      'CENSUS_API_KEY is not set. Free, instant: ' +
        'https://api.census.gov/data/key_signup.html'
    );
  }
  return config.keys.census;
}

/**
 * List Census datasets whose title or description mentions business trends.
 *
 * Written because the BTOS endpoint path could not be confirmed offline.
 * Rather than hard-code a guess that fails silently, this queries the Census
 * dataset catalogue so the real path can be discovered and pinned.
 *
 * @returns {Promise<Array<{name: string, title: string, endpoint: string, vintage: number|null}>>}
 */
export async function discoverDatasets(match = /business trends|btos/i) {
  const data = await fetchJson(`${BASE}.json`);
  const datasets = data?.dataset ?? [];

  return datasets
    .filter((d) => match.test(d.title ?? '') || match.test(d.description ?? ''))
    .map((d) => ({
      name: Array.isArray(d.c_dataset) ? d.c_dataset.join('/') : String(d.c_dataset),
      title: d.title,
      endpoint: d.distribution?.[0]?.accessURL ?? null,
      vintage: d.c_vintage ?? null,
    }));
}

/**
 * Fetch BTOS estimates.
 *
 * The Census API returns a header row followed by data rows — a CSV-shaped
 * JSON array, not objects. The first row must be used as the key list;
 * assuming column positions would break the moment Census reorders them.
 *
 * @param {object} options
 * @param {string} options.dataset      e.g. 'timeseries/btos'
 * @param {string[]} options.variables  variable codes to request
 * @param {string} [options.forGeography='us:*']
 * @param {string} [options.time]       e.g. '2026' or a period code
 */
export async function fetchBtos(options) {
  const {
    dataset,
    variables,
    forGeography = 'us:*',
    time,
  } = options;

  const params = new URLSearchParams({
    get: variables.join(','),
    for: forGeography,
    key: requireKey(),
  });
  if (time) params.set('time', time);

  const url = `${BASE}/${dataset}?${params}`;
  const rows = await fetchJson(url);

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new HttpError(`Census returned no rows for ${dataset}`, { url });
  }

  const [header, ...body] = rows;
  return body.map((row) =>
    Object.fromEntries(header.map((column, index) => [column, row[index]]))
  );
}

/**
 * Shape BTOS rows into observations.
 *
 * Kept separate from fetching so the mapping can be unit-tested against a
 * recorded response without a network call, and so the variable codes — which
 * need confirming against the live catalogue — are changeable in one place.
 *
 * @param {Array<Record<string,string>>} rows
 * @param {object} options
 * @param {string} options.indicatorId
 * @param {string} options.valueField   which column holds the estimate
 */
export function toObservations(rows, { indicatorId, valueField }) {
  const observations = [];

  for (const row of rows) {
    const raw = row[valueField];
    const value = raw === undefined || raw === null || raw === '' ? null : Number(raw);

    // Census uses negative sentinels for suppressed or unavailable cells.
    // Treating them as real values would put impossible numbers on a chart.
    const suppressed = value !== null && value < 0;

    // BTOS reports a reference period rather than a single date.
    const periodStart = row.time_slot_date ?? row.time ?? null;
    if (!periodStart) continue;

    observations.push({
      indicatorId,
      countryIso3: 'USA',
      periodStart,
      periodEnd: periodStart,
      value: suppressed ? null : value,
      valueStatus: suppressed ? 'suppressed' : null,
      sourceRef: 'https://www.census.gov/hfp/btos/',
    });
  }

  return observations;
}

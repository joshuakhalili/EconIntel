/**
 * US Census Business Trends and Outlook Survey (BTOS) — AI supplement.
 *
 * WHY THIS IS THE MOST IMPORTANT SOURCE IN THE PROJECT
 *
 * Every other source measures either an INPUT to AI (compute, capex, energy,
 * papers) or a LAGGING OUTPUT (employment, productivity). BTOS measures the
 * causal middle term: what share of real firms are actually using AI, broken
 * down by sector, state and firm size, refreshed roughly biweekly across a
 * sample of ~1.2 million businesses.
 *
 * Without it the dashboard can show AI spending going up and employment moving,
 * and can never honestly connect the two. With it, adoption is an observed
 * variable rather than an assumption.
 *
 * CAVEAT, STATED UP FRONT: the exact API path for the BTOS AI supplement was
 * not verifiable when this adapter was written (no outbound network access to
 * census.gov). Some Census products are API-served and others are
 * download-only. `discoverDatasets()` exists to resolve that at runtime rather
 * than guessing — run it first on a networked machine.
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

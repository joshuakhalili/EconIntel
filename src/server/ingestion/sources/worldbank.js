/**
 * World Bank Open Data adapter.
 *
 * Keyless, CC BY 4.0, and the best free source of cross-country comparable
 * economic indicators. This is what makes the dashboard global rather than
 * US-only.
 *
 * Two quirks of this API drive the code below:
 *
 *   1. The response is a TWO-ELEMENT array: [pagination, data]. Not an object
 *      with a data field — an array whose first element is metadata. Treating
 *      it as a normal collection silently yields nothing.
 *   2. It returns supranational aggregates (World, Euro area, OECD) through the
 *      same endpoint as real countries. Summing without filtering double-counts
 *      badly, which is why `countries.is_aggregate` exists.
 */

import { fetchJson, HttpError } from '../../lib/http.js';

const BASE = 'https://api.worldbank.org/v2';

/** World Bank indicators used here are annual; periods are calendar years. */
function yearBounds(year) {
  return { periodStart: `${year}-01-01`, periodEnd: `${year}-12-31` };
}

/**
 * Fetch an indicator across countries.
 *
 * @param {string} indicatorCode  e.g. 'NY.GDP.PCAP.KD'
 * @param {object} [options]
 * @param {string[]} [options.countries]  ISO3 codes; defaults to all
 * @param {number} [options.startYear=2000]
 * @param {number} [options.endYear]      defaults to current year
 * @param {string} [options.indicatorId]  defaults to `wb.${indicatorCode}`
 * @returns {Promise<import('../../repositories/observations.js').ObservationInput[]>}
 */
export async function fetchIndicator(indicatorCode, options = {}) {
  const {
    countries = ['all'],
    startYear = 2000,
    endYear = new Date().getUTCFullYear(),
    indicatorId = `wb.${indicatorCode}`,
  } = options;

  const countryPath = countries.join(';');

  // per_page is set high deliberately. The default of 50 would turn a
  // 50-country × 25-year request into 25 paginated round-trips; one large page
  // is both faster and kinder to a free service.
  const url =
    `${BASE}/country/${encodeURIComponent(countryPath)}` +
    `/indicator/${encodeURIComponent(indicatorCode)}` +
    `?format=json&per_page=20000&date=${startYear}:${endYear}`;

  const payload = await fetchJson(url);

  if (!Array.isArray(payload)) {
    throw new HttpError(
      `World Bank returned an unexpected shape for ${indicatorCode}`,
      { url }
    );
  }

  const [meta, rows] = payload;

  // The API signals errors inside a 200 response: the first element carries a
  // `message` array instead of pagination metadata. Checking the HTTP status
  // alone would treat that as success and produce a silently empty series.
  if (meta?.message) {
    const detail = meta.message.map((m) => m.value ?? m.key).join('; ');
    throw new HttpError(`World Bank error for ${indicatorCode}: ${detail}`, { url });
  }

  if (!Array.isArray(rows)) return [];

  const observations = [];

  for (const row of rows) {
    const iso3 = row?.countryiso3code;
    const year = Number(row?.date);

    // Rows lacking an ISO3 code are regional groupings the API includes
    // opportunistically; without a code they cannot be joined to our countries
    // table, so they are dropped rather than guessed at.
    if (!iso3 || !Number.isFinite(year)) continue;

    observations.push({
      indicatorId,
      countryIso3: iso3,
      ...yearBounds(year),
      // null is meaningful here: the World Bank reports a year with no data
      // rather than omitting it, and that distinction ("not measured" vs
      // "not reported") is worth preserving.
      value: row.value === null ? null : Number(row.value),
      sourceRef: `https://data.worldbank.org/indicator/${indicatorCode}`,
    });
  }

  return observations;
}

/**
 * Confirm an indicator code exists. Used by the verification script.
 * @param {string} indicatorCode
 */
export async function fetchIndicatorMetadata(indicatorCode) {
  const url = `${BASE}/indicator/${encodeURIComponent(indicatorCode)}?format=json`;
  const payload = await fetchJson(url);

  const [meta, rows] = Array.isArray(payload) ? payload : [];
  if (meta?.message || !rows?.[0]) {
    throw new HttpError(`World Bank has no indicator "${indicatorCode}"`, { url });
  }

  return {
    id: rows[0].id,
    name: rows[0].name,
    sourceNote: rows[0].sourceNote,
    sourceOrganization: rows[0].sourceOrganization,
  };
}

/**
 * Fetch the country list, including the aggregate flag. Lets us keep
 * `countries.is_aggregate` accurate from the source of truth rather than a
 * hand-maintained list that drifts.
 */
export async function fetchCountries() {
  const url = `${BASE}/country?format=json&per_page=400`;
  const payload = await fetchJson(url);
  const [, rows] = Array.isArray(payload) ? payload : [];

  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => row.id)
    .map((row) => ({
      iso3: row.id,
      iso2: row.iso2Code || null,
      name: row.name?.trim(),
      region: row.region?.value,
      incomeGroup: row.incomeLevel?.value,
      // The API marks aggregates by giving them region 'Aggregates'.
      isAggregate: row.region?.id === 'NA' || row.region?.value === 'Aggregates',
    }));
}

/**
 * Epoch AI adapter.
 *
 * Epoch AI publishes CC BY 4.0 datasets on notable AI models, ML hardware, GPU
 * clusters and data centres. It is the only credible OPEN source of structured
 * AI-compute figures — everything comparable is either paywalled or a press
 * release.
 *
 * The data is fetched LIVE on every run rather than committed to the repository.
 * Epoch updates daily; a checked-in CSV would freeze the dashboard at whatever
 * date it was downloaded while still presenting itself as current, which is the
 * exact dishonesty this project is built to avoid.
 */

import { parse } from 'csv-parse/sync';

import { config } from '../../config.js';
import { HttpError } from '../../lib/http.js';
import { USER_AGENT } from './user-agent.js';

const BASE = 'https://epoch.ai/data';

/**
 * Known dataset slugs. Kept in one place because these paths are the part most
 * likely to change upstream, and a 404 here should point at one obvious file.
 *
 * NOTE: these paths were written without network access to confirm them. Run
 * `npm run verify:sources` on a networked machine before trusting any panel
 * built on them.
 */
export const DATASETS = Object.freeze({
  notableModels: `${BASE}/notable_ai_models.csv`,
  gpuClusters: `${BASE}/gpu_clusters.csv`,
  mlHardware: `${BASE}/ml_hardware.csv`,
});

/**
 * Fetch and parse a CSV.
 *
 * Uses csv-parse rather than splitting on commas. Real CSVs contain quoted
 * fields with embedded commas and newlines — model names and organisation
 * lists routinely do — and naive splitting silently shifts every column after
 * the first such row.
 *
 * @param {string} url
 * @returns {Promise<Array<Record<string, string>>>}
 */
export async function fetchCsv(url) {
  if (config.useFixtures) {
    throw new HttpError(
      `Fixture mode: no recorded CSV for ${url}. ` +
        `Epoch AI data is fetched live by design — run with network access.`,
      { url }
    );
  }

  const response = await fetch(url, {
    // Was `Diffusion/1.0 (research dashboard)`, which named no contact at
    // all — the one thing a User-Agent is for. See sources/user-agent.js.
    headers: { Accept: 'text/csv', 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new HttpError(`Epoch AI returned HTTP ${response.status} for ${url}`, {
      url,
      status: response.status,
    });
  }

  const text = await response.text();

  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    // Upstream column counts change as Epoch adds fields. Tolerating that beats
    // failing the whole ingestion over an extra column we do not read.
    relax_column_count: true,
  });
}

/** Parse a possibly-missing numeric cell without producing NaN. */
function num(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const value = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

/** Normalise a date cell to YYYY-MM-DD, or null. */
function isoDate(raw) {
  if (!raw) return null;
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(String(raw).trim());
  if (!match) return null;
  const [, year, month = '01', day = '01'] = match;
  return `${year}-${month}-${day}`;
}

/**
 * Frontier training compute over time.
 *
 * Emits a running MAXIMUM rather than every model's compute. The economically
 * meaningful quantity is "how much compute does the largest known training run
 * require", which is a frontier, not a scatter — and it is that frontier that
 * drives data centre demand.
 *
 * @param {Array<Record<string,string>>} rows
 * @param {string} [indicatorId]
 */
export function toFrontierComputeObservations(rows, indicatorId = 'epoch.training_compute_frontier') {
  const dated = [];

  for (const row of rows) {
    // Column naming has varied upstream; accept the known variants rather than
    // failing on a rename.
    const date = isoDate(row['Publication date'] ?? row.publication_date ?? row.date);
    const compute = num(
      row['Training compute (FLOP)'] ?? row.training_compute_flop ?? row.training_compute
    );
    if (!date || compute === null) continue;
    dated.push({ date, compute, model: row.Model ?? row.model ?? null });
  }

  dated.sort((a, b) => a.date.localeCompare(b.date));

  /**
   * Keyed by date rather than appended, because two record-setting models can
   * share a publication date. Both would clear the running maximum in turn and
   * emit two rows on the same day — and since the observations grain is
   * (indicator, date), Postgres rejects the whole batch with "ON CONFLICT DO
   * UPDATE command cannot affect row a second time".
   *
   * Overwriting is correct rather than merely expedient: entries are sorted
   * ascending and only records are emitted, so the last write for a given date
   * is by construction the highest compute that day — which is what a frontier
   * series means.
   */
  const byDate = new Map();
  let runningMax = 0;

  for (const entry of dated) {
    if (entry.compute <= runningMax) continue;   // not a new frontier
    runningMax = entry.compute;

    byDate.set(entry.date, {
      indicatorId,
      periodStart: entry.date,
      periodEnd: entry.date,
      value: entry.compute,
      sourceRef: 'https://epoch.ai/data',
    });
  }

  return [...byDate.values()];
}

/**
 * GPU clusters, aggregated to a count per country per year.
 *
 * Deliberately emitted as a count rather than a capacity estimate: the dataset
 * documents publicly-known clusters, many are undisclosed, and multiplying an
 * undercount by an assumed per-cluster capacity would manufacture false
 * precision. The indicator's description states it is a lower bound.
 */
export function toClusterCountObservations(rows, indicatorId = 'epoch.gpu_cluster_count') {
  /** @type {Map<string, number>} */
  const counts = new Map();

  for (const row of rows) {
    // 'First Operational Date' is the live column name. The previous spelling
    // here differed only in capitalisation, so every lookup returned undefined,
    // every row was skipped, and the job reported success having written
    // nothing — a wrong key and an empty upstream are indistinguishable on a
    // chart, which is why the variants are listed explicitly rather than
    // assumed.
    const date = isoDate(
      row['First Operational Date'] ??
        row['First operational date'] ??
        row.first_operational_date ??
        row.date
    );
    const country = (row.Country ?? row.country ?? '').trim();
    if (!date || !country) continue;

    const year = date.slice(0, 4);
    const iso3 = COUNTRY_NAME_TO_ISO3[country];
    // Skip unmapped country names rather than guessing: a wrong country
    // attribution on a map is worse than an absent one.
    if (!iso3) continue;

    counts.set(`${iso3}_${year}`, (counts.get(`${iso3}_${year}`) ?? 0) + 1);
  }

  return [...counts.entries()].map(([key, count]) => {
    const [iso3, year] = key.split('_');
    return {
      indicatorId,
      countryIso3: iso3,
      periodStart: `${year}-01-01`,
      periodEnd: `${year}-12-31`,
      value: count,
      sourceRef: 'https://epoch.ai/data',
    };
  });
}

/**
 * Country names as they appear in Epoch's CSVs, mapped to ISO3.
 * Extend as new names appear; unmapped names are skipped, never guessed.
 */
const COUNTRY_NAME_TO_ISO3 = Object.freeze({
  'United States': 'USA',
  'United States of America': 'USA',
  USA: 'USA',
  China: 'CHN',
  'United Kingdom': 'GBR',
  UK: 'GBR',
  Germany: 'DEU',
  France: 'FRA',
  Japan: 'JPN',
  'South Korea': 'KOR',
  Korea: 'KOR',
  Taiwan: 'TWN',
  Israel: 'ISR',
  Canada: 'CAN',
  Australia: 'AUS',
  India: 'IND',
  Singapore: 'SGP',
  Netherlands: 'NLD',
  Ireland: 'IRL',
  Sweden: 'SWE',
  Finland: 'FIN',
  Norway: 'NOR',
  Switzerland: 'CHE',
  'United Arab Emirates': 'ARE',
  'Saudi Arabia': 'SAU',
  Spain: 'ESP',
  Italy: 'ITA',
  Poland: 'POL',
  Brazil: 'BRA',

  /**
   * ISO 3166 official long forms, which is what Epoch actually publishes.
   * Auditing the live CSV showed 'Korea (Republic of)' and 'United Kingdom of
   * Great Britain and Northern Ireland' arriving instead of the short names
   * above — 18 clusters were being dropped without a word, the same silent
   * class of failure as the column-case bug in this file's history.
   *
   * Only countries present in the `countries` table are mapped. An ISO3 we do
   * not hold would violate the foreign key and abort the entire batch, so an
   * unmapped name skipping one row is strictly safer than a mapping we cannot
   * insert. Thailand, Iceland, Hong Kong, Luxembourg, Slovenia and the
   * Philippines appear in the data but are not seeded, so they stay unmapped
   * deliberately rather than by oversight.
   */
  'Korea (Republic of)': 'KOR',
  'United Kingdom of Great Britain and Northern Ireland': 'GBR',
  'Russian Federation': 'RUS',
  Russia: 'RUS',
  Denmark: 'DNK',
  Czechia: 'CZE',
  'Czech Republic': 'CZE',
  'Viet Nam': 'VNM',
  Vietnam: 'VNM',
  Mexico: 'MEX',
  Malaysia: 'MYS',
});

/** Convenience: fetch and shape frontier compute in one call. */
export async function ingestFrontierCompute() {
  const rows = await fetchCsv(DATASETS.notableModels);
  return toFrontierComputeObservations(rows);
}

/** Convenience: fetch and shape cluster counts in one call. */
export async function ingestGpuClusters() {
  const rows = await fetchCsv(DATASETS.gpuClusters);
  return toClusterCountObservations(rows);
}

/**
 * Installed data-centre power capacity, cumulative, by country and year.
 *
 * CUMULATIVE rather than annual additions, because capacity is a stock: a
 * cluster that came online in 2024 is still drawing power in 2026. Charting
 * additions would show a decline in any year that merely built less than the
 * one before, which is not what "capacity" means.
 *
 * MEGAWATTS rather than a count of clusters, because clusters differ by two
 * orders of magnitude — xAI's Memphis phase 3 is 352 MW against sites under
 * 1 MW. Counting them treats those as equal, which is why the existing
 * gpu_cluster_count series answers a different question than this one.
 *
 * THIS IS A LOWER BOUND, AND THE DASHBOARD MUST SAY SO. Epoch documents
 * publicly-known clusters; many are undisclosed, and the 482 rows carry 2,604
 * MW between them, which is certainly less than what exists. A lower bound
 * presented as a total is a wrong number wearing a confident face.
 */
export function toCapacityObservations(rows, indicatorId = 'derived.datacentre_capacity_mw') {
  /** @type {Array<{year: number, iso3: string, mw: number}>} */
  const entries = [];

  for (const row of rows) {
    const date = isoDate(
      row['First Operational Date'] ??
        row['First operational date'] ??
        row.first_operational_date
    );
    const country = (row.Country ?? row.country ?? '').trim();
    const mw = num(row['Power Capacity (MW)'] ?? row.power_capacity_mw);

    if (!date || !country || mw === null || mw <= 0) continue;

    const iso3 = COUNTRY_NAME_TO_ISO3[country];
    if (!iso3) continue;   // never guess a country onto a map

    entries.push({ year: Number(date.slice(0, 4)), iso3, mw });
  }

  if (entries.length === 0) return [];

  // Build the running total per country across the full span, emitting a point
  // for every year from a country's first cluster to the present. Without the
  // fill, a country with clusters in 2022 and 2025 would render as a line that
  // leaps across an apparently empty 2023-24, when in fact its capacity simply
  // did not change.
  const byCountry = new Map();
  for (const e of entries) {
    if (!byCountry.has(e.iso3)) byCountry.set(e.iso3, new Map());
    const years = byCountry.get(e.iso3);
    years.set(e.year, (years.get(e.year) ?? 0) + e.mw);
  }

  const finalYear = Math.max(...entries.map((e) => e.year));
  const observations = [];

  for (const [iso3, years] of byCountry) {
    const firstYear = Math.min(...years.keys());
    let cumulative = 0;

    for (let year = firstYear; year <= finalYear; year += 1) {
      cumulative += years.get(year) ?? 0;
      observations.push({
        indicatorId,
        countryIso3: iso3,
        periodStart: `${year}-01-01`,
        periodEnd: `${year}-12-31`,
        // Two decimals: the source quotes fractional megawatts, but the
        // undercount dwarfs any rounding, so more precision would be theatre.
        value: Math.round(cumulative * 100) / 100,
        sourceRef: 'https://epoch.ai/data/gpu-clusters',
      });
    }
  }

  return observations;
}

/** Convenience: fetch and shape installed capacity in one call. */
export async function ingestDatacentreCapacity() {
  const rows = await fetchCsv(DATASETS.gpuClusters);
  return toCapacityObservations(rows);
}

/**
 * Best price-performance ever achieved in ML hardware — FLOP/s per dollar.
 *
 * The point of this series is to sit beside the semiconductor PPI, which has
 * been flat since roughly 2021. The PPI is a NOMINAL price for a chip; this is
 * a price for a unit of COMPUTATION, so the two disagreeing is the finding.
 *
 * READ THE THREE LIMITS BEFORE PUTTING THIS ON A PAGE. They are not
 * boilerplate; each one has changed what this series may be used to claim.
 *
 * 1. IT IS A FRONTIER, NOT AN INDEX. Emitted as a running maximum, for the same
 *    reason toFrontierComputeObservations is: the ml_hardware table is a
 *    convenience sample of notable accelerators, not a priced market basket.
 *    Any mean or per-year maximum over it moves with WHICH hardware Epoch
 *    happened to record that year rather than with prices — taking the annual
 *    maximum of this same column yields 413 GFLOP/s per dollar in 2022 and 66
 *    in 2024, an apparent 84% price rise that is entirely composition, because
 *    2022 caught a consumer card and 2024 caught only datacentre parts. A
 *    running maximum cannot manufacture that: it can only understate, by going
 *    flat where the sample missed a better chip.
 *
 * 2. THE 2018 STEP IS PART ARTEFACT. Epoch's Price-performance column divides
 *    'Max performance' by release price, and max performance is taken at
 *    whatever precision the chip is fastest at. That basis moved from FP32 to
 *    tensor FP16 with the RTX 2080 Ti, so the 14x jump in September 2018 is a
 *    change of measurement as well as a real gain. Lower precision is a genuine
 *    quality improvement for ML work, which is why the column is built this way
 *    — but the step is not fourteen times more compute per dollar of the same
 *    kind.
 *
 * 3. IT HAS BEEN FLAT SINCE SEPTEMBER 2022. The record holder is the RTX 4090,
 *    a consumer card, and no sampled accelerator has since beaten it on FLOP/s
 *    per dollar at maximum precision. So this series does NOT by itself show
 *    quality-adjusted compute prices continuing to fall through the 2020s. It
 *    shows a ~430x improvement from 2008 to 2022 against a PPI that barely
 *    moved, and then a gap. Anything stronger than that needs a precision- and
 *    population-consistent index that nobody publishes.
 *
 * The value is Epoch's own published Price-performance figure, not arithmetic
 * done here — the column exists in the CSV and is used as given.
 */
export function toGpuPricePerformanceObservations(rows, indicatorId = 'epoch.gpu_price_performance') {
  const dated = [];

  for (const row of rows) {
    const date = isoDate(row['Release date'] ?? row.release_date);
    const perf = num(row['Price-performance'] ?? row.price_performance);
    // Zero and negative are as wrong as missing here: a chip cannot deliver no
    // compute per dollar, so a 0 means the upstream cell was blank or unparsed.
    if (!date || perf === null || perf <= 0) continue;
    dated.push({ date, perf, name: row['Hardware name'] ?? row.hardware_name ?? null });
  }

  dated.sort((a, b) => a.date.localeCompare(b.date));

  // Keyed by date for the reason spelled out in toFrontierComputeObservations:
  // two chips can share a release date, both clear the running maximum, and two
  // rows on one date breaks the ON CONFLICT upsert. Last write wins, which is
  // the highest value that day — which is what a frontier means.
  const byDate = new Map();
  let runningMax = 0;

  for (const entry of dated) {
    if (entry.perf <= runningMax) continue;
    runningMax = entry.perf;

    byDate.set(entry.date, {
      indicatorId,
      periodStart: entry.date,
      periodEnd: entry.date,
      value: entry.perf,
      sourceRef: 'https://epoch.ai/data/machine-learning-hardware',
    });
  }

  return [...byDate.values()];
}

/** Convenience: fetch and shape GPU price-performance in one call. */
export async function ingestGpuPricePerformance() {
  const rows = await fetchCsv(DATASETS.mlHardware);
  return toGpuPricePerformanceObservations(rows);
}

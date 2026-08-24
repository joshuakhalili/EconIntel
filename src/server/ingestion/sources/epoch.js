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
    headers: { Accept: 'text/csv', 'User-Agent': 'EconIntel/1.0 (research dashboard)' },
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

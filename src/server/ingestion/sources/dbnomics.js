/**
 * DBnomics adapter.
 *
 * DBnomics mirrors 80+ statistical providers — FRED, OECD, IMF, Eurostat, BLS,
 * ECB, World Bank — behind one keyless API with a uniform response shape. One
 * client instead of six.
 *
 * The trade-off, stated honestly: it is a MIRROR. It can lag its upstream, and
 * it does not carry every series. Where release-day freshness matters (US
 * monthly indicators on release morning) prefer the primary source; where broad
 * cross-provider coverage matters more than hours of latency, prefer this.
 *
 * Series are addressed as provider/dataset/series, e.g. 'OECD/MEI/USA.LORSGPRT.STSA.M'.
 */

import { fetchJson, HttpError } from '../../lib/http.js';

const BASE = 'https://api.db.nomics.world/v22';

/**
 * DBnomics returns periods as strings whose format depends on frequency:
 * '2025' (annual), '2025-Q1' (quarterly), '2025-03' (monthly), '2025-03-14'
 * (daily). Our schema wants explicit start and end dates, so each shape is
 * expanded to real bounds.
 *
 * @param {string} period
 * @returns {{periodStart: string, periodEnd: string} | null}
 */
export function parsePeriod(period) {
  if (typeof period !== 'string') return null;

  // Annual: '2025'
  let match = /^(\d{4})$/.exec(period);
  if (match) {
    return { periodStart: `${match[1]}-01-01`, periodEnd: `${match[1]}-12-31` };
  }

  // Quarterly: '2025-Q1'
  match = /^(\d{4})-Q([1-4])$/.exec(period);
  if (match) {
    const year = Number(match[1]);
    const quarter = Number(match[2]);
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    return {
      periodStart: `${year}-${String(startMonth).padStart(2, '0')}-01`,
      periodEnd: lastDayOf(year, endMonth),
    };
  }

  // Semi-annual: '2025-S1'
  match = /^(\d{4})-S([12])$/.exec(period);
  if (match) {
    const year = Number(match[1]);
    const half = Number(match[2]);
    return half === 1
      ? { periodStart: `${year}-01-01`, periodEnd: `${year}-06-30` }
      : { periodStart: `${year}-07-01`, periodEnd: `${year}-12-31` };
  }

  // Monthly: '2025-03'
  match = /^(\d{4})-(\d{2})$/.exec(period);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    return {
      periodStart: `${match[1]}-${match[2]}-01`,
      periodEnd: lastDayOf(year, month),
    };
  }

  // Daily: '2025-03-14'
  match = /^(\d{4}-\d{2}-\d{2})$/.exec(period);
  if (match) {
    return { periodStart: match[1], periodEnd: match[1] };
  }

  return null;
}

function lastDayOf(year, month) {
  // Day 0 of the following month is the last day of this one, and Date handles
  // leap years so we do not have to.
  const date = new Date(Date.UTC(year, month, 0));
  return date.toISOString().slice(0, 10);
}

/**
 * Fetch one series.
 *
 * @param {string} seriesPath  'PROVIDER/DATASET/SERIES'
 * @param {object} [options]
 * @param {string} [options.indicatorId]
 * @param {string} [options.countryIso3]
 */
export async function fetchSeries(seriesPath, options = {}) {
  const { indicatorId = `dbnomics.${seriesPath}`, countryIso3 = null } = options;

  const url = `${BASE}/series/${seriesPath}?observations=1`;

  /**
   * 90 seconds, against a 20-second default.
   *
   * Response size is not the problem — EIA/ELEC/PRICE.US-IND.M is 13 KB with
   * 303 observations and still takes ~56 seconds. DBnomics assembles some
   * providers' series on demand, and how long that takes has nothing to do with
   * how much data comes back. Timing out here produced a failed job for a series
   * that works perfectly well given the time to answer.
   */
  const data = await fetchJson(url, { timeoutMs: 90_000 });

  const series = data?.series?.docs?.[0];
  if (!series) {
    throw new HttpError(`DBnomics has no series "${seriesPath}"`, { url });
  }

  // DBnomics returns parallel arrays: period[i] pairs with value[i].
  const periods = series.period ?? [];
  const values = series.value ?? [];

  const observations = [];

  for (let i = 0; i < periods.length; i += 1) {
    const bounds = parsePeriod(periods[i]);
    if (!bounds) continue;   // unrecognised frequency: skip rather than guess

    const raw = values[i];
    // DBnomics uses the string 'NA' for missing observations. Number('NA') is
    // NaN, which would poison every downstream calculation.
    const value = raw === 'NA' || raw === null || raw === undefined ? null : Number(raw);

    observations.push({
      indicatorId,
      countryIso3,
      ...bounds,
      value: Number.isFinite(value) ? value : null,
      sourceRef: `https://db.nomics.world/${seriesPath}`,
    });
  }

  return observations;
}

/** Confirm a series exists, for the verification script. */
export async function fetchSeriesMetadata(seriesPath) {
  const url = `${BASE}/series/${seriesPath}`;
  const data = await fetchJson(url);
  const series = data?.series?.docs?.[0];

  if (!series) {
    throw new HttpError(`DBnomics has no series "${seriesPath}"`, { url });
  }

  return {
    code: series.series_code,
    name: series.series_name,
    provider: series.provider_code,
    dataset: series.dataset_name,
    frequency: series['@frequency'] ?? null,
  };
}

/** List available providers — useful for exploring what DBnomics actually carries. */
export async function listProviders() {
  const data = await fetchJson(`${BASE}/providers`);
  return (data?.providers?.docs ?? []).map((p) => ({
    code: p.code,
    name: p.name,
    region: p.region,
  }));
}

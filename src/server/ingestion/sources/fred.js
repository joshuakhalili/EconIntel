/**
 * FRED adapter — Federal Reserve Economic Data.
 *
 * FRED is authoritative for US macroeconomic series and is the primary source
 * for the productivity indicators that sit at the centre of this dashboard's
 * central question: is AI adoption showing up in measured output per hour?
 *
 * Requires a free API key (fredaccount.stlouisfed.org/apikeys), 120 req/min.
 */

import { fetchJson, HttpError } from '../../lib/http.js';
import { config } from '../../config.js';

const BASE = 'https://api.stlouisfed.org/fred';

/**
 * FRED reports a single date per observation, meaning the START of the period.
 * Our schema stores explicit period bounds, so we derive the end date from the
 * series frequency.
 *
 * This is not pedantry. Joining a quarterly series to a monthly one on a bare
 * date silently mismatches by up to two months; storing real bounds makes the
 * overlap explicit and the join correct.
 *
 * @param {string} startDate 'YYYY-MM-DD'
 * @param {string} frequency FRED's frequency_short: 'D','W','M','Q','A'
 */
function derivePeriodEnd(startDate, frequency) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(start);

  switch (frequency) {
    case 'D':  break;                                    // same day
    case 'W':  end.setUTCDate(end.getUTCDate() + 6); break;
    case 'M':  end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0); break;
    case 'Q':  end.setUTCMonth(end.getUTCMonth() + 3); end.setUTCDate(0); break;
    case 'A':  end.setUTCFullYear(end.getUTCFullYear() + 1); end.setUTCDate(end.getUTCDate() - 1); break;
    default:   break;   // unknown frequency: treat as an instant
  }
  return end.toISOString().slice(0, 10);
}

/** Map FRED's frequency codes onto our cadence enum. */
const FREQUENCY_TO_CADENCE = {
  D: 'daily', W: 'weekly', M: 'monthly', Q: 'quarterly', A: 'annual',
};

/**
 * Fetch a series' metadata. Used by the verification script to confirm a series
 * code actually exists before we trust an empty chart to mean "no data".
 *
 * @param {string} seriesId
 */
export async function fetchSeriesMetadata(seriesId) {
  requireKey();

  const url = `${BASE}/series?series_id=${encodeURIComponent(seriesId)}` +
              `&api_key=${config.keys.fred}&file_type=json`;

  const data = await fetchJson(url);
  const series = data?.seriess?.[0];

  if (!series) {
    throw new HttpError(`FRED returned no metadata for series "${seriesId}"`, { url });
  }

  return {
    id: series.id,
    title: series.title,
    units: series.units,
    frequency: series.frequency_short,
    cadence: FREQUENCY_TO_CADENCE[series.frequency_short] ?? 'irregular',
    observationStart: series.observation_start,
    observationEnd: series.observation_end,
    lastUpdated: series.last_updated,
  };
}

/**
 * Fetch observations for a FRED series and shape them for our schema.
 *
 * @param {string} seriesId
 * @param {object} [options]
 * @param {string} [options.indicatorId]     defaults to `fred.${seriesId}`
 * @param {string} [options.countryIso3]     FRED series are US unless stated
 * @param {string} [options.observationStart] 'YYYY-MM-DD' lower bound
 * @returns {Promise<import('../../repositories/observations.js').ObservationInput[]>}
 */
export async function fetchSeries(seriesId, options = {}) {
  requireKey();

  const {
    indicatorId = `fred.${seriesId}`,
    countryIso3 = 'USA',
    observationStart = '1990-01-01',
  } = options;

  // One metadata call to learn the frequency, so period bounds are derived
  // correctly rather than assumed.
  const meta = await fetchSeriesMetadata(seriesId);

  const url =
    `${BASE}/series/observations?series_id=${encodeURIComponent(seriesId)}` +
    `&api_key=${config.keys.fred}&file_type=json` +
    `&observation_start=${observationStart}`;

  const data = await fetchJson(url);
  const raw = data?.observations ?? [];

  return raw.map((row) => ({
    indicatorId,
    countryIso3,
    periodStart: row.date,
    periodEnd: derivePeriodEnd(row.date, meta.frequency),
    // FRED encodes "no value for this period" as the string '.'. Coercing that
    // with Number() would yield NaN and poison downstream arithmetic; it must
    // become a genuine NULL, which the schema explicitly allows.
    value: row.value === '.' ? null : Number(row.value),
    sourceRef: `https://fred.stlouisfed.org/series/${seriesId}`,
  }));
}

function requireKey() {
  if (!config.keys.fred) {
    throw new Error(
      'FRED_API_KEY is not set. Get a free key at ' +
        'https://fredaccount.stlouisfed.org/apikeys and add it to .env'
    );
  }
}

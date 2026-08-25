/**
 * GDELT — historical news volume.
 *
 * WHY THIS EXISTS ALONGSIDE rss.js
 * RSS feeds have no memory: they return the most recent items and nothing
 * older. An indicator built from them starts empty on first run and grows one
 * day at a time, so you would wait a year to see a year of trend. GDELT indexes
 * global news back to 2017 and will count matches server-side, which means a
 * full history arrives in one request instead of being accumulated.
 *
 * WHAT WE STORE, AND WHY IT IS SMALL
 * We do not download articles. We ask GDELT for a timeline and receive one
 * number per day — roughly 3,500 points for the whole archive, a few hundred
 * kilobytes. The counting happens on their infrastructure.
 *
 * WHY A SHARE AND NOT A COUNT
 * TimelineVolRaw returns both `value` (articles matching) and `norm` (all
 * articles GDELT saw that period). Storing the raw count would produce a chart
 * that rises as GDELT's crawler grows — measuring their coverage, not the
 * world's attention. The ratio is the honest quantity.
 */

import { config } from '../../config.js';
import { HttpError } from '../../lib/http.js';

const BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';

/**
 * The query defining "AI economics news".
 *
 * Two clauses, ANDed: something must identify it as about AI, and something
 * must identify it as about the economy. Either alone is far too broad — the
 * first would pull in every product launch, the second every interest-rate
 * story.
 *
 * `sourcelang:eng` because the relevance vocabulary is English. Dropping it
 * would inflate counts with articles the filter cannot actually assess.
 */
/**
 * GDELT rejects queries beyond roughly 250 characters with
 * "Your query was too short or too long" — and returns that as plain text with
 * HTTP 200, like every other refusal it issues. An earlier, more exhaustive
 * version of this query ran to ~280 characters and failed for that reason
 * rather than for anything to do with the terms in it.
 *
 * Kept under 160 characters. The dropped terms ("machine learning", "workforce",
 * "capex") were mostly redundant: articles using them almost always also use
 * one of the terms retained, so the loss in recall is small and the query
 * actually runs.
 */
export const AI_ECONOMY_QUERY =
  '("artificial intelligence" OR "generative AI" OR ChatGPT OR OpenAI) ' +
  '(jobs OR layoffs OR productivity OR economy OR hiring OR wages) sourcelang:eng';

/**
 * GDELT publishes 1 request / 5 seconds. Observed behaviour is stickier than
 * that: a short burst produced roughly 100 seconds of refusal. 8 seconds is
 * deliberately slack — this job runs on a schedule with no deadline, and being
 * throttled costs far more time than waiting.
 */
const REQUEST_SPACING_MS = 8_000;

let lastRequestAt = 0;

async function paced() {
  const wait = lastRequestAt + REQUEST_SPACING_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

/**
 * Fetch and parse, defending against GDELT's most dangerous behaviour.
 *
 * When throttled, GDELT returns its refusal as PLAIN TEXT WITH HTTP 200 rather
 * than a 429. Any `if (response.ok)` check accepts it, `JSON.parse` throws
 * something unrelated to the real cause, and a retry loop keyed on status code
 * never fires. So the body is inspected before parsing, and a throttle is
 * raised as a retryable condition rather than a parse failure.
 */
async function fetchTimeline(url) {
  await paced();

  let response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent':
          'EconIntel/1.0 (+https://github.com/joshuakhalili/EconIntel; joshuakhalili20@gmail.com)',
      },
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    /**
     * Node's HTTP stack applies its own 10-second CONNECT timeout, separate
     * from the AbortSignal above, and surfaces it as a bare "fetch failed".
     * GDELT routinely takes longer than that to accept a connection while it
     * assembles a large timeline, so this fires on healthy requests. Re-raised
     * as a retryable condition rather than a hard failure.
     */
    const cause = error.cause?.code ?? error.code;
    if (cause === 'UND_ERR_CONNECT_TIMEOUT' || error.name === 'TimeoutError') {
      throw new HttpError(`GDELT connection timed out (${cause ?? error.name})`, {
        url,
        status: 504,
      });
    }
    throw error;
  }

  const body = await response.text();

  if (!response.ok) {
    throw new HttpError(`GDELT returned HTTP ${response.status}`, {
      url,
      status: response.status,
      body: body.slice(0, 200),
    });
  }

  // The throttle notice, and any other non-JSON reply, starts with something
  // other than '{'. Checking the shape is the only reliable signal here.
  const trimmed = body.trimStart();
  if (!trimmed.startsWith('{')) {
    const throttled = /limit requests|one every|high-traffic/i.test(body);
    throw new HttpError(
      throttled
        ? 'GDELT rate limit hit (returned as plain text with HTTP 200)'
        : `GDELT returned non-JSON: ${body.slice(0, 120)}`,
      { url, status: throttled ? 429 : 502, body: body.slice(0, 200) }
    );
  }

  return JSON.parse(trimmed);
}

/** Retry on throttling with escalating backoff. */
async function fetchWithBackoff(url, { retries = 4 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchTimeline(url);
    } catch (error) {
      lastError = error;
      // 429 throttle, 502 unparseable, 504 connect timeout — all transient.
      if (![429, 502, 504].includes(error.status)) throw error;
      // 30s, 60s, 120s, 240s. GDELT's throttle outlasts short waits.
      const delay = 30_000 * 2 ** attempt;
      if (attempt < retries) await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

/** 'YYYYMMDDHHMMSS' as GDELT requires. */
function stamp(date) {
  return `${date.toISOString().slice(0, 10).replace(/-/g, '')}000000`;
}

/**
 * Daily volume of AI-economics news as a share of all news.
 *
 * @param {object} [options]
 * @param {Date}   [options.from]  defaults to 2017-01-01, GDELT's archive start
 * @param {Date}   [options.to]
 * @param {string} [options.query]
 * @returns {Promise<Array<{date: string, value: number, norm: number, share: number}>>}
 */
export async function fetchDailyVolume({ from, to, query = AI_ECONOMY_QUERY } = {}) {
  if (config.useFixtures) {
    throw new HttpError('Fixture mode: no recorded GDELT response', { url: BASE });
  }

  const start = from ?? new Date('2017-01-01T00:00:00Z');
  const end = to ?? new Date();

  const url =
    `${BASE}?query=${encodeURIComponent(query)}` +
    `&mode=TimelineVolRaw&format=json` +
    `&STARTDATETIME=${stamp(start)}&ENDDATETIME=${stamp(end)}`;

  const data = await fetchWithBackoff(url);

  const series = data?.timeline?.[0]?.data;
  if (!Array.isArray(series)) {
    throw new HttpError('GDELT returned no timeline', { url });
  }

  const points = [];

  for (const point of series) {
    // Dates arrive as 'YYYYMMDDTHHMMSSZ'.
    const iso = String(point.date ?? '').slice(0, 8);
    if (iso.length !== 8) continue;

    const value = Number(point.value);
    const norm = Number(point.norm);
    if (!Number.isFinite(value)) continue;

    points.push({
      date: `${iso.slice(0, 4)}-${iso.slice(4, 6)}-${iso.slice(6, 8)}`,
      value,
      norm: Number.isFinite(norm) ? norm : 0,
      // Guard the divide: GDELT reports norm 0 for days it indexed nothing,
      // which happens around outages. 0/0 would poison the series with NaN.
      share: Number.isFinite(norm) && norm > 0 ? (value / norm) * 100 : null,
    });
  }

  return points;
}

/**
 * Monthly observations for `derived.ai_news_volume`.
 *
 * Aggregated to months rather than stored daily: daily news volume is extremely
 * noisy — a single conference or earnings day doubles it — and the question the
 * dashboard asks is about trend, not about Tuesday. Months also line up with
 * the cadence of nearly every economic series it will be charted against.
 *
 * The monthly share is recomputed from summed numerators and denominators
 * rather than averaged from daily shares. Averaging ratios weights a quiet
 * Sunday equally with a heavy Wednesday, which is not what "share of coverage
 * this month" means.
 */
export function toMonthlyObservations(points, indicatorId = 'derived.ai_news_volume') {
  /** @type {Map<string, {value: number, norm: number}>} */
  const months = new Map();

  for (const p of points) {
    const month = p.date.slice(0, 7);
    const acc = months.get(month) ?? { value: 0, norm: 0 };
    acc.value += p.value;
    acc.norm += p.norm;
    months.set(month, acc);
  }

  const observations = [];

  for (const [month, acc] of months) {
    if (acc.norm <= 0) continue;

    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);

    observations.push({
      indicatorId,
      countryIso3: null,   // GDELT is global; sourcecountry would be a different series
      periodStart: `${month}-01`,
      periodEnd: lastDay,
      value: (acc.value / acc.norm) * 100,
      sourceRef: 'https://api.gdeltproject.org/api/v2/doc/doc',
    });
  }

  return observations.sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

/** Fetch and shape in one call, for the runner. */
export async function ingestNewsVolume() {
  const points = await fetchDailyVolume();
  return toMonthlyObservations(points);
}

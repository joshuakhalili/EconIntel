/**
 * SEC adapter — two genuinely different APIs, and the distinction matters.
 *
 *   1. XBRL  (data.sec.gov)  — STRUCTURED financial facts extracted from filed
 *      accounts. Real audited numbers: R&D expense, capital expenditure,
 *      revenue, headcount-adjacent measures. This is the good one.
 *
 *   2. Full-text search (efts.sec.gov) — searches the TEXT of filings. Returns
 *      "this filing mentions artificial intelligence", never "this company
 *      spent $X on AI". Companies do not tag AI spending as a distinct
 *      accounting concept, so no dollar figure can be derived from it.
 *
 * Conflating the two is the most likely way to end up presenting an attention
 * proxy as if it were a spending figure. They are kept in separate functions
 * with separate confidence tiers for exactly that reason.
 *
 * Neither needs an API key. Both REQUIRE a User-Agent header identifying the
 * operator; the SEC refuses requests without one.
 * See https://www.sec.gov/os/webmaster-faq#developers
 */

import { fetchJson, HttpError } from '../../lib/http.js';
import { config } from '../../config.js';

const XBRL_BASE = 'https://data.sec.gov/api/xbrl';
const FTS_BASE = 'https://efts.sec.gov/LATEST/search-index';

function secHeaders() {
  if (!config.secUserAgent) {
    throw new Error(
      'SEC_USER_AGENT is not set. The SEC requires a User-Agent identifying ' +
        'you, in the form "Your Name your@email.com", and refuses requests ' +
        'without one. Add it to .env.'
    );
  }
  return {
    'User-Agent': config.secUserAgent,
    'Accept-Encoding': 'gzip, deflate',
  };
}

/** SEC expects CIKs zero-padded to 10 digits in API paths. */
function padCik(cik) {
  return String(cik).replace(/\D/g, '').padStart(10, '0');
}

/**
 * us-gaap concepts worth tracking for AI-economics analysis.
 *
 * R&D expense is the closest audited proxy for AI investment that exists in
 * standardised accounting. It is imperfect — it covers all research, not just
 * AI — but it is a real number from a filed account rather than an inference,
 * and its trend across AI-heavy firms is meaningful.
 */
export const CONCEPTS = Object.freeze({
  rd: 'ResearchAndDevelopmentExpense',
  capex: 'PaymentsToAcquirePropertyPlantAndEquipment',
  revenue: 'RevenueFromContractWithCustomerExcludingAssessedTax',
  ppe: 'PropertyPlantAndEquipmentNet',
});

/**
 * Fetch one concept for ALL filers in a period — the "frames" endpoint.
 *
 * This is the highest-leverage call in the entire project: one request returns
 * a cross-sectional panel of, say, R&D expense for every company that reported
 * it in a quarter. Building the same panel company-by-company would be hundreds
 * of requests.
 *
 * @param {string} concept  a us-gaap tag, e.g. 'ResearchAndDevelopmentExpense'
 * @param {object} options
 * @param {number} options.year
 * @param {number} [options.quarter]  omit for annual frames
 * @param {string} [options.unit='USD']
 * @param {boolean} [options.instantaneous=false]
 *        Balance-sheet concepts (a stock, like PP&E) are "instantaneous" and
 *        take the 'I' suffix; income-statement concepts (a flow, like R&D
 *        expense over a period) do not. Getting this wrong returns 404, which
 *        is a much friendlier failure than silently wrong data.
 */
export async function fetchFrame(concept, options) {
  const { year, quarter, unit = 'USD', instantaneous = false } = options;

  const period = quarter
    ? `CY${year}Q${quarter}${instantaneous ? 'I' : ''}`
    : `CY${year}${instantaneous ? 'I' : ''}`;

  const url = `${XBRL_BASE}/frames/us-gaap/${concept}/${unit}/${period}.json`;
  const data = await fetchJson(url, { headers: secHeaders() });

  if (!Array.isArray(data?.data)) {
    throw new HttpError(`SEC frames returned no data array for ${concept} ${period}`, { url });
  }

  return data.data.map((row) => ({
    cik: padCik(row.cik),
    entityName: row.entityName,
    value: Number(row.val),
    periodStart: row.start ?? null,
    periodEnd: row.end,
    form: row.form,
    filed: row.filed,
    accession: row.accn,
  }));
}

/**
 * Fetch the full reported history of one concept for one company.
 *
 * @param {string} cik
 * @param {string} concept
 * @param {object} [options]
 * @param {string} [options.unit='USD']
 */
export async function fetchCompanyConcept(cik, concept, options = {}) {
  const { unit = 'USD' } = options;
  const url = `${XBRL_BASE}/companyconcept/CIK${padCik(cik)}/us-gaap/${concept}.json`;

  const data = await fetchJson(url, { headers: secHeaders() });
  const facts = data?.units?.[unit];

  if (!Array.isArray(facts)) {
    throw new HttpError(
      `SEC returned no ${unit} facts for ${concept} on CIK ${cik}`,
      { url }
    );
  }

  // Companies restate figures, so the same period appears more than once with
  // different accession numbers. Keep the most recently FILED value per period:
  // that is the company's current view of its own history, which is what any
  // analysis should use.
  const latestByPeriod = new Map();

  for (const fact of facts) {
    // 10-K and 10-Q only. Other forms (8-K exhibits, S-1s) mix reporting bases
    // and would make a time series incomparable with itself.
    if (fact.form !== '10-K' && fact.form !== '10-Q') continue;

    const key = `${fact.start ?? ''}_${fact.end}`;
    const existing = latestByPeriod.get(key);

    if (!existing || fact.filed > existing.filed) {
      latestByPeriod.set(key, fact);
    }
  }

  return [...latestByPeriod.values()].map((fact) => ({
    periodStart: fact.start ?? fact.end,
    periodEnd: fact.end,
    value: Number(fact.val),
    form: fact.form,
    filed: fact.filed,
    fiscalYear: fact.fy,
    fiscalPeriod: fact.fp,
    accession: fact.accn,
  }));
}

/**
 * Full-text search over filings.
 *
 * IMPORTANT: the return type is deliberately named `mentions`, not `spending`.
 * This function can tell you that AI is discussed; it cannot tell you what was
 * spent. Every consumer must treat the output as an attention signal with
 * confidence_tier 'derived' at best.
 *
 * @param {string} query   e.g. '"artificial intelligence"'
 * @param {object} [options]
 * @param {string[]} [options.forms=['10-K']]
 * @param {string} [options.startDate] 'YYYY-MM-DD'
 * @param {string} [options.endDate]
 */
export async function searchFilingMentions(query, options = {}) {
  const { forms = ['10-K'], startDate, endDate } = options;

  const params = new URLSearchParams({ q: query, forms: forms.join(',') });
  if (startDate && endDate) {
    params.set('dateRange', 'custom');
    params.set('startdt', startDate);
    params.set('enddt', endDate);
  }

  const url = `${FTS_BASE}?${params}`;
  const data = await fetchJson(url, { headers: secHeaders() });

  const hits = data?.hits?.hits ?? [];

  return {
    // The total is the useful number here: "how many filings mention this",
    // tracked over time, is a legitimate attention measure.
    totalMentions: data?.hits?.total?.value ?? 0,
    filings: hits.map((hit) => ({
      accession: hit._id,
      companyNames: hit._source?.display_names ?? [],
      cik: hit._source?.ciks?.[0] ? padCik(hit._source.ciks[0]) : null,
      form: hit._source?.file_type,
      filedAt: hit._source?.file_date,
    })),
  };
}

/**
 * Resolve a ticker to a CIK using the SEC's published mapping.
 * Needed because everything else in this module is keyed on CIK, while humans
 * and every other data source think in tickers.
 */
/**
 * How many filings of a given form type EDGAR received in a year.
 *
 * Read from the quarterly full-index files rather than from full-text search,
 * because FTS caps its reported total at 10,000. Querying a ubiquitous word
 * returns exactly 10000 for every year — a number that looks like a count, is
 * actually a ceiling, and would silently produce a wrong denominator that no
 * one would question because the resulting rate looks reasonable.
 *
 * The index files are the authoritative record: one line per filing, no cap.
 *
 * @param {number} year
 * @param {string} [form]
 * @returns {Promise<number>}
 */
export async function fetchFilingCount(year, form = '10-K') {
  let total = 0;

  for (const quarter of ['QTR1', 'QTR2', 'QTR3', 'QTR4']) {
    const url = `https://www.sec.gov/Archives/edgar/full-index/${year}/${quarter}/form.idx`;

    let text;
    try {
      const response = await fetch(url, {
        headers: secHeaders(),
        signal: AbortSignal.timeout(60_000),
      });
      // A quarter that has not happened yet returns 404. That is expected for
      // the current year and must not fail the whole calculation.
      if (response.status === 404) continue;
      if (!response.ok) {
        throw new HttpError(`SEC index returned HTTP ${response.status}`, {
          url,
          status: response.status,
        });
      }
      text = await response.text();
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(`SEC index fetch failed: ${error.message}`, { url });
    }

    // form.idx is fixed-width with the form type first. Match the whole token,
    // or '10-K' would also count '10-K/A' amendments and '10-KSB'.
    for (const line of text.split('\n')) {
      const first = line.trimEnd().split(/\s{2,}/)[0]?.trim();
      if (first === form) total += 1;
    }
  }

  return total;
}

/**
 * Share of annual reports that mention AI, per year.
 *
 * WHY THIS IS A GOOD INDICATOR: a 10-K is a legal document. Overstating AI
 * involvement in one carries liability that a press release does not, so this
 * measures corporate commitment under a materially higher standard of truth
 * than any survey or announcement count.
 *
 * The denominator matters as much as the numerator. Total 10-K filings barely
 * moved between 2019 and 2024 (6,923 to 6,878), so the rise from 6.4% to 35.4%
 * is a real change in what companies are saying, not an artefact of more
 * companies filing.
 *
 * @param {object} [options]
 * @param {number} [options.startYear=2015]
 * @param {number} [options.endYear]
 * @returns {Promise<Array<object>>}
 */
export async function computeAiMentionRate({
  startYear = 2015,
  endYear = new Date().getUTCFullYear(),
  indicatorId = 'derived.sec_ai_mention_rate',
} = {}) {
  const observations = [];

  for (let year = startYear; year <= endYear; year += 1) {
    const total = await fetchFilingCount(year, '10-K');
    // Skip rather than divide by zero. The current year has few filings until
    // the spring, and a rate computed from a handful of them is noise wearing
    // the same units as signal.
    if (total < 100) continue;

    const { totalMentions } = await searchFilingMentions('"artificial intelligence"', {
      forms: ['10-K'],
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    });

    observations.push({
      indicatorId,
      countryIso3: 'USA',
      periodStart: `${year}-01-01`,
      periodEnd: `${year}-12-31`,
      value: Math.round((totalMentions / total) * 10_000) / 100,
      sourceRef: 'https://efts.sec.gov/LATEST/search-index',
    });
  }

  return observations;
}

export async function fetchTickerToCikMap() {
  const url = 'https://www.sec.gov/files/company_tickers.json';
  const data = await fetchJson(url, { headers: secHeaders() });

  // The response is an object keyed by arbitrary index, not an array.
  return Object.values(data ?? {}).map((entry) => ({
    cik: padCik(entry.cik_str),
    ticker: entry.ticker,
    name: entry.title,
  }));
}

/**
 * US Federal Register adapter.
 *
 * The Federal Register is the official daily journal of the US government:
 * proposed rules, final rules, executive orders and notices. It is the primary
 * record of American AI regulation, and unlike a news feed it is the actual
 * legal instrument rather than someone's description of one.
 *
 * No API key. Public domain.
 *
 * Documents land in the `documents` table (kind = 'regulatory_text') rather
 * than becoming observations directly. The policy-stance classifier reads them
 * from there; a count of them becomes an observation separately. Keeping the
 * text and the derived numbers apart is what lets a reader trace any policy
 * figure back to the words behind it.
 */

import { createHash } from 'node:crypto';

import { fetchJson, HttpError } from '../../lib/http.js';

const BASE = 'https://www.federalregister.gov/api/v1';

/**
 * Search terms for AI-related regulation.
 *
 * Quoted phrases rather than bare words: unquoted 'artificial intelligence'
 * matches documents containing either word, and 'intelligence' alone pulls in
 * the entire national-security corpus.
 */
export const AI_SEARCH_TERMS = [
  '"artificial intelligence"',
  '"machine learning"',
  '"automated decision"',
  '"algorithmic"',
  '"foundation model"',
  '"generative AI"',
];

/**
 * Fetch documents matching a term.
 *
 * @param {string} term
 * @param {object} [options]
 * @param {string} [options.startDate] 'YYYY-MM-DD'
 * @param {string} [options.endDate]
 * @param {number} [options.perPage=100]  API maximum is 1000, but 100 keeps
 *                                        responses small and paging honest
 * @param {number} [options.page=1]
 */
export async function searchDocuments(term, options = {}) {
  const { startDate, endDate, perPage = 100, page = 1 } = options;

  const params = new URLSearchParams({
    'conditions[term]': term,
    per_page: String(perPage),
    page: String(page),
    order: 'newest',
  });

  // Field selection is not an optimisation nicety here: the default response
  // includes full document bodies, which for a 100-document page is megabytes
  // of text we would immediately discard.
  for (const field of [
    'document_number', 'title', 'abstract', 'html_url', 'publication_date',
    'type', 'agencies', 'action', 'significant',
  ]) {
    params.append('fields[]', field);
  }

  if (startDate) params.set('conditions[publication_date][gte]', startDate);
  if (endDate) params.set('conditions[publication_date][lte]', endDate);

  const url = `${BASE}/documents.json?${params}`;
  const data = await fetchJson(url);

  if (!data || typeof data !== 'object') {
    throw new HttpError('Federal Register returned an unexpected response', { url });
  }

  return {
    total: data.count ?? 0,
    totalPages: data.total_pages ?? 1,
    documents: (data.results ?? []).map(toDocument),
  };
}

/**
 * Map a Federal Register result onto our `documents` row shape.
 */
function toDocument(result) {
  const title = result.title ?? '(untitled)';
  const publishedAt = result.publication_date;

  return {
    kind: 'regulatory_text',
    sourceId: 'federal_register',
    url: result.html_url,
    title,
    // Agencies are objects; a comma-joined list of names is what a reader
    // actually wants to see as the author.
    author: (result.agencies ?? []).map((a) => a.name).filter(Boolean).join(', ') || null,
    summary: result.abstract ?? null,
    body: null,
    publishedAt,
    // Dedup on document_number: it is the Federal Register's own stable
    // identifier, so it is strictly better than hashing the title. The same
    // document surfaces under several of our search terms and must collapse to
    // one row.
    dedupHash: createHash('sha256')
      .update(`fedreg:${result.document_number}`)
      .digest('hex'),
    countryIso3s: ['USA'],
    industryCodes: [],
    companyIds: [],
    raw: result,
    // Documents reached via an explicit AI search term are AI-relevant by
    // construction; 'significant' is the Federal Register's own flag for rules
    // with major economic impact, which is a genuine signal rather than a guess.
    aiRelevance: result.significant ? 95 : 75,
    documentType: result.type ?? null,
  };
}

/**
 * Fetch all AI-related documents in a window, across every search term.
 *
 * Terms overlap heavily — a rule about foundation models mentions machine
 * learning too — so results are deduplicated on document_number before return.
 * Without that the monthly "regulatory volume" indicator would be inflated
 * several-fold by the same documents counted once per matching term.
 *
 * @param {object} [options]
 * @param {string} [options.startDate]
 * @param {string} [options.endDate]
 * @param {number} [options.maxPagesPerTerm=5]
 */
export async function fetchAiDocuments(options = {}) {
  const { startDate, endDate, maxPagesPerTerm = 5 } = options;

  /** @type {Map<string, ReturnType<typeof toDocument>>} */
  const byHash = new Map();
  let truncated = false;

  for (const term of AI_SEARCH_TERMS) {
    let page = 1;
    let totalPages = 1;

    while (page <= Math.min(totalPages, maxPagesPerTerm)) {
      const result = await searchDocuments(term, { startDate, endDate, page });
      totalPages = result.totalPages;

      for (const doc of result.documents) {
        byHash.set(doc.dedupHash, doc);
      }

      if (totalPages > maxPagesPerTerm) truncated = true;
      page += 1;
    }
  }

  return {
    documents: [...byHash.values()],
    // Report truncation rather than silently returning a partial set. A
    // capped result presented as complete would understate regulatory volume
    // without anyone noticing.
    truncated,
  };
}

/**
 * Monthly counts of AI-related documents, for the regulatory-volume indicator.
 *
 * @param {Array<{publishedAt: string}>} documents
 * @param {string} [indicatorId]
 */
/**
 * Monthly counts restricted to one Federal Register document type.
 *
 * The distinction is the point, and lumping them together loses it. A "Rule" is
 * binding law already in force. A "Proposed Rule" is a intention with a comment
 * period, typically 12-24 months ahead of becoming a Rule, if it ever does. A
 * "Presidential Document" is an executive order — fast, unilateral, and often
 * reversed by the next administration.
 *
 * A single "regulatory activity" line treats an executive order, a draft, and
 * enforceable law as the same event. Split, proposals become a leading
 * indicator of rules, and the gap between the two lines measures how much
 * announced intent is actually converting into obligation.
 *
 * @param {Array<{publishedAt: string, documentType: string|null}>} documents
 * @param {string} type  'Rule' | 'Proposed Rule' | 'Notice' | 'Presidential Document'
 * @param {string} indicatorId
 */
export function toMonthlyCountsByType(documents, type, indicatorId) {
  const matching = documents.filter((doc) => doc.documentType === type);
  return toMonthlyCounts(matching, indicatorId);
}

export function toMonthlyCounts(documents, indicatorId = 'derived.ai_regulation_volume') {
  /** @type {Map<string, number>} */
  const counts = new Map();

  for (const doc of documents) {
    if (!doc.publishedAt) continue;
    const month = doc.publishedAt.slice(0, 7);   // 'YYYY-MM'
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }

  return [...counts.entries()].map(([month, count]) => {
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);

    return {
      indicatorId,
      countryIso3: 'USA',
      periodStart: `${month}-01`,
      periodEnd: lastDay,
      value: count,
      sourceRef: 'https://www.federalregister.gov',
    };
  });
}

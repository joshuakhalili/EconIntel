/**
 * Document persistence.
 *
 * Mirrors `observations.js`: every adapter that produces text — RSS, GDELT,
 * Federal Register, SEC filings — funnels through here so deduplication and
 * conflict handling exist once rather than once per source.
 */

import { createHash } from 'node:crypto';

import { withTransaction, query } from '../db/pool.js';
import { normaliseTitle } from '../lib/relevance.js';

/** Postgres caps a statement at 65535 bound parameters; 11 per row here. */
const BATCH_SIZE = 500;

/**
 * Build the deduplication key.
 *
 * Normalised title plus publication DATE (not timestamp) is the grain that
 * catches wire-service syndication: the same story appears within hours across
 * outlets with different URLs and cosmetically different headlines. Using the
 * full timestamp would defeat that, since the copies never share a minute.
 *
 * URL is deliberately excluded — it is precisely the field that differs
 * between copies of the same article.
 */
export function buildDedupHash(title, publishedAt) {
  const day = new Date(publishedAt).toISOString().slice(0, 10);
  return createHash('sha256')
    .update(`${normaliseTitle(title)}|${day}`)
    .digest('hex');
}

/**
 * @typedef {object} DocumentInput
 * @property {string} kind            one of the document_kind enum values
 * @property {string} sourceId        must exist in `sources`
 * @property {string} url
 * @property {string} title
 * @property {string} [author]
 * @property {string} [summary]
 * @property {Date|string} publishedAt
 * @property {number} aiRelevance     0-100, from scoreRelevance()
 * @property {string[]} [countryIso3s]
 * @property {string[]} [industryCodes]
 * @property {object} [raw]
 */

/**
 * Insert documents, ignoring ones already held.
 *
 * DO NOTHING rather than DO UPDATE: a news article is immutable once published.
 * Re-running ingestion should be free and idempotent, and overwriting would
 * pointlessly churn `fetched_at` on rows that have not changed. The exception
 * would be a corrected headline, which is rare enough not to design around.
 *
 * @param {DocumentInput[]} documents
 * @returns {Promise<{written: number, duplicates: number, skipped: number}>}
 */
export async function insertDocuments(documents) {
  if (documents.length === 0) return { written: 0, duplicates: 0, skipped: 0 };

  const valid = [];
  let skipped = 0;

  for (const doc of documents) {
    // A document with no title or date cannot be deduplicated or ordered, and
    // both fields are NOT NULL. Drop it here rather than aborting the batch.
    if (!doc.title || !doc.url || !doc.publishedAt || !doc.sourceId) {
      skipped += 1;
      continue;
    }
    const published = new Date(doc.publishedAt);
    if (Number.isNaN(published.getTime())) {
      skipped += 1;
      continue;
    }
    valid.push({ ...doc, publishedAt: published });
  }

  // Deduplicate WITHIN the batch as well as against the table. Postgres rejects
  // an INSERT whose own VALUES list contains the conflict key twice, even with
  // ON CONFLICT DO NOTHING — the same wire story arriving from two feeds in one
  // run would otherwise abort the whole statement.
  const seen = new Set();
  const deduped = [];
  let duplicates = 0;

  for (const doc of valid) {
    const hash = buildDedupHash(doc.title, doc.publishedAt);
    if (seen.has(hash)) {
      duplicates += 1;
      continue;
    }
    seen.add(hash);
    deduped.push({ ...doc, dedupHash: hash });
  }

  let written = 0;

  await withTransaction(async (client) => {
    for (let offset = 0; offset < deduped.length; offset += BATCH_SIZE) {
      const batch = deduped.slice(offset, offset + BATCH_SIZE);

      const params = [];
      const tuples = batch.map((doc, index) => {
        const base = index * 12;
        params.push(
          doc.kind,
          doc.sourceId,
          doc.url,
          doc.title,
          doc.author ?? null,
          doc.summary ?? null,
          doc.publishedAt.toISOString(),
          doc.dedupHash,
          doc.countryIso3s ?? [],
          doc.industryCodes ?? [],
          doc.raw ? JSON.stringify(doc.raw) : null,
          // Clamp rather than trust the caller: ai_relevance is CHECK (0..100)
          // and a single out-of-range value would abort the whole batch.
          Math.max(0, Math.min(100, Math.round(doc.aiRelevance ?? 0)))
        );
        return `($${base + 1}::document_kind, $${base + 2}, $${base + 3}, $${base + 4}, ` +
               `$${base + 5}, $${base + 6}, $${base + 7}::timestamptz, $${base + 8}, ` +
               `$${base + 9}::char(3)[], $${base + 10}::text[], $${base + 11}::jsonb, ` +
               `$${base + 12}::smallint)`;
      });

      const { rowCount } = await client.query(
        `INSERT INTO documents (
           kind, source_id, url, title, author, summary,
           published_at, dedup_hash, country_iso3s, industry_codes, raw,
           ai_relevance
         )
         VALUES ${tuples.join(', ')}
         ON CONFLICT (dedup_hash) DO NOTHING`,
        params
      );

      written += rowCount;
      duplicates += batch.length - rowCount;
    }
  });

  return { written, duplicates, skipped };
}

/**
 * Recent documents above the relevance cutoff, for the dashboard news panel.
 *
 * The 40 default matches the partial index in 0004_documents.sql — querying
 * below it silently falls back to a sequential scan.
 */
export async function recentDocuments({ limit = 50, minRelevance = 40, kind = null } = {}) {
  const { rows } = await query(
    `SELECT d.id, d.kind, d.source_id, s.name AS source_name, d.url, d.title,
            d.summary, d.published_at, d.ai_relevance
       FROM documents d
       JOIN sources s ON s.id = d.source_id
      WHERE d.ai_relevance >= $1
        AND ($3::document_kind IS NULL OR d.kind = $3)
      ORDER BY d.published_at DESC
      LIMIT $2`,
    [minRelevance, limit, kind]
  );
  return rows;
}

/**
 * Documents published within a date window.
 *
 * Backs the click-a-chart-point context panel. Ordered by relevance first and
 * recency second: the reader wants the most significant thing that happened
 * that month, not merely the last thing.
 *
 * A sibling of `recentDocuments` rather than another parameter on it, because
 * the two use different indexes — that one rides `documents_relevance_idx`, this
 * one `documents_published_idx`.
 */
export async function documentsInWindow({ from, to, limit = 20, minRelevance = 40, kind = null } = {}) {
  const { rows } = await query(
    `SELECT d.id, d.kind, d.source_id, s.name AS source_name, d.url, d.title,
            d.summary, d.published_at, d.ai_relevance
       FROM documents d
       JOIN sources s ON s.id = d.source_id
      WHERE d.published_at >= $1::date
        AND d.published_at <  ($2::date + INTERVAL '1 day')
        AND d.ai_relevance >= $3
        AND ($5::document_kind IS NULL OR d.kind = $5)
      ORDER BY d.ai_relevance DESC, d.published_at DESC
      LIMIT $4`,
    [from, to, minRelevance, limit, kind]
  );
  return rows;
}

/**
 * Monthly counts of relevant documents — the raw material for
 * `derived.ai_news_volume`.
 *
 * Returns both the relevant count and the total, so the indicator can be
 * expressed as a SHARE. A raw count would rise simply because we added more
 * feeds, which would read on a chart as "AI is being discussed more".
 */
export async function monthlyDocumentCounts({ minRelevance = 40 } = {}) {
  const { rows } = await query(
    `SELECT date_trunc('month', published_at)::date AS month,
            count(*) FILTER (WHERE ai_relevance >= $1)::int AS relevant,
            count(*)::int AS total
       FROM documents
      GROUP BY 1
      ORDER BY 1`,
    [minRelevance]
  );
  return rows;
}

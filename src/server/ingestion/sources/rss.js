/**
 * RSS ingestion — the readable headline layer.
 *
 * WHAT THIS IS FOR, AND WHAT IT IS NOT FOR
 * RSS feeds have no memory. A feed returns the most recent 10-300 items and
 * nothing older, with no way to ask for last year. So RSS can supply a fresh,
 * attributable headline list, but it CANNOT supply a historical time series:
 * an indicator built from it would start empty on first run and grow one day at
 * a time. Counting over history is GDELT's job (see gdelt.js); this file exists
 * to give the dashboard trustworthy, named, linkable headlines.
 *
 * SOURCE SELECTION IS THE PRIMARY FILTER
 * Choosing constrained feeds removes far more irrelevance than any scoring
 * logic, and it never misfires. A road accident does not appear in arXiv cs.AI.
 * Every feed below was fetched and confirmed returning items on 2026-08-24.
 */

import Parser from 'rss-parser';

import { scoreRelevance } from '../../lib/relevance.js';

/**
 * The SEC is not the only publisher that blocks anonymous automated traffic —
 * BLS returns 403 without one, and Bloomberg and the FT are inconsistent. A
 * descriptive User-Agent with contact details is both the polite and the
 * working choice.
 */
const USER_AGENT =
  'EconIntel/1.0 (+https://github.com/joshuakhalili/EconIntel; joshuakhalili20@gmail.com)';

/**
 * Curated feed list.
 *
 * `sourceId` must exist in the `sources` table — it is a foreign key.
 * `aiFocused` marks feeds that are ALREADY entirely about AI, so an item need
 * not restate it in the title to count as an AI story.
 *
 * Deliberately excluded: feeds.reuters.com (discontinued, returns nothing —
 * a dead feed is indistinguishable from a quiet one, so it must be removed
 * rather than left to fail silently).
 */
export const FEEDS = [
  {
    sourceId: 'rss:arstechnica',
    url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
    kind: 'news',
    aiFocused: false,
  },
  {
    sourceId: 'rss:mit_tech',
    url: 'https://www.technologyreview.com/feed/',
    kind: 'news',
    aiFocused: false,
  },
  {
    sourceId: 'rss:bbc_tech',
    url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    kind: 'news',
    aiFocused: false,
  },
  {
    /**
     * The Guardian's AI section, but NOT marked aiFocused.
     *
     * Measured against the live feed: the section carries loosely-tagged
     * opinion pieces, and trusting the tag let a Bernie Sanders column on US
     * politics score 75 purely because it discussed the economy. A section tag
     * is an editorial convenience, not a guarantee of topic — so this feed must
     * still show its own AI signal like any other.
     */
    sourceId: 'rss:guardian',
    url: 'https://www.theguardian.com/technology/artificialintelligenceai/rss',
    kind: 'news',
    aiFocused: false,
  },
  {
    sourceId: 'rss:cnbc',
    url: 'https://www.cnbc.com/id/19854910/device/rss/rss.html',
    kind: 'news',
    aiFocused: false,
  },
  {
    sourceId: 'rss:ft',
    url: 'https://www.ft.com/technology?format=rss',
    kind: 'news',
    aiFocused: false,
  },
  {
    sourceId: 'rss:bloomberg',
    url: 'https://feeds.bloomberg.com/technology/news.rss',
    kind: 'news',
    aiFocused: false,
  },
  {
    // Central bank commentary is where AI first enters official economic
    // thinking, and it is the highest-credibility source in this list.
    sourceId: 'gov:federal_reserve',
    url: 'https://www.federalreserve.gov/feeds/press_all.xml',
    kind: 'gov_release',
    aiFocused: false,
  },
];

/**
 * rss-parser handles both RSS and Atom. `customFields` pulls the fields
 * publishers disagree about — some put the excerpt in `description`, others in
 * `content:encoded` or `summary`.
 */
const parser = new Parser({
  timeout: 20_000,
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'dcCreator'],
    ],
  },
});

/** Strip HTML tags from a feed excerpt and collapse whitespace. */
function stripHtml(text) {
  if (!text) return null;
  const plain = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  // Excerpts are for display and full-text search, not storage of the article.
  // We do not hold the body, both to respect publishers and to keep the row small.
  return plain.length > 1000 ? `${plain.slice(0, 997)}...` : plain || null;
}

/**
 * Fetch one feed and shape it into DocumentInput rows.
 *
 * Items with no usable date are dropped rather than dated `now()`: a wrong
 * timestamp corrupts both the dedup key and any ordering by recency, and it is
 * invisible once written.
 *
 * @param {typeof FEEDS[number]} feed
 * @returns {Promise<Array<object>>}
 */
export async function fetchFeed(feed) {
  const parsed = await parser.parseURL(feed.url);
  const documents = [];

  for (const item of parsed.items ?? []) {
    const title = (item.title ?? '').trim();
    const url = (item.link ?? '').trim();
    if (!title || !url) continue;

    const publishedAt = item.isoDate ?? item.pubDate ?? null;
    if (!publishedAt) continue;

    const summary = stripHtml(item.contentSnippet ?? item.summary ?? item.content ?? item.contentEncoded);

    const { score } = scoreRelevance({
      title,
      summary: summary ?? '',
      url,
      sourceIsAiFocused: feed.aiFocused,
    });

    documents.push({
      kind: feed.kind,
      sourceId: feed.sourceId,
      url,
      title,
      author: item.creator ?? item.dcCreator ?? item.author ?? null,
      summary,
      publishedAt,
      aiRelevance: score,
      raw: { feedUrl: feed.url, guid: item.guid ?? null, categories: item.categories ?? [] },
    });
  }

  return documents;
}

/**
 * Fetch every feed.
 *
 * Feeds are fetched sequentially with a small delay rather than in parallel.
 * These are other people's free services and this job runs on a schedule with
 * no deadline; hammering eight publishers simultaneously to save four seconds
 * is a good way to be blocked.
 *
 * One feed failing must not lose the others — publishers change URLs, expire
 * certificates and rate-limit without warning. Failures are collected and
 * returned so the caller can record them rather than discovering an empty
 * news panel later.
 *
 * @returns {Promise<{documents: object[], failures: Array<{sourceId: string, url: string, error: string}>}>}
 */
export async function fetchAllFeeds({ delayMs = 400 } = {}) {
  const documents = [];
  const failures = [];

  for (const feed of FEEDS) {
    try {
      const items = await fetchFeed(feed);
      documents.push(...items);
    } catch (error) {
      failures.push({ sourceId: feed.sourceId, url: feed.url, error: error.message });
    }
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return { documents, failures };
}

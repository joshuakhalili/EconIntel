/**
 * OpenAlex adapter — the academic corpus behind "What others have found".
 *
 * OpenAlex is a free, keyless, CC0 catalogue of ~250 million scholarly works.
 * That size is the problem, not the feature. Fetching OpenAlex is trivial;
 * CHOOSING a corpus is the entire job, because a query one notch too loose
 * returns a hundred thousand papers that mention AI and measure nothing about
 * the economy.
 *
 * These documents land in `documents` (kind = 'research'). They are candidates
 * for `question_reading`, not entries in it: attaching a paper to a question
 * means judging what it argues and how it sits against this site's own answer,
 * which is an editorial act. Nothing here writes a `takeaway` — 0012 and 0014
 * both say why, and the reason holds harder for a machine-selected corpus than
 * for a hand-picked one.
 *
 *
 * ── THE QUERY ───────────────────────────────────────────────────────────────
 *
 * Two strands, unioned and deduplicated. Both share the same topical core:
 *
 *   title       contains an AI / automation term          (AI_TITLE_TERMS)
 *   title+abs   contains an economic-outcome term         (ECONOMIC_OUTCOME_TERMS)
 *   field       Economics, Econometrics and Finance       (fields/20)
 *   from        2015-01-01, has an abstract, not retracted
 *
 * and differ only in what counts as a publication worth keeping:
 *
 *   journals        type:article  +  primary_location.source.is_core:true
 *                   ~890 works. `is_core` is OpenAlex's own flag for the CWTS
 *                   Leiden-ranked journal set — a curated ~28k venues. It is
 *                   structured metadata, not our judgement, and it is the
 *                   single most effective filter found here (see PRECISION).
 *
 *   working_papers  locations.source.id in WORKING_PAPER_SOURCES
 *                   ~470 works. RePEc, NBER, SSRN, EconStor, MPRA, the OECD
 *                   Economics Department series, World Bank policy research
 *                   papers, CESifo. This literature genuinely lives in working
 *                   paper form for years before it is a journal article — the
 *                   Acemoglu–Restrepo and Autor lines both do — so excluding
 *                   preprints would exclude the frontier of the field.
 *
 * Combined: roughly 1,350 works fetched, ~1,050 kept after the title veto and
 * cross-strand deduplication. Both numbers move as OpenAlex indexes more.
 *
 *
 * ── WHY THE TITLE, NOT JUST THE ABSTRACT ────────────────────────────────────
 *
 * The first attempt searched title AND abstract for the AI terms. It returned
 * 3,927 works in field 20, and an unbiased random sample of 25 was roughly 15%
 * on-topic. The failure mode is one genre: economics papers that USE machine
 * learning as a method ("Unveiling greenwashing in Colombian manufacturing: a
 * machine learning approach"). They mention AI everywhere and measure nothing
 * about it.
 *
 * Requiring an AI term in the TITLE fixes that, because a paper about AI's
 * economic effects names AI in its title and a paper that merely uses ML for
 * regression usually does not.
 *
 *
 * ── WHAT IS DELIBERATELY EXCLUDED ───────────────────────────────────────────
 *
 * "machine learning" as an AI term.  It is overwhelmingly a method marker in
 *   this field. Dropping it cost almost no real papers — the ones that matter
 *   say "artificial intelligence", "generative AI", "robots" or "automation".
 *
 * "algorithmic".  Tested and removed. OpenAlex stems, so it also matches
 *   "algorithm", and it dragged in the entire algorithmic-trading and
 *   applied-mathematics literature ("A Monte Carlo algorithm for the extrema of
 *   tempered stable processes"). It was the largest single source of noise.
 *
 * Fields 14 (Business, Management and Accounting) and 18 (Decision Sciences).
 *   Adding them took the journal strand from 892 to 2,938 works and the sample
 *   precision from ~76% to under half — HR commentary, technology-acceptance
 *   surveys and e-commerce papers. Field 20 alone is the right boundary.
 *
 * Retracted works, works with no abstract, and anything before 2015.
 *
 * `is_oa:true` is NOT used as a filter, though the brief invited it. It would
 *   have removed "Robots and Jobs" (JPE, closed) and most of the QJE line —
 *   the most-cited work in the field. Open access is stored per work instead,
 *   and `openAccessUrl` carries a link a reader can actually open where one
 *   exists.
 *
 * The `TITLE_VETO` genres — carbon/emissions/green, clinical/medical,
 *   trading/portfolio/crypto — are cut CLIENT-SIDE rather than as a NOT clause
 *   in the query. Two reasons: OpenAlex 504s on queries with too many boolean
 *   operators (measured, repeatedly, with the veto inline), and a local filter
 *   is unit-testable, which a remote search string is not.
 *
 *
 * ── PRECISION, MEASURED ─────────────────────────────────────────────────────
 *
 * Method: OpenAlex's `sample=25&seed=N`, which draws uniformly from the whole
 * result set rather than from the relevance-sorted head. Sorted samples flatter
 * every query ever written; the head of even the worst query below looked
 * excellent. Each title was read and marked on one question — does this work
 * measure or model an economic effect of AI, automation or robots?
 *
 *   title+abstract AI, field 20, no venue filter   3,927 works   ~15%  (4/25)
 *   + cited_by_count > 9                             503 works   ~45% (11/25)
 *   AI in title, field 20, is_core, no veto           703 works   ~68% (17/25)
 *   final journals strand (with veto)                ~890 works   ~76% (19/25)
 *   final working-papers strand (with veto)          ~470 works   ~84% (21/25)
 *
 * A citation floor was tried and rejected as the primary filter. It works
 * (45% at >9 citations) but it is an age filter wearing a quality costume: it
 * removes almost everything published after 2024, which on this subject is the
 * half a reader most wants. `is_core` achieves more precision without that bias.
 *
 * The residual ~20% is mostly two genres the veto does not catch: papers on
 * AI and energy intensity, and single-country descriptive pieces in minor
 * journals. Both are visible in the corpus rather than hidden, and both are a
 * human's call to keep or drop at the point of citing one.
 *
 *
 * ── LICENCE ─────────────────────────────────────────────────────────────────
 *
 * OpenAlex data is CC0. Abstracts are reconstructed from OpenAlex's inverted
 * index and stored VERBATIM — no summarising, no paraphrase, nothing written by
 * a model. See `reconstructAbstract`.
 */

import { fetchJson, HttpError } from '../../lib/http.js';
import { scoreRelevance } from '../../lib/relevance.js';
import { config } from '../../config.js';

const BASE = 'https://api.openalex.org';

/** Earliest publication date kept. Deep learning's economics literature starts here. */
export const CORPUS_START = '2015-01-01';

/**
 * AI / automation terms, matched against the TITLE.
 *
 * OpenAlex stems, so "robots" also matches "robot", and "large language model"
 * also matches the plural. Redundant variants were removed after measuring: the
 * operator count is what makes OpenAlex time a query out.
 */
export const AI_TITLE_TERMS = [
  '"artificial intelligence"',
  '"generative AI"',
  '"large language model"',
  'ChatGPT',
  '"AI adoption"',
  'robots',
  'robotics',
  'automation',
];

/**
 * Economic-outcome vocabulary, matched against title AND abstract.
 *
 * This is what separates "AI and the labour market" from "AI and the ethics of
 * personhood". Broad on purpose — the title filter above has already decided
 * the paper is about AI, so this only has to decide whether an economic
 * quantity appears anywhere in it.
 */
export const ECONOMIC_OUTCOME_TERMS = [
  'productivity', 'employment', 'unemployment', 'labor', 'labour', 'wage',
  'jobs', 'hiring', 'occupations', 'workers', 'skills', 'tasks', 'earnings',
  'inequality', '"economic growth"', '"firm performance"', 'output', 'GDP',
];

/**
 * Title substrings that mark a paper as belonging to a different literature.
 *
 * Applied to the lowercased title, locally. Every one of these was observed in
 * a random sample before it was added — none is speculative. The environmental
 * block is by far the largest: "AI and carbon emissions in Chinese
 * manufacturing" is a genuine and very large research programme, and it is not
 * this one.
 *
 * Kept as plain substrings, matching `lib/relevance.js`, because a title is
 * short and the failure mode of a regex here is silent over-deletion.
 */
export const TITLE_VETO = [
  // Environmental economics — a separate literature that shares every AI term.
  'carbon', 'emission', 'green ', 'greening', 'sustainab', 'pollution',
  'ecological', 'renewable', 'energy transition', 'energy intensity',
  'energy efficiency', 'climate', 'biodiversity',
  // Clinical and agricultural applications.
  'medical', 'clinical', 'patient', 'surgical', 'radiolog', 'agricultur',
  // Finance methods rather than economic effects.
  'algorithmic trading', 'portfolio', 'cryptocurrenc', 'blockchain',
  'stock market', 'asset pricing',
  // Machine-learning methodology papers that slipped past the title filter.
  'reinforcement learning', 'genetic algorithm', 'neural network architecture',
];

/**
 * Working-paper venues, by OpenAlex source id.
 *
 * A whitelist rather than `type:preprint`, because the unrestricted preprint
 * pool is arXiv, Zenodo, Preprints.org and Qeios — unrefereed dumps whose
 * economics content is mostly not economics. These eight are where the field's
 * working papers actually circulate.
 */
export const WORKING_PAPER_SOURCES = [
  { id: 'S4306401271', name: 'RePEc: Research Papers in Economics' },
  { id: 'S2809516038', name: 'National Bureau of Economic Research' },
  { id: 'S4210172589', name: 'SSRN Electronic Journal' },
  { id: 'S4306401696', name: 'EconStor' },
  { id: 'S4306400553', name: 'Munich Personal RePEc Archive' },
  { id: 'S4210239538', name: 'OECD Economics Department working papers' },
  { id: 'S4210231086', name: 'World Bank policy research working paper' },
  { id: 'S7407053623', name: 'CESifo' },
];

/** Shared topical core of both strands. */
function coreFilters({ fromDate }) {
  return [
    `title.search:${AI_TITLE_TERMS.join(' OR ')}`,
    `title_and_abstract.search:${ECONOMIC_OUTCOME_TERMS.join(' OR ')}`,
    'primary_topic.field.id:fields/20',
    'has_abstract:true',
    'is_retracted:false',
    `from_publication_date:${fromDate}`,
  ];
}

/**
 * The two halves of the corpus.
 *
 * Separate jobs rather than one, so the runner reports them separately: they
 * fail for different reasons (a venue whitelist can go stale, `is_core` cannot)
 * and a reader of the ingestion log should be able to see which half is thin.
 */
export const STRANDS = [
  {
    id: 'journals',
    label: 'peer-reviewed economics journals',
    filters: (options) => [
      ...coreFilters(options),
      'type:article',
      'primary_location.source.is_core:true',
    ],
  },
  {
    id: 'working_papers',
    label: 'economics working papers and institutional research',
    filters: (options) => [
      ...coreFilters(options),
      `locations.source.id:${WORKING_PAPER_SOURCES.map((s) => s.id).join('|')}`,
    ],
  },
];

/**
 * The contact address OpenAlex asks for, taken from SEC_USER_AGENT.
 *
 * Reusing that variable rather than adding a second one: both exist for the
 * same reason — a public API that wants to know who is calling it — and a
 * second contact variable is a second thing to forget to set. OpenAlex's polite
 * pool is a courtesy we should take, not a requirement; if the variable is
 * unset the request still works, so this returns null rather than throwing.
 */
export function contactEmail() {
  const match = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(config.secUserAgent ?? '');
  return match ? match[0] : null;
}

/**
 * Rebuild an abstract from OpenAlex's inverted index.
 *
 * OpenAlex stores abstracts as {word: [positions]} rather than as text, for
 * copyright reasons that do not survive contact with the fact that the mapping
 * is exactly reversible. This reverses it and nothing else — every word and its
 * position comes from the index. It is a transcription, not a summary, which is
 * the only reason storing it is allowed here at all.
 *
 * Returns null rather than a partial string when the index is missing, so a
 * caller can tell "no abstract" from "empty abstract".
 *
 * @param {Record<string, number[]>|null|undefined} index
 * @returns {string|null}
 */
export function reconstructAbstract(index) {
  if (!index || typeof index !== 'object') return null;

  /** @type {string[]} */
  const words = [];
  let maxPosition = -1;

  for (const [word, positions] of Object.entries(index)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions) {
      if (!Number.isInteger(position) || position < 0) continue;
      words[position] = word;
      if (position > maxPosition) maxPosition = position;
    }
  }

  if (maxPosition < 0) return null;

  // Gaps are possible if OpenAlex's index is malformed. Drop them rather than
  // emitting "undefined" into stored text.
  const text = words.slice(0, maxPosition + 1).filter(Boolean).join(' ').trim();
  return text.length > 0 ? text : null;
}

/**
 * Is this title from a different literature?
 *
 * @param {string} title
 * @returns {boolean}
 */
export function isOffTopicTitle(title) {
  if (!title) return true;
  const haystack = title.toLowerCase();
  return TITLE_VETO.some((term) => haystack.includes(term));
}

/** Strip the OpenAlex URL prefix from an entity id: W3021644002. */
function shortId(id) {
  return typeof id === 'string' ? id.replace(/^https?:\/\/openalex\.org\//, '') : null;
}

/**
 * Map an OpenAlex work onto our `documents` row shape.
 *
 * Returns null for anything that cannot be cited honestly — no title, no date,
 * or no resolvable identifier. The brief's second rule is that every stored
 * work carries a real identifier and a URL that resolves; a work with neither a
 * DOI nor a landing page fails that and is dropped rather than stored with a
 * guessed link.
 *
 * @param {object} work
 * @param {string} [strandId]
 */
export function toDocument(work, strandId = null) {
  const title = work?.display_name ?? work?.title ?? null;
  const publishedAt = work?.publication_date ?? null;
  if (!title || !publishedAt) return null;

  const primary = work.primary_location ?? {};
  const bestOa = work.best_oa_location ?? null;
  const venue = primary.source ?? {};

  /**
   * The stored URL is the DOI where there is one.
   *
   * A DOI is the citation, it resolves forever, and it is the thing a reader
   * can paste into a reference manager. An OA landing page is more immediately
   * READABLE but it is a copy at some repository, and repositories move. So the
   * DOI is the link and the OA copy is carried alongside it in `raw`, where the
   * reading view can prefer it.
   */
  const doi = work.doi ?? null;
  const url = doi
    ?? bestOa?.landing_page_url
    ?? primary.landing_page_url
    ?? work.id
    ?? null;
  if (!url) return null;

  const summary = reconstructAbstract(work.abstract_inverted_index);

  const authorships = Array.isArray(work.authorships) ? work.authorships : [];
  // Cap the author list. Some indexed works carry hundreds of authorships and
  // the column is displayed, not analysed.
  const authors = authorships
    .map((a) => a?.author?.display_name)
    .filter(Boolean);
  const author = authors.length === 0
    ? null
    : authors.length > 6
      ? `${authors.slice(0, 6).join(', ')} et al.`
      : authors.join(', ');

  /**
   * `sourceIsAiFocused` is true because this corpus IS the filter.
   *
   * Without it the scorer returns 0 for "Robots and Jobs: Evidence from US
   * Labor Markets" — its AI vocabulary is tuned for news copy and "robots" is
   * not in it — and the paper would land below the 40 threshold that decides
   * whether a document is visible to the dashboard at all. The flag is
   * documented for exactly this case: a source that has already done the topic
   * filtering upstream.
   */
  const { score } = scoreRelevance({
    title,
    summary: summary ?? '',
    sourceIsAiFocused: true,
  });

  return {
    kind: 'research',
    sourceId: 'openalex',
    url,
    title,
    author,
    summary,
    publishedAt,
    countryIso3s: [],
    industryCodes: [],
    companyIds: [],
    aiRelevance: score,
    /**
     * Kept deliberately small. `documents.raw` exists so a record can be
     * reprocessed without refetching, not as a mirror of the provider — an
     * OpenAlex work is ~40KB of JSON and almost all of it is per-author
     * institution metadata this project has no use for.
     */
    raw: {
      openalex_id: shortId(work.id),
      doi,
      type: work.type ?? null,
      language: work.language ?? null,
      cited_by_count: work.cited_by_count ?? null,
      is_oa: work.open_access?.is_oa ?? null,
      oa_status: work.open_access?.oa_status ?? null,
      // The link a reader can open, where one exists. Not the citation.
      oa_url: bestOa?.landing_page_url ?? work.open_access?.oa_url ?? null,
      venue: venue.display_name ?? null,
      venue_id: shortId(venue.id),
      venue_type: venue.type ?? null,
      venue_is_core: venue.is_core ?? null,
      publisher: venue.host_organization_name ?? null,
      topic: work.primary_topic?.display_name ?? null,
      topic_id: shortId(work.primary_topic?.id),
      author_count: authorships.length,
      strand: strandId,
    },
  };
}

/**
 * Fields requested from OpenAlex.
 *
 * `select` is not an optimisation nicety: the default work object is ~40KB and
 * a 200-work page of them is eight megabytes, nearly all of it authorship
 * institution records. Asking for what we store keeps a full corpus fetch at a
 * few megabytes total.
 */
const SELECT = [
  'id', 'doi', 'display_name', 'publication_date', 'type', 'language',
  'cited_by_count', 'open_access', 'primary_location', 'best_oa_location',
  'authorships', 'primary_topic', 'abstract_inverted_index',
].join(',');

/**
 * Fetch one strand, paging until exhausted.
 *
 * Cursor paging rather than `page=`: OpenAlex caps offset paging at 10,000
 * results and cursors are what it asks callers to use for anything larger. The
 * corpus is under that cap today, and will not be if the query is ever widened.
 *
 * @param {object} strand  one of STRANDS
 * @param {object} [options]
 * @param {string} [options.fromDate=CORPUS_START]
 * @param {number} [options.perPage=200]  OpenAlex maximum
 * @param {number} [options.maxPages=40]  hard stop; 40 pages is 8,000 works
 */
export async function fetchStrand(strand, options = {}) {
  const { fromDate = CORPUS_START, perPage = 200, maxPages = 40 } = options;

  const email = contactEmail();
  const filter = strand.filters({ fromDate }).join(',');

  /** @type {ReturnType<typeof toDocument>[]} */
  const documents = [];
  let cursor = '*';
  let pages = 0;
  let total = null;
  let vetoed = 0;
  let unusable = 0;

  while (cursor && pages < maxPages) {
    const params = new URLSearchParams({
      filter,
      select: SELECT,
      'per-page': String(perPage),
      cursor,
    });
    if (email) params.set('mailto', email);

    const data = await fetchJson(`${BASE}/works?${params}`, {
      // OpenAlex answers a boolean-heavy search in 2-8 seconds and occasionally
      // much longer. The default 20s is not always enough for the first page.
      timeoutMs: 45_000,
      headers: email ? { 'User-Agent': `Diffusion (mailto:${email})` } : {},
    });

    if (!data || typeof data !== 'object' || !Array.isArray(data.results)) {
      throw new HttpError('OpenAlex returned an unexpected response', {
        url: `${BASE}/works`,
      });
    }

    if (total === null) total = data.meta?.count ?? 0;

    for (const work of data.results) {
      const title = work?.display_name ?? '';
      if (isOffTopicTitle(title)) {
        vetoed += 1;
        continue;
      }
      const document = toDocument(work, strand.id);
      if (!document) {
        unusable += 1;
        continue;
      }
      documents.push(document);
    }

    cursor = data.meta?.next_cursor ?? null;
    pages += 1;
    if (data.results.length === 0) break;
  }

  return {
    documents,
    total,
    vetoed,
    unusable,
    // A corpus silently capped at maxPages would look complete. Say so instead.
    truncated: Boolean(cursor) && pages >= maxPages,
  };
}

/**
 * Fetch both strands and deduplicate across them.
 *
 * The strands overlap: a paper can be an NBER working paper AND appear in a
 * core journal, and OpenAlex returns the same work id for both. Deduplication
 * is on the OpenAlex work id, which is stable, rather than on the title —
 * `insertDocuments` deduplicates on normalised title and date as well, but that
 * runs later and would count the overlap as "already held" rather than as what
 * it is.
 *
 * @param {object} [options] passed through to fetchStrand
 */
export async function fetchCorpus(options = {}) {
  /** @type {Map<string, ReturnType<typeof toDocument>>} */
  const byId = new Map();
  const strands = [];

  for (const strand of STRANDS) {
    const result = await fetchStrand(strand, options);
    strands.push({ id: strand.id, ...result, documents: result.documents.length });

    for (const document of result.documents) {
      const key = document.raw.openalex_id ?? document.url;
      // First strand wins, so a work in both is attributed to `journals`.
      if (!byId.has(key)) byId.set(key, document);
    }
  }

  return {
    documents: [...byId.values()],
    strands,
    truncated: strands.some((s) => s.truncated),
  };
}

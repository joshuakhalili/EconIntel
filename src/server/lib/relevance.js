/**
 * Deterministic AI-relevance scoring for documents.
 *
 * This runs on every article at ingestion and decides which are worth keeping,
 * showing, and (later) paying an LLM to classify. It is pure keyword matching
 * by design: the schema's triage step must stay free, and a scorer whose output
 * changes between runs would make `ai_relevance` untrustworthy as a filter.
 *
 * WHY NOT JUST SEARCH FOR "AI"
 * Two-letter acronyms are the worst possible search term. Naive matching pulls
 * in "Al Jazeera", "bail", "retail", "Thailand", and artificial insemination in
 * farming coverage. It also MISSES the most important stories, which routinely
 * discuss Nvidia, data centres and automation without ever writing "AI".
 *
 * So relevance is decided by three interacting signals rather than one list:
 *
 *   1. AI SIGNAL      — is this about AI at all? (required)
 *   2. ECONOMIC SIGNAL— does it touch the economy, labour or industry?
 *   3. VETO           — is it clearly a different kind of story?
 *
 * A document must have signal 1 to score at all. Signal 2 is what separates
 * "AI economic impact" from consumer gadget reviews. Signal 3 is what actually
 * removes the crime, sport and celebrity noise — no amount of positive matching
 * does that job, because those articles legitimately contain economic words.
 */

/**
 * Terms that are unambiguously about AI. Matching one of these is strong
 * evidence on its own, so they carry the highest weight.
 *
 * Multi-word phrases and proper nouns only. Anything that could be a substring
 * of an unrelated word belongs in AI_TOKENS instead, where it gets stricter
 * boundary handling.
 */
const AI_STRONG = [
  'artificial intelligence', 'generative ai', 'machine learning', 'deep learning',
  'large language model', 'language model', 'neural network', 'foundation model',
  'chatgpt', 'openai', 'anthropic', 'deepmind', 'claude ai', 'gemini ai',
  'copilot', 'midjourney', 'stable diffusion', 'hugging face', 'mistral ai',
  'transformer model', 'llm', 'agentic ai', 'ai agent', 'ai model', 'ai system',
  'ai chip', 'ai adoption', 'ai regulation', 'ai safety', 'frontier model',
  'inference compute', 'training run', 'gpu cluster', 'superintelligence',
];

/**
 * Supporting technology terms. Individually weak — a data-centre story might be
 * about cloud storage — but they compound, and they catch AI coverage written
 * without the phrase "AI" in it.
 */
const TECH_SUPPORT = [
  'data centre', 'data center', 'datacenter', 'hyperscaler', 'nvidia', 'tsmc',
  'semiconductor', 'gpu', 'tpu', 'chip fab', 'foundry', 'cloud computing',
  'automation', 'robotics', 'algorithm', 'compute capacity', 'h100', 'blackwell',
  'export controls', 'chip act', 'silicon',
];

/**
 * Economic and labour vocabulary. This is what makes the difference between a
 * product launch and an economics story. Required for a high score, because
 * this dashboard is about AI's ECONOMIC impact, not about AI generally.
 */
const ECONOMIC = [
  'productivity', 'gdp', 'employment', 'unemployment', 'jobs', 'job losses',
  'layoff', 'layoffs', 'redundanc', 'hiring', 'workforce', 'labour market',
  'labor market', 'wages', 'earnings', 'capital expenditure', 'capex',
  'investment', 'economy', 'economic', 'inflation', 'recession', 'revenue',
  'profit', 'valuation', 'market share', 'supply chain', 'trade', 'tariff',
  'monetary policy', 'central bank', 'interest rate', 'industry', 'manufacturing',
  'displacement', 'reskilling', 'occupation', 'earnings call', 'ipo',
];

/**
 * Hard vetoes.
 *
 * These do not subtract points — they disqualify outright. That asymmetry is
 * deliberate: a murder trial at a technology company legitimately contains
 * "company", "revenue" and "industry", so a subtractive score still lets it
 * through. The question "is this fundamentally a crime story?" is categorical,
 * not a matter of degree.
 *
 * Kept deliberately narrow. Over-broad vetoes silently delete real coverage,
 * and a false negative here is invisible — you never see what you filtered out.
 */
const VETO = [
  'murder', 'homicide', 'manslaughter', 'rape', 'sexual assault', 'paedophil',
  'pedophil', 'car crash', 'road accident', 'plane crash', 'shooting',
  'stabbing', 'burglary', 'arson', 'kidnap',
  'football', 'soccer', 'basketball', 'cricket match', 'tennis', 'olympics',
  'premier league', 'nfl ', 'nba ', 'world cup', 'formula 1', 'golf tournament',
  'celebrity', 'kardashian', 'red carpet', 'box office', 'reality tv',
  'horoscope', 'royal family', 'wedding', 'divorce settlement',
  'recipe', 'weight loss', 'skincare', 'dating app tips',
];

/**
 * Bare-token terms needing word-boundary matching rather than substring.
 * "ai" inside "said", "chain" or "Thailand" is the single most common way a
 * naive news filter fills up with nonsense.
 */
const AI_TOKENS = ['ai', 'a.i.', 'ml', 'agi', 'ai-driven', 'ai-powered'];

/** Escape a string for safe use inside a RegExp. */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Count how many terms from a list appear. Counts DISTINCT terms rather than
 * total occurrences — an article repeating "Nvidia" nine times is not nine
 * times more relevant, and rewarding repetition favours SEO spam.
 */
function countMatches(haystack, terms) {
  let hits = 0;
  const matched = [];
  for (const term of terms) {
    if (haystack.includes(term)) {
      hits += 1;
      matched.push(term);
    }
  }
  return { hits, matched };
}

/** Word-boundary matching for short tokens where substrings would misfire. */
function countTokenMatches(haystack, tokens) {
  let hits = 0;
  const matched = [];
  for (const token of tokens) {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(token)}([^a-z0-9]|$)`, 'i');
    if (pattern.test(haystack)) {
      hits += 1;
      matched.push(token);
    }
  }
  return { hits, matched };
}

/**
 * Score a document's AI-economics relevance from 0 to 100.
 *
 * The schema indexes `ai_relevance >= 40`, so 40 is the threshold that decides
 * whether a document is reachable by the dashboard's news queries at all.
 *
 * Scores are banded rather than finely graded, because keyword counting cannot
 * honestly distinguish a 61 from a 64. Pretending to that precision would
 * invite sorting by a number that does not mean what it appears to.
 *
 * @param {object} doc
 * @param {string} doc.title
 * @param {string} [doc.summary]
 * @param {string} [doc.url]
 * @param {boolean} [doc.sourceIsAiFocused] true when the FEED itself is already
 *   AI-specific (arXiv cs.AI, a Google News AI query). Such a source has done
 *   the topic filtering upstream, so an article need not restate it in its title.
 * @returns {{score: number, reasons: string[]}}
 */
export function scoreRelevance({ title, summary = '', url = '', sourceIsAiFocused = false }) {
  const haystack = `${title} ${summary} ${url}`.toLowerCase();
  const reasons = [];

  const vetoed = countMatches(haystack, VETO);
  if (vetoed.hits > 0) {
    return { score: 0, reasons: [`vetoed: ${vetoed.matched.slice(0, 3).join(', ')}`] };
  }

  const strong = countMatches(haystack, AI_STRONG);
  const tokens = countTokenMatches(haystack, AI_TOKENS);
  const tech = countMatches(haystack, TECH_SUPPORT);
  const econ = countMatches(haystack, ECONOMIC);

  /**
   * What counts as evidence this is an AI story.
   *
   * The last clause is load-bearing and was added because a test caught its
   * absence: "Nvidia and TSMC lift capital expenditure as data centre demand
   * surges" is a central AI-economics story that contains no AI term at all.
   * Requiring the word would have silently discarded exactly the coverage this
   * dashboard exists to track.
   *
   * TWO distinct tech entities are required rather than one, because a single
   * mention is too weak — "cloud computing" alone is as likely to be a storage
   * story. Two co-occurring (Nvidia + data centre, semiconductor + GPU) is a
   * pattern that ordinary business coverage does not produce by accident.
   */
  const hasAiSignal =
    strong.hits > 0 || tokens.hits > 0 || sourceIsAiFocused || tech.hits >= 2;

  // No AI signal means no score, regardless of how economic the article is.
  // Otherwise every interest-rate story in a business feed would rank highly.
  if (!hasAiSignal) {
    return { score: 0, reasons: ['no AI signal'] };
  }

  if (strong.hits > 0) reasons.push(`ai:${strong.matched.slice(0, 3).join('/')}`);
  else if (tokens.hits > 0) reasons.push(`ai-token:${tokens.matched.join('/')}`);
  if (sourceIsAiFocused) reasons.push('ai-focused source');
  if (tech.hits > 0) reasons.push(`tech:${tech.matched.slice(0, 3).join('/')}`);
  if (econ.hits > 0) reasons.push(`econ:${econ.matched.slice(0, 3).join('/')}`);

  // Banding. The economic signal is weighted most heavily because it is what
  // makes an article relevant to THIS dashboard rather than to AI news generally.
  let score;
  if (strong.hits > 0 && econ.hits >= 2) score = 95;
  else if (strong.hits > 0 && econ.hits === 1) score = 80;
  else if (sourceIsAiFocused && econ.hits >= 2) score = 75;
  else if (tech.hits >= 2 && econ.hits >= 2) score = 70;
  else if (strong.hits > 0 && tech.hits > 0) score = 55;
  else if (sourceIsAiFocused && econ.hits === 1) score = 50;
  else if (strong.hits > 0) score = 45;
  else if (tokens.hits > 0 && econ.hits >= 2) score = 45;
  else if (sourceIsAiFocused) score = 35;
  else score = 20;

  return { score, reasons };
}

/**
 * Normalise a headline for deduplication.
 *
 * Wire services syndicate one story to many outlets with cosmetic differences:
 * a masthead prefix, smart quotes, a trailing "- Reuters". Stripping
 * punctuation and collapsing whitespace catches most of it. Measured on live
 * GDELT output, 6 of 8 results for one query were the same wire story.
 */
export function normaliseTitle(title) {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[‘’“”]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const _internals = { AI_STRONG, TECH_SUPPORT, ECONOMIC, VETO, AI_TOKENS };

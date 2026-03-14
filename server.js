const express = require('express');
const cors = require('cors');
const RSSParser = require('rss-parser');
const cheerio = require('cheerio');
const path = require('path');
const https = require('https');
const http = require('http');

// ═══════════════════════════════════════════════════════════════════════════
const app = express();
const parser = new RSSParser({
  timeout: 12000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*'
  },
  customFields: { item: ['media:content', 'dc:creator'] }
});

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════════════════════════════════
// RSS FEED SOURCES
// ═══════════════════════════════════════════════════════════════════════════
const FEEDS = {
  finance: [
    { name: 'CNBC', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147', credibility: 8 },
    { name: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/topstories/', credibility: 7 },
    { name: 'Financial Times', url: 'https://www.ft.com/rss/home', credibility: 9 },
    { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex', credibility: 6 },
    { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss', credibility: 9 },
    { name: 'Investing.com', url: 'https://www.investing.com/rss/news.rss', credibility: 7 },
  ],
  trade: [
    { name: 'CNBC Economy', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258', credibility: 8 },
    { name: 'FT Trade', url: 'https://www.ft.com/trade?format=rss', credibility: 9 },
    { name: 'PIIE', url: 'https://www.piie.com/rss.xml', credibility: 8 },
    { name: 'WTO News', url: 'https://www.wto.org/english/news_e/news_e.rss', credibility: 9 },
    { name: 'UNCTAD', url: 'https://unctad.org/rss.xml', credibility: 8 },
    { name: 'MarketWatch Economy', url: 'https://feeds.marketwatch.com/marketwatch/marketpulse/', credibility: 7 },
  ],
  government: [
    { name: 'Federal Reserve', url: 'https://www.federalreserve.gov/feeds/press_all.xml', credibility: 10 },
    { name: 'Bank of England', url: 'https://www.bankofengland.co.uk/rss/news', credibility: 10 },
    { name: 'ECB', url: 'https://www.ecb.europa.eu/rss/press.html', credibility: 10 },
    { name: 'White House', url: 'https://www.whitehouse.gov/feed/', credibility: 9 },
    { name: 'UK Gov', url: 'https://www.gov.uk/government/all.atom', credibility: 9 },
    { name: 'EU Commission', url: 'https://ec.europa.eu/commission/presscorner/api/rss', credibility: 9 },
    { name: 'Bank of Japan', url: 'https://www.boj.or.jp/en/rss/whatsnew.xml', credibility: 10 },
    { name: 'RBA', url: 'https://www.rba.gov.au/rss/rss-cb-media-releases.xml', credibility: 10 },
    { name: 'US Treasury', url: 'https://home.treasury.gov/system/files/136/press-rss.xml', credibility: 10 },
    { name: 'Ground News', url: 'https://news.google.com/rss/search?q=site:ground.news+when:7d', credibility: 9 },
    { name: 'Straight Arrow News', url: 'https://news.google.com/rss/search?q=site:straightarrownews.com+when:7d', credibility: 8 },
  ],
  geopolitics: [
    { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', credibility: 9 },
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', credibility: 7 },
    { name: 'NPR World', url: 'https://feeds.npr.org/1004/rss.xml', credibility: 8 },
    { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss', credibility: 8 },
    { name: 'France24', url: 'https://www.france24.com/en/rss', credibility: 8 },
    { name: 'DW News', url: 'https://rss.dw.com/rdf/rss-en-all', credibility: 8 },
    { name: 'Ground News', url: 'https://news.google.com/rss/search?q=site:ground.news+when:7d', credibility: 9 },
    { name: 'Straight Arrow News', url: 'https://news.google.com/rss/search?q=site:straightarrownews.com+when:7d', credibility: 8 },
  ],
  conflicts: [
    { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', credibility: 9 },
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', credibility: 7 },
    { name: 'NPR World', url: 'https://feeds.npr.org/1004/rss.xml', credibility: 8 },
    { name: 'AP News', url: 'https://rsshub.app/apnews/topics/world-news', credibility: 9 },
    { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss', credibility: 8 },
    { name: 'France24', url: 'https://www.france24.com/en/rss', credibility: 8 },
  ],
  technology: [
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', credibility: 7 },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', credibility: 8 },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', credibility: 7 },
    { name: 'Wired', url: 'https://www.wired.com/feed/rss', credibility: 8 },
    { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/', credibility: 9 },
    { name: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', credibility: 9 },
  ],
  thinktanks: [
    { name: 'Brookings', url: 'https://www.brookings.edu/feed/', credibility: 9 },
    { name: 'CFR', url: 'https://www.cfr.org/rss.xml', credibility: 9 },
    { name: 'RAND', url: 'https://www.rand.org/content/rand/blog.rss.xml', credibility: 9 },
    { name: 'Carnegie', url: 'https://carnegieendowment.org/rss/solr/?t=article', credibility: 9 },
    { name: 'Chatham House', url: 'https://www.chathamhouse.org/rss.xml', credibility: 9 },
    { name: 'CSIS', url: 'https://www.csis.org/rss.xml', credibility: 9 },
    { name: 'Atlantic Council', url: 'https://www.atlanticcouncil.org/feed/', credibility: 8 },
    { name: 'PIIE', url: 'https://www.piie.com/rss.xml', credibility: 9 },
  ],
};

const REGIONAL_FEEDS = {
  'north-america': {
    name: 'North America', emoji: '\u{1F1FA}\u{1F1F8}',
    feeds: [
      { name: 'CNBC', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10001147', credibility: 8 },
      { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml', credibility: 8 },
      { name: 'CBC Canada', url: 'https://rss.cbc.ca/lineup/topstories.xml', credibility: 8 },
    ]
  },
  'europe': {
    name: 'Europe', emoji: '\u{1F1EA}\u{1F1FA}',
    feeds: [
      { name: 'BBC', url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml', credibility: 9 },
      { name: 'DW Europe', url: 'https://rss.dw.com/rdf/rss-en-eu', credibility: 8 },
      { name: 'The Guardian Europe', url: 'https://www.theguardian.com/world/europe-news/rss', credibility: 8 },
      { name: 'France24', url: 'https://www.france24.com/en/europe/rss', credibility: 8 },
    ]
  },
  'asia-pacific': {
    name: 'Asia Pacific', emoji: '\u{1F30F}',
    feeds: [
      { name: 'BBC Asia', url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml', credibility: 9 },
      { name: 'Nikkei Asia', url: 'https://asia.nikkei.com/rss', credibility: 8 },
      { name: 'South China Morning Post', url: 'https://www.scmp.com/rss/91/feed', credibility: 7 },
    ]
  },
  'middle-east': {
    name: 'Middle East & N. Africa', emoji: '\u{1F54C}',
    feeds: [
      { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', credibility: 7 },
      { name: 'BBC Middle East', url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', credibility: 9 },
      { name: 'France24 MidEast', url: 'https://www.france24.com/en/middle-east/rss', credibility: 8 },
    ]
  },
  'africa': {
    name: 'Sub-Saharan Africa', emoji: '\u{1F30D}',
    feeds: [
      { name: 'BBC Africa', url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', credibility: 9 },
      { name: 'DW Africa', url: 'https://rss.dw.com/rdf/rss-en-af', credibility: 8 },
      { name: 'The Guardian Africa', url: 'https://www.theguardian.com/world/africa/rss', credibility: 8 },
    ]
  },
  'latin-america': {
    name: 'Latin America', emoji: '\u{1F30E}',
    feeds: [
      { name: 'BBC Latin America', url: 'https://feeds.bbci.co.uk/news/world/latin_america/rss.xml', credibility: 9 },
      { name: 'France24 Americas', url: 'https://www.france24.com/en/americas/rss', credibility: 8 },
      { name: 'The Guardian Americas', url: 'https://www.theguardian.com/world/americas/rss', credibility: 8 },
    ]
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// MARKET DATA CONFIGURATION — expanded with sector ETFs
// ═══════════════════════════════════════════════════════════════════════════
const MARKET_SYMBOLS = {
  indices: [
    { symbol: '^GSPC', name: 'S&P 500', region: 'US' },
    { symbol: '^DJI', name: 'Dow Jones', region: 'US' },
    { symbol: '^IXIC', name: 'NASDAQ', region: 'US' },
    { symbol: '^FTSE', name: 'FTSE 100', region: 'UK' },
    { symbol: '^GDAXI', name: 'DAX', region: 'EU' },
    { symbol: '^N225', name: 'Nikkei 225', region: 'Asia' },
    { symbol: '^HSI', name: 'Hang Seng', region: 'Asia' },
    { symbol: '000001.SS', name: 'Shanghai', region: 'Asia' },
  ],
  sectors: [
    { symbol: 'XLF', name: 'Financials', sector: 'Financials' },
    { symbol: 'XLK', name: 'Technology', sector: 'Technology' },
    { symbol: 'XLE', name: 'Energy', sector: 'Energy' },
    { symbol: 'XLV', name: 'Healthcare', sector: 'Healthcare' },
    { symbol: 'XLI', name: 'Industrials', sector: 'Industrials' },
    { symbol: 'XLY', name: 'Consumer Disc.', sector: 'Consumer' },
    { symbol: 'XLP', name: 'Consumer Staples', sector: 'Staples' },
    { symbol: 'XLU', name: 'Utilities', sector: 'Utilities' },
    { symbol: 'XLRE', name: 'Real Estate', sector: 'Real Estate' },
    { symbol: 'XLB', name: 'Materials', sector: 'Materials' },
    { symbol: 'XLC', name: 'Comms Services', sector: 'Communications' },
  ],
  commodities: [
    { symbol: 'GC=F', name: 'Gold', unit: '$/oz' },
    { symbol: 'SI=F', name: 'Silver', unit: '$/oz' },
    { symbol: 'CL=F', name: 'Crude Oil', unit: '$/bbl' },
    { symbol: 'BZ=F', name: 'Brent Crude', unit: '$/bbl' },
    { symbol: 'NG=F', name: 'Natural Gas', unit: '$/MMBtu' },
    { symbol: 'HG=F', name: 'Copper', unit: '$/lb' },
    { symbol: 'ZW=F', name: 'Wheat', unit: 'c/bu' },
    { symbol: 'ZC=F', name: 'Corn', unit: 'c/bu' },
    { symbol: 'PL=F', name: 'Platinum', unit: '$/oz' },
  ],
  currencies: [
    { symbol: 'EURUSD=X', name: 'EUR/USD' },
    { symbol: 'GBPUSD=X', name: 'GBP/USD' },
    { symbol: 'USDJPY=X', name: 'USD/JPY' },
    { symbol: 'USDCNY=X', name: 'USD/CNY' },
    { symbol: 'AUDUSD=X', name: 'AUD/USD' },
    { symbol: 'USDCHF=X', name: 'USD/CHF' },
  ],
  crypto: [
    { symbol: 'BTC-USD', name: 'Bitcoin' },
    { symbol: 'ETH-USD', name: 'Ethereum' },
    { symbol: 'SOL-USD', name: 'Solana' },
    { symbol: 'XRP-USD', name: 'Ripple' }
  ]
};

// ═══════════════════════════════════════════════════════════════════════════
// IMPACT KEYWORDS & CONFLICT KEYWORDS
// ═══════════════════════════════════════════════════════════════════════════
const IMPACT_KEYWORDS = {
  critical: {
    weight: 3.0,
    words: [
      'recession','depression','collapse','crash','default','bailout',
      'hyperinflation','devaluation','bankruptcy','contagion','meltdown',
      'systemic risk','sovereign debt','currency crisis','bank run',
      'financial crisis','debt ceiling','stagflation','austerity',
      'war','invasion','nuclear','pandemic','emergency'
    ]
  },
  high: {
    weight: 2.0,
    words: [
      'gdp','inflation','interest rate','federal reserve','central bank',
      'tariff','sanctions','trade war','embargo','deficit','surplus',
      'unemployment','monetary policy','fiscal policy','quantitative easing',
      'rate hike','rate cut','bond yield','treasury','stimulus',
      'supply chain','oil price','opec','commodity','exchange rate',
      'imf','world bank','wto','trade agreement','ceasefire',
      'coup','assassination','election','referendum','conflict'
    ]
  },
  moderate: {
    weight: 1.0,
    words: [
      'market','stock','economy','economic','billion','trillion',
      'investor','growth','decline','regulation','deregulation',
      'tax','revenue','profit','loss','earnings','forecast',
      'outlook','volatility','risk','trade','export','import',
      'manufacturing','employment','wage','consumer','spending',
      'housing','energy','technology','infrastructure','budget',
      'debt','credit','banking','insurance','pension','investment',
      'geopolitical','nato','alliance','diplomacy','summit',
      'artificial intelligence','semiconductor','chip','cyber',
      'climate','renewable','carbon','transition'
    ]
  }
};

const CONFLICT_KEYWORDS = [
  'war','conflict','military','attack','strike','bomb','missile',
  'troops','soldiers','army','navy','airstrike','ceasefire',
  'invasion','occupation','siege','shelling','casualties',
  'killed','wounded','hostage','terrorist','militia','rebel',
  'insurgent','peacekeeping','sanctions','escalation','tension',
  'nuclear','weapon','defense','pentagon','nato','frontline',
  'drone','combat','offensive','retreat','surrender','coup'
];

// ═══════════════════════════════════════════════════════════════════════════
// ARTICLE CONTENT FETCHER — gets full text from free sources
// ═══════════════════════════════════════════════════════════════════════════
async function fetchPageContent(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return '';
    const data = await res.text();
    const $ = cheerio.load(data);
    $('script,style,nav,header,footer,aside,.ad,.ads,.sidebar,.comment,.related,.share,.social,figure,figcaption,iframe,noscript').remove();
    const selectors = [
      'article', '[role="main"]', '.article-body', '.story-body', '.post-content', 
      '.entry-content', '.article__body', '.article-text', '.caas-body', 
      '.meteredContent', '.grid-body', 'main'
    ];
    let firstPara = '';
    
    // First try standard layout wrappers
    for (const sel of selectors) {
      const el = $(sel);
      if (el.length > 0) {
        el.find('p').each((_, p) => {
          const pt = $(p).text().trim();
          if (!firstPara && pt.length > 100 && !pt.toLowerCase().includes('follow us') && !pt.toLowerCase().includes('subscribe')) {
            firstPara = pt;
          }
        });
        if (firstPara) break;
      }
    }
    
    // Fallback: any p tag on the page
    if (!firstPara) {
      $('p').each((_, p) => {
        const pt = $(p).text().trim();
        if (!firstPara && pt.length > 100 && !pt.toLowerCase().includes('follow us') && !pt.toLowerCase().includes('subscribe')) {
          firstPara = pt;
        }
      });
    }

    // Ultimate fallback to just the body text cut short
    if (!firstPara) {
      firstPara = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 400);
    }
    
    return firstPara.substring(0, 1500);
  } catch (e) {
    return '';
  }
}

async function fetchArticleContents(articles, limit = 5) {
  const results = new Map();
  for (let i = 0; i < articles.length; i += limit) {
    const batch = articles.slice(i, i + limit);
    const promises = batch.map(async (a) => {
      if (!a.link) return;
      const content = await fetchPageContent(a.link);
      if (content && content.length > 200) results.set(a.link, content);
    });
    await Promise.all(promises);
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// STRUCTURED SUMMARY GENERATOR — bullet-point format
// ═══════════════════════════════════════════════════════════════════════════
function generateStructuredSummary(title, rawContent, maxBullets = 5) {
  if (!rawContent || rawContent.trim().length < 50) {
    return { text: rawContent || title, bullets: [], hasFullContent: false };
  }
  const clean = rawContent.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  // Strict summarization: Return only the pristine first paragraph extracted.
  return { text: clean, bullets: [], hasFullContent: clean.length > 200 };
}

// ═══════════════════════════════════════════════════════════════════════════
// ECONOMIC IMPACT SCORER
// ═══════════════════════════════════════════════════════════════════════════
function calculateImpactScore(article) {
  const text = `${article.title} ${article.contentSnippet || article.content || article.summary || ''}`.toLowerCase();
  let score = 0;
  Object.entries(IMPACT_KEYWORDS).forEach(([level, category]) => {
    category.words.forEach(keyword => {
      if (text.includes(keyword)) score += category.weight;
    });
  });
  const credibility = article._credibility || 5;
  score += (credibility / 10) * 2;
  const pubDate = article.pubDate ? new Date(article.pubDate) : new Date();
  const hoursAgo = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
  if (hoursAgo < 3) score += 3;
  else if (hoursAgo < 6) score += 2;
  else if (hoursAgo < 24) score += 1;
  else if (hoursAgo < 48) score += 0.5;
  const titleLower = article.title.toLowerCase();
  Object.entries(IMPACT_KEYWORDS).forEach(([level, category]) => {
    category.words.forEach(keyword => {
      if (titleLower.includes(keyword)) score += category.weight * 0.5;
    });
  });
  return Math.min(10, Math.max(1, Math.round(score * 1.1)));
}

// ═══════════════════════════════════════════════════════════════════════════
// RSS FETCHER
// ═══════════════════════════════════════════════════════════════════════════
async function fetchFeed(source, category) {
  try {
    const feed = await parser.parseURL(source.url);
    return (feed.items || []).slice(0, 15).map(item => ({
      title: (item.title || 'Untitled').replace(/<[^>]+>/g, '').trim(),
      link: item.link || '',
      content: item.contentSnippet || item.content || item.summary || item.title || '',
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
      source: source.name,
      category: category,
      _credibility: source.credibility,
    }));
  } catch (err) {
    console.warn(`\u26a0 Failed: ${source.name} (${err.message.substring(0, 60)})`);
    return [];
  }
}

async function fetchAllFeeds(category = null) {
  const categories = category ? { [category]: FEEDS[category] } : FEEDS;
  const promises = [];
  for (const [cat, sources] of Object.entries(categories)) {
    if (!sources) continue;
    for (const source of sources) promises.push(fetchFeed(source, cat));
  }
  const results = await Promise.allSettled(promises);
  let articles = [];
  results.forEach(r => { if (r.status === 'fulfilled') articles.push(...r.value); });

  if (category === 'conflicts') {
    articles = articles.filter(a => {
      const text = `${a.title} ${a.content}`.toLowerCase();
      return CONFLICT_KEYWORDS.some(kw => text.includes(kw));
    });
  }

  // Deduplicate
  const seen = new Set();
  const unique = articles.filter(a => {
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Fetch full article content for all sources (top 40)
  const toFetch = unique.filter(a => a.link).slice(0, 40);
  const fullContentMap = await fetchArticleContents(toFetch);

  // Enrich with structured summaries
  const enriched = unique.map((article, index) => {
    const fullContent = fullContentMap.get(article.link) || article.content;
    const structured = generateStructuredSummary(article.title, fullContent);
    const impactScore = calculateImpactScore({ ...article, content: fullContent });
    return {
      id: `art_${Date.now()}_${index}_${Math.random().toString(36).substring(2,6)}`,
      title: article.title,
      link: article.link,
      summary: structured.text,
      bullets: structured.bullets,
      hasFullContent: structured.hasFullContent,
      content: article.content,
      impactScore,
      source: article.source,
      category: article.category,
      publishedAt: article.pubDate,
    };
  });

  // Tag conflict articles from geopolitics for the main feed badge counts
  if (!category) {
    enriched.forEach(a => {
      if (a.category === 'geopolitics') {
        const text = `${a.title} ${a.content}`.toLowerCase();
        if (CONFLICT_KEYWORDS.some(kw => text.includes(kw))) a._isConflict = true;
      }
    });
  }

  enriched.sort((a, b) => {
    if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore;
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });
  return enriched;
}

// ═══════════════════════════════════════════════════════════════════════════
// REGIONAL NEWS WITH CATEGORIZED OUTLOOK
// ═══════════════════════════════════════════════════════════════════════════
async function fetchRegionalData(regionId) {
  const region = REGIONAL_FEEDS[regionId];
  if (!region) return null;
  const promises = region.feeds.map(source => fetchFeed(source, regionId));
  const results = await Promise.allSettled(promises);
  const articles = [];
  results.forEach(r => { if (r.status === 'fulfilled') articles.push(...r.value); });

  const seen = new Set();
  const unique = articles.filter(a => {
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const enriched = unique.map((article, index) => ({
    id: `reg_${Date.now()}_${index}_${Math.random().toString(36).substring(2,6)}`,
    title: article.title, link: article.link,
    summary: article.content,
    impactScore: calculateImpactScore(article),
    source: article.source, publishedAt: article.pubDate,
  }));
  enriched.sort((a, b) => b.impactScore - a.impactScore);

  const outlook = generateCategorizedOutlook(region.name, enriched);
  return {
    id: regionId, name: region.name, emoji: region.emoji,
    articleCount: enriched.length,
    articles: enriched.slice(0, 20),
    outlook,
  };
}

function generateCategorizedOutlook(regionName, articles) {
  if (articles.length === 0) return { categories: [], riskLevel: 'Unknown', avgImpact: '0' };

  const avgImpact = articles.reduce((s, a) => s + a.impactScore, 0) / articles.length;
  let riskLevel = 'Stable';
  if (avgImpact >= 7) riskLevel = 'Elevated Risk';
  else if (avgImpact >= 5) riskLevel = 'Moderate Uncertainty';

  // Categorize articles
  const buckets = {
    'CONFLICTS & SECURITY': { icon: '\u{1F534}', keywords: CONFLICT_KEYWORDS, articles: [] },
    'ECONOMY & TRADE': { icon: '\u{1F4CA}', keywords: ['economy','trade','gdp','inflation','tariff','market','bank','growth','recession','employment','unemployment','interest rate','fiscal','monetary','tax','budget','deficit','surplus','export','import','investment'], articles: [] },
    'POLITICS & GOVERNANCE': { icon: '\u{1F3DB}', keywords: ['election','government','parliament','president','minister','policy','law','vote','political','party','legislation','reform','opposition','coalition','supreme court','congress','senate'], articles: [] },
    'ENERGY & CLIMATE': { icon: '\u26A1', keywords: ['oil','gas','energy','climate','carbon','renewable','solar','wind','nuclear energy','pipeline','opec','emissions','drought','flood','hurricane','typhoon','earthquake'], articles: [] },
    'TECHNOLOGY & INNOVATION': { icon: '\u{1F4BB}', keywords: ['technology','tech','ai','artificial intelligence','cyber','digital','semiconductor','chip','startup','innovation','data','software','internet'], articles: [] },
  };

  articles.forEach(a => {
    const text = `${a.title} ${a.summary || ''}`.toLowerCase();
    let matched = false;
    for (const [catName, cat] of Object.entries(buckets)) {
      if (cat.keywords.some(kw => text.includes(kw))) {
        cat.articles.push(a);
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Put in economy as default
      buckets['ECONOMY & TRADE'].articles.push(a);
    }
  });

  const categories = [];
  for (const [name, cat] of Object.entries(buckets)) {
    if (cat.articles.length === 0) continue;
    const bullets = cat.articles.slice(0, 4).map(a => a.title);
    categories.push({ name, icon: cat.icon, bulletCount: cat.articles.length, bullets });
  }

  return { categories, riskLevel, avgImpact: avgImpact.toFixed(1), articleCount: articles.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKET DATA FETCHER (Yahoo Finance)
// ═══════════════════════════════════════════════════════════════════════════
function fetchYahooQuote(symbol) {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const timeout = setTimeout(() => resolve(null), 8000);
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const json = JSON.parse(data);
          const result = json.chart?.result?.[0];
          if (!result) return resolve(null);
          const meta = result.meta;
          const price = meta.regularMarketPrice;
          const prevClose = meta.chartPreviousClose || meta.previousClose;
          const change = price - prevClose;
          const changePercent = prevClose ? ((change / prevClose) * 100) : 0;
          resolve({ price, change: change.toFixed(2), changePercent: changePercent.toFixed(2), currency: meta.currency || 'USD' });
        } catch (e) { resolve(null); }
      });
    }).on('error', () => { clearTimeout(timeout); resolve(null); });
  });
}

async function fetchAllMarketData() {
  const results = { indices: [], sectors: [], commodities: [], currencies: [], crypto: [] };
  for (const [groupKey, symbols] of Object.entries(MARKET_SYMBOLS)) {
    const promises = symbols.map(async (item) => {
      const quote = await fetchYahooQuote(item.symbol);
      return {
        symbol: item.symbol, name: item.name,
        region: item.region || null, unit: item.unit || null, sector: item.sector || null,
        price: quote ? quote.price : null,
        change: quote ? quote.change : null,
        changePercent: quote ? quote.changePercent : null,
        currency: quote ? quote.currency : 'USD',
        available: !!quote,
      };
    });
    results[groupKey] = await Promise.all(promises);
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// AI INTEL REPORT GENERATOR — comprehensive daily/weekly briefing
// ═══════════════════════════════════════════════════════════════════════════
async function generateIntelReport() {
  const allNews = await fetchAllFeeds();
  const now = new Date();

  const byCategory = {};
  allNews.forEach(a => {
    if (!byCategory[a.category]) byCategory[a.category] = [];
    byCategory[a.category].push(a);
  });

  const sections = {};
  for (const [cat, articles] of Object.entries(byCategory)) {
    const topArticles = articles.slice(0, 10);
    const avgImpact = articles.reduce((s, a) => s + a.impactScore, 0) / Math.max(articles.length, 1);
    const criticalCount = articles.filter(a => a.impactScore >= 8).length;
    const themes = extractThemes(articles);

    // Build multi-paragraph briefing
    let briefing = '';
    const label = { finance:'Financial Markets', trade:'Global Trade', government:'Government & Central Banks', geopolitics:'Geopolitics', conflicts:'Active Conflicts', technology:'Technology', thinktanks:'Think Tank Analysis' }[cat] || cat;

    briefing += `${label} — ${articles.length} articles tracked across ${new Set(articles.map(a => a.source)).size} sources. `;
    if (criticalCount > 0) briefing += `${criticalCount} critical-impact developments detected. `;
    if (themes.length > 0) briefing += `Dominant themes: ${themes.join(', ')}.\n\n`;

    // Key developments with bullets
    briefing += 'KEY DEVELOPMENTS:\n';
    topArticles.slice(0, 5).forEach((a, i) => {
      briefing += `\u2022 ${a.title} (Impact: ${a.impactScore}/10, ${a.source})\n`;
      if (a.bullets && a.bullets.length > 0) {
        briefing += `  ${a.bullets[0]}\n`;
      }
    });

    if (themes.length > 0) {
      briefing += `\nTRENDS: ${themes.map(t => `\u2022 ${t}`).join(' ')}\n`;
    }

    sections[cat] = {
      articleCount: articles.length,
      avgImpact: avgImpact.toFixed(1),
      criticalCount,
      highCount: articles.filter(a => a.impactScore >= 6).length,
      themes,
      briefing,
    };
  }

  const totalArticles = allNews.length;
  const globalAvgImpact = allNews.reduce((s, a) => s + a.impactScore, 0) / Math.max(totalArticles, 1);
  const criticalGlobal = allNews.filter(a => a.impactScore >= 8).length;

  let globalStatus = 'STABLE', statusColor = 'green';
  if (globalAvgImpact >= 7) { globalStatus = 'HIGH ALERT'; statusColor = 'red'; }
  else if (globalAvgImpact >= 5) { globalStatus = 'ELEVATED'; statusColor = 'amber'; }

  const executiveSummary = generateDetailedExecSummary(allNews, sections, byCategory);

  return {
    generatedAt: now.toISOString(),
    period: 'Daily Intelligence Briefing',
    date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    globalStatus, statusColor,
    stats: {
      totalArticles,
      avgImpact: globalAvgImpact.toFixed(1),
      criticalAlerts: criticalGlobal,
      sourcesMonitored: Object.values(FEEDS).flat().length,
    },
    executiveSummary,
    sections,
  };
}

function extractThemes(articles) {
  const themeFreq = {};
  const allText = articles.map(a => `${a.title} ${a.summary || ''}`).join(' ').toLowerCase();
  const keywords = [
    'inflation','recession','tariff','sanctions','war','trade',
    'oil','energy','climate','election','interest rate','gdp',
    'unemployment','technology','ai','crypto','regulation',
    'debt','stimulus','reform','conflict','peace','alliance',
    'supply chain','semiconductor','housing','migration'
  ];
  keywords.forEach(kw => {
    const count = (allText.match(new RegExp(kw, 'g')) || []).length;
    if (count >= 2) themeFreq[kw] = count;
  });
  return Object.entries(themeFreq).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t.charAt(0).toUpperCase() + t.slice(1));
}

function generateDetailedExecSummary(allNews, sections, byCategory) {
  const topStories = allNews.slice(0, 8);
  let summary = 'EXECUTIVE SUMMARY\n\n';
  summary += `This briefing covers ${allNews.length} articles from ${Object.values(FEEDS).flat().length}+ sources across ${Object.keys(sections).length} intelligence domains.\n\n`;

  summary += 'TOP PRIORITY DEVELOPMENTS:\n';
  topStories.forEach((a, i) => {
    summary += `${i + 1}. [${a.category.toUpperCase()}] ${a.title}\n`;
    summary += `   Impact: ${a.impactScore}/10 | Source: ${a.source}\n`;
    if (a.bullets && a.bullets.length > 0) {
      summary += `   \u2022 ${a.bullets[0]}\n`;
    }
    summary += '\n';
  });

  summary += 'SECTOR OVERVIEW:\n';
  for (const [cat, data] of Object.entries(sections)) {
    summary += `\u2022 ${cat.toUpperCase()}: ${data.articleCount} articles | Avg impact ${data.avgImpact}/10 | ${data.criticalCount} critical alerts`;
    if (data.themes.length > 0) summary += ` | Key: ${data.themes.slice(0, 3).join(', ')}`;
    summary += '\n';
  }

  summary += '\nRISK ASSESSMENT:\n';
  const criticalArticles = allNews.filter(a => a.impactScore >= 8);
  if (criticalArticles.length > 10) {
    summary += '\u2022 HIGH: Elevated number of critical-impact events across multiple sectors\n';
  } else if (criticalArticles.length > 5) {
    summary += '\u2022 MODERATE: Several high-impact developments require monitoring\n';
  } else {
    summary += '\u2022 LOW: Normal activity levels across monitored sectors\n';
  }

  return summary;
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHING — 1 minute TTL
// ═══════════════════════════════════════════════════════════════════════════
const cacheStore = {};
const CACHE_TTL = 60 * 1000;
async function getCached(key, fetchFn) {
  const cached = cacheStore[key];
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) return cached.data;
  const data = await fetchFn();
  cacheStore[key] = { data, timestamp: Date.now() };
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/news', async (req, res) => {
  try {
    const articles = await getCached('news_all', () => fetchAllFeeds());
    res.json({ count: articles.length, lastUpdated: new Date().toISOString(), articles });
  } catch (err) {
    console.error('Error fetching news:', err);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

app.get('/api/news/:category', async (req, res) => {
  const category = req.params.category.toLowerCase();
  if (!FEEDS[category]) {
    return res.status(400).json({ error: `Invalid category. Use: ${Object.keys(FEEDS).join(', ')}` });
  }
  try {
    const articles = await getCached(`news_${category}`, () => fetchAllFeeds(category));
    res.json({ count: articles.length, category, lastUpdated: new Date().toISOString(), articles });
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch ${category} news` });
  }
});

app.get('/api/markets', async (req, res) => {
  try {
    const data = await getCached('markets', fetchAllMarketData);
    res.json({ lastUpdated: new Date().toISOString(), ...data });
  } catch (err) {
    console.error('Error fetching markets:', err);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

app.get('/api/regions', async (req, res) => {
  try {
    const regionIds = Object.keys(REGIONAL_FEEDS);
    const data = await getCached('regions', async () => {
      const results = await Promise.allSettled(regionIds.map(id => fetchRegionalData(id)));
      return results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
    });
    res.json({ lastUpdated: new Date().toISOString(), regions: data });
  } catch (err) {
    console.error('Error fetching regions:', err);
    res.status(500).json({ error: 'Failed to fetch regional data' });
  }
});

app.get('/api/intel-report', async (req, res) => {
  try {
    const report = await getCached('intel_report', generateIntelReport);
    res.json(report);
  } catch (err) {
    console.error('Error generating intel report:', err);
    res.status(500).json({ error: 'Failed to generate intel report' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  \u26a1 EconIntel v2.1 running at http://localhost:${PORT}`);
  console.log(`  \u{1F4CA} Sections: ${Object.keys(FEEDS).join(', ')}`);
  console.log(`  \u{1F30D} Regions: ${Object.keys(REGIONAL_FEEDS).join(', ')}`);
  console.log(`  \u{1F4C8} Market symbols: ${Object.values(MARKET_SYMBOLS).flat().length}`);
  console.log(`  \u{1F504} Cache TTL: ${CACHE_TTL / 1000}s\n`);
});

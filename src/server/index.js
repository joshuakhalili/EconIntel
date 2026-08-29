/**
 * HTTP server — the boundary between the database and the browser.
 *
 * ONE RULE GOVERNS THIS FILE: the browser never talks to a data provider.
 * Every API key lives in this process and goes no further. Anything the browser
 * receives, a reader can see by pressing F12, so a key that reaches the client
 * is a published key. The browser asks this server; this server reads Postgres,
 * which ingestion filled earlier. No upstream call happens during a page load.
 *
 * That also makes the dashboard fast and resilient: FRED being down slows
 * tonight's ingest, not the site.
 */

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { config, describeIntegrations } from './config.js';
import { query, closePool, pool } from './db/pool.js';
import { securityHeaders } from './lib/security.js';
import { recentDocuments, documentsInWindow, documentsForLens } from './repositories/documents.js';
import { listQuestions, getQuestion, orphanedIndicators } from './repositories/questions.js';
import { listLenses, getLens, getLensTickers, overview } from './repositories/lenses.js';
import { globe } from './repositories/globe.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '../../public');

const app = express();

/**
 * CORS is open on purpose, and it is safe to be open only because of what this
 * API is: read-only public data, no authentication, no cookies, no session.
 * There is nothing a cross-origin caller can do that curl cannot, and letting
 * researchers query it from their own pages is a stated goal of the project.
 *
 * That stops being true the moment any endpoint accepts a credential. If auth
 * is ever added, this must become an allowlist and `credentials` must stay off
 * — an open CORS policy plus cookie auth is how a read API becomes a CSRF hole.
 */
app.use(cors({ credentials: false }));

app.use(securityHeaders({ publicDir, isProduction: config.env === 'production' }));
app.disable('x-powered-by');

/**
 * Wrap an async route so a rejected promise becomes a normal Express error
 * instead of an unhandled rejection that kills the process. Without this, one
 * bad query takes the whole dashboard down rather than returning a 500.
 */
const route = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render polls this to decide whether a deploy succeeded. It must actually
 * touch the database: a process that has booted but cannot reach Postgres is
 * not healthy, and reporting it as healthy means a broken deploy goes live.
 */
app.get('/healthz', route(async (_req, res) => {
  const started = performance.now();
  await query('SELECT 1');
  res.json({
    ok: true,
    database: 'connected',
    latencyMs: Math.round(performance.now() - started),
    env: config.env,
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every active indicator, with how much data it actually holds.
 *
 * `default_country_iso3` is selected here and was not before. The client reads
 * it to decide which country to request for a multi-country series; without it
 * the value was always undefined, every country cell rendered wrong, and
 * single-country sparklines were fetched unfiltered — drawing fifty countries
 * interleaved as one line, which looks like a noisy series rather than a bug.
 *
 * `quantity_kind` and `index_base_period` are included because they decide
 * chart form and whether two series may share an axis. Both existed in the
 * schema and neither reached the client.
 */
app.get('/api/indicators', route(async (req, res) => {
  const { q = null, pillar = null } = req.query;
  const hasData = req.query.hasData === 'true';

  const { rows } = await query(
    `SELECT i.id, i.name, i.description, i.pillar, i.unit, i.unit_symbol,
            i.decimals, i.cadence, i.quantity_kind, i.confidence_tier,
            i.source_id, i.source_url, i.higher_is_better,
            i.has_country_dim, i.has_industry_dim, i.default_country_iso3,
            i.index_base_period::text, i.last_ingested_at,
            count(o.*)::int              AS observation_count,
            max(o.period_start)::text    AS latest_period,
            min(o.period_start)::text    AS earliest_period
       FROM indicators i
       LEFT JOIN observations o ON o.indicator_id = i.id
      WHERE i.is_active
        AND ($1::text IS NULL OR i.pillar = $1::pillar)
        AND ($2::text IS NULL OR i.name ILIKE '%' || $2 || '%'
                              OR i.id   ILIKE '%' || $2 || '%')
      GROUP BY i.id
     HAVING (NOT $3::boolean OR count(o.*) > 0)
      ORDER BY i.pillar, count(o.*) DESC, i.id`,
    [pillar, q, hasData]
  );
  res.json({ indicators: rows });
}));

// ─────────────────────────────────────────────────────────────────────────────
// Questions — the editorial layer
// ─────────────────────────────────────────────────────────────────────────────

// ── Lenses: the top level of navigation ──────────────────────────────────────

/**
 * Every country, its position, its adoption history and how much is stored
 * about it. Backs the globe on the landing page.
 */
app.get('/api/globe', route(async (_req, res) => {
  res.json(await globe());
}));

app.get('/api/lenses', route(async (_req, res) => {
  res.json({ lenses: await listLenses() });
}));

/**
 * The front page. Every lens with its thesis and one live number, in one
 * request — see the note on `overview()` for why this is not five ticker calls.
 */
app.get('/api/overview', route(async (_req, res) => {
  res.json({ lenses: await overview() });
}));

app.get('/api/lenses/:slug', route(async (req, res) => {
  const lens = await getLens(req.params.slug);
  if (!lens) return res.status(404).json({ error: `No lens "${req.params.slug}"` });
  res.json(lens);
}));

/**
 * The ticker strip. Two observations per indicator, not the whole series —
 * a strip needs a value and a direction, and fetching decades of history for
 * seven tickers would cost more than the rest of the page.
 */
app.get('/api/lenses/:slug/tickers', route(async (req, res) => {
  res.json({ tickers: await getLensTickers(req.params.slug) });
}));

/**
 * Coverage for a lens, matched by the lens's own stored search rather than by
 * classifying each article. See `lenses.news_query` for why.
 */
app.get('/api/lenses/:slug/news', route(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 24, 100);
  res.json({ documents: await documentsForLens(req.params.slug, { limit }) });
}));

app.get('/api/questions', route(async (_req, res) => {
  res.json({ questions: await listQuestions() });
}));

app.get('/api/questions/:slug', route(async (req, res) => {
  const question = await getQuestion(req.params.slug);
  if (!question) return res.status(404).json({ error: `No question "${req.params.slug}"` });
  res.json(question);
}));

/**
 * Indicators grouped by pillar, for the dashboard's top-level layout.
 * Empty indicators are included deliberately — a pillar that is empty should
 * look empty rather than look absent.
 */
app.get('/api/pillars', route(async (_req, res) => {
  const { rows } = await query(
    `SELECT i.pillar,
            count(*)::int                                        AS indicator_count,
            count(*) FILTER (WHERE o.n > 0)::int                  AS populated_count,
            COALESCE(sum(o.n), 0)::int                            AS observation_count
       FROM indicators i
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS n FROM observations WHERE indicator_id = i.id
       ) o ON true
      WHERE i.is_active
      GROUP BY i.pillar
      ORDER BY i.pillar`
  );
  res.json({ pillars: rows });
}));

// ─────────────────────────────────────────────────────────────────────────────
// Observations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The time series for one indicator.
 *
 * `country` defaults to nothing rather than to USA: for a country-dimensioned
 * indicator the caller must say which country it wants, or it would silently
 * receive fifty countries interleaved and plot nonsense.
 */
app.get('/api/indicators/:id/observations', route(async (req, res) => {
  const { id } = req.params;
  const { country = null, industry = null, from = null, to = null } = req.query;
  const limit = Math.min(Number(req.query.limit) || 5000, 20_000);

  const { rows: meta } = await query(
    'SELECT id, name, unit, unit_symbol, decimals, pillar, cadence, source_url, confidence_tier FROM indicators WHERE id = $1',
    [id]
  );
  if (meta.length === 0) {
    return res.status(404).json({ error: `No indicator "${id}"` });
  }

  const { rows } = await query(
    `SELECT period_start::text, period_end::text, value, value_status,
            country_iso3, industry_code
       FROM observations
      WHERE indicator_id = $1
        AND ($2::char(3) IS NULL OR country_iso3  = $2)
        AND ($3::text    IS NULL OR industry_code = $3)
        AND ($4::date    IS NULL OR period_start >= $4)
        AND ($5::date    IS NULL OR period_start <= $5)
      ORDER BY period_start
      LIMIT $6`,
    [id, country, industry, from, to, limit]
  );

  res.json({ indicator: meta[0], observations: rows });
}));

/**
 * Several series in one request, optionally rebased to a common index.
 *
 * A question page draws up to eighteen charts; fetching each series separately
 * meant a request per chart. More importantly, this is where REBASING lives.
 *
 * The project bans dual-axis charts — a second y-scale lets any two lines be
 * made to cross wherever the author chooses, which is the most effective way to
 * imply a relationship that is not in the data. So series measured on different
 * scales are indexed to 100 at their first shared period instead, which
 * compares SHAPE honestly and states in the axis label that it is doing so.
 *
 * Rebasing happens here rather than in the browser so that every consumer —
 * page, explorer, future export — indexes identically.
 *
 * Query: ?ids=a,b,c&countries=USA,,GBR&index=true
 * `countries` is positional and may contain blanks, so a mixed request of
 * country-specific and global series stays aligned with `ids`.
 */
app.get('/api/series', route(async (req, res) => {
  const ids = String(req.query.ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return res.status(400).json({ error: 'ids required' });
  // Cap the fan-out: a request for 200 series is a mistake or an attack, and
  // either way it should fail clearly rather than exhaust the pool.
  if (ids.length > 12) return res.status(400).json({ error: 'at most 12 series per request' });

  const countries = String(req.query.countries ?? '').split(',').map((s) => s.trim());
  const rebase = req.query.index === 'true';

  const series = await Promise.all(ids.map(async (id, i) => {
    const country = countries[i] || null;

    const { rows: meta } = await query(
      `SELECT id, name, unit, unit_symbol, decimals, cadence, quantity_kind,
              source_url, confidence_tier, default_country_iso3
         FROM indicators WHERE id = $1 AND is_active`,
      [id]
    );
    if (meta.length === 0) return { id, error: 'not found', points: [] };

    const { rows } = await query(
      `SELECT period_start::text AS date, value
         FROM observations
        WHERE indicator_id = $1
          AND ($2::char(3) IS NULL OR country_iso3 = $2)
        ORDER BY period_start`,
      [id, country ?? meta[0].default_country_iso3 ?? null]
    );

    return { id, meta: meta[0], country, points: rows };
  }));

  if (!rebase) return res.json({ series, indexed: false });

  /**
   * Index every series to 100 at the first period they ALL cover.
   *
   * Using each series' own first observation instead would silently compare
   * different starting points and make whichever series began earliest look
   * like the strongest performer.
   */
  const dateSets = series
    .filter((s) => s.points.some((p) => p.value != null))
    .map((s) => new Set(s.points.filter((p) => p.value != null).map((p) => p.date)));

  const shared = dateSets.length
    ? [...dateSets[0]].filter((d) => dateSets.every((set) => set.has(d))).sort()
    : [];

  // No overlap means indexing would be arbitrary. Say so rather than picking a
  // base that makes the comparison meaningless without admitting it.
  if (shared.length === 0) {
    return res.json({ series, indexed: false, indexNote: 'no shared period — series shown unindexed' });
  }

  const base = shared[0];
  const indexedSeries = series.map((s) => {
    const anchor = s.points.find((p) => p.date === base && p.value != null);
    if (!anchor || anchor.value === 0) return { ...s, indexed: false };
    return {
      ...s,
      indexed: true,
      points: s.points.map((p) => ({
        date: p.date,
        value: p.value == null ? null : (p.value / anchor.value) * 100,
      })),
    };
  });

  res.json({ series: indexedSeries, indexed: true, indexBase: base });
}));

/**
 * What was happening around a given period.
 *
 * The layer that turns a line into an explanation: click a point, see the news
 * and regulation from that month. Reads `documents` (165 rows, indexed on
 * published_at) and `events` (currently empty, awaiting extraction) so the
 * shape is right before the data arrives.
 */
app.get('/api/context', route(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const minRelevance = Number(req.query.minRelevance ?? 40);

  const [documents, events] = await Promise.all([
    documentsInWindow({ from, to, limit, minRelevance }),
    query(
      `SELECT e.id, e.kind, e.status, e.headline, e.amount_usd, e.capacity_mw,
              e.announced_date::text, e.location_iso3,
              f.name AS from_name, t.name AS to_name,
              (SELECT count(*)::int FROM event_sources es WHERE es.event_id = e.id) AS source_count
         FROM events e
         JOIN entities f ON f.id = e.from_entity_id
         LEFT JOIN entities t ON t.id = e.to_entity_id
        WHERE e.announced_date BETWEEN $1::date AND $2::date
          AND e.status <> 'cancelled'
        ORDER BY e.amount_usd DESC NULLS LAST, e.announced_date DESC
        LIMIT $3`,
      [from, to, limit]
    ).then((r) => r.rows),
  ]);

  res.json({ from, to, documents, events });
}));

/** Which countries an indicator actually holds data for — populates dropdowns. */
/**
 * One indicator with its provenance.
 *
 * The catalogue endpoint deliberately does not carry licence and attribution —
 * it returns 110 rows and that text would be repeated on most of them. A
 * detail page is the one place a reader is asking where a number came from and
 * on what terms it may be reused, so the source join lives here.
 *
 * `question_slug` is included because an indicator reached from the data
 * browser is context-free: knowing which page argues with it is most of what
 * makes a bare series legible.
 */
app.get('/api/indicators/:id', route(async (req, res) => {
  const { rows } = await query(
    `SELECT i.id, i.name, i.description, i.pillar, i.unit, i.unit_symbol,
            i.decimals, i.cadence, i.quantity_kind, i.confidence_tier,
            i.higher_is_better, i.has_country_dim, i.default_country_iso3,
            i.index_base_period::text, i.last_ingested_at, i.source_url,
            s.id   AS source_id,
            s.name AS source_name,
            s.homepage_url AS source_homepage,
            s.licence      AS source_licence,
            s.attribution_text,
            o.n AS observation_count,
            o.first_period, o.last_period,
            q.slug AS question_slug, q.question,
            qi.caption_plain, qi.caption_expert
       FROM indicators i
       LEFT JOIN sources s ON s.id = i.source_id
       LEFT JOIN LATERAL (
         SELECT count(*)::int           AS n,
                min(period_start)::text AS first_period,
                max(period_start)::text AS last_period
           FROM observations WHERE indicator_id = i.id
       ) o ON true
       LEFT JOIN question_indicators qi ON qi.indicator_id = i.id
       LEFT JOIN questions q ON q.id = qi.question_id AND q.is_active
      WHERE i.id = $1`,
    [req.params.id]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: `No indicator "${req.params.id}"` });
  }
  res.json({ indicator: rows[0] });
}));

app.get('/api/indicators/:id/countries', route(async (req, res) => {
  const { rows } = await query(
    `SELECT o.country_iso3, c.name, count(*)::int AS n
       FROM observations o
       JOIN countries c ON c.iso3 = o.country_iso3
      WHERE o.indicator_id = $1 AND o.country_iso3 IS NOT NULL
      GROUP BY o.country_iso3, c.name
      ORDER BY c.name`,
    [req.params.id]
  );
  res.json({ countries: rows });
}));

// ─────────────────────────────────────────────────────────────────────────────
// News
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/documents', route(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 40, 200);
  const minRelevance = Number(req.query.minRelevance ?? 40);
  const documents = await recentDocuments({ limit, minRelevance });
  res.json({ documents });
}));

// ─────────────────────────────────────────────────────────────────────────────
// Operational status — deliberately public
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What ran, what failed, and what is stale.
 *
 * Public rather than admin-only on purpose: a dashboard that shows its own
 * data pipeline is more trustworthy than one that hides it, and silent
 * staleness is the normal way a project like this rots.
 */
app.get('/api/status', route(async (_req, res) => {
  const [counts, runs, stale] = await Promise.all([
    query(`SELECT
             (SELECT count(*)::int FROM observations) AS observations,
             (SELECT count(*)::int FROM documents)    AS documents,
             (SELECT count(*)::int FROM indicators WHERE is_active) AS indicators,
             (SELECT count(*)::int FROM countries)   AS countries`),
    query(`SELECT job_name, source_id, status, started_at, finished_at,
                  rows_written, error_message
             FROM ingestion_runs
            ORDER BY started_at DESC
            LIMIT 15`),
    query(`SELECT id, name, last_ingested_at
             FROM indicators
            WHERE is_active AND source_series_code IS NOT NULL
              AND (last_ingested_at IS NULL
                   OR last_ingested_at < now() - INTERVAL '7 days')
            ORDER BY last_ingested_at NULLS FIRST
            LIMIT 20`),
  ]);

  res.json({
    counts: counts.rows[0],
    recentRuns: runs.rows,
    staleIndicators: stale.rows,
    integrations: describeIntegrations(),
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// Static files and errors
// ─────────────────────────────────────────────────────────────────────────────

app.use(express.static(publicDir, { maxAge: config.env === 'production' ? '1h' : 0 }));

app.use('/api', (_req, res) => res.status(404).json({ error: 'No such endpoint' }));

/**
 * SPA fallback. The front end routes on real paths (/lens/money, /q/:slug), so
 * a reader who opens one directly or refreshes on it asks this server for a file
 * that does not exist. Hand back the app shell and let the client router read
 * the URL. Registered after /api so a mistyped endpoint still gets JSON 404
 * rather than a page, and it never answers a request that expects data.
 */
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/healthz') return next();
  res.sendFile(path.join(publicDir, 'index.html'), (error) => {
    // Before the first `npm run build` there is no index.html to serve.
    if (error) next(error);
  });
});

/**
 * Error handler. Returns the message in development and hides it in production:
 * a database error message can disclose schema details, and this dashboard is
 * public. The full error is always logged server-side either way.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
app.use((error, _req, res, _next) => {
  console.error('[http]', error);
  res.status(500).json({
    error: config.env === 'production' ? 'Internal error' : error.message,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

const server = app.listen(config.port, () => {
  console.log(`\n  Diffusion listening on http://localhost:${config.port}`);
  console.log(`  health: http://localhost:${config.port}/healthz\n`);

  const ready = describeIntegrations().filter((i) => i.ready).length;
  console.log(`  ${ready}/${describeIntegrations().length} integrations configured\n`);
});

/**
 * Close the pool before exiting so in-flight queries finish and Postgres is not
 * left holding connections. Render sends SIGTERM on every redeploy, so without
 * this each deploy leaks connections until the database refuses new ones.
 */
async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
  // Do not wait forever for a wedged connection to drain.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, server };

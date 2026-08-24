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
import { recentDocuments } from './repositories/documents.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '../../public');

const app = express();

app.use(cors());
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

/** Every active indicator, with how much data it actually holds. */
app.get('/api/indicators', route(async (_req, res) => {
  const { rows } = await query(
    `SELECT i.id, i.name, i.description, i.pillar, i.unit, i.unit_symbol,
            i.decimals, i.cadence, i.confidence_tier, i.source_id, i.source_url,
            i.higher_is_better, i.has_country_dim, i.has_industry_dim,
            i.last_ingested_at,
            count(o.*)::int              AS observation_count,
            max(o.period_start)::text    AS latest_period,
            min(o.period_start)::text    AS earliest_period
       FROM indicators i
       LEFT JOIN observations o ON o.indicator_id = i.id
      WHERE i.is_active
      GROUP BY i.id
      ORDER BY i.pillar, count(o.*) DESC, i.id`
  );
  res.json({ indicators: rows });
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

/** Which countries an indicator actually holds data for — populates dropdowns. */
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
  console.log(`\n  EconIntel listening on http://localhost:${config.port}`);
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

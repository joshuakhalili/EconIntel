/**
 * The Express application — the boundary between the database and the browser.
 *
 * ONE RULE GOVERNS THIS FILE: the browser never talks to a data provider.
 * Every API key lives in this process and goes no further. Anything the browser
 * receives, a reader can see by pressing F12, so a key that reaches the client
 * is a published key. The browser asks this server; this server reads Postgres,
 * which ingestion filled earlier. No upstream call happens during a page load.
 *
 * That also makes the dashboard fast and resilient: FRED being down slows
 * tonight's ingest, not the site.
 *
 * WHY THIS FILE DOES NOT LISTEN
 *
 * It used to. `app.listen` sat at the bottom and `index.js` was this file, so
 * importing it for any reason — a test, a script, a serverless handler — opened
 * a port as a side effect. On Vercel that is fatal rather than untidy: the
 * platform imports the module and calls the exported handler itself, and a
 * module that binds a port during import either crashes or leaks one per cold
 * start.
 *
 * So the listener lives in `index.js` (~40 lines, the only thing `npm start`
 * runs) and `api/index.js` re-exports this app for Vercel. Both get the same
 * routes in the same order, which is the point — see the note on route order
 * under the auth gate.
 */

import express from 'express';
import compression from 'compression';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { config, describeIntegrations } from './config.js';
import { query } from './db/pool.js';
import { securityHeaders } from './lib/security.js';
import { recentDocuments, documentsInWindow, documentsForLens } from './repositories/documents.js';
import { listQuestions, getQuestion, orphanedIndicators } from './repositories/questions.js';
import { listLenses, getLens, getLensTickers, overview } from './repositories/lenses.js';
import { financingGraph } from './repositories/events.js';
import cookieParser from 'cookie-parser';
import { globe } from './repositories/globe.js';
import * as auth from './lib/auth.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '../../public');
/**
 * The landing page is a static site, not part of the React app.
 *
 * It is a hardened mirror of a Framer template, committed as source under
 * `landing/`, and it owns the front door plus /waitlist, /thanks and /legal/*.
 * The app owns everything else. Serving both from one origin is what makes the
 * site one site rather than two — a reader clicking "Diffusion" in the app nav
 * lands on the real landing page, not on a second copy of the overview.
 */
const landingDir = path.resolve(here, '../../landing');

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
/*
 * CORS was deliberately wide open while the API was anonymous and read-only —
 * a cross-origin caller could do nothing `curl` could not. A session cookie
 * changes that completely: open CORS plus credentials is the textbook CSRF
 * hole, and STATUS.md has carried that warning since before there was auth to
 * make it real.
 *
 * So it is now an allowlist whenever sign-in is configured. Same-origin
 * requests carry no Origin header and are unaffected; this only governs who
 * may call the API from another site.
 */
/*
 * Gzip, before anything that can produce a body.
 *
 * `express.static` does not compress. The client bundle is 994 kB of
 * JavaScript and 133 kB of CSS, and every reader has been downloading all of
 * it uncompressed — roughly a megabyte where a quarter of one would do. The
 * JSON responses are worse per byte: a series payload is thousands of repeated
 * `{"date":"…","value":…}` keys, which is close to the best case gzip has.
 *
 * First in the chain because compression works by wrapping `res.write`, so it
 * has to be installed before any handler that might call it.
 *
 * Left at the default 1 kB threshold: below that the gzip header costs more
 * than the saving, and the CPU is not free on a small instance.
 */
app.use(compression());

app.use(
  cors({
    credentials: auth.isConfigured(),
    origin(origin, callback) {
      if (!origin) return callback(null, true); // same-origin or curl
      if (!auth.isConfigured()) return callback(null, true);
      const allowed = config.auth.allowedOrigins;
      return callback(null, allowed.length === 0 ? false : allowed.includes(origin));
    },
  })
);
app.use(cookieParser());
/*
 * JSON bodies, for the one route that takes one — email sign-in. Capped small:
 * nothing here accepts an upload, and an unbounded parser in front of a public
 * endpoint is a free denial-of-service.
 */
app.use(express.json({ limit: '4kb' }));

/*
 * Both roots, not just the app's. The landing page is served from this same
 * origin under this same CSP and carries seven executable inline scripts;
 * scanning only `publicDir` is what silently killed every one of them. See the
 * header of lib/security.js.
 */
app.use(
  securityHeaders({ publicDir, landingDir, isProduction: config.env === 'production' })
);
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
/**
 * Sign-in. Three routes, all outside the API gate for obvious reasons.
 *
 * These live on /auth rather than /api because they are browser navigations,
 * not fetches — they redirect, and a 401-returning gate in front of them would
 * make signing in impossible.
 */
app.get('/auth/github', (req, res) => {
  if (!auth.isConfigured()) {
    return res.status(503).send('Sign-in is not configured on this server.');
  }
  return auth.beginLogin(req, res);
});

app.get('/auth/github/callback', async (req, res) => {
  try {
    await auth.completeLogin(req, res);
    res.redirect('/overview');
  } catch (error) {
    // The message is written to be safe to show; nothing here echoes a token
    // or a code back to the browser.
    res.redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * Sign in with a name and an email address.
 *
 * JSON in, JSON out — the client posts it and stays on the page, so a failure
 * shows inline rather than as a redirect that loses what was typed.
 */
app.post('/auth/email', route(async (req, res) => {
  if (!auth.isConfigured()) {
    return res.status(503).json({ error: 'Sign-in is not configured on this server.' });
  }
  try {
    const reader = await auth.signInWithEmail(res, req.body ?? {});
    return res.json({ reader });
  } catch (error) {
    // These messages are written for a reader and carry nothing sensitive.
    return res.status(400).json({ error: error.message });
  }
}));

app.post('/auth/logout', (req, res) => {
  auth.logout(res);
  res.json({ ok: true });
});

/** Who am I. Public, and answers null rather than 401 when signed out. */
app.get('/api/me', route(async (req, res) => {
  const reader = auth.isConfigured() ? await auth.currentReader(req) : null;
  res.json({
    reader,
    authRequired: auth.isConfigured(),
    githubAvailable: auth.githubConfigured(),
  });
}));

/*
 * Everything below /api needs an account. Registered after /api/me so the
 * client can always ask whether it is signed in, and after the auth routes so
 * signing in is possible while signed out.
 */
app.use('/api', auth.requireReader());

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
            /* Latest period with an ACTUAL VALUE.
               Several upstreams publish empty future periods as placeholders —
               the RBA's quarterly tables carry rows out to 2027-03-31 with a
               null value. A bare max() over period_start counts those, so the
               catalogue claimed coverage to 2027 for a series whose last
               measurement is 2026 Q1. Nothing is drawn from a null, so the
               charts were right and the coverage claim was wrong. */
            max(o.period_start) FILTER (WHERE o.value IS NOT NULL)::text AS latest_period,
            min(o.period_start) FILTER (WHERE o.value IS NOT NULL)::text AS earliest_period
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

/**
 * The financing graph — every deal, and the circles inside it.
 *
 * Reads `investment_edges`, which is one row per non-cancelled deal. It must
 * never read `monthly_investment`: that view sums opposite-facing legs of the
 * same arrangement, so its totals describe nothing that happened.
 */
app.get('/api/financing', route(async (_req, res) => {
  res.json(await financingGraph());
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

    /*
     * `value_status` rides along per point because a forecast drawn like a
     * measurement is the failure this site's first rule exists to prevent.
     * AMECO's later years are the European Commission's own projection — real
     * numbers, but not observations — and seed 029 marks them 'projected'.
     * Sending only date and value left the chart no way to tell the two
     * apart, so it drew them identically.
     */
    const { rows } = await query(
      `SELECT period_start::text AS date, value, value_status
         FROM observations
        WHERE indicator_id = $1
          AND ($2::char(3) IS NULL OR country_iso3 = $2)
        ORDER BY period_start`,
      [id, country ?? meta[0].default_country_iso3 ?? null]
    );

    return { id, meta: meta[0], country, points: rows };
  }));

  /*
   * A SERIES SQUASHED FLAT IS A LIE THE CHART TELLS QUIETLY.
   *
   * The caller asks for indexing when the units differ, because different
   * units cannot share an axis. That test misses the case where the units
   * MATCH and the magnitudes do not. Three live chart groups had it:
   *
   *   money / usd-millions      world computer-services exports against US
   *                             cloud exports — a factor of 161
   *   materials / precious-metals   gold against silver — a factor of 64
   *   productivity / us-value-added private services against information — 13
   *
   * At 13x the smaller series occupies under 8% of the axis, so its whole
   * history renders as a flat line along the bottom. On the productivity page
   * that read as "the information sector has not grown", when it has roughly
   * quadrupled since 2005. Nothing warned; the chart looked fine.
   *
   * WHY quantity_kind DECIDES AND NOT THE RATIO ALONE
   *
   * A big spread is only a problem when the axis POSITION is not itself the
   * finding. For a `rate` it is: the adoption panel runs from Australia at 3%
   * to Denmark at 27%, a factor of 8, and rebasing those to 100 would destroy
   * the comparison the page exists to make — Poland at 3% and Denmark at 42%
   * is the whole point, and indexing both to 100 hides it.
   *
   * For a `currency`, a `magnitude` or a `count`, the level is a fact about
   * the unit rather than about the subject, and the shape is what the reader
   * is being invited to compare. Those rebase.
   */
  const LEVELS_ARE_COMPARABLE = new Set(['rate', 'index', 'change', 'score']);

  /*
   * The test measures the failure directly rather than proxying it.
   *
   * A ratio between the series' peaks was the first attempt and it let
   * `us-value-added` through: private services peaks around 8x information, a
   * ratio under the threshold, while information's entire movement still
   * covers under a tenth of the axis. What makes a line look flat is not how
   * it compares to its neighbour's peak — it is how much VERTICAL ROOM its own
   * range takes up on the axis the chart will draw.
   *
   * The denominator assumes a zero-based axis, which is what these charts
   * draw for all-positive data.
   */
  const MIN_AXIS_SHARE = 0.1;

  const measurable = series.filter((s) => s.meta && s.points.some((p) => p.value != null));
  const comparableLevels =
    measurable.length > 0 &&
    measurable.every((s) => LEVELS_ARE_COMPARABLE.has(s.meta.quantity_kind));

  const allValues = measurable.flatMap((s) =>
    s.points.filter((p) => p.value != null).map((p) => Number(p.value))
  );
  const axisSpan = allValues.length
    ? Math.max(...allValues) - Math.min(0, ...allValues)
    : 0;

  const shares = measurable.map((s) => {
    const values = s.points.filter((p) => p.value != null).map((p) => Number(p.value));
    return (Math.max(...values) - Math.min(...values)) / axisSpan;
  });

  const squashed =
    measurable.length > 1 &&
    !comparableLevels &&
    axisSpan > 0 &&
    shares.some((share) => share < MIN_AXIS_SHARE);



  if (!rebase && !squashed) return res.json({ series, indexed: false });

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
      // Rebasing changes the scale, not what the value IS: a projection
      // indexed to 100 is still a projection, so the status survives the map.
      points: s.points.map((p) => ({
        date: p.date,
        value: p.value == null ? null : (p.value / anchor.value) * 100,
        value_status: p.value_status,
      })),
    };
  });

  res.json({
    series: indexedSeries,
    indexed: true,
    indexBase: base,
    /* Said out loud when the rebase was this endpoint's decision rather than
       the caller's. A reader looking at a chart whose caption promised raw
       dollars deserves to be told why it is showing an index instead — and
       the ratio is given so they can judge whether they agree. */
    indexNote: squashed && !rebase
      ? 'rebased because one series covered under a tenth of the axis in raw units and would have been drawn as a flat line'
      : undefined,
  });
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
                -- Non-null only; see the note on latest_period above.
                min(period_start) FILTER (WHERE value IS NOT NULL)::text AS first_period,
                max(period_start) FILTER (WHERE value IS NOT NULL)::text AS last_period
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
      /*
       * `lower(c.name)`, not `c.name`, because a bare text ORDER BY depends on
       * the DATABASE's collation and this project has now run on two with
       * different ones: Render was en_US.UTF8, Neon is C.UTF-8. Under C, byte
       * order applies and an all-caps name sorts before a Title Case one —
       * "BBC" ahead of "Bank" — so the same query returns a different order on
       * the two hosts with identical data.
       *
       * This is the only reader-facing text ordering left in the API. Every
       * other list orders by a count, a date, or an id: /api/indicators is
       * pillar then count then id, the source register is row count with name
       * only as a tiebreaker, and /data sorts in the browser. So this is a
       * one-line fix rather than a sweep, and lower() is enough — the values
       * here are country names, where case is the only thing that differs
       * between the two collations.
       */
      ORDER BY lower(c.name)`,
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
  const [counts, runs, stale, sources] = await Promise.all([
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
    /*
     * WHO ACTUALLY PROVIDES THE DATA.
     *
     * The page this feeds is called "where this comes from", and until now it
     * could not answer that. It listed which integrations were configured —
     * a fact about the .env file — while the honest answer is that two
     * sources carry 79% of every observation on the site and the other six
     * carry the rest. That imbalance is the most important thing a reader
     * assessing this project should know, and it was the one thing the
     * provenance page did not say.
     *
     * Licence and attribution come along because they are a condition of use
     * for several of these and were previously visible only on an individual
     * series page, one at a time.
     */
    query(`SELECT s.id, s.name, s.homepage_url, s.licence, s.attribution_text,
                  s.credibility,
                  COALESCE(m.observations, 0)  AS observations,
                  COALESCE(m.indicators, 0)    AS indicators,
                  m.latest_period,
                  COALESCE(d.documents, 0)     AS documents
             FROM sources s
             /* Two LATERALs rather than two LEFT JOINs into one GROUP BY.
                Joining indicators AND documents to the same row multiplies
                them together — 38 indicators × 25 articles counted as 950 of
                each — and the totals silently stop summing to the real
                figure. Aggregating each side independently is the fix. */
             LEFT JOIN LATERAL (
               SELECT count(o.*)::int          AS observations,
                      count(DISTINCT i.id)::int AS indicators,
                      max(o.period_start) FILTER (WHERE o.value IS NOT NULL)::text AS latest_period
                 FROM indicators i
                 LEFT JOIN observations o ON o.indicator_id = i.id
                WHERE i.source_id = s.id AND i.is_active
             ) m ON true
             LEFT JOIN LATERAL (
               SELECT count(*)::int AS documents
                 FROM documents WHERE source_id = s.id
             ) d ON true
            WHERE COALESCE(m.observations, 0) > 0
               OR COALESCE(d.documents, 0) > 0
            ORDER BY COALESCE(m.observations, 0) DESC,
                     COALESCE(d.documents, 0) DESC, s.name`),
  ]);

  res.json({
    counts: counts.rows[0],
    recentRuns: runs.rows,
    staleIndicators: stale.rows,
    sources: sources.rows,
    integrations: describeIntegrations(),
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// Static files and errors
// ─────────────────────────────────────────────────────────────────────────────

/*
 * Landing first, then the app build. Both mount at the root and both have an
 * `assets/` directory, which is safe because their filenames cannot collide:
 * the landing page carries Framer's content-hashed names and Vite emits
 * `index-<hash>`. Express tries landing, misses, and falls through.
 *
 * `index: 'index.html'` is what makes `/` the landing page and what resolves
 * `/legal/privacy-policy` and `/waitlist` to their directories' index files.
 */
/*
 * The template's waitlist flow, retired.
 *
 * Diffusion has no waitlist — every call to action was repointed at /login when
 * the mirror was built — but the two pages behind it are still in the mirror
 * and still served, and one of them renders the template's invented
 * "1,200+ people on the waitlist". That is a fabricated number on a site whose
 * first rule is to invent nothing, so the pages are redirected rather than left
 * reachable by anyone who guesses the URL.
 *
 * Before the static handlers, because express.static would otherwise answer
 * first. 302 rather than 301: this is a decision about content, not a permanent
 * move, and a cached 301 is very hard to take back.
 */
app.get(['/waitlist', '/waitlist/', '/thanks', '/thanks/'], (_req, res) =>
  res.redirect(302, '/login')
);

/**
 * The landing directory holds its own build pipeline, and none of it is
 * public content.
 *
 * `express.static(landingDir)` serves the whole tree, and the tree contains
 * more than the site. Both of these returned 200 to an anonymous request until
 * 2026-08-30:
 *
 *   /docs/mirror.py                 the clone pipeline, in full
 *   /.mirror-cache/pages/index.html the ORIGINAL Framer template, un-hardened,
 *                                   before the content map replaced the
 *                                   template's copy with Diffusion's
 *
 * The second is the worse of the two: it is a working copy of somebody else's
 * template served from this domain, still carrying their text.
 *
 * Blocked here rather than by moving the directories, because `docs/` is where
 * the build scripts live and they are meant to sit beside what they build. 404
 * rather than 403 — there is no reason to confirm the path exists.
 *
 * Express's own dotfile handling does NOT cover this: `express.static` defaults
 * to `dotfiles: 'ignore'`, which applies to the final path segment only, so
 * `/.mirror-cache/pages/index.html` sailed straight through it.
 */
app.use(['/docs', '/.mirror-cache'], (_req, res) =>
  res.status(404).type('txt').send('Not found')
);

app.use(
  express.static(landingDir, {
    index: 'index.html',
    extensions: ['html'],
    // No trailing-slash redirect. The mirror's links are slash-less
    // (/waitlist, /legal/privacy-policy) and a 301 to /waitlist/ changes the
    // URL under the reader and breaks the canonical tags written by detach.py.
    // The resolver below serves those directly instead.
    redirect: false,
    maxAge: config.env === 'production' ? '1h' : 0,
  })
);

/**
 * Slash-less directory paths on the landing page.
 *
 * `express.static` will serve `landing/waitlist/index.html` for `/waitlist/`
 * but not for `/waitlist`, and the mirror links to the latter everywhere. This
 * resolves the slash-less form directly rather than redirecting to add one.
 */
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/healthz') return next();
  const candidate = path.join(landingDir, req.path, 'index.html');
  // Never let a crafted path climb out of landing/.
  if (!candidate.startsWith(landingDir + path.sep)) return next();
  res.sendFile(candidate, (error) => {
    if (error) next();
  });
});
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

export { app };
export default app;

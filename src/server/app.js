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
import { securityHeaders, rateLimit, sameOriginOnly } from './lib/security.js';
import { recentDocuments, documentsInWindow, documentsForLens } from './repositories/documents.js';
import { listQuestions, getQuestion, orphanedIndicators } from './repositories/questions.js';
import { listLenses, getLens, getLensTickers, overview } from './repositories/lenses.js';
import { financingGraph } from './repositories/events.js';
import {
  listScenarios,
  getScenario,
  runSimulation,
  scenarioEvidence,
} from './repositories/simulations.js';
import cookieParser from 'cookie-parser';
import { globe } from './repositories/globe.js';
import * as auth from './lib/auth.js';
import { reportServerError, describeErrorSink, redact } from './lib/observability.js';

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

/*
 * Gzip, before anything that can produce a body — but only on the host that
 * needs it.
 *
 * FOR `npm start` ON A LONG-LIVED HOST, WHERE THIS IS STILL RIGHT
 *
 * There, Express serves everything itself and `express.static` does not
 * compress. This used to say 994 kB of JavaScript, which was true before route
 * code-splitting landed; the three chunks `index.html` actually preloads now
 * come to about 380 kB, plus 143 kB of CSS. Still half a megabyte uncompressed
 * where a fraction of it would do, and the lazy route chunks land on top as
 * the reader moves around. The JSON responses are worse per byte: a series
 * payload is thousands of repeated `{"date":"…","value":…}` keys, which is
 * close to the best case gzip has. First in the chain because compression
 * works by wrapping `res.write`, so it has to be installed before any handler
 * that might call it. Left at the default 1 kB threshold: below that the gzip
 * header costs more than the saving, and the CPU is not free on a small
 * instance.
 *
 * FOR VERCEL, WHERE IT IS A PURE CPU TAX
 *
 * None of the above applies. `vercel.json` routes only `/api/*`, `/auth/*` and
 * `/healthz` into this function — the bundle and the landing page are served
 * by the CDN, which brotli-compresses them without ever entering this process.
 * What is left is the JSON, and Vercel already compresses function responses
 * at the edge. So this middleware gzips a body that is about to be
 * decompressed and recompressed by the platform, and bills the function for
 * the privilege.
 *
 * `process.env.VERCEL` is set by the platform on every deployment and in
 * `vercel dev`, and is absent everywhere else, which makes it the honest test
 * for "is something else already doing this".
 */
if (!process.env.VERCEL) {
  app.use(compression());
}

/**
 * CORS, which follows sign-in rather than being a fixed policy.
 *
 * This was wide open, and the comment above it argued the case well: read-only
 * public data, no authentication, no cookies, no session, so a cross-origin
 * caller could do nothing `curl` could not — and letting researchers query the
 * API from their own pages is a stated goal of the project. That comment ended
 * by naming the exact condition under which it would stop being true: "if auth
 * is ever added, this must become an allowlist".
 *
 * Auth was added. The policy changed with it and the comment did not, so the
 * file carried a paragraph asserting there were no cookies directly above the
 * allowlist that exists because there are. Same orphaning as the /healthz note
 * that used to sit above the auth routes describing Render. Both blocks are now
 * this one.
 *
 * WHAT IT ACTUALLY DOES, IN THE ORDER THE CALLBACK DECIDES
 *
 *   no Origin header      always allowed. That is same-origin navigation, curl,
 *                         and anything server-to-server. A browser omits the
 *                         header entirely rather than sending an empty one, so
 *                         this is not a hole a page can climb through.
 *
 *   sign-in not configured   still wide open, and `credentials` is off. With no
 *                         session there is no credential to ride along on a
 *                         cross-site request, the original argument holds in
 *                         full, and the open API researchers were promised is
 *                         the one they get.
 *
 *   sign-in configured    ALLOWED_ORIGINS only, with `credentials` on. Open CORS
 *                         plus a session cookie is the textbook way a read-only
 *                         API becomes a CSRF hole, which STATUS.md warned about
 *                         from before there was any auth to make it real.
 *
 * An empty ALLOWED_ORIGINS with sign-in on refuses every cross-origin caller
 * rather than admitting all of them. A deployment that forgot to set the list
 * should lose third-party access, not its session protection.
 *
 * `credentials` is tied to the same `isConfigured()` the allowlist is, so the
 * two can never disagree — the mode where cookies are permitted from anywhere
 * is not reachable from any environment.
 */
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

/*
 * INBOUND RATE LIMITING, WHICH DID NOT EXIST.
 *
 * `POST /auth/email` takes an unverified name and address and INSERTs a row
 * into `readers`. Nothing bounded how often that could be called, so anyone
 * could write to the production database in a loop — and Neon's free tier caps
 * on storage and compute, which makes filling one table a cheap way to take the
 * whole site down. Every one of those inserts is a WRITE, which pins the
 * request to the primary and defeats the read routing `auth.currentReader`
 * spends twelve comment lines protecting.
 *
 * TWO CEILINGS, BECAUSE THEY STOP DIFFERENT THINGS
 *
 * The per-caller limit stops one client looping. The global limit is the one
 * that bounds rows written per minute no matter how many addresses a caller
 * appears to come from, which is what actually protects the database — see the
 * note on `callerKey` in lib/security.js for why the per-caller key cannot be
 * trusted on its own.
 *
 * The /auth ceiling is deliberately low: sign-in is something a person does
 * once. The /api ceiling is generous because one question page fans out into
 * several parallel fetches and a reader clicking around must never meet it.
 * Reads have no global ceiling — they write nothing, and a shared ceiling on
 * reads would let one caller degrade the site for everybody.
 */
const AUTH_WINDOW_MS = 60_000;
const API_WINDOW_MS = 60_000;

app.use(
  '/auth',
  rateLimit({
    windowMs: AUTH_WINDOW_MS,
    max: 10,
    globalMax: 60,
    message: 'Too many sign-in attempts. Wait a minute and try again.',
  })
);

/*
 * One bucket for the whole API, attached in three places rather than mounted
 * once at the top.
 *
 * `/api/me` and `/api/status` are registered ABOVE the auth gate, so a single
 * `app.use('/api', …)` placed before them would be the first middleware on that
 * path and would shadow the gate as "the thing mounted on /api" for anything
 * reading the router — while placing it after them would leave the two routes
 * an anonymous caller can actually reach as the only unlimited ones on the
 * site. Attaching the same limiter instance to those two routes directly, and
 * mounting it for everything else, gives one allowance across all of them with
 * no route left out.
 */
const apiLimiter = rateLimit({
  windowMs: API_WINDOW_MS,
  max: 240,
  message: 'Too many requests. Wait a minute and try again.',
});

// ─────────────────────────────────────────────────────────────────────────────
// Sign-in
// ─────────────────────────────────────────────────────────────────────────────

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

/*
 * Both POST routes require a same-origin signal.
 *
 * Read lazily through a function so the guard sees the allowlist the CORS
 * middleware sees rather than a copy taken at module load. See the header of
 * `sameOriginOnly` for what each branch decides and why `curl` still works.
 */
const fromOurOwnPages = sameOriginOnly(() => config.auth?.allowedOrigins ?? []);

/**
 * Sign in with a name and an email address.
 *
 * JSON in, JSON out — the client posts it and stays on the page, so a failure
 * shows inline rather than as a redirect that loses what was typed.
 */
app.post('/auth/email', fromOurOwnPages, route(async (req, res) => {
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

app.post('/auth/logout', fromOurOwnPages, (req, res) => {
  auth.logout(res);
  res.json({ ok: true });
});

/** Who am I. Public, and answers null rather than 401 when signed out. */
app.get('/api/me', apiLimiter, route(async (req, res) => {
  const reader = auth.isConfigured() ? await auth.currentReader(req) : null;
  /*
   * The one response on this site that identifies a person, so it says so.
   * `Vary: Cookie` is what stops any cache — the browser's own included —
   * handing one reader's name to the next request that arrives without a
   * session, and `no-store` means nothing keeps a copy in the first place.
   */
  res.setHeader('Cache-Control', 'private, no-store');
  res.vary('Cookie'); // append, never replace the `Vary: Origin` cors set
  res.json({
    reader,
    authRequired: auth.isConfigured(),
    githubAvailable: auth.githubConfigured(),
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// Operational status — public, and registered here so that is true
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What ran, what failed, and what is stale.
 *
 * WHY IT SITS ABOVE THE GATE
 *
 * The comment here used to say "public rather than admin-only on purpose" while
 * the route was registered 600 lines BELOW `app.use('/api', requireReader())`,
 * so it answered 401 to precisely the person the argument is about. Someone
 * deciding whether to believe this site had to create an account before they
 * could check where its numbers came from, which inverts the claim rather than
 * weakening it. The provenance page is the strongest trust signal the project
 * has and it was the one page an anonymous visitor could not see.
 *
 * It is safe to open, and that was checked rather than assumed. The body is
 * aggregate counts, the source register, and ingestion error messages — which
 * `runner.js` redacts on the way IN, explicitly because this endpoint publishes
 * them (see the note at runner.js:47). `describeIntegrations()` reports whether
 * each key is set, never its value. The reader gate stays on every page that
 * carries an argument; this one carries only arithmetic about the pipeline.
 */
app.get('/api/status', apiLimiter, route(async (_req, res) => {
  const [counts, runs, stale, sources] = await Promise.all([
    /*
     * TWO KINDS OF COUNT, AND THE DIFFERENCE MATTERS.
     *
     * `countries` is `count(*) FROM countries` — a row count of a dimension
     * table, six of whose rows are aggregates (WLD, EUU, …) and one of which
     * holds nothing at all. It is kept because it answers "how big is the
     * catalogue", but on its own a reader takes it for coverage, and coverage
     * is both thinner and far more uneven than the row count suggests — the
     * United States holds an order of magnitude more indicators than the median
     * country, and the two figures beside it are what say so.
     *
     * `countries_with_depth` counts countries holding more than six distinct
     * indicators — six being the size of the annual World Bank block that
     * nearly every country in the table carries, so the threshold reads as
     * "has anything specific to it". It is a threshold rather than a fact about
     * the World Bank, and it misses one case in that direction: Taiwan holds
     * two indicators, both country-specific, and falls under it. Written down
     * because a number whose edge case is hidden is the failure this whole
     * block exists to fix.
     *
     * `sources_registered` is the row count of the register. The number of
     * sources actually supplying anything is added below from the source list
     * itself, so the figure and the list it summarises cannot disagree.
     */
    query(`WITH country_depth AS (
             SELECT o.country_iso3, count(DISTINCT o.indicator_id) AS indicators
               FROM observations o
               JOIN countries c ON c.iso3 = o.country_iso3
              WHERE NOT c.is_aggregate AND o.value IS NOT NULL
              GROUP BY o.country_iso3
           )
           SELECT
             (SELECT count(*)::int FROM observations) AS observations,
             (SELECT count(*)::int FROM documents)    AS documents,
             (SELECT count(*)::int FROM indicators WHERE is_active) AS indicators,
             (SELECT count(*)::int FROM countries)   AS countries,
             (SELECT count(*)::int FROM country_depth) AS countries_with_data,
             (SELECT count(*)::int FROM country_depth WHERE indicators > 6) AS countries_with_depth,
             (SELECT count(*)::int FROM sources)     AS sources_registered`),
    query(`SELECT job_name, source_id, status, started_at, finished_at,
                  rows_written, error_message
             FROM ingestion_runs
            ORDER BY started_at DESC
            LIMIT 15`),
    /*
     * STALENESS MEASURED ON THE DATA, NOT ON THE JOB.
     *
     * This used to test `last_ingested_at < now() - 7 days`, and
     * `touchIndicator()` sets that column on any successful fetch INCLUDING one
     * that returned nothing new. So the query returned zero rows and /pipeline
     * told the reader "Nothing is late. Every active series has run inside its
     * own cadence" while 73 of the 125 active series had no observation newer
     * than a year — fourteen of them over a thousand days behind, the worst at
     * 2,438 — and every one of those carried last_ingested_at = the night
     * before. The page whose entire job is to say how much to trust the numbers
     * said the opposite of the truth about 58% of them.
     *
     * The test is now the newest period that actually holds a VALUE, compared
     * against the indicator's own cadence. `FILTER (WHERE value IS NOT NULL)`
     * matters on its own: several upstreams publish empty future periods as
     * placeholders, and a bare max() would count those as fresh data.
     *
     * WHY THREE PERIODS
     *
     * Every publisher runs behind its own reference period — annual national
     * accounts for 2025 arrive through 2026 — so one period late is normal and
     * flagging it would make the list noise. Three periods is past any ordinary
     * publication lag: a monthly series with nothing for a quarter, or an
     * annual one three reference years back, has stopped rather than slipped.
     * Daily gets a week instead of three days, because these are market series
     * and a weekend plus a holiday is not a fault.
     *
     * `irregular` has no cadence to measure against, so it is not measured. A
     * threshold invented for it would be a number nobody could defend, which is
     * the thing this endpoint is for catching.
     */
    query(`SELECT i.id, i.name, i.cadence::text AS cadence, i.last_ingested_at,
                  max(o.period_start) FILTER (WHERE o.value IS NOT NULL)::text AS latest_period,
                  (now()::date - max(o.period_start) FILTER (WHERE o.value IS NOT NULL))::int
                    AS days_behind,
                  -- How long the job has been succeeding while returning nothing:
                  -- the distance between "we last asked" and "the newest number
                  -- we hold". Large here means the upstream answered and had
                  -- nothing to add, which is the failure the freshness badge
                  -- cannot see and the reason it is published rather than derived.
                  (i.last_ingested_at::date - max(o.period_start) FILTER (WHERE o.value IS NOT NULL))::int
                    AS ingest_gap_days
             FROM indicators i
             LEFT JOIN observations o ON o.indicator_id = i.id
            WHERE i.is_active AND i.source_series_code IS NOT NULL
            GROUP BY i.id
           HAVING max(o.period_start) FILTER (WHERE o.value IS NOT NULL) IS NULL
               OR max(o.period_start) FILTER (WHERE o.value IS NOT NULL)
                    < (now() - CASE i.cadence
                                 WHEN 'daily'     THEN INTERVAL '7 days'
                                 WHEN 'weekly'    THEN INTERVAL '3 weeks'
                                 WHEN 'monthly'   THEN INTERVAL '3 months'
                                 WHEN 'quarterly' THEN INTERVAL '9 months'
                                 WHEN 'annual'    THEN INTERVAL '3 years'
                               END)::date
            ORDER BY days_behind DESC NULLS FIRST
            LIMIT 40`),
    /*
     * WHO ACTUALLY PROVIDES THE DATA.
     *
     * The page this feeds is called "where this comes from", and until now it
     * could not answer that. It listed which integrations were configured —
     * a fact about the .env file — while the honest answer is that two of the
     * eight measured sources carry roughly four fifths of every observation on
     * the site and the other six carry the rest. That imbalance is the most
     * important thing a reader assessing this project should know, and it was
     * the one thing the provenance page did not say. (The share is not written
     * as a figure here on purpose: a number in a comment cannot be gated, and
     * the one that used to sit in this sentence had already drifted.)
     *
     * Licence and attribution come along because they are a condition of use
     * for several of these and were previously visible only on an individual
     * series page, one at a time.
     *
     * ONE GROUPED PASS, NOT A LATERAL PER SOURCE.
     *
     * This was two correlated LATERALs. EXPLAIN (ANALYZE, BUFFERS) showed a
     * sequential scan of every observation with loops=8, a sequential scan of
     * documents with loops=25, and a per-source sort writing over a thousand
     * temp blocks to disk — 295.7 ms. Each side is now aggregated once and
     * joined to `sources`: 37.6 ms on the same database in the same session,
     * one pass over observations, one over documents, no temp files.
     *
     * The three CTEs stay separate rather than collapsing into one join because
     * joining indicators and documents into a single GROUP BY multiplies them
     * together — the failure the old comment here warned about — and counting
     * indicators apart from observations is what removes the count(DISTINCT)
     * that was doing the sorting.
     */
    query(`WITH catalogued AS (
             SELECT i.source_id, count(*)::int AS indicators
               FROM indicators i
              WHERE i.is_active
              GROUP BY i.source_id
           ), measured AS (
             SELECT i.source_id,
                    count(*)::int                                                AS observations,
                    max(o.period_start) FILTER (WHERE o.value IS NOT NULL)::text AS latest_period
               FROM observations o
               JOIN indicators i ON i.id = o.indicator_id AND i.is_active
              GROUP BY i.source_id
           ), reported AS (
             SELECT source_id, count(*)::int AS documents
               FROM documents
              GROUP BY source_id
           )
           SELECT s.id, s.name, s.homepage_url, s.licence, s.attribution_text,
                  s.credibility,
                  COALESCE(m.observations, 0) AS observations,
                  COALESCE(c.indicators, 0)   AS indicators,
                  m.latest_period,
                  COALESCE(d.documents, 0)    AS documents
             FROM sources s
             LEFT JOIN catalogued c ON c.source_id = s.id
             LEFT JOIN measured   m ON m.source_id = s.id
             LEFT JOIN reported   d ON d.source_id = s.id
            WHERE COALESCE(m.observations, 0) > 0
               OR COALESCE(d.documents, 0) > 0
            ORDER BY COALESCE(m.observations, 0) DESC,
                     COALESCE(d.documents, 0) DESC, s.name`),
  ]);

  /*
   * Cacheable at the edge, because this one genuinely is public and identical
   * for everybody. Every other /api response varies with a session cookie and
   * is marked `private` further down for that reason. Half an hour, since the
   * pipeline behind it moves once a night.
   */
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');

  res.json({
    counts: {
      ...counts.rows[0],
      /* Counted from the list rather than queried again, so this figure and the
         register printed under it can never disagree — which is the whole
         defect: the home page printed a hardcoded "24" while /pipeline listed
         17 and /data reported 8.

         Several rows in `sources` — nasa_gibs, copernicus and a set of gov:
         entries — back no observation and no document at all. Naming an
         institution as a source while holding none of its data is a
         credibility claim rather than a coverage one, so the query above
         already excludes them and this counts what survives. */
      sources_supplying: sources.rows.length,
    },
    recentRuns: runs.rows,
    staleIndicators: stale.rows,
    sources: sources.rows,
    integrations: describeIntegrations(),
  });
}));

app.use('/api', apiLimiter);

/*
 * Everything below /api needs an account. Registered after /api/me so the
 * client can always ask whether it is signed in, after the auth routes so
 * signing in is possible while signed out, and after /api/status so an
 * anonymous visitor can check the provenance of the numbers before deciding
 * whether an account is worth making.
 */
app.use('/api', auth.requireReader());

/**
 * Cache-Control on the gated API, which carried none at all.
 *
 * Vercel's default for a function that sets no header is
 * `public, max-age=0, must-revalidate` — the word `public` on a response that
 * varies with a session cookie and does not say so. Harmless today only because
 * `max-age=0` means nothing keeps it, and the wrong thing to leave as the
 * default anyone builds on.
 *
 * WHY `private` AND NOT AN EDGE CACHE, WHICH IS THE OBVIOUS WIN
 *
 * These payloads are identical for every signed-in reader, so a shared cache
 * looks free. It is not, and the reason is the gate. One URL answers 401 to an
 * anonymous request and 200 to a signed-in one, so a shared cache holding the
 * 200 serves it to anybody — the gate is bypassed by a CDN doing its job. The
 * fix for that is `Vary: Cookie`, which makes the cache key the session itself,
 * one entry per reader, and the hit rate goes to nothing. There is no
 * arrangement where a shared cache in front of a per-reader gate is both safe
 * and useful, so the edge is left out of it.
 *
 * `private` is a real gain regardless: the reader's own browser may reuse a
 * response across a reload or a back navigation, which is where the repeat
 * fetches actually are. What it costs is that a reader who signs out may still
 * be served up to five minutes of data they had already fetched, from their own
 * disk. That data is public and they had already seen it.
 *
 * The 401 itself is never labelled, because `requireReader` answers without
 * calling `next()` and this never runs for it.
 */
app.use('/api', (req, res, next) => {
  // Reads only. A POST response is not cacheable without a Content-Location
  // anyway, and labelling one `max-age` invites a future proxy to guess.
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();

  // Deferred to writeHead, and that is the whole point. Setting the header here
  // labels the response before anyone knows what the response IS: the first
  // version of this cached 500s, 404s and 400s for five minutes in the reader's
  // own browser, so a transient database wobble outlived the wobble. Proven at
  // the time with `/api/indicators/<id>/observations?from=notadate` -> HTTP 500
  // carrying `private, max-age=300`.
  //
  // By writeHead the status code is settled and nothing has been flushed, so
  // this is the last honest moment to make the decision. A route that set its
  // own value keeps it — /api/status has its own s-maxage and the rate limiter
  // answers `no-store`; neither wants overwriting.
  const writeHead = res.writeHead;
  res.writeHead = function (...args) {
    const ok = res.statusCode >= 200 && res.statusCode < 300;
    if (ok && !res.getHeader('Cache-Control')) {
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.vary('Cookie'); // append, never replace the `Vary: Origin` cors set
    }
    return writeHead.apply(this, args);
  };
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Is this deployment alive, and WHICH deployment is it.
 *
 * Nothing deploys to Render any more — this comment used to say so, and used
 * to sit above `/auth/github`, having been orphaned when the auth routes were
 * inserted underneath it. What reads this now is Vercel, and the smoke
 * workflow that runs against the deployed URL after every push.
 *
 * It must actually touch the database: a process that has booted but cannot
 * reach Postgres is not healthy, and reporting it as healthy means a broken
 * deploy goes live.
 *
 * WHY `commit` IS IN THE BODY
 *
 * A green smoke run proved the site was up. It could not prove the site was
 * the site that had just been pushed — a deploy that never finished, or one
 * that rolled back, leaves last week's build answering happily on the same URL
 * and every assertion still passes. The SHA is the only thing that ties the
 * running process to a commit, so the smoke suite can assert it matches the
 * one it tested.
 *
 * Vercel injects it as VERCEL_GIT_COMMIT_SHA. Locally there is nothing to
 * inject, so the answer is null: an honest "this build does not know which
 * commit it is" rather than a placeholder string that a test would happily
 * compare and a human would eventually mistake for a real SHA.
 *
 * `?deep=1` ANSWERS A DIFFERENT QUESTION, AND IT IS THE ONE THAT WAS MISSING.
 *
 * `SELECT 1` proves a connection exists. It proves nothing about whether the
 * queries that draw the site still run — and every one of those sits behind the
 * sign-in gate, so the smoke suite, which has no session, could watch
 * /api/overview, /api/series and /api/questions all return 500 and report every
 * check green. A reader signing in to empty charts was the first person who
 * would find out.
 *
 * So the deep form runs one representative query per repository that backs a
 * reader-facing route and reports HOW MANY ROWS came back. Counts only, never
 * content: this is public, and it stays safe to serve anonymously precisely
 * because a row count discloses nothing a signed-in reader would not see on
 * /api/status, which is already open.
 */
const DEEP_PROBES = [
  // The front page. Five lenses with a live number each.
  { name: 'overview', run: async () => (await overview()).length },
  // Every question page's index.
  { name: 'questions', run: async () => (await listQuestions()).length },
  /*
   * Every chart on the site. Deliberately NOT a hard-coded indicator id — one
   * of those goes stale the day a series is renamed and then fails for a reason
   * that is not an outage. This is the join every series request makes, capped
   * at 500 rows so the cost does not grow with the table: zero means no active
   * indicator holds a single value, which is the catastrophe worth paging for.
   */
  {
    name: 'series',
    run: async () => (
      await query(
        `SELECT count(*)::int AS n
           FROM (SELECT 1
                   FROM observations o
                   JOIN indicators i ON i.id = o.indicator_id AND i.is_active
                  WHERE o.value IS NOT NULL
                  LIMIT 500) s`
      )
    ).rows[0].n,
  },
  // The news rails on every lens.
  { name: 'documents', run: async () => (await recentDocuments({ limit: 1 })).length },
  // The financing graph, which is the one page built from `events`.
  { name: 'financing', run: async () => (await financingGraph()).edges.length },
  // The simulation pages.
  { name: 'scenarios', run: async () => (await listScenarios()).length },
];

/*
 * THE PROBE RESULT IS CACHED FOR 30 SECONDS, AND THAT IS A COST DECISION.
 *
 * This endpoint is unauthenticated and it issues six queries. Without a cache
 * it is a free lever on the database for anyone who finds it. With one, the
 * database cost is bounded to six queries per thirty seconds however hard it is
 * hit, and the freshness lost is reported rather than hidden — `probedAt` says
 * when the answer was actually measured.
 *
 * `inFlight` is shared rather than restarted so a burst of simultaneous callers
 * produces one round of probes, not one per caller.
 */
const DEEP_PROBE_CACHE_MS = 30_000;
let deepCache = { at: 0, probes: null, inFlight: null };

async function runDeepProbes() {
  return Promise.all(
    DEEP_PROBES.map(async ({ name, run }) => {
      const started = performance.now();
      try {
        const rows = await run();
        return { name, ok: rows > 0, rows, ms: Math.round(performance.now() - started) };
      } catch (error) {
        /*
         * The message is redacted before it is published. A failing probe is
         * the moment a database error message is most useful and most
         * dangerous — `redact` is the same function the error sink uses, so
         * there is one rule about what may leave this process, not two.
         */
        return {
          name,
          ok: false,
          rows: 0,
          ms: Math.round(performance.now() - started),
          error: redact(error?.message ?? String(error)),
        };
      }
    })
  );
}

function deepProbes() {
  const now = Date.now();
  if (deepCache.probes && now - deepCache.at < DEEP_PROBE_CACHE_MS) {
    return Promise.resolve({ probes: deepCache.probes, at: deepCache.at });
  }
  if (!deepCache.inFlight) {
    deepCache.inFlight = runDeepProbes().then(
      (probes) => {
        deepCache = { at: Date.now(), probes, inFlight: null };
        return { probes, at: deepCache.at };
      },
      (error) => {
        deepCache.inFlight = null;
        throw error;
      }
    );
  }
  return deepCache.inFlight;
}

app.get('/healthz', route(async (req, res) => {
  const started = performance.now();
  await query('SELECT 1');
  const body = {
    ok: true,
    database: 'connected',
    latencyMs: Math.round(performance.now() - started),
    env: config.env,
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  };

  const deep = req.query.deep === '1' || req.query.deep === 'true';
  if (!deep) return res.json(body);

  const { probes, at } = await deepProbes();
  const failing = probes.filter((probe) => !probe.ok);
  /*
   * 503, not 200, when a probe fails. A monitor that only reads status codes —
   * an uptime pinger, a load balancer — has to be able to see this, and a
   * green 200 carrying `ok: false` is the shape of check that gets believed.
   */
  res.setHeader('Cache-Control', 'no-store');
  return res.status(failing.length === 0 ? 200 : 503).json({
    ...body,
    ok: failing.length === 0,
    probedAt: new Date(at).toISOString(),
    /*
     * Whether a 500 on this deployment would leave a trace anywhere. It is the
     * only way to find out that the answer is "no" BEFORE the outage rather
     * than after it, and it names the kind of sink and never its address.
     */
    errorSink: describeErrorSink(),
    probes,
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
 * about it.
 *
 * NOTHING CALLS THIS TODAY. It used to say it backed the globe on the landing
 * page; the landing page is the static Framer mirror and never calls the API at
 * all. The React `Globe` component that would call it has no importer, and
 * `useGlobe()` in hooks/queries.js is exported and used by nothing. Left
 * registered rather than deleted because the component is a live question for
 * whoever picks it up — but a comment claiming a consumer that does not exist
 * is how a dead endpoint survives three audits.
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

/**
 * Simulations — the one part of this site whose numbers were not measured.
 *
 * Every other endpoint here reports something an agency published. These
 * report arithmetic performed on published coefficients, which is a weaker
 * kind of fact, and the payloads say so: `model_version` and the citation list
 * ship with the response so a client cannot render a projection without having
 * been handed its provenance.
 */
app.get('/api/simulations', route(async (_req, res) => {
  res.json({ scenarios: await listScenarios() });
}));

app.get('/api/simulations/:slug', route(async (req, res) => {
  const scenario = await getScenario(req.params.slug);
  if (!scenario) return res.status(404).json({ error: `No scenario "${req.params.slug}"` });
  res.json(scenario);
}));

/**
 * Run a scenario.
 *
 * THE GET IS NOT IDEMPOTENT, AND THIS COMMENT USED TO SAY IT WAS.
 *
 * It argued that GET was right because the run "has no side effect a reader can
 * observe (the run cache is an implementation detail)". That is not what the
 * code does: `runSimulation()` INSERTs a row into `simulation_runs` for every
 * distinct combination of slider positions — a JSONB blob averaging 1.4 kB — so
 * a GET writes. Three things follow, and all three have already been seen.
 * A write pins the request to Neon's primary, defeating the read routing the
 * rest of this file protects; it is why production once answered
 * `cannot execute INSERT in a read-only transaction`; and with sign-in
 * unverified it is an endpoint that mints rows on demand for anybody.
 *
 * The linkability argument for GET still holds — a result worth arguing about
 * is a result worth linking to — so the shape is GET for reading and POST for
 * the write, not GET replaced.
 *
 * WHAT IS DONE HERE AND WHAT IS NOT
 *
 * POST is registered and is honest: a request that may write is declared as
 * one. The GET still writes, because the INSERT lives inside `runSimulation()`
 * in repositories/simulations.js and the split has to happen there — the
 * function needs to take a `persist` option (or the cache needs to stop being a
 * table), with the GET passing false and answering from cache alone. Until that
 * lands, the rate limiter in front of /api is what bounds the rows.
 *
 * Slider values arrive as query parameters — or, on the POST, as a JSON body —
 * and are checked against the bounds in `simulation_inputs`: out of range is a
 * 400, never a silent clamp.
 */
const runScenarioRoute = route(async (req, res) => {
  const { country = 'USA', ...inputs } = { ...req.query, ...(req.body ?? {}) };

  const result = await runSimulation(req.params.slug, country, inputs);
  if (!result) return res.status(404).json({ error: `No scenario "${req.params.slug}"` });
  if (result.error) return res.status(result.status ?? 400).json({ error: result.error });

  return res.json(result);
});

app.get('/api/simulations/:slug/run', runScenarioRoute);
app.post('/api/simulations/:slug/run', fromOurOwnPages, runScenarioRoute);

/**
 * The measured data beside the projection — real series, real deals.
 *
 * Separate from `/run` because it does not change when a slider moves, and
 * refetching decades of observations on every drag would make the one genuinely
 * cheap thing on the page expensive.
 */
app.get('/api/simulations/:slug/evidence', route(async (req, res) => {
  res.json(await scenarioEvidence(req.params.slug));
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

  /*
   * TWO STATEMENTS, WHATEVER THE CALLER ASKS FOR.
   *
   * This was a metadata SELECT and an observations SELECT per id, inside a
   * Promise.all — so a request for the maximum twelve series issued 24 round
   * trips where two do. Locally that is 91 ms and unremarkable. On Vercel every
   * statement is a separate trip to Neon's pooler and the function is billed for
   * the waiting, and the count scales with the number of charts on a question
   * page rather than with the amount of data anybody asked for.
   *
   * The pairs are deduplicated first: a page may legitimately ask for the same
   * indicator twice under different countries, but asking for the identical
   * pair twice should not fetch its history twice.
   */
  const { rows: metaRows } = await query(
    `SELECT id, name, unit, unit_symbol, decimals, cadence, quantity_kind,
            source_url, confidence_tier, default_country_iso3
       FROM indicators WHERE id = ANY($1::text[]) AND is_active`,
    [[...new Set(ids)]]
  );
  const metaById = new Map(metaRows.map((row) => [row.id, row]));

  /*
   * The country each position is actually asking for: the positional
   * `countries` parameter, falling back to the indicator's own default, and
   * null meaning "every country this indicator holds" — which is what the
   * single-series form meant by a null parameter and must keep meaning.
   */
  const requested = ids.map((id, i) => ({
    id,
    country: countries[i] || null,
    effective: countries[i] || metaById.get(id)?.default_country_iso3 || null,
  }));

  const wanted = new Map();
  for (const { id, effective } of requested) {
    if (!metaById.has(id)) continue;
    wanted.set(`${id}\u0000${effective ?? ''}`, { id, effective });
  }
  const pairs = [...wanted.values()];

  /*
   * `value_status` rides along per point because a forecast drawn like a
   * measurement is the failure this site's first rule exists to prevent.
   * AMECO's later years are the European Commission's own projection — real
   * numbers, but not observations — and seed 029 marks them 'projected'.
   * Sending only date and value left the chart no way to tell the two
   * apart, so it drew them identically.
   *
   * `unnest(…) WITH ORDINALITY` carries the pair's slot number through the
   * join, so the rows come back already labelled with which series they belong
   * to and the grouping below is a bucket fill rather than a match.
   *
   * THE `o.id` TIEBREAKER IN THE ORDER BY IS NOT DECORATION. Asking for a
   * country-dimensioned indicator with no country returns every country's rows
   * interleaved, several sharing each date, and ordering on period_start alone
   * leaves their sequence up to whichever plan the database picks — so the same
   * request could answer with the same points in a different order from one day
   * to the next. The primary key is unique, so adding it makes the response
   * stable without changing anything that is in it. (Kept out here rather than
   * inside the template literal: a backtick in a comment inside one ends the
   * string, which is how this file once shipped unparseable.)
   */
  const points = new Map(pairs.map((_pair, slot) => [slot + 1, []]));
  if (pairs.length > 0) {
    const { rows } = await query(
      `SELECT w.slot, o.period_start::text AS date, o.value, o.value_status
         FROM unnest($1::text[], $2::text[]) WITH ORDINALITY AS w(indicator_id, country, slot)
         JOIN observations o
           ON o.indicator_id = w.indicator_id
          AND (w.country IS NULL OR o.country_iso3 = w.country::char(3))
        ORDER BY w.slot, o.period_start, o.id`,
      [pairs.map((p) => p.id), pairs.map((p) => p.effective)]
    );
    for (const row of rows) {
      points.get(Number(row.slot)).push({
        date: row.date,
        value: row.value,
        value_status: row.value_status,
      });
    }
  }

  const slotOf = new Map(pairs.map((pair, i) => [`${pair.id}\u0000${pair.effective ?? ''}`, i + 1]));
  const series = requested.map(({ id, country, effective }) => {
    const meta = metaById.get(id);
    if (!meta) return { id, error: 'not found', points: [] };
    return { id, meta, country, points: points.get(slotOf.get(`${id}\u0000${effective ?? ''}`)) };
  });

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
 * and regulation from that month. Reads `documents`, indexed on published_at,
 * and `events`, which holds the financing deals.
 *
 * NO ROW COUNTS IN THIS COMMENT, DELIBERATELY.
 *
 * It used to give a row count for documents and describe events as "currently
 * empty, awaiting extraction". Both were true when they were written; documents
 * has since grown by an order of magnitude and the financing deals shipped. A
 * figure written into a comment cannot be gated, nothing fails when it drifts,
 * and the next person reads it as fact — this one told them a feature had not
 * been built, four days after it went live.
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
              /* event_sources was counted here and holds zero rows, written by
                 nothing, so every event reported a source_count of 0 — which a
                 reader would take to mean no evidence exists. The evidence is
                 in event_citations, one row per checked URL, and 0020's trigger
                 makes it impossible to store an event without at least one.
                 Counting the table that holds the rows. */
              (SELECT count(*)::int FROM event_citations ec WHERE ec.event_id = e.id)
                AS citation_count
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
 * it returns one row per active indicator and that text would be repeated on
 * most of them. A detail page is the one place a reader is asking where a
 * number came from and on what terms it may be reused, so the source join
 * lives here.
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

/**
 * Which countries an indicator holds data for — populates the dropdown.
 *
 * ORDERED BY lower(name), NOT BY name.
 *
 * A bare text ORDER BY resolves through the DATABASE's collation, and this
 * project has now run on two with different ones: Render was en_US.UTF8, Neon
 * is C.UTF-8. Under C it is byte order, so an all-caps name sorts ahead of a
 * Title Case one and the same query returns a different order on the two hosts
 * from identical data. lower() is deterministic on any Postgres, which pinning
 * a named collation would not be.
 *
 * This is the only reader-facing text ordering left in the API. Everything
 * else orders by a count, a date or an id: /api/indicators is pillar then
 * count then id, the source register is row count with name only as a
 * tiebreaker, and /data sorts in the browser.
 *
 * NOTE FOR ANYONE ADDING A COMMENT TO A QUERY BELOW: put it here, outside the
 * template literal. A comment placed inside one that uses backticks to quote
 * an identifier terminates the string, and the file stops parsing — which is
 * exactly how this endpoint shipped broken once.
 */
app.get('/api/indicators/:id/countries', route(async (req, res) => {
  const { rows } = await query(
    `SELECT o.country_iso3, c.name, count(*)::int AS n
       FROM observations o
       JOIN countries c ON c.iso3 = o.country_iso3
      WHERE o.indicator_id = $1 AND o.country_iso3 IS NOT NULL
      GROUP BY o.country_iso3, c.name
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
 *
 * THE TWO BODY-PARSER FAILURES ARE ANSWERED BEFORE THAT.
 *
 * `express.json` throws before any route runs, so a malformed or oversized body
 * fell straight through to the 500 above: a reader whose sign-in failed was
 * told "Internal error" about a request their own client had got wrong, with
 * nothing they could act on. Worse, each one wrote a `[http] …` line to the
 * function log, so an anonymous caller controlled log volume — a cost lever, in
 * a process that until now had no rate limit in front of it either.
 *
 * Neither is a server fault, so neither is logged at error level and neither
 * reports 500. They are the caller being told precisely what was wrong.
 *
 * AND THE 500 NOW LEAVES A TRACE THAT OUTLIVES THE LOG WINDOW.
 *
 * `console.error` writes into Vercel's function log, which is retained for a
 * while and read by nobody. A real production 500 — `cannot execute INSERT in a
 * read-only transaction`, from runSimulation — was noticed once, in passing, by
 * somebody auditing something else, and nothing followed it up because there
 * was nowhere for it to land. Meanwhile the daily smoke run stayed green.
 *
 * `reportServerError` is the cheapest honest fix: route, message and commit to
 * a GitHub issue or a webhook. Three properties make it safe to call from
 * here, and all three are asserted in lib/observability.test.js:
 *
 *   - IT NEVER THROWS AND NEVER REJECTS. An error sink that throws inside an
 *     error handler takes the process down, which is worse than the silence.
 *   - IT RETURNS `null`, SYNCHRONOUSLY, WHEN THERE IS NOTHING TO DO — no sink
 *     configured, or this fault already reported. That is the path taken on
 *     every request during an outage after the first few, so the reader's 500
 *     is answered at exactly the speed it was before.
 *   - IT CARRIES NO SECRET, NO SESSION COOKIE AND NO READER'S EMAIL. Headers,
 *     bodies and `error.detail` are never read.
 *
 * The await is deliberate and is the one cost. Fire-and-forget works on a
 * long-lived host and silently does not on Vercel: the invocation ends when the
 * response does and the instance freezes, killing a fetch that was never
 * awaited. Delivery is capped at 1.5s inside the module, and paid only on the
 * handful of 500s that actually get reported.
 *
 * AND THE AWAIT IS WHY THE `headersSent` GUARD BELOW IS NOT OPTIONAL.
 *
 * An error can reach here after the response has already started — a handler
 * that answers and then fails on the next tick, a stream that dies mid-body.
 * `res.status()` throws `ERR_HTTP_HEADERS_SENT` at that point, and WHERE it
 * throws decides whether this process lives:
 *
 *   - Thrown synchronously (the no-sink path), Express catches it, hands the
 *     half-written response to its own final handler, and the process lives.
 *     Measured: the request 500s, a stack is logged, the server carries on.
 *   - Thrown inside `.then()` (the path taken the moment a sink is configured),
 *     nothing is listening. It becomes an unhandled rejection, and Node 24 —
 *     which is what `engines` pins and what Vercel runs — exits the process on
 *     one of those by default. Measured the same way: exit code, dead server.
 *
 * So without this guard, configuring `ERROR_SINK_URL` would ship the sink and a
 * process-killing crash together, and the crash would arrive at exactly the
 * moment something was already going wrong. That is the failure the sink exists
 * to prevent, caused by the sink.
 */
app.use((error, req, res, next) => {
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Malformed JSON' });
  }

  console.error('[http]', error);

  if (res.headersSent) {
    /*
     * The status line has gone; this reader cannot be told anything more. The
     * fault is still real, so it is still reported — but NOT awaited, because
     * there is no response left to delay and `reportServerError` has no
     * rejection state, so an unawaited promise here cannot become an unhandled
     * one. On Vercel that report may not survive the invocation ending. Stated
     * rather than hidden: a half-written response is the one case where this
     * sink is best-effort.
     */
    reportServerError({ error, method: req.method, path: req.path });
    // Express's own final handler is the only thing that closes a response
    // that has already started without throwing on the way.
    return next(error);
  }

  const body = { error: config.env === 'production' ? 'Internal error' : error.message };
  /*
   * Total, because it runs after an await: between the guard above and here,
   * the socket may have gone. A throw at this point has no caller left to catch
   * it — see the note above about which of these two shapes kills the process.
   */
  const send = () => {
    try {
      res.status(500).json(body);
    } catch {
      res.destroy?.();
    }
  };

  const reported = reportServerError({ error, method: req.method, path: req.path });
  if (!reported) return send();
  // `reported` has no rejection state, but both arms stay: an unhandled
  // rejection in an error handler is the failure this whole block is about.
  return reported.then(send, send);
});

export { app };
export default app;

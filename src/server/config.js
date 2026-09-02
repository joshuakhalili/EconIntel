/**
 * Configuration — read the environment once, validate it, freeze it.
 *
 * Scattering `process.env.X` through the codebase means a typo produces
 * `undefined` at some random later moment instead of a clear failure at
 * startup. Centralising it means a missing required variable stops the process
 * immediately with a message that says what to do about it.
 */

import 'dotenv/config';

/** @param {string} name @param {string} [fallback] */
function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    // The remedy differs by environment and the wrong one wastes real time:
    // there is no .env file on a hosted service to copy anything into.
    const remedy =
      (process.env.NODE_ENV ?? 'development') === 'production'
        ? `Set it on the deployment. Vercel: Project → Settings → Environment Variables, ` +
          `then redeploy — Vercel bakes them in at build time, so changing one does ` +
          `nothing until a new deployment exists. GitHub Actions: Settings → ` +
          `Secrets and variables → Actions.`
        : `Copy .env.example to .env and fill it in.`;
    throw new Error(`Missing required environment variable ${name}. ${remedy}`);
  }
  return value;
}

/** @param {string} name @param {number} fallback */
function numeric(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got "${raw}"`);
  }
  return parsed;
}

const env = process.env.NODE_ENV ?? 'development';

/**
 * The database URL falls back to a local development instance, but ONLY
 * outside production.
 *
 * This used to fall back unconditionally, which is the worst possible
 * behaviour on a hosted service: forget to set DATABASE_URL on Render and the
 * process starts cleanly, reports itself healthy, and then fails every single
 * request against a localhost database that does not exist. A config error
 * should look like a config error at startup, not like a database outage an
 * hour later.
 *
 * The credentials below MUST match the ones .env.example tells you to create
 * (`createuser econintel` / `createdb econintel`, lines 12-14). They did not:
 * this said `diffusion:diffusion_dev@…/diffusion` while the setup instructions
 * said `econintel`, and a comment claimed the pair came "from the README" —
 * which documents no database at all. So the fallback pointed at a database
 * nobody had been told to create, and the one path it exists to serve (a fresh
 * clone with no .env yet) was the one path it could not serve.
 *
 * They are deliberately the only secret-shaped string in the repository, and
 * they unlock nothing that is not already on your own machine.
 *
 * When the repo is renamed to Diffusion, this and .env.example change together.
 */
const LOCAL_DEV_DATABASE = 'postgres://econintel:econintel_dev@localhost:5432/econintel';

export const config = Object.freeze({
  env,
  port: numeric('PORT', 3000),

  databaseUrl: required(
    'DATABASE_URL',
    env === 'production' ? undefined : LOCAL_DEV_DATABASE
  ),
  dbPoolMax: numeric('DB_POOL_MAX', 10),
  /*
   * How long a single statement may run before Postgres cancels it.
   *
   * Must sit BELOW the host's request ceiling wherever one exists. A Vercel
   * function is killed at 10s; a 30s statement_timeout there means the caller
   * gets a 504 while the query carries on holding a database connection that
   * nobody is waiting for. Set 8000 on the web deployment. Ingestion keeps the
   * default — it legitimately runs long statements and has no such ceiling.
   */
  dbStatementTimeoutMs: numeric('DB_STATEMENT_TIMEOUT_MS', 30_000),
  slowQueryMs: numeric('SLOW_QUERY_MS', 500),

  /**
   * Optional API keys. Absent keys disable their ingestion job rather than
   * crashing the server — the dashboard must still start and serve whatever
   * data it already has. A dashboard that refuses to boot because one optional
   * upstream is unconfigured is a fragile dashboard.
   */
  keys: Object.freeze({
    fred: process.env.FRED_API_KEY ?? null,
    census: process.env.CENSUS_API_KEY ?? null,
    ember: process.env.EMBER_API_KEY ?? null,
    eia: process.env.EIA_API_KEY ?? null,
    bls: process.env.BLS_API_KEY ?? null,
    openai: process.env.OPENAI_API_KEY ?? null,
    anthropic: process.env.ANTHROPIC_API_KEY ?? null,
    cloudflare: process.env.CLOUDFLARE_API_TOKEN ?? null,
    copernicus: process.env.COPERNICUS_TOKEN ?? null,
  }),

  /**
   * Cloudflare Workers AI — the LLM this project actually runs on.
   *
   * Chosen over OpenAI and Anthropic for one reason: the free tier is 10,000
   * neurons a day with no card on file, which is enough for the extraction
   * work (findings from papers, events from filings) to fill in steadily.
   * The account id is not a secret — it appears in every dashboard URL — but
   * it lives here rather than in `keys` so nothing treats it as one.
   */
  /**
   * Sign-in. Absent in development until a GitHub OAuth app is registered, in
   * which case the API stays open rather than locking everyone out of a
   * dashboard nobody can sign in to.
   *
   * SESSION_SECRET signs the session cookie. Rotating it signs everyone out,
   * which is the only revocation mechanism there is — see lib/auth.js.
   */
  auth: Object.freeze({
    githubClientId: process.env.GITHUB_CLIENT_ID ?? null,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? null,
    sessionSecret: process.env.SESSION_SECRET ?? null,
    callbackUrl: process.env.OAUTH_CALLBACK_URL ?? null,
    // Origins allowed to send credentialed requests. Open CORS plus a session
    // cookie is how a read-only API becomes a CSRF hole, which STATUS.md has
    // warned about since before there was any auth to make it real.
    allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  }),

  cloudflare: Object.freeze({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? null,
    model: process.env.CLOUDFLARE_AI_MODEL ?? '@cf/meta/llama-3.1-8b-instruct',
  }),

  /**
   * The SEC requires a descriptive User-Agent containing contact details on
   * every request and blocks traffic without one. This is their stated policy,
   * not a nicety. See https://www.sec.gov/os/webmaster-faq#developers
   */
  secUserAgent: process.env.SEC_USER_AGENT ?? null,

  /**
   * When true, HTTP adapters read recorded fixtures instead of making network
   * calls. Set automatically in test, and useful in restricted-network
   * environments where outbound access to data providers is blocked.
   */
  useFixtures:
    process.env.USE_FIXTURES === 'true' || process.env.NODE_ENV === 'test',
});

/**
 * Report which optional integrations are configured. Called at startup so the
 * operator can see at a glance what will and will not run, instead of
 * discovering it from an empty chart hours later.
 */
export function describeIntegrations() {
  return [
    { name: 'FRED',        ready: Boolean(config.keys.fred),    note: 'free key: fredaccount.stlouisfed.org/apikeys' },
    { name: 'World Bank',  ready: true,                         note: 'no key required' },
    { name: 'DBnomics',    ready: true,                         note: 'no key required (mirrors FRED/OECD/IMF/BLS/Eurostat)' },
    { name: 'SEC',         ready: Boolean(config.secUserAgent), note: 'no key; SEC_USER_AGENT="Name contact@email" is mandatory' },
    { name: 'Epoch AI',    ready: true,                         note: 'no key; CC BY 4.0; fetched live, never cached to disk' },
    { name: 'Fed Register',ready: true,                         note: 'no key required' },
    { name: 'Census BTOS', ready: Boolean(config.keys.census),  note: 'free key: api.census.gov/data/key_signup.html — AI adoption rates' },
    { name: 'Ember',       ready: Boolean(config.keys.ember),   note: 'free key: api.ember-energy.org — electricity, CC BY 4.0' },
    { name: 'EIA',         ready: Boolean(config.keys.eia),     note: 'free key: eia.gov/opendata — US grid demand' },
    { name: 'BLS',         ready: Boolean(config.keys.bls),     note: 'free key: data.bls.gov/registrationEngine — 500 req/day' },
    { name: 'Copernicus',  ready: Boolean(config.keys.copernicus), note: 'satellite imagery, phase 3' },
    { name: 'Workers AI',  ready: Boolean(config.keys.cloudflare && config.cloudflare.accountId),
                                                                 note: `free: 10k neurons/day, no card — ${config.cloudflare.model}` },
    { name: 'LLM (paid)',  ready: Boolean(config.keys.openai || config.keys.anthropic), note: 'optional fallback; not required' },
  ];
}

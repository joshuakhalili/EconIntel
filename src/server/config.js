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
        ? `Set it in the service's environment settings (Render: Dashboard → the service → Environment).`
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
 * The credentials below are the documented local dev pair from the README.
 * They are deliberately the only secret-shaped string in the repository, and
 * they unlock nothing that is not already on your own machine.
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

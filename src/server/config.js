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
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy .env.example to .env and fill it in.`
    );
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

export const config = Object.freeze({
  env: process.env.NODE_ENV ?? 'development',
  port: numeric('PORT', 3000),

  databaseUrl: required(
    'DATABASE_URL',
    'postgres://econintel:econintel_dev@localhost:5432/econintel'
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
    openai: process.env.OPENAI_API_KEY ?? null,
    anthropic: process.env.ANTHROPIC_API_KEY ?? null,
    copernicus: process.env.COPERNICUS_TOKEN ?? null,
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
    { name: 'FRED',       ready: Boolean(config.keys.fred),   note: 'free key: fredaccount.stlouisfed.org/apikeys' },
    { name: 'World Bank', ready: true,                        note: 'no key required' },
    { name: 'DBnomics',   ready: true,                        note: 'no key required (aggregates FRED/OECD/IMF/BLS)' },
    { name: 'SEC EDGAR',  ready: Boolean(config.secUserAgent),note: 'set SEC_USER_AGENT to "Name contact@email"' },
    { name: 'Copernicus', ready: Boolean(config.keys.copernicus), note: 'satellite imagery, phase 3' },
    { name: 'LLM',        ready: Boolean(config.keys.openai || config.keys.anthropic), note: 'narration layer' },
  ];
}

/**
 * Postgres connection pool — the single place the app talks to the database.
 *
 * One shared pool per process. Creating a pool per request is the classic
 * mistake: it exhausts Postgres's connection slots under load and pays TCP +
 * TLS + auth setup on every query.
 *
 * TWO DRIVERS, CHOSEN FROM THE CONNECTION STRING
 *
 * A long-lived Express process and a serverless function want different
 * things from a database client, and the difference is not tuning — it is a
 * different transport.
 *
 * A long-lived process opens a TCP connection, authenticates once, and reuses
 * it for hours. That is what `pg` is for and it is the right thing on a normal
 * host. A serverless function is a fresh process per request that may live for
 * 300 ms, so it pays TCP + TLS + Postgres auth — several round trips before a
 * single query runs — and then throws the connection away. Neon's driver
 * exists to collapse that, talking to their pooler over a WebSocket.
 *
 * So the driver follows the host it is pointed at: a `.neon.tech` URL gets
 * `@neondatabase/serverless`, anything else gets `pg`. Detection is from the
 * URL rather than from NODE_ENV because the deciding fact is which database
 * this is, not which mode we think we are in — and running the production
 * database from a laptop for a migration must not silently change transport.
 * `DB_DRIVER=pg|neon` overrides it when that inference is wrong.
 *
 * Both drivers expose the same `Pool`, the same `query`, and the same
 * `connect`/`release`, so nothing downstream of this file knows which is in
 * use. That is the whole reason the swap is safe.
 */

import pgDriver from 'pg';
import * as neonDriver from '@neondatabase/serverless';
import { config } from '../config.js';

/**
 * Which driver, and why.
 *
 * Parsed rather than string-matched: `includes('.neon.tech')` would also match
 * a password that happened to contain it, and a password is the one part of a
 * connection string an attacker-adjacent process might influence.
 */
function chooseDriver(connectionString, override) {
  if (override === 'pg') return { driver: pgDriver, name: 'pg', reason: 'DB_DRIVER=pg' };
  if (override === 'neon') return { driver: neonDriver, name: 'neon', reason: 'DB_DRIVER=neon' };

  let host = '';
  try {
    host = new URL(connectionString).hostname;
  } catch {
    // Not a URL we can parse — a libpq keyword string, say. Default to pg,
    // which is the driver that has always worked here.
    return { driver: pgDriver, name: 'pg', reason: 'unparseable connection string' };
  }

  return host.endsWith('.neon.tech')
    ? { driver: neonDriver, name: 'neon', reason: `host ${host}` }
    : { driver: pgDriver, name: 'pg', reason: `host ${host}` };
}

const chosen = chooseDriver(config.databaseUrl, process.env.DB_DRIVER);
export const driverName = chosen.name;

const { Pool, types } = chosen.driver;

/**
 * Postgres NUMERIC arrives as a string by default, because it has arbitrary
 * precision and JavaScript's Number cannot represent all of it faithfully.
 *
 * We override that to parse into Number, which is the right trade for THIS
 * application: our values are economic indicators, comfortably inside the
 * ~15 significant digits a double gives you, and every consumer (charts, JSON
 * responses, arithmetic in the metrics layer) wants numbers rather than
 * strings. Silent string-vs-number bugs across that boundary are far more
 * likely than a precision loss at these magnitudes.
 *
 * This trade would be wrong in a financial ledger. It is right here. Anything
 * requiring exact decimal arithmetic must be computed in SQL, not JS.
 *
 * APPLIED TO THE CHOSEN DRIVER, NOT TO `pg`
 *
 * These parsers are global to a driver's type registry, and the Neon package
 * bundles its OWN copy of pg-types. Calling `pg.types.setTypeParser` while
 * running on Neon would register the parser on a registry nothing reads, and
 * every NUMERIC would silently arrive as a string — `"4.2" * 2` is `8.4` in
 * JavaScript but `"4.2" + 2` is `"4.22"`, so the failure would surface as
 * plausible wrong numbers on charts rather than as an error.
 */
types.setTypeParser(types.builtins.NUMERIC, (value) =>
  value === null ? null : Number.parseFloat(value)
);

/**
 * DATE columns should stay calendar dates, not be shifted into the process's
 * local timezone. Postgres returns 'YYYY-MM-DD'; node-pg would otherwise
 * construct a Date at local midnight, which silently becomes the previous day
 * for anyone west of UTC. Economic periods are calendar facts — keep them text.
 */
types.setTypeParser(types.builtins.DATE, (value) => value);

export const pool = new Pool({
  connectionString: config.databaseUrl,
  /*
   * On a long-lived host this is a per-process ceiling and 10 is generous.
   * On serverless it is a ceiling PER CONCURRENT INVOCATION — every function
   * instance is its own process with its own pool — so the real number is
   * 10 × instances, which reaches a Neon connection limit fast. Set
   * DB_POOL_MAX=1 there and let the pooler do the pooling.
   */
  max: config.dbPoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  /*
   * Fail a runaway query rather than letting it pin a connection indefinitely.
   *
   * 30s is right for ingestion, which legitimately runs long statements. It is
   * WRONG behind a serverless function with a 10s ceiling: the function is
   * killed at 10s while the statement keeps running on the database, holding a
   * connection nobody is waiting for any more. Set DB_STATEMENT_TIMEOUT_MS
   * below the function limit on the web deployment (8000), and leave ingestion
   * alone.
   */
  statement_timeout: config.dbStatementTimeoutMs,
});

pool.on('error', (err) => {
  // Idle clients can be terminated by the server (restart, admin action).
  // Log rather than crash: the pool replaces the client transparently.
  console.error('[db] idle client error', err.message);
});

/**
 * Run a query. Logs slow queries so performance problems surface during
 * development rather than in production.
 *
 * @param {string} text  parameterised SQL — never interpolate user input
 * @param {unknown[]} params
 */
export async function query(text, params) {
  const startedAt = performance.now();
  const result = await pool.query(text, params);
  const elapsedMs = performance.now() - startedAt;

  if (elapsedMs > config.slowQueryMs) {
    console.warn(
      `[db] slow query ${elapsedMs.toFixed(0)}ms: ${text.trim().slice(0, 120)}`
    );
  }
  return result;
}

/**
 * Run a function inside a transaction, committing on success and rolling back
 * on any throw. Ingestion jobs use this so a partial failure never leaves the
 * database holding half a batch.
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // Always release, or the pool leaks a connection per failed transaction.
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}

/**
 * Postgres connection pool — the single place the app talks to the database.
 *
 * One shared pool per process. Creating a pool per request is the classic
 * mistake: it exhausts Postgres's connection slots under load and pays TCP +
 * TLS + auth setup on every query.
 */

import pg from 'pg';
import { config } from '../config.js';

const { Pool, types } = pg;

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
  max: config.dbPoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Fail a runaway query rather than letting it pin a connection indefinitely.
  statement_timeout: 30_000,
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
 * @param {(client: pg.PoolClient) => Promise<T>} fn
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

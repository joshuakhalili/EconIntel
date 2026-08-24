/**
 * Migration runner.
 *
 * Plain SQL files applied in filename order, each inside a transaction, each
 * recorded in `schema_migrations` so it runs exactly once.
 *
 * Why hand-rolled rather than a migration framework: the whole thing is ~80
 * lines, it has no opinions to fight, and the migrations stay as readable SQL
 * that a reviewer can audit without learning a DSL. A framework earns its place
 * when you need branching, squashing, or multi-environment drift detection —
 * none of which apply here.
 *
 * Usage:  node src/server/db/migrate.js         (apply pending)
 *         node src/server/db/migrate.js status  (list without applying)
 */

import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { pool, withTransaction, closePool } from './pool.js';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../../db/migrations', import.meta.url));

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      checksum    TEXT NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function loadMigrationFiles() {
  const entries = await readdir(MIGRATIONS_DIR);
  const files = entries.filter((f) => f.endsWith('.sql')).sort();

  return Promise.all(
    files.map(async (filename) => {
      const sql = await readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
      return {
        filename,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex').slice(0, 16),
      };
    })
  );
}

async function getApplied() {
  const { rows } = await pool.query(
    'SELECT filename, checksum FROM schema_migrations'
  );
  return new Map(rows.map((r) => [r.filename, r.checksum]));
}

export async function migrate({ dryRun = false } = {}) {
  await ensureMigrationsTable();

  const migrations = await loadMigrationFiles();
  const applied = await getApplied();

  const pending = [];

  for (const migration of migrations) {
    const appliedChecksum = applied.get(migration.filename);

    if (appliedChecksum === undefined) {
      pending.push(migration);
      continue;
    }

    // An already-applied file whose contents changed means someone edited
    // history. Refuse loudly: applying it again could fail or, worse, succeed
    // and leave two environments with silently different schemas.
    if (appliedChecksum !== migration.checksum) {
      throw new Error(
        `Migration ${migration.filename} was modified after being applied ` +
          `(recorded ${appliedChecksum}, now ${migration.checksum}). ` +
          `Never edit an applied migration — add a new one instead.`
      );
    }
  }

  if (dryRun) {
    console.log(`applied: ${applied.size}, pending: ${pending.length}`);
    for (const m of pending) console.log(`  pending  ${m.filename}`);
    return { applied: applied.size, pending: pending.map((m) => m.filename) };
  }

  if (pending.length === 0) {
    console.log('Database is up to date.');
    return { applied: applied.size, pending: [] };
  }

  for (const migration of pending) {
    const startedAt = performance.now();

    // One transaction per migration: a failing file leaves no partial schema,
    // and the migrations already applied before it stay applied.
    await withTransaction(async (client) => {
      await client.query(migration.sql);
      await client.query(
        'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
        [migration.filename, migration.checksum]
      );
    });

    const ms = (performance.now() - startedAt).toFixed(0);
    console.log(`  applied  ${migration.filename}  (${ms}ms)`);
  }

  console.log(`\nApplied ${pending.length} migration(s).`);
  return { applied: applied.size + pending.length, pending: [] };
}

// Run directly (node src/server/db/migrate.js) rather than when imported.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dryRun = process.argv[2] === 'status';
  try {
    await migrate({ dryRun });
  } catch (error) {
    console.error(`\nMigration failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

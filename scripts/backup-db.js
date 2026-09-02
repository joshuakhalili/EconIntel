/**
 * Dump every table to a plain-SQL file you can restore from.
 *
 * WHY THIS EXISTS RATHER THAN `pg_dump`
 *
 * pg_dump is not installed on this machine and pulling in a Postgres client
 * install to take one backup is a bad trade. This uses the `pg` driver the
 * project already depends on, so it runs anywhere `npm ci` has run — including
 * a CI job, which is where a backup most wants to run.
 *
 * The cost, stated plainly so nobody mistakes this for pg_dump: this dumps DATA
 * and nothing else. No schema, no indexes, no constraints, no views, no
 * sequences, no extensions. Restoring means running the migrations first to
 * build an empty schema, then loading this. That is exactly how this project
 * already builds a database (`npm run db:migrate`), so it is not a gap — but it
 * does mean this file alone is not a database. The migrations in db/migrations
 * are the other half, and they are in git.
 *
 * Usage:
 *   node scripts/backup-db.js                        # DATABASE_URL, to ./backups
 *   node scripts/backup-db.js --out ~/Desktop/x.sql
 *   node scripts/backup-db.js --url "postgres://..." # a different database
 */

import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};

const url = flag('--url') ?? process.env.DATABASE_URL;
if (!url) {
  console.error('No database. Pass --url or set DATABASE_URL.');
  process.exit(1);
}

/*
 * Timestamp comes from the process, not from the caller, so two backups taken
 * in the same minute cannot silently overwrite each other.
 */
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const out = flag('--out') ?? `backups/diffusion-${stamp}.sql`;

/*
 * NO TYPE PARSERS ARE INSTALLED HERE, DELIBERATELY.
 *
 * The app installs parsers that turn NUMERIC into a JS number and leave DATE as
 * a string. Both are right for rendering a chart and wrong for a backup: a
 * float64 cannot hold every NUMERIC exactly, so round-tripping a value through
 * one is lossy. Reading everything as the string Postgres sent means what gets
 * written is what was stored.
 */
const pool = new pg.Pool({ connectionString: url, max: 2 });

/** Quote a value the way Postgres will read back as the same value. */
function literal(value) {
  if (value === null) return 'NULL';
  if (Array.isArray(value)) {
    // node-postgres hands array columns back already parsed; rebuild the
    // Postgres array literal rather than letting JSON.stringify invent one.
    return `'{${value.map((v) => (v === null ? 'NULL' : `"${String(v).replace(/(["\\])/g, '\\$1')}"`)).join(',')}}'`;
  }
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `'${String(value).replace(/'/g, "''")}'`;
}

const started = Date.now();
const host = new URL(url).host;
console.log(`Backing up ${host}`);

const { rows: tables } = await pool.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`);

const lines = [
  `-- Diffusion data backup`,
  `-- ${new Date().toISOString()}  from ${host}`,
  `-- DATA ONLY. Run 'npm run db:migrate' to build the schema before loading this.`,
  ``,
  `BEGIN;`,
  ``,
];

let total = 0;
const counts = [];

for (const { table_name: table } of tables) {
  const { rows } = await pool.query(`SELECT * FROM "${table}"`);
  counts.push({ table, rows: rows.length });
  total += rows.length;
  if (rows.length === 0) {
    lines.push(`-- ${table}: empty`, ``);
    continue;
  }

  const cols = Object.keys(rows[0]);
  lines.push(`-- ${table}: ${rows.length} rows`);
  /*
   * One multi-row INSERT per 500 rows. One statement per row makes a 76,000-row
   * restore take minutes; one statement for everything overflows the parser on
   * the larger tables.
   */
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values = chunk
      .map((r) => `  (${cols.map((c) => literal(r[c])).join(', ')})`)
      .join(',\n');
    lines.push(
      `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES`,
      `${values};`
    );
  }
  lines.push(``);
}

/*
 * Sequences are restored explicitly. Without this a restored database hands out
 * primary keys that already exist, and the first insert after a restore fails
 * on a duplicate key — the classic way a restore looks successful and is not.
 */
const { rows: seqs } = await pool.query(`
  SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
`);
if (seqs.length) {
  lines.push(`-- sequences`);
  for (const { sequence_name: seq } of seqs) {
    const { rows } = await pool.query(`SELECT last_value, is_called FROM "${seq}"`);
    lines.push(`SELECT setval('"${seq}"', ${rows[0].last_value}, ${rows[0].is_called});`);
  }
  lines.push(``);
}

lines.push(`COMMIT;`, ``);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, lines.join('\n'));

console.table(counts.filter((c) => c.rows > 0));
console.log(
  `\n${tables.length} tables, ${total.toLocaleString()} rows, ` +
    `${seqs.length} sequences -> ${out} (${(lines.join('\n').length / 1e6).toFixed(1)} MB) ` +
    `in ${((Date.now() - started) / 1000).toFixed(1)}s`
);

await pool.end();

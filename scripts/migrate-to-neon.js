/**
 * Copy the whole database from one Postgres to another.
 *
 * Written for the Render → Neon move on 2026-08-30, and kept because the same
 * job comes back every time this project changes host.
 *
 * WHY NOT pg_dump
 *
 * Because it is not on this machine, and installing Homebrew to get it is a
 * larger and less reversible change than this script. There is also a real
 * advantage to doing it this way: the schema arrives via the project's own
 * checksummed migrations, so the move proves the migrations run on the new
 * host rather than proving a dump file restores.
 *
 * THE SOURCE IS OPENED READ-ONLY, AND THAT IS NOT DECORATION
 *
 * At the moment this runs, the source is the ONLY copy of 74,041 observations
 * gathered over months. A `SET TRANSACTION READ ONLY` on the reading session
 * means a mistake in this file cannot damage it — the database refuses the
 * write rather than relying on the script not to attempt one.
 *
 * TYPE PARSERS ARE DELIBERATELY NOT APPLIED
 *
 * `db/pool.js` parses NUMERIC into a JavaScript number, which is the right
 * trade for an app drawing charts and the wrong one for a migration: it is
 * lossy at the far end of the range, and a migration that silently rounds is
 * worse than one that fails. This opens its own clients with the default
 * parsers, so every value round-trips as the string Postgres emitted.
 *
 * TABLES ARE ORDERED BY FOREIGN KEY, COMPUTED NOT GUESSED
 *
 * `observations` references `indicators`, which references `sources`. Getting
 * that order wrong fails loudly on the first insert, but hand-maintaining it
 * across 28 tables is how it drifts. It is derived from the catalogue below.
 *
 *     node scripts/migrate-to-neon.js --check    compare both, change nothing
 *     node scripts/migrate-to-neon.js --copy     copy, then compare
 */

import pg from 'pg';
import { readFileSync } from 'node:fs';

const GREEN = '[32m';
const RED = '[31m';
const YELLOW = '[33m';
const DIM = '[2m';
const RESET = '[0m';

const mode = process.argv.includes('--copy') ? 'copy' : 'check';
const BATCH = 1000;

const SOURCE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_URL = process.env.TARGET_DATABASE_URL;

if (!SOURCE_URL || !TARGET_URL) {
  console.error(
    `${RED}✗${RESET} SOURCE_DATABASE_URL and TARGET_DATABASE_URL must both be set.`
  );
  process.exit(2);
}
if (SOURCE_URL === TARGET_URL) {
  console.error(`${RED}✗${RESET} source and target are the same database.`);
  process.exit(2);
}

/** Plain clients: no `db/pool.js`, so no type parsers. See the header. */
const source = new pg.Client({ connectionString: SOURCE_URL });
const target = new pg.Client({ connectionString: TARGET_URL });

await source.connect();
await target.connect();

/* The source cannot be written to, whatever this script tries. */
await source.query('BEGIN');
await source.query('SET TRANSACTION READ ONLY');

const host = (url) => new URL(url).hostname;
console.log(`${DIM}from ${host(SOURCE_URL)}\n  to ${host(TARGET_URL)}${RESET}\n`);

/** Tables in an order that satisfies every foreign key. */
async function orderedTables(client) {
  const { rows: tables } = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const { rows: deps } = await client.query(
    `SELECT tc.table_name AS child, ccu.table_name AS parent
       FROM information_schema.table_constraints tc
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`
  );

  const names = tables.map((t) => t.tablename);
  const parents = new Map(names.map((n) => [n, new Set()]));
  for (const { child, parent } of deps) {
    // A self-reference cannot be satisfied by ordering and is handled by the
    // insert order within the table instead; ignore it here or nothing sorts.
    if (child !== parent && parents.has(child)) parents.get(child).add(parent);
  }

  const ordered = [];
  const placed = new Set();
  // Kahn's algorithm, but tolerant: a cycle would otherwise hang, so anything
  // still unplaced after a full pass is appended and allowed to fail loudly.
  while (ordered.length < names.length) {
    const ready = names.filter(
      (n) => !placed.has(n) && [...parents.get(n)].every((p) => placed.has(p))
    );
    if (ready.length === 0) {
      for (const n of names) if (!placed.has(n)) { ordered.push(n); placed.add(n); }
      break;
    }
    for (const n of ready) { ordered.push(n); placed.add(n); }
  }
  return ordered;
}

async function counts(client, tables) {
  const out = new Map();
  for (const table of tables) {
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM public."${table}"`);
    out.set(table, rows[0].n);
  }
  return out;
}

const tables = await orderedTables(source);

// ── Copy ─────────────────────────────────────────────────────────────────────
if (mode === 'copy') {
  /*
   * THE WHOLE COPY IS ONE TRANSACTION, and that is a correctness requirement
   * rather than tidiness.
   *
   * `events` carries a CONSTRAINT TRIGGER, DEFERRABLE INITIALLY DEFERRED,
   * enforcing migration 0020's rule that no event exists without a source.
   * Deferred means it fires at COMMIT — so inserting each table in its own
   * autocommitted statement checks `events` before `event_citations` has been
   * written and fails every time, correctly, on an event whose evidence is
   * three tables further down the ordering.
   *
   * Inside one transaction the check runs once, at the end, when the citations
   * are there. The side benefit is that a failure now leaves the target
   * completely untouched instead of half-populated.
   */
  await target.query('BEGIN');

  for (const table of tables) {
    /*
     * Generated and always-identity columns are EXCLUDED, because Postgres
     * refuses to be told what they contain: `documents.search_tsv` is a
     * generated tsvector and an insert naming it fails outright with
     * "cannot insert a non-DEFAULT value into column". They are derived from
     * columns that are being copied, so the target recomputes them itself and
     * nothing is lost.
     *
     * `is_identity = 'YES'` with `identity_generation = 'BY DEFAULT'` is NOT
     * excluded — that is an ordinary serial primary key whose value must
     * carry across, or every foreign key referencing it breaks.
     */
    const { rows: cols } = await source.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
          AND is_generated <> 'ALWAYS'
          AND coalesce(identity_generation, '') <> 'ALWAYS'
        ORDER BY ordinal_position`,
      [table]
    );
    const names = cols.map((c) => c.column_name);
    if (names.length === 0) continue;

    const quoted = names.map((n) => `"${n}"`).join(', ');
    const { rows } = await source.query(`SELECT ${quoted} FROM public."${table}"`);
    if (rows.length === 0) {
      console.log(`  ${DIM}—     ${table}${RESET}`);
      continue;
    }

    let written = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const values = [];
      const placeholders = batch.map((row, r) => {
        const slots = names.map((_, c) => `$${r * names.length + c + 1}`);
        values.push(...names.map((n) => row[n]));
        return `(${slots.join(', ')})`;
      });

      /*
       * ON CONFLICT DO NOTHING, so the script is safe to re-run after a
       * partial failure. It also means a row already present is LEFT ALONE
       * rather than overwritten — which is why the count comparison at the end
       * is the thing that decides success, not the number written here.
       */
      const result = await target.query(
        `INSERT INTO public."${table}" (${quoted}) VALUES ${placeholders.join(', ')}
         ON CONFLICT DO NOTHING`,
        values
      );
      written += result.rowCount;
    }
    const skipped = rows.length - written;
    console.log(
      `  ${GREEN}ok${RESET}    ${table.padEnd(24)} ${String(written).padStart(6)} written` +
        (skipped ? ` ${DIM}(${skipped} already present)${RESET}` : '')
    );
  }

  /*
   * Move every sequence past the ids that were just inserted.
   *
   * Rows arrive carrying their original primary keys, which does NOT advance
   * the sequence backing the column — so the target's `narrations_id_seq`
   * still says 1 while the table holds ids up to 8, and the very first row
   * written after the migration collides on the primary key.
   *
   * It fails immediately and loudly rather than corrupting anything, which is
   * the only reason this is a footnote and not a disaster. Still, a migration
   * that leaves the database unable to accept a single insert is not finished.
   */
  const { rows: sequences } = await target.query(
    `SELECT s.relname                                   AS sequence,
            t.relname                                   AS table,
            a.attname                                   AS column
       FROM pg_class s
       JOIN pg_depend d      ON d.objid = s.oid AND d.deptype = 'a'
       JOIN pg_class t       ON t.oid = d.refobjid
       JOIN pg_attribute a   ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
       JOIN pg_namespace n   ON n.oid = s.relnamespace
      WHERE s.relkind = 'S' AND n.nspname = 'public'`
  );

  let bumped = 0;
  for (const seq of sequences) {
    // `false` as the third argument: setval(seq, max) with is_called false
    // would hand out `max` itself again. coalesce covers an empty table.
    await target.query(
      `SELECT setval($1, coalesce((SELECT max("${seq.column}") FROM public."${seq.table}"), 0) + 1, false)`,
      [`public.${seq.sequence}`]
    );
    bumped += 1;
  }
  console.log(`\n  ${DIM}${bumped} sequence(s) advanced past the copied ids${RESET}`);

  /* Every deferred constraint is checked here. If the copy violated one,
     this throws and the entire transaction is discarded. */
  await target.query('COMMIT');
  console.log(`  ${DIM}committed — deferred constraints checked and satisfied${RESET}\n`);
}

// ── Compare ──────────────────────────────────────────────────────────────────
const before = await counts(source, tables);
const after = await counts(target, tables);

let mismatched = 0;
let sourceTotal = 0;
let targetTotal = 0;

console.log(`${'table'.padEnd(26)} ${'source'.padStart(8)} ${'target'.padStart(8)}`);
for (const table of tables) {
  const a = before.get(table) ?? 0;
  const b = after.get(table) ?? 0;
  sourceTotal += a;
  targetTotal += b;
  const same = a === b;
  if (!same) mismatched += 1;
  if (a === 0 && b === 0) continue;
  const mark = same ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  console.log(`${mark} ${table.padEnd(24)} ${String(a).padStart(8)} ${String(b).padStart(8)}`);
}

console.log(
  `\n${'TOTAL'.padEnd(26)} ${String(sourceTotal).padStart(8)} ${String(targetTotal).padStart(8)}`
);

await source.query('ROLLBACK');
await source.end();
await target.end();

if (mismatched > 0) {
  console.error(
    `\n${RED}✗ ${mismatched} table(s) differ${RESET}\n` +
      `${DIM}Nothing has been switched over. Do not change DATABASE_URL until this is clean.${RESET}`
  );
  process.exit(1);
}

console.log(
  `\n${GREEN}✓ every table matches${RESET} ` +
    `${DIM}(${tables.length} tables, ${sourceTotal.toLocaleString()} rows)${RESET}`
);

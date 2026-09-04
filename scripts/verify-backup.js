/**
 * Read a backup file and say what it is, what it is not, and whether it is intact.
 *
 * WHY THIS EXISTS
 *
 * Until 2026-09-04 this project had never taken a backup. There is now one, and
 * the thing that makes an untested backup dangerous is not that it might be
 * missing — you would notice that — but that it might be present, 21 MB, and
 * truncated in the middle of a table. A dump like that looks exactly like a good
 * one in `ls`, and you find out at the moment you need it.
 *
 * So this reads the file and checks the two things a plain-SQL dump can be
 * checked for without a database: that every statement it claims to hold is
 * actually complete, and that the row counts it advertises in its own comments
 * match the rows it actually wrote.
 *
 * WHAT THIS CANNOT DO, STATED PLAINLY SO NOBODY MISTAKES IT FOR A RESTORE TEST
 *
 * It does not restore anything. It cannot: that needs a scratch database to
 * restore INTO, and no such database exists here. A green run of this script
 * means the FILE is well-formed. It does not mean the restore works. Those are
 * different claims, and the second one has still never been tested — see
 * `Restoring for real` at the bottom of the output, which is printed every time
 * precisely so the distinction cannot quietly fade.
 *
 * Usage:
 *   node scripts/verify-backup.js                    # newest file in backups/
 *   node scripts/verify-backup.js path/to/dump.sql
 *
 * Exit 0 when the file is well-formed, 1 when it is not, 2 when it is unusable
 * (missing, unreadable, not a dump from scripts/backup-db.js).
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const problems = [];
const warnings = [];
const fail = (message) => problems.push(message);
const warn = (message) => warnings.push(message);

// ── Find the file ────────────────────────────────────────────────────────────

function newestBackup() {
  const dir = path.join(repoRoot, 'backups');
  if (!existsSync(dir)) return null;
  const candidates = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => path.join(dir, name))
    .map((file) => ({ file, mtime: statSync(file).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.file ?? null;
}

const target = process.argv[2] ? path.resolve(process.argv[2]) : newestBackup();
if (!target) {
  console.error('No backup to check. Pass a path, or run `node scripts/backup-db.js` first.');
  process.exit(2);
}
if (!existsSync(target)) {
  console.error(`No such file: ${target}`);
  process.exit(2);
}

const bytes = statSync(target).size;
const sql = readFileSync(target, 'utf8');

console.log(`${BOLD}${path.relative(repoRoot, target)}${RESET}`);
console.log(`${DIM}${(bytes / 1e6).toFixed(1)} MB${RESET}\n`);

// ── Is it one of ours ────────────────────────────────────────────────────────

/*
 * The header is checked before anything else, because every check below assumes
 * the dialect scripts/backup-db.js writes. Pointed at a pg_dump file — which
 * quotes and escapes differently — the parser would report nonsense with total
 * confidence, which is worse than refusing.
 */
if (!sql.startsWith('-- Diffusion data backup')) {
  console.error(
    `${RED}This is not a dump from scripts/backup-db.js.${RESET}\n` +
    `Expected the first line to be "-- Diffusion data backup"; got:\n  ${sql.slice(0, 120)}`
  );
  process.exit(2);
}

const takenAt = /^-- (\S+)\s+from (\S+)/m.exec(sql.split('\n')[1] ?? '');
const dataOnlyNotice = sql.split('\n')[2] ?? '';

// ── The scanner ──────────────────────────────────────────────────────────────

/**
 * Walk the file once, tracking what a Postgres parser would track.
 *
 * THIS IS A CHARACTER SCAN RATHER THAN A SET OF REGULAR EXPRESSIONS, and the
 * reason is the one thing a dump is full of: text. `documents.title` holds real
 * headlines, and a headline containing `);` or `-- ` would end a statement or
 * start a comment for any line-based check, silently, on exactly the rows most
 * worth protecting.
 *
 * Only two states matter for the dialect backup-db.js writes:
 *
 *   - Inside a single-quoted string, where a doubled `''` is a literal quote.
 *     There are no E'' strings and no dollar quoting in its output, and a
 *     backslash inside a standard-conforming string is an ordinary character —
 *     which is why array literals like '{"a\"b"}' need no special handling.
 *   - Inside a `--` line comment, which runs to the newline and where a lone
 *     apostrophe must NOT toggle the string state. (A table comment cannot
 *     contain one today; a future table name is not something to bet on.)
 */
function scan(text) {
  const statements = [];
  const comments = [];
  let inString = false;
  let inComment = false;
  let depth = 0;
  let statementStart = 0;
  let commentStart = 0;
  let sawContent = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];

    if (inComment) {
      if (c === '\n') {
        comments.push(text.slice(commentStart, i));
        inComment = false;
      }
      continue;
    }

    if (inString) {
      if (c === "'") {
        if (text[i + 1] === "'") i += 1; // an escaped quote, not the end
        else inString = false;
      }
      continue;
    }

    if (c === "'") { inString = true; sawContent = true; continue; }
    if (c === '-' && text[i + 1] === '-') { inComment = true; commentStart = i; i += 1; continue; }
    if (c === '(') { depth += 1; sawContent = true; continue; }
    if (c === ')') { depth -= 1; continue; }
    if (c === ';' && depth === 0) {
      statements.push(text.slice(statementStart, i + 1));
      statementStart = i + 1;
      sawContent = false;
      continue;
    }
    if (!/\s/.test(c)) sawContent = true;
  }

  return {
    statements,
    comments,
    unterminatedString: inString,
    unbalancedParens: depth,
    // Anything after the last `;` that is not whitespace or a comment: the
    // signature of a file that stopped being written mid-statement.
    trailingContent: sawContent,
  };
}

const scanned = scan(sql);

if (scanned.unterminatedString) fail('A string literal is never closed — the file is truncated or corrupt.');
if (scanned.unbalancedParens !== 0) {
  fail(`Parentheses do not balance (${scanned.unbalancedParens > 0 ? 'unclosed' : 'extra closing'}: ${Math.abs(scanned.unbalancedParens)}).`);
}
if (scanned.trailingContent) fail('The file ends mid-statement — there is content after the last semicolon.');

// ── The transaction ──────────────────────────────────────────────────────────

/*
 * backup-db.js wraps everything in BEGIN … COMMIT, which is what makes a
 * restore all-or-nothing. A dump that has the BEGIN and not the COMMIT is the
 * commonest shape of a truncated file, and it is also the most dangerous,
 * because psql would load most of it and then leave the transaction open.
 */
const bare = scanned.statements.map((s) => s.replace(/--[^\n]*/g, '').trim().toUpperCase());
const beginCount = bare.filter((s) => s === 'BEGIN;').length;
const commitCount = bare.filter((s) => s === 'COMMIT;').length;
if (beginCount !== 1) fail(`Expected exactly one BEGIN; found ${beginCount}.`);
if (commitCount !== 1) fail(`Expected exactly one COMMIT; found ${commitCount} — a dump without one is truncated.`);
if (commitCount === 1 && bare.at(-1) !== 'COMMIT;') fail('COMMIT is not the last statement.');

// ── What the dump says it holds, against what it actually holds ─────────────

/*
 * THE CHECK THAT ACTUALLY MATTERS.
 *
 * backup-db.js writes `-- observations: 75934 rows` and then the rows. Those
 * are two independent statements of the same fact — the first from the driver's
 * row count, the second from what reached the file — so comparing them catches
 * every failure mode between the query and the disk: a truncated write, a
 * chunking bug, a value that broke the quoting and swallowed the tuples after
 * it. Neither number alone can tell you anything.
 */
const claimed = new Map();
for (const comment of scanned.comments) {
  const rows = /^--\s+([a-z_][a-z0-9_]*):\s+(\d+)\s+rows$/i.exec(comment.trim());
  if (rows) { claimed.set(rows[1], Number(rows[2])); continue; }
  const empty = /^--\s+([a-z_][a-z0-9_]*):\s+empty$/i.exec(comment.trim());
  if (empty) claimed.set(empty[1], 0);
}

/** Count the top-level value tuples in one INSERT statement. */
function countTuples(statement) {
  // Find ` VALUES` outside any string. The column list is the only other
  // paren group, and it always precedes it.
  let inString = false;
  let valuesAt = -1;
  for (let i = 0; i < statement.length; i += 1) {
    const c = statement[i];
    if (inString) {
      if (c === "'") { if (statement[i + 1] === "'") i += 1; else inString = false; }
      continue;
    }
    if (c === "'") { inString = true; continue; }
    if ((c === 'V' || c === 'v') && /^values\b/i.test(statement.slice(i, i + 7))) { valuesAt = i + 6; break; }
  }
  if (valuesAt === -1) return null;

  let depth = 0;
  let tuples = 0;
  inString = false;
  for (let i = valuesAt; i < statement.length; i += 1) {
    const c = statement[i];
    if (inString) {
      if (c === "'") { if (statement[i + 1] === "'") i += 1; else inString = false; }
      continue;
    }
    if (c === "'") { inString = true; continue; }
    if (c === '(') { if (depth === 0) tuples += 1; depth += 1; continue; }
    if (c === ')') depth -= 1;
  }
  return tuples;
}

const actual = new Map();
let insertStatements = 0;
for (const statement of scanned.statements) {
  const head = /INSERT\s+INTO\s+"?([a-z_][a-z0-9_]*)"?/i.exec(statement);
  if (!head) continue;
  insertStatements += 1;
  const tuples = countTuples(statement);
  if (tuples === null) { fail(`An INSERT INTO "${head[1]}" has no VALUES clause.`); continue; }
  actual.set(head[1], (actual.get(head[1]) ?? 0) + tuples);
}

if (insertStatements === 0) fail('The dump contains no INSERT statements at all.');

const tables = [...new Set([...claimed.keys(), ...actual.keys()])].sort();
let totalRows = 0;
let mismatches = 0;
for (const table of tables) {
  const said = claimed.get(table);
  const wrote = actual.get(table) ?? 0;
  totalRows += wrote;
  if (said === undefined) { warn(`"${table}" has rows but no "-- ${table}: N rows" header.`); continue; }
  if (said !== wrote) {
    mismatches += 1;
    fail(`"${table}": the header claims ${said.toLocaleString()} rows, the file holds ${wrote.toLocaleString()}.`);
  }
}

// ── Sequences ────────────────────────────────────────────────────────────────

const setvals = scanned.statements.filter((s) => /^\s*SELECT\s+setval\s*\(/i.test(s.replace(/--[^\n]*/g, '')));

// ── What is NOT in here, which is the half that decides a restore ───────────

/*
 * Each of these is looked for rather than assumed absent. backup-db.js's own
 * header lists what it leaves out, and a header is a claim about code that may
 * have changed since — the same reason the row counts above are recomputed
 * rather than read.
 */
const DDL = [
  { what: 'tables (CREATE TABLE)', pattern: /^\s*CREATE\s+TABLE/im },
  { what: 'indexes (CREATE INDEX)', pattern: /^\s*CREATE\s+(UNIQUE\s+)?INDEX/im },
  { what: 'views (CREATE VIEW / MATERIALIZED VIEW)', pattern: /^\s*CREATE\s+(OR\s+REPLACE\s+)?(MATERIALIZED\s+)?VIEW/im },
  { what: 'types and enums (CREATE TYPE)', pattern: /^\s*CREATE\s+TYPE/im },
  { what: 'extensions (CREATE EXTENSION)', pattern: /^\s*CREATE\s+EXTENSION/im },
  { what: 'constraints (ALTER TABLE … ADD CONSTRAINT)', pattern: /^\s*ALTER\s+TABLE/im },
  { what: 'functions and triggers', pattern: /^\s*CREATE\s+(OR\s+REPLACE\s+)?(FUNCTION|TRIGGER)/im },
];
const present = DDL.filter(({ pattern }) => pattern.test(sql));
const absent = DDL.filter(({ pattern }) => !pattern.test(sql));

// ── Does this dump match the schema the migrations would build ──────────────

/*
 * ADVISORY, NOT A GATE. A restore runs `npm run db:migrate` and then loads
 * this, so the two halves have to describe the same schema — and they can
 * legitimately disagree for a reason that is not a fault: a migration written
 * after the backup was taken, or one written and not yet applied, both show up
 * here. Reporting the difference is useful; failing on it would make the check
 * red for a state the project is in on purpose.
 *
 * `schema_migrations` is created by src/server/db/migrate.js rather than by any
 * migration file, so it is expected on the dump side and never on the other.
 */
const migrationsDir = path.join(repoRoot, 'db', 'migrations');
if (existsSync(migrationsDir)) {
  const created = new Set(['schema_migrations']);
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))) {
    const text = readFileSync(path.join(migrationsDir, file), 'utf8');
    for (const match of text.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z_][a-z0-9_]*)"?/gi)) {
      created.add(match[1]);
    }
  }
  const inDump = new Set(tables);
  const missingFromDump = [...created].filter((t) => !inDump.has(t)).sort();
  const notInMigrations = [...inDump].filter((t) => !created.has(t)).sort();
  if (missingFromDump.length) {
    warn(
      `The migrations create ${missingFromDump.length} table(s) this dump does not hold: ` +
      `${missingFromDump.join(', ')}. Either the migration was written after the backup, ` +
      `or it has not been applied — a restore would leave them empty.`
    );
  }
  if (notInMigrations.length) {
    warn(
      `The dump holds ${notInMigrations.length} table(s) no migration creates: ` +
      `${notInMigrations.join(', ')}. A restore would fail on these — there is nothing to load them into.`
    );
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

console.log(`${BOLD}Contents${RESET}`);
console.log(`  taken       ${takenAt ? takenAt[1] : 'unknown'}`);
console.log(`  from        ${takenAt ? takenAt[2] : 'unknown'}`);
console.log(`  tables      ${tables.length} (${tables.filter((t) => (actual.get(t) ?? 0) > 0).length} with rows, ${tables.filter((t) => (actual.get(t) ?? 0) === 0).length} empty)`);
console.log(`  rows        ${totalRows.toLocaleString()} counted in the file itself`);
console.log(`  statements  ${insertStatements} INSERT, ${setvals.length} setval, wrapped in ${beginCount} BEGIN / ${commitCount} COMMIT`);
console.log('');

const widest = Math.max(...tables.map((t) => t.length), 10);
for (const table of tables) {
  const rows = actual.get(table) ?? 0;
  const said = claimed.get(table);
  const agree = said === rows;
  console.log(
    `  ${agree ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`} ${table.padEnd(widest)} ` +
    `${String(rows.toLocaleString()).padStart(8)}${agree ? '' : ` ${RED}(header says ${said?.toLocaleString() ?? 'nothing'})${RESET}`}`
  );
}

console.log(`\n${BOLD}What this file does NOT contain${RESET}`);
console.log(`  ${DIM}${dataOnlyNotice.replace(/^--\s*/, '')}${RESET}`);
for (const { what } of absent) console.log(`  ${DIM}·${RESET} no ${what}`);
for (const { what } of present) console.log(`  ${YELLOW}!${RESET} it DOES contain ${what} — unexpected for a data-only dump`);
/*
 * Said explicitly because backup-db.js's own header lists "no sequences" among
 * what it omits, and the file in front of us has setval statements in it. The
 * header means the sequence OBJECTS, which the migrations create; the values
 * are here, which is the part that decides whether the first insert after a
 * restore collides with an existing key.
 */
console.log(
  setvals.length
    ? `  ${DIM}·${RESET} sequence OBJECTS are not created here, but their VALUES are restored ` +
      `(${setvals.length} setval calls) — so the first insert after a restore will not collide`
    : `  ${YELLOW}!${RESET} no setval calls: sequence values are NOT restored, and the first ` +
      `insert after a restore may collide with an existing key`
);

console.log(`\n${BOLD}Restoring for real${RESET}`);
console.log(`  1. Create an empty database (a Neon branch is the cheap way).`);
console.log(`  2. ${BOLD}DATABASE_URL=<it> npm run db:migrate${RESET} — builds the schema this file assumes.`);
console.log(`  3. Load this file into it with psql.`);
console.log(`  4. Compare row counts against the "Contents" table above.`);
console.log(
  `  ${YELLOW}This has never been done.${RESET} ${DIM}This script checks the FILE, not the RESTORE.\n` +
  `  A green run here means the dump is complete and well-formed; it does not mean\n` +
  `  the schema still matches or that psql will accept it. Only steps 1-4 prove that,\n` +
  `  and they need a scratch database that does not exist yet.${RESET}`
);

if (warnings.length) {
  console.log(`\n${BOLD}Worth knowing${RESET}`);
  for (const message of warnings) console.log(`  ${YELLOW}!${RESET} ${message}`);
}

if (problems.length) {
  console.log(`\n${RED}✗ ${problems.length} problem${problems.length === 1 ? '' : 's'}${RESET}`);
  for (const message of problems) console.log(`  ${RED}·${RESET} ${message}`);
  console.log(`\n${RED}This backup is not safe to rely on.${RESET}`);
  process.exit(1);
}

console.log(
  `\n${GREEN}✓ well-formed${RESET} ${DIM}— ${tables.length} tables, ${totalRows.toLocaleString()} rows, ` +
  `${mismatches} count mismatches, complete transaction${RESET}`
);
process.exit(0);

/** Read-only DB export. Usage: node scripts/export-country-matrix.js OUTPUT_DIR
 * Output contains public statistical metadata, never credentials.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { countryEvidenceMatrix } from '../src/server/repositories/countries.js';
import { closePool } from '../src/server/db/pool.js';
import { priorityDepth, evidenceRole } from '../src/server/lib/country-depth.js';

try {
  if (!process.argv[2]) throw new Error('Supply an output directory');
  const out = path.resolve(process.argv[2]);
  const rows = (await countryEvidenceMatrix()).map((row) => ({ ...row, evidence_role: evidenceRole(row) }));
  const depth = priorityDepth(rows);
  const generated = new Date().toISOString();
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'country-question-indicator-matrix.json'), JSON.stringify({ generated, rows }, null, 2));
  const report = [
    '# Country evidence depth', '', `Generated ${generated}. Read-only staging snapshot.`, '',
    'Counts use active question placements and non-null observations for the named country. Global series are not credited to countries. Repeated placements count once per domain. A direct AI-use survey measures adoption, not a causal economic effect. Other series are conservatively labelled context/proxies. Latest period can include projections; inspect provider flags and individual periods in the matrix.', '',
    '| Country | Domain | Series | Direct AI-use measures | AI-use survey latest | Latest period (any series) | Remaining gap |',
    '|---|---|---:|---:|---|---|---|',
    ...depth.map((row) => `| ${row.iso3} | ${row.domain} | ${row.indicator_count} | ${row.direct_ai_measures} | ${row.direct_ai_latest ?? 'none'} | ${row.latest_period ?? 'none'} | ${row.gap} |`), '',
    'The accompanying JSON includes every country × active question placement, including missing observations, source URL/licence, instrument panel, reference range and provider flags. Zero means absent from this catalogue, not zero economic activity or proof that no source exists.', '',
  ].join('\n');
  await writeFile(path.join(out, 'priority-country-gaps.md'), report);
  console.log(JSON.stringify({ rows: rows.length, priority_domain_cells: depth.length, output: out }));
} finally { await closePool(); }

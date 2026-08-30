/**
 * What the last ingestion actually did, as GitHub Actions job-summary markdown.
 *
 * WHY THIS EXISTS RATHER THAN JUST READING THE LOG
 *
 * A green tick means the process exited 0. It does not mean anything was
 * written. This project has already shipped the difference: the RSS pipeline
 * existed, had tests, and was called by nothing — `npm run ingest -- rss`
 * matched no indicator, printed nothing, and exited 0. It reported success
 * while doing nothing, for weeks, and the only symptom was a news feed that
 * looked a bit thin.
 *
 * A scheduled job makes that failure mode worse, not better, because nobody is
 * watching the log. So the summary reports the two things a log cannot:
 *
 *   - what was written, per job, THIS RUN
 *   - what is STALE — indicators whose data is older than their own refresh
 *     interval says it should be, whether or not this run touched them
 *
 * The second is the one that catches silent rot. A job can succeed every night
 * for a month while the upstream quietly stops publishing, and only a staleness
 * check notices.
 *
 * Exit code is always 0. This reports; the ingestion step decides pass or fail,
 * and a summary that fails the build would hide the ingestion's own error.
 */

import { query, closePool } from '../src/server/db/pool.js';

const WINDOW = "now() - INTERVAL '6 hours'";

function table(headers, rows) {
  if (rows.length === 0) return '_none_\n';
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
    '',
  ].join('\n');
}

const lines = [];

try {
  const { rows: runs } = await query(
    `SELECT job_name, status, rows_written, rows_skipped,
            round(extract(epoch FROM (finished_at - started_at)))::int AS seconds,
            error_message
       FROM ingestion_runs
      WHERE started_at > ${WINDOW}
      ORDER BY started_at`
  );

  const written = runs.reduce((sum, r) => sum + (r.rows_written ?? 0), 0);
  const failed = runs.filter((r) => r.status === 'failed');

  lines.push('## Ingestion', '');

  if (runs.length === 0) {
    lines.push(
      '**No runs recorded in the last six hours.**',
      '',
      'The step reported success but wrote no audit record at all, which means',
      'it matched no job. That is the shape of the RSS bug: exit 0, nothing done.',
      ''
    );
  } else {
    lines.push(
      `**${runs.length} jobs · ${written.toLocaleString()} rows written · ` +
        `${failed.length} failed**`,
      ''
    );

    if (written === 0) {
      lines.push(
        '> Every job succeeded and **nothing was written**. That is legitimate',
        '> when no upstream has published since the last run, and it is also',
        '> exactly what a broken adapter looks like. Worth a glance.',
        ''
      );
    }

    /*
     * Only the jobs that did something, plus every failure.
     *
     * A full listing is 73 rows on a normal night and 70 of them say "0",
     * because most series refresh monthly or annually and simply had nothing
     * new. A summary nobody scrolls to the bottom of is a summary nobody
     * reads, and the three interesting rows were the ones off the screen.
     */
    const notable = runs.filter((r) => r.status !== 'succeeded' || (r.rows_written ?? 0) > 0);
    const quiet = runs.length - notable.length;

    lines.push(
      table(
        ['Job', 'Status', 'Written', 'Skipped', 'Secs'],
        notable.map((r) => [
          `\`${r.job_name}\``,
          r.status === 'succeeded' ? '✅' : r.status === 'failed' ? '❌' : r.status,
          (r.rows_written ?? 0).toLocaleString(),
          (r.rows_skipped ?? 0).toLocaleString(),
          r.seconds ?? '—',
        ])
      )
    );

    if (quiet > 0) {
      lines.push(
        `_${quiet} further jobs succeeded with nothing new to fetch — normal ` +
          'for monthly and annual series. Listed in full in the step log._',
        ''
      );
    }

    if (failed.length > 0) {
      lines.push('### Failures', '');
      for (const f of failed) {
        // Already redacted at the point of storage — see finishRun.
        lines.push(`- **${f.job_name}** — ${f.error_message ?? 'no message'}`);
      }
      lines.push('');
    }
  }

  /*
   * Staleness, measured against each indicator's OWN refresh interval rather
   * than a fixed number of days. An annual World Bank series is not stale at
   * eight days; a daily metals price is.
   */
  const { rows: stale } = await query(
    `SELECT id, name,
            COALESCE(last_ingested_at::date::text, 'never') AS last_seen,
            COALESCE(refresh_interval, INTERVAL '1 day')::text AS every
       FROM indicators
      WHERE is_active
        AND source_series_code IS NOT NULL
        AND (last_ingested_at IS NULL
             OR last_ingested_at + (COALESCE(refresh_interval, INTERVAL '1 day') * 2) < now())
      ORDER BY last_ingested_at NULLS FIRST
      LIMIT 25`
  );

  lines.push('## Stale indicators', '');
  if (stale.length === 0) {
    lines.push('Every active series is inside twice its own refresh interval.', '');
  } else {
    lines.push(
      `${stale.length} series are past **twice** their own refresh interval — ` +
        'late enough that a missed run does not explain it.',
      ''
    );
    lines.push(
      table(
        ['Indicator', 'Last seen', 'Expected every'],
        stale.map((s) => [`\`${s.id}\``, s.last_seen, s.every])
      )
    );
  }

  const { rows: totals } = await query(
    `SELECT (SELECT count(*) FROM observations)::int AS observations,
            (SELECT count(*) FROM documents)::int    AS documents`
  );
  lines.push(
    '## Totals',
    '',
    `${totals[0].observations.toLocaleString()} observations · ` +
      `${totals[0].documents.toLocaleString()} documents`,
    ''
  );
} catch (error) {
  lines.push(
    '## Ingestion summary unavailable',
    '',
    `Could not read the database: \`${error.message}\``,
    '',
    'This does not mean ingestion failed — check the step above.',
    ''
  );
} finally {
  await closePool();
}

process.stdout.write(`${lines.join('\n')}\n`);

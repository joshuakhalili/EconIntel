/**
 * Ingestion runner.
 *
 * Wraps every job in an audit record, so a silently-failing feed is visible
 * rather than merely producing stale charts. Silent staleness is the normal
 * way a dashboard like this rots: the page still renders, the numbers are just
 * quietly months old, and nobody notices for a quarter.
 *
 * Usage:
 *   node src/server/ingestion/runner.js            run all due jobs
 *   node src/server/ingestion/runner.js fred        run one job group
 *   node src/server/ingestion/runner.js --force     ignore refresh intervals
 */

import { fileURLToPath } from 'node:url';

import { query, closePool } from '../db/pool.js';
import { config } from '../config.js';
import { redactUrl } from '../lib/http.js';
import { upsertObservations, touchIndicator } from '../repositories/observations.js';
import * as fred from './sources/fred.js';
import * as worldbank from './sources/worldbank.js';
import * as epoch from './sources/epoch.js';
import * as federalRegister from './sources/federal-register.js';
import * as dbnomics from './sources/dbnomics.js';
import * as gdelt from './sources/gdelt.js';
import * as sec from './sources/sec.js';
import * as lbma from './sources/lbma.js';
import * as rss from './sources/rss.js';
import * as openalex from './sources/openalex.js';
import { insertDocuments } from '../repositories/documents.js';

/**
 * Open a run record. Every job gets one whether it succeeds or fails — a run
 * that vanishes on failure is exactly the run you needed to see.
 */
async function startRun(jobName, sourceId) {
  const { rows } = await query(
    `INSERT INTO ingestion_runs (job_name, source_id, status)
     VALUES ($1, $2, 'running') RETURNING id`,
    [jobName, sourceId]
  );
  return rows[0].id;
}

/**
 * `error_message` is served publicly by /api/status, so it is redacted HERE,
 * at the point of storage, rather than trusted to arrive clean.
 *
 * HttpError already redacts its own message and url, but only some failures are
 * HttpErrors — a native fetch TypeError, a pg error, or anything a future
 * adapter throws arrives unfiltered, and a request URL carrying `api_key=` in
 * one of those would be written to a column the public dashboard renders. A key
 * that reaches a public page has to be rotated, so the guarantee belongs at the
 * boundary where it can be made once for every error type rather than
 * re-established at every throw site.
 */
async function finishRun(runId, { status, written = 0, skipped = 0, error = null, details = null }) {
  await query(
    `UPDATE ingestion_runs
        SET status = $2, finished_at = now(), rows_written = $3,
            rows_skipped = $4, error_message = $5, details = $6
      WHERE id = $1`,
    [
      runId,
      status,
      written,
      skipped,
      redactUrl(error),
      details ? redactUrl(JSON.stringify(details)) : null,
    ]
  );
}

/**
 * Which indicators are due for a refresh.
 *
 * Comparing `last_ingested_at + refresh_interval` against now() in SQL keeps
 * the scheduling decision next to the data it concerns, and means a restarted
 * process picks up exactly where it left off with no in-memory state to lose.
 */
async function dueIndicators({ sourceId = null, force = false } = {}) {
  const { rows } = await query(
    `SELECT id, source_id, source_series_code, cadence, default_country_iso3, has_country_dim
       FROM indicators
      WHERE is_active
        AND source_series_code IS NOT NULL
        AND ($1::text IS NULL OR source_id = $1)
        AND ($2::boolean
             OR last_ingested_at IS NULL
             OR last_ingested_at + COALESCE(refresh_interval, INTERVAL '1 day') < now())
      ORDER BY source_id, id`,
    [sourceId, force]
  );
  return rows;
}

/** Ingest one FRED-backed indicator. */
async function ingestFredIndicator(indicator) {
  const runId = await startRun(`fred:${indicator.id}`, 'fred');
  try {
    /**
     * The FRED adapter defaults every series to USA, on the reasonable
     * assumption that FRED is a US source. That is wrong for the global
     * commodity prices it also carries: copper and aluminium are world prices,
     * not American ones, and the grain trigger correctly rejected them for
     * declaring a country the indicator does not have.
     *
     * So the country comes from the indicator: its own default where it has a
     * country dimension, and explicitly nothing where it does not.
     */
    const observations = await fred.fetchSeries(indicator.source_series_code, {
      indicatorId: indicator.id,
      countryIso3: indicator.has_country_dim ? (indicator.default_country_iso3 ?? 'USA') : null,
    });
    const { written, skipped } = await upsertObservations(observations);
    await touchIndicator(indicator.id);
    await finishRun(runId, {
      status: 'succeeded',
      written,
      skipped,
      details: { fetched: observations.length },
    });
    return { written, skipped, fetched: observations.length };
  } catch (error) {
    await finishRun(runId, { status: 'failed', error: error.message });
    throw error;
  }
}

/** Ingest one World Bank-backed indicator across all seeded countries. */
async function ingestWorldBankIndicator(indicator) {
  const runId = await startRun(`worldbank:${indicator.id}`, 'worldbank');
  try {
    // Request only countries we actually have rows for. Asking for 'all' would
    // return ~260 entities, most of which would fail the foreign key and be
    // discarded — wasted bandwidth on someone else's free service.
    const { rows: countries } = await query(
      'SELECT iso3 FROM countries ORDER BY iso3'
    );
    const codes = countries.map((c) => c.iso3);

    const observations = await worldbank.fetchIndicator(
      indicator.source_series_code,
      { countries: codes, indicatorId: indicator.id }
    );

    // Drop observations for countries not in our dimension table. The API
    // occasionally returns entities we did not ask for; inserting them would
    // violate the foreign key and abort the whole batch.
    const known = new Set(codes);
    const filtered = observations.filter((o) => known.has(o.countryIso3));

    const { written, skipped } = await upsertObservations(filtered);
    await touchIndicator(indicator.id);
    await finishRun(runId, {
      status: 'succeeded',
      written,
      skipped: skipped + (observations.length - filtered.length),
      details: { fetched: observations.length, unknownCountries: observations.length - filtered.length },
    });
    return { written, skipped, fetched: observations.length };
  } catch (error) {
    await finishRun(runId, { status: 'failed', error: error.message });
    throw error;
  }
}

/**
 * Ingest one Epoch AI indicator.
 *
 * Dispatches on indicator id rather than source id because this one source
 * backs two structurally different series — a running maximum over model
 * training runs, and a count of known clusters per country per year. They share
 * a provider and nothing else.
 */
async function ingestEpochIndicator(indicator) {
  const runId = await startRun(`epoch:${indicator.id}`, 'epoch_ai');
  try {
    let observations;
    switch (indicator.id) {
      case 'epoch.training_compute_frontier':
        observations = await epoch.ingestFrontierCompute();
        break;
      case 'epoch.gpu_cluster_count':
        observations = await epoch.ingestGpuClusters();
        break;
      case 'epoch.gpu_price_performance':
        observations = await epoch.ingestGpuPricePerformance();
        break;
      default:
        /*
         * A hard-coded switch is why this line exists. Epoch's three datasets
         * share a provider and nothing else — different files, different
         * shapes, different converters — so there is no generic path the way
         * there is for DBnomics, and adding an Epoch indicator to the seed is
         * not enough on its own. Without a case here the indicator is seeded,
         * visible, and fails on every run.
         */
        throw new Error(`No Epoch job defined for indicator "${indicator.id}"`);
    }

    const { written, skipped } = await upsertObservations(observations);
    await touchIndicator(indicator.id);
    await finishRun(runId, {
      status: 'succeeded',
      written,
      skipped,
      details: { fetched: observations.length },
    });
    return { written, skipped, fetched: observations.length };
  } catch (error) {
    await finishRun(runId, { status: 'failed', error: error.message });
    throw error;
  }
}

/**
 * Ingest one DBnomics-backed indicator.
 *
 * DBnomics mirrors 93 statistical agencies behind one API, which is what makes
 * genuinely global coverage a configuration problem rather than 93 adapters.
 * One series here can come from ONS, Eurostat, China's NBS or the Bank of
 * Japan; the provider is the first segment of the series path.
 *
 * The country is carried on the indicator rather than parsed out of the series
 * code. Provider code layouts differ wildly and share no convention, so
 * inferring geography from the string would be guesswork — and a series
 * attributed to the wrong country is worse on a map than one that is absent.
 */
async function ingestDbnomicsIndicator(indicator) {
  const runId = await startRun(`dbnomics:${indicator.id}`, 'dbnomics');
  try {
    const observations = await dbnomics.fetchSeries(indicator.source_series_code, {
      indicatorId: indicator.id,
      countryIso3: indicator.default_country_iso3 ?? null,
    });

    const { written, skipped } = await upsertObservations(observations);
    await touchIndicator(indicator.id);
    await finishRun(runId, {
      status: 'succeeded',
      written,
      skipped,
      details: { fetched: observations.length },
    });
    return { written, skipped, fetched: observations.length };
  } catch (error) {
    await finishRun(runId, { status: 'failed', error: error.message });
    throw error;
  }
}

/**
 * LBMA precious metals. Dispatches on indicator id: one source, two metals,
 * each its own endpoint.
 */
async function ingestLbmaIndicator(indicator) {
  const runId = await startRun(`lbma:${indicator.id}`, 'lbma');
  try {
    const observations = await lbma.fetchMetal(indicator.source_series_code, indicator.id);
    const { written, skipped } = await upsertObservations(observations);
    await touchIndicator(indicator.id);
    await finishRun(runId, { status: 'succeeded', written, skipped, details: { fetched: observations.length } });
    return { written, skipped, fetched: observations.length };
  } catch (error) {
    await finishRun(runId, { status: 'failed', error: error.message });
    throw error;
  }
}

const HANDLERS = {
  fred: ingestFredIndicator,
  lbma: ingestLbmaIndicator,
  worldbank: ingestWorldBankIndicator,
  epoch_ai: ingestEpochIndicator,
  dbnomics: ingestDbnomicsIndicator,
};

/**
 * DERIVED JOBS — the second kind of ingestion.
 *
 * `dueIndicators` requires `source_series_code IS NOT NULL`, because a fetch
 * job needs something to fetch. Nine indicators in the catalogue are
 * `derived.*`: they have no upstream code because they are COMPUTED rather than
 * retrieved. You cannot ask an API for "AI regulation volume" — you fetch
 * several hundred documents, deduplicate them and count them by month.
 *
 * Those indicators were therefore invisible to the runner entirely. They did
 * not even appear as skips, because the WHERE clause excluded them before the
 * loop saw them — the worst kind of gap, since nothing reports it.
 *
 * Keyed by indicator id rather than source id: a derived indicator's identity
 * IS its computation, and two derived indicators from the same source are
 * usually unrelated calculations.
 *
 * Each function returns ObservationInput[] and is responsible for its own
 * fetching. Absent entries are reported as unimplemented rather than skipped
 * silently, so an empty chart always has a stated reason.
 */
const DERIVED_JOBS = {
  'derived.ai_regulation_volume': async () => {
    // fetchAiDocuments returns { documents, truncated } — the wrapper exists so
    // a capped result cannot be mistaken for a complete one.
    const { documents, truncated } = await federalRegister.fetchAiDocuments();
    if (truncated) {
      console.warn(
        '  note  federal register results were truncated by the per-term page cap; ' +
          'regulatory volume is a lower bound for the affected months'
      );
    }
    return federalRegister.toMonthlyCounts(documents);
  },

  /**
   * Installed data-centre power capacity, from Epoch's cluster register.
   *
   * This indicator was previously recorded as having no free source anywhere.
   * That was wrong: the same CSV backing gpu_cluster_count carries a
   * 'Power Capacity (MW)' column, populated for 418 of 482 clusters. Nobody
   * had read past the columns already in use.
   */
  'derived.datacentre_capacity_mw': async () => epoch.ingestDatacentreCapacity(),

  /**
   * AI-economics news as a share of all global news coverage, monthly to 2017.
   *
   * A share rather than a count: GDELT's crawler has grown over the period, so
   * raw matches would rise even if the world's attention had not moved. The
   * denominator is what makes the series about AI rather than about GDELT.
   */
  'derived.ai_news_volume': async () => gdelt.ingestNewsVolume(),

  /**
   * Share of US annual reports mentioning AI.
   *
   * A 10-K is a legal filing: overstating AI involvement in one carries
   * liability that a press release does not, so this measures corporate
   * commitment under a far higher standard of truth than any survey.
   */
  'derived.sec_ai_mention_rate': async () => sec.computeAiMentionRate(),

  /**
   * Federal Register counts split by document type.
   *
   * All three share one fetch of several hundred documents, so they are cheap
   * to compute together, but they answer different questions: a Rule is law, a
   * Proposed Rule is an intention, an executive order is a gesture that can be
   * undone by the next administration.
   */
  'derived.ai_binding_rules': async () => {
    const { documents } = await federalRegister.fetchAiDocuments();
    return federalRegister.toMonthlyCountsByType(documents, 'Rule', 'derived.ai_binding_rules');
  },

  'derived.ai_proposed_rules': async () => {
    const { documents } = await federalRegister.fetchAiDocuments();
    return federalRegister.toMonthlyCountsByType(documents, 'Proposed Rule', 'derived.ai_proposed_rules');
  },

  'derived.ai_presidential_documents': async () => {
    const { documents } = await federalRegister.fetchAiDocuments();
    return federalRegister.toMonthlyCountsByType(documents, 'Presidential Document', 'derived.ai_presidential_documents');
  },

  /**
   * Ratios computed in SQL from observations already held.
   *
   * Done in SQL rather than JavaScript because the join on period is exactly
   * what a database is for, and because the definition of the ratio then lives
   * in one place instead of being re-derived by whatever reads it.
   */
  'derived.information_employment_share': async () => {
    const { rows } = await query(
      `SELECT info.period_start::text AS period_start,
              info.period_end::text   AS period_end,
              (info.value / total.value) * 100 AS value
         FROM observations info
         JOIN observations total
           ON total.indicator_id = 'fred.PAYEMS'
          AND total.period_start = info.period_start
        WHERE info.indicator_id = 'fred.USINFO'
          AND info.value IS NOT NULL
          AND total.value IS NOT NULL
          AND total.value > 0
        ORDER BY info.period_start`
    );
    return rows.map((r) => ({
      indicatorId: 'derived.information_employment_share',
      countryIso3: 'USA',
      periodStart: r.period_start,
      periodEnd: r.period_end,
      value: Number(r.value),
      sourceRef: 'computed: fred.USINFO / fred.PAYEMS',
    }));
  },

  'derived.productivity_gap_mfg_vs_total': async () => {
    const { rows } = await query(
      `WITH paired AS (
         SELECT m.period_start, m.period_end, m.value AS mfg, t.value AS total
           FROM observations m
           JOIN observations t
             ON t.indicator_id = 'fred.OPHNFB'
            AND t.period_start = m.period_start
          WHERE m.indicator_id = 'fred.OPHMFG'
            AND m.value IS NOT NULL AND t.value IS NOT NULL AND t.value > 0
       ),
       base AS (SELECT (mfg / total) AS r FROM paired ORDER BY period_start LIMIT 1)
       SELECT p.period_start::text AS period_start,
              p.period_end::text   AS period_end,
              ((p.mfg / p.total) / b.r) * 100 AS value
         FROM paired p CROSS JOIN base b
        ORDER BY p.period_start`
    );
    return rows.map((r) => ({
      indicatorId: 'derived.productivity_gap_mfg_vs_total',
      countryIso3: 'USA',
      periodStart: r.period_start,
      periodEnd: r.period_end,
      value: Number(r.value),
      sourceRef: 'computed: fred.OPHMFG / fred.OPHNFB, indexed to first shared period',
    }));
  },
};

/**
 * The derived job ids, for anything that needs to know what this runner can
 * actually produce.
 *
 * Exported for one job: `.github/workflows/ingest.yml` names
 * `derived.ai_news_volume` in `INGEST_ALLOW_FAIL`, and a typo there — a plural,
 * a renamed indicator — would silently stop excusing GDELT and put the daily
 * red X back with nothing anywhere reporting why. `runner.test.js` reads the
 * workflow and checks its list against this.
 */
export const DERIVED_JOB_IDS = Object.freeze(Object.keys(DERIVED_JOBS));

/**
 * Derived indicators that are due, i.e. the ones `dueIndicators` cannot see.
 *
 * Honours sourceId for the same reason the fetch pass does. Without it,
 * `ingest -- rss` ran all eleven derived jobs including the GDELT one, whose
 * connect timeout and retry take minutes — so a targeted run of one fast job
 * took as long as a full one, which is a good way to stop running targeted
 * jobs at all.
 */
async function dueDerivedIndicators({ sourceId = null, force = false } = {}) {
  const { rows } = await query(
    `SELECT id, source_id, cadence
       FROM indicators
      WHERE is_active
        AND source_series_code IS NULL
        AND ($1::text IS NULL OR source_id = $1)
        AND ($2::boolean
             OR last_ingested_at IS NULL
             OR last_ingested_at + COALESCE(refresh_interval, INTERVAL '1 day') < now())
      ORDER BY id`,
    [sourceId, force]
  );
  return rows;
}

/** Run one derived job inside the same audit wrapper as a fetch job. */
async function runDerivedJob(indicator) {
  const runId = await startRun(`derived:${indicator.id}`, indicator.source_id);
  try {
    const observations = await DERIVED_JOBS[indicator.id]();
    const { written, skipped } = await upsertObservations(observations);
    await touchIndicator(indicator.id);
    await finishRun(runId, {
      /* `fetched` as well as `computed`: the regression check reads a job's
         previous count, and a derived job that stored only `computed` was
         invisible to it — which would have exempted exactly the two jobs that
         actually fail. `computed` stays because it is the accurate word for
         what a derived job did, and something may already read it. */
      status: 'succeeded',
      written,
      skipped,
      details: { computed: observations.length, fetched: observations.length },
    });
    return { written, skipped, fetched: observations.length };
  } catch (error) {
    await finishRun(runId, { status: 'failed', error: error.message });
    throw error;
  }
}

/**
 * Document jobs — news and filings, as opposed to numbers.
 *
 * These were missing from the runner entirely. `dueIndicators` selects rows
 * from `indicators`, and a news feed is not an indicator: it produces
 * DOCUMENTS. So `npm run ingest -- rss` matched no indicator, printed nothing,
 * exited 0, and the feeds had in fact never been fetched on a schedule at all
 * — the articles in the database came from a one-off call. The corpus sat
 * frozen while the runner reported success every time.
 *
 * That is the same silent-failure shape as the empty chart that reads as "no
 * data" rather than "broken", and it is why this is keyed by name and reported
 * explicitly below.
 */
const DOCUMENT_JOBS = {
  ...Object.fromEntries(
    rss.FEEDS.map((feed) => [
      feed.sourceId,
      async () => {
        const documents = await rss.fetchFeed(feed);
        const { written, duplicates, skipped } = await insertDocuments(documents);
        // Duplicates are the normal case, not an error: a feed re-serves the same
        // items on every poll and the URL unique constraint absorbs them.
        return { written, fetched: documents.length, skipped: skipped + duplicates };
      },
    ])
  ),

  /**
   * The academic corpus — papers measuring AI's economic effects.
   *
   * A document job rather than an indicator job for the obvious reason (it
   * produces text, not numbers) and a less obvious one: nothing here derives a
   * figure from it. These works are CANDIDATES for `question_reading`, and
   * which of them ends up cited on a page — with what stance, under what
   * takeaway — is an editorial decision a person makes later. See
   * 0012_editorial.sql.
   *
   * One job for both strands rather than two, because `ingestion_runs.source_id`
   * is a foreign key into `sources` and 'openalex:journals' is not a provider,
   * it is half a query. The per-strand counts go into the run's `details`
   * instead, which is where a thin strand should be visible.
   *
   * Roughly fourteen requests and a minute of wall time for the full corpus.
   * It re-fetches from CORPUS_START every run rather than a rolling window:
   * OpenAlex back-fills abstracts and DOIs onto works it indexed months ago, so
   * a window would permanently miss the ones that arrived incomplete.
   */
  openalex: async () => {
    const { documents, strands, truncated } = await openalex.fetchCorpus();

    if (truncated) {
      console.warn(
        '  note  the OpenAlex corpus hit the per-strand page cap; it is a ' +
          'lower bound and the query has grown past what this job expects'
      );
    }

    const { written, duplicates, skipped } = await insertDocuments(documents);
    return {
      written,
      fetched: documents.length,
      skipped: skipped + duplicates,
      details: {
        strands: strands.map((s) => ({
          strand: s.id,
          matched: s.total,
          kept: s.documents,
          vetoed: s.vetoed,
          unusable: s.unusable,
        })),
      },
    };
  },
};

/**
 * Match a job filter against document job names.
 *
 * `rss` matches every `rss:*` feed; `rss:guardian` matches exactly one. The
 * prefix form is what anyone actually types, and having it silently match
 * nothing is the failure this whole section exists to fix.
 */
export function matchDocumentJobs(sourceId) {
  const names = Object.keys(DOCUMENT_JOBS);
  if (!sourceId) return names;
  return names.filter((n) => n === sourceId || n.startsWith(`${sourceId}:`));
}

/** Run one document job inside the same audit wrapper as everything else. */
async function runDocumentJob(name) {
  const runId = await startRun(`documents:${name}`, name);
  try {
    // `details` is optional: a job that has more to say than a count returns
    // one, and it is merged rather than replacing `fetched`, which every job has.
    const { written, fetched, skipped, details } = await DOCUMENT_JOBS[name]();
    await finishRun(runId, {
      status: 'succeeded',
      written,
      skipped,
      details: { fetched, ...details },
    });
    return { written, fetched, skipped };
  } catch (error) {
    await finishRun(runId, { status: 'failed', error: error.message });
    throw error;
  }
}

/**
 * How each job finished LAST time, before this run writes anything.
 *
 * Two questions need an answer that a single run cannot give, and both of them
 * are about change rather than state:
 *
 *   Did a job that worked yesterday stop working today? That is news, and it
 *   must be news even for a job on the workflow's allow-to-fail list — a source
 *   that is being tolerated because it is broken is being tolerated on the
 *   understanding that it stays broken. The day it works and then breaks again,
 *   the list is hiding a live failure.
 *
 *   Did a job succeed while returning NOTHING? That is the rot this whole
 *   runner exists to catch, one level up: not "nobody ran the job" but "the job
 *   ran and the data did not move". The runner has always stored `fetched` per
 *   run and nothing has ever read it, so a feed that started returning an empty
 *   array succeeded, was marked fresh, and appeared nowhere.
 *
 * Taken BEFORE the first job starts, or `DISTINCT ON … ORDER BY started_at
 * DESC` would return this run's own row and every job would look unchanged.
 *
 * Keyed on everything after the first colon of `job_name`, which is what the
 * outer loops know a job as, what the `FAIL` lines print, and what
 * `INGEST_ALLOW_FAIL` is written in: `fred:fred.PAYEMS` → `fred.PAYEMS`,
 * `documents:rss:ft` → `rss:ft`.
 *
 * `computed` is read alongside `fetched` because derived jobs store their count
 * under that name — and the two standing failures are both derived jobs, so a
 * check that skipped them would skip the cases it was written for.
 *
 * Ninety days, not all of history: a monthly series compared against a run from
 * another season is not a regression signal, it is a different question.
 */
async function previousOutcomes() {
  const { rows } = await query(
    `SELECT DISTINCT ON (job_name)
            substring(job_name from position(':' in job_name) + 1) AS id,
            job_name,
            status,
            finished_at,
            COALESCE(details->>'fetched', details->>'computed') AS fetched
       FROM ingestion_runs
      WHERE status IN ('succeeded', 'failed')
        AND started_at > now() - INTERVAL '90 days'
      ORDER BY job_name, started_at DESC`
  );

  const history = {};
  for (const row of rows) {
    history[row.id] = {
      status: row.status,
      finishedAt: row.finished_at,
      fetched: row.fetched === null ? null : Number(row.fetched),
    };
  }
  return history;
}

/**
 * Which of this run's outcomes are WORSE than the same job's last outcome.
 *
 * Pure, and exported, because it is the whole decision and a decision buried in
 * a loop that only runs against live upstreams is a decision nobody can test.
 * Everything it needs arrives as an argument.
 *
 * A job with no history is never a regression. A first run has nothing to be
 * worse than, and treating "new" as "broken" would make every added indicator
 * paint the nightly run red on the day it lands.
 *
 * @param {{id: string, status: 'succeeded'|'failed', fetched?: number}[]} current
 * @param {Record<string, {status: string, finishedAt?: unknown, fetched: number|null}>} history
 * @returns {{id: string, kind: string, message: string}[]}
 */
export function detectRegressions(current, history) {
  const regressions = [];

  for (const job of current) {
    const before = history?.[job.id];
    if (!before) continue;

    if (job.status === 'failed') {
      if (before.status === 'succeeded') {
        regressions.push({
          id: job.id,
          kind: 'newly_failing',
          message:
            'succeeded on its previous run and failed on this one — this is not a ' +
            'standing condition, whatever the allow-to-fail list says',
        });
      }
      continue;
    }

    /*
     * Succeeded. The dangerous case: a green tick over an empty response.
     *
     * Only asserted where there is something to compare against — a job that
     * returned nothing last time and nothing this time is a known-empty source,
     * not a change, and the site's staleness reporting is the right place for
     * that. `fetched` absent (an older run, or a job that never reported one)
     * is not evidence either way.
     */
    if (!Number.isFinite(job.fetched)) continue;
    if (!Number.isFinite(before.fetched)) continue;

    if (job.fetched === 0 && before.fetched > 0) {
      regressions.push({
        id: job.id,
        kind: 'returned_nothing',
        message:
          `returned 0 rows, having returned ${before.fetched} on its previous run — ` +
          'it reported success and the data did not move',
      });
    }
  }

  return regressions;
}

/**
 * The allow-to-fail list, parsed.
 *
 * Whitespace- or comma-separated job ids, exactly as `INGEST_ALLOW_FAIL` is
 * written in `.github/workflows/ingest.yml`. Empty — which is what a laptop
 * has, because nothing sets the variable there — means every failure is fatal.
 * That default is deliberate: a run on a developer's machine must not inherit
 * the nightly job's tolerance for a source that is broken only on GitHub's
 * runners.
 *
 * @param {string|undefined|null} value
 * @returns {string[]}
 */
export function parseAllowFail(value) {
  return String(value ?? '')
    .split(/[\s,]+/)
    .filter(Boolean);
}

/**
 * What this run's exit code should be, and why.
 *
 * WHY THIS IS HERE AND NOT ONLY IN THE WORKFLOW
 *
 * The rule used to live only in shell, inside `.github/workflows/ingest.yml`,
 * re-derived by grepping the log. That is not a thing anyone can test: the only
 * way to find out whether a GDELT ECONNRESET on a GitHub runner would produce a
 * green run was to wait until 05:40 UTC and read the email. Two waves of work
 * shipped "the failure policy" without ever demonstrating the exit code it
 * produces, and the workflow stayed red.
 *
 * So the decision lives here, pure, taking everything it needs as arguments. It
 * can be driven with stubbed job results and asserted both ways, which is what
 * `runner.test.js` does. The workflow reads the `VERDICT` line this produces and
 * cross-checks it against its own parse of the log; a disagreement between the
 * two is itself blocking.
 *
 * THE ORDER OF THE BRANCHES IS THE POLICY.
 *
 *   1. An abort is never excusable. The run threw before it could finish, so
 *      the absence of FAIL lines says nothing about whether anything worked.
 *   2. A REGRESSION outranks the allow list. A source is tolerated on the
 *      understanding that it stays broken; the day it works and breaks again,
 *      tolerating it would be hiding a live failure. Testing this after the
 *      allow list would let "only known-degraded jobs failed" swallow it.
 *   3. Any failure not on the list is fatal — the default for everything.
 *   4. Only then: failures entirely inside the list pass, loudly.
 *
 * @param {{
 *   failures?: ({id: string}|string)[],
 *   regressions?: ({id: string}|string)[],
 *   aborted?: boolean,
 *   allowFail?: string,
 * }} outcome
 * @returns {{
 *   code: 0|1, verdict: 'pass'|'fail', reason: string,
 *   allowed: string[], blocking: string[], regressed: string[],
 * }}
 */
export function classifyOutcome({
  failures = [],
  regressions = [],
  aborted = false,
  allowFail = '',
} = {}) {
  const id = (entry) => (typeof entry === 'string' ? entry : entry?.id);
  const allowList = new Set(parseAllowFail(allowFail));

  const failedIds = failures.map(id).filter(Boolean);
  const allowed = failedIds.filter((job) => allowList.has(job));
  const blocking = failedIds.filter((job) => !allowList.has(job));
  const regressed = regressions.map(id).filter(Boolean);

  const decide = (verdict, reason) => ({
    code: verdict === 'pass' ? 0 : 1,
    verdict,
    reason,
    allowed,
    blocking,
    regressed,
  });

  if (aborted) return decide('fail', 'the run aborted before finishing');
  if (regressed.length > 0) {
    return decide('fail', `job(s) worse than their own last run: ${regressed.join(' ')}`);
  }
  if (blocking.length > 0) {
    return decide('fail', `failures outside the allow-to-fail list: ${blocking.join(' ')}`);
  }
  if (allowed.length > 0) {
    return decide('pass', `only known-degraded jobs failed: ${allowed.join(' ')}`);
  }
  return decide('pass', 'every job succeeded');
}

/**
 * Print the verdict, for a person and for the workflow.
 *
 * The `VERDICT` line is the machine-readable one — `.github/workflows/ingest.yml`
 * greps for it. The warning above it is for whoever opens the log: a run that
 * exits 0 while a source is broken has to say so where it cannot be missed, or
 * the allow list becomes the same silence as a permanently red X.
 */
function printVerdict(decision, log = console.log) {
  if (decision.allowed.length > 0) {
    log(
      `\n  WARNING  known-degraded source(s) failed: ${decision.allowed.join(', ')}\n` +
        '           Tolerated by INGEST_ALLOW_FAIL, so this run does not go red.\n' +
        '           Take a job off that list the moment it is fixed.'
    );
  }
  log(`\nVERDICT ${decision.verdict} — ${decision.reason}`);
}

/**
 * Run all due ingestion jobs.
 *
 * One failing indicator must not abort the rest: sources fail independently,
 * and a FRED outage should not cost us the World Bank refresh. Failures are
 * recorded and reported at the end.
 */
export async function runIngestion({ sourceId = null, force = false } = {}) {
  const history = await previousOutcomes();
  /** What each job did THIS run, for the comparison at the end. */
  const outcomes = [];

  const indicators = await dueIndicators({ sourceId, force });

  /**
   * No early return when the fetch list is empty.
   *
   * This used to return here, which made the derived pass below reachable only
   * when at least one FETCH job happened to be due. Derived indicators refresh
   * on their own schedule and frequently have none — so a newly added
   * computation would print "Nothing due", never run, and leave an empty chart
   * with nothing in the audit log to explain it.
   */
  if (indicators.length > 0) {
    console.log(`Ingesting ${indicators.length} indicator(s)…\n`);
  }

  let succeeded = 0;
  let failed = 0;
  let totalWritten = 0;
  const failures = [];

  for (const indicator of indicators) {
    const handler = HANDLERS[indicator.source_id];

    if (!handler) {
      console.log(`  skip  ${indicator.id}  (no handler for source "${indicator.source_id}")`);
      continue;
    }

    try {
      const { written, fetched } = await handler(indicator);
      totalWritten += written;
      succeeded += 1;
      outcomes.push({ id: indicator.id, status: 'succeeded', fetched });
      console.log(`  ok    ${indicator.id.padEnd(32)} ${written} written / ${fetched} fetched`);
    } catch (error) {
      failed += 1;
      outcomes.push({ id: indicator.id, status: 'failed' });
      failures.push({ id: indicator.id, message: error.message.split('\n')[0] });
      console.log(`  FAIL  ${indicator.id.padEnd(32)} ${error.message.split('\n')[0]}`);
    }
  }

  // ── Pass two: documents ───────────────────────────────────────────────────
  // Before the derived pass, because `derived.ai_news_volume` is computed FROM
  // the documents table and would otherwise measure the previous run's corpus.
  const docJobs = matchDocumentJobs(sourceId);

  // Naming a job that does not exist must be loud. Silently running nothing is
  // exactly how this pipeline went unnoticed for as long as it did.
  if (sourceId && docJobs.length === 0 && indicators.length === 0) {
    console.log(
      `Nothing matched "${sourceId}". Known document jobs: ${Object.keys(DOCUMENT_JOBS).join(', ')}.`
    );
  }

  if (docJobs.length > 0) {
    console.log(`\nFetching ${docJobs.length} document source(s)…\n`);
    for (const name of docJobs) {
      try {
        const { written, fetched, skipped } = await runDocumentJob(name);
        totalWritten += written;
        succeeded += 1;
        outcomes.push({ id: name, status: 'succeeded', fetched });
        console.log(`  ok    ${name.padEnd(32)} ${written} new / ${fetched} fetched / ${skipped} already held`);
      } catch (error) {
        failed += 1;
        outcomes.push({ id: name, status: 'failed' });
        failures.push({ id: name, message: error.message.split('\n')[0] });
        console.log(`  FAIL  ${name.padEnd(32)} ${error.message.split('\n')[0]}`);
      }
    }
  }

  // ── Pass three: derived indicators ────────────────────────────────────────
  // Run after fetch jobs, not alongside them: a derived metric computed from
  // observations must see this run's fresh data, not the previous run's.
  const derived = await dueDerivedIndicators({ sourceId, force });
  const unimplemented = [];

  if (derived.length > 0) {
    console.log(`\nComputing ${derived.length} derived indicator(s)…\n`);

    for (const indicator of derived) {
      if (!DERIVED_JOBS[indicator.id]) {
        unimplemented.push(indicator.id);
        console.log(`  todo  ${indicator.id.padEnd(32)} (no computation defined yet)`);
        continue;
      }

      try {
        const { written, fetched } = await runDerivedJob(indicator);
        totalWritten += written;
        succeeded += 1;
        outcomes.push({ id: indicator.id, status: 'succeeded', fetched });
        console.log(`  ok    ${indicator.id.padEnd(32)} ${written} written / ${fetched} computed`);
      } catch (error) {
        failed += 1;
        outcomes.push({ id: indicator.id, status: 'failed' });
        failures.push({ id: indicator.id, message: error.message.split('\n')[0] });
        console.log(`  FAIL  ${indicator.id.padEnd(32)} ${error.message.split('\n')[0]}`);
      }
    }
  }

  console.log(`\n${succeeded} succeeded · ${failed} failed · ${totalWritten} rows written`);

  // Report these explicitly rather than leaving them to be discovered as blank
  // panels. An indicator with no computation is a product decision outstanding,
  // not a bug, but it must be visible either way.
  if (unimplemented.length > 0) {
    console.log(
      `\n${unimplemented.length} derived indicator(s) have no computation defined:\n` +
        unimplemented.map((id) => `  ${id}`).join('\n')
    );
  }

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  ${f.id}\n    ${f.message}`);
    console.log(
      '\nIf these are "no fixture recorded" errors, this environment has no ' +
      'network access to data providers — run locally or widen the allowlist.'
    );
  }

  /*
   * What changed for the worse since the last run.
   *
   * Printed in the same column shape as the `FAIL` lines above, because
   * `.github/workflows/ingest.yml` parses both and a REGRESSION line is
   * BLOCKING whatever `INGEST_ALLOW_FAIL` says. That is the whole point of
   * separating them: the allow list exists so a source that is known to be
   * broken stops painting the run red every morning, and a source that was
   * WORKING yesterday is by definition not that.
   *
   * Written after the failure block so that the last thing on the log is the
   * thing worth acting on.
   */
  const regressions = detectRegressions(outcomes, history);
  if (regressions.length > 0) {
    console.log('');
    for (const r of regressions) {
      console.log(`  REGRESSION  ${r.id.padEnd(32)} ${r.message}`);
    }
  }

  // `failures` is returned as well as counted: `classifyOutcome` needs the ids,
  // because whether a failure is fatal depends on which job it was.
  return { succeeded, failed, written: totalWritten, failures, regressions };
}

/**
 * The command line, as a function — argv in, exit code out.
 *
 * WHY THIS IS NOT LEFT AS A BARE `if (process.argv[1] === …)` BLOCK
 *
 * B-20 is a claim about an EXIT CODE: a nightly run whose only failure is a
 * declared-degraded source must exit 0, and a run where FRED fails must exit 1.
 * `classifyOutcome` returning `{code: 0}` is not that claim — between the two
 * sits the wiring that reads INGEST_ALLOW_FAIL out of the environment, catches
 * an abort, and assigns `process.exitCode`. A top-level block only runs when
 * this file is the entry point, and it opens a database, so nothing could drive
 * it. Wave 3 worked around that by writing a test that re-implemented those
 * lines in a probe; changing `process.exitCode = decision.code` to
 * `process.exitCode = 1` left all 29 tests green. A test that cannot fail is
 * how this finding survived three waves.
 *
 * Everything the block needs now arrives as an argument, so `runner.test.js`
 * drives THIS function in a child process with a stubbed `run` and reads the
 * code the shell would read. The entry point below is one call.
 *
 * `run` and `shutdown` are injectable for exactly one reason — to be stubbed.
 * Nothing in this repository passes them.
 *
 * @param {{
 *   argv?: string[], env?: Record<string, string|undefined>,
 *   run?: typeof runIngestion, shutdown?: () => Promise<void>,
 *   log?: (message: string) => void, reportError?: (message: string) => void,
 * }} options
 * @returns {Promise<0|1>}
 */
export async function runCli({
  argv = [],
  env = process.env,
  run = runIngestion,
  shutdown = closePool,
  log = console.log,
  reportError = console.error,
} = {}) {
  const force = argv.includes('--force');
  const sourceId = argv.find((a) => !a.startsWith('--')) ?? null;

  if (config.useFixtures) {
    log('Running in FIXTURE mode (USE_FIXTURES=true). No network calls will be made.\n');
  }

  let code;
  try {
    const result = await run({ sourceId, force });
    /*
     * A regression is non-zero even when nothing failed: a job that succeeded
     * and returned an empty response is the failure mode this project keeps
     * naming, and it does not raise.
     *
     * INGEST_ALLOW_FAIL is read here rather than in `runIngestion` so that the
     * function stays a pure "run the jobs and report" and the policy stays one
     * testable call. Unset — every environment except the workflow — means an
     * empty list, so any failure exits 1.
     */
    const decision = classifyOutcome({
      failures: result.failures,
      regressions: result.regressions,
      allowFail: env.INGEST_ALLOW_FAIL,
    });
    printVerdict(decision, log);
    code = decision.code;
  } catch (error) {
    // This exact prefix is what the workflow greps for; an abort that printed
    // only a VERDICT line would be indistinguishable from a clean finish in the
    // logs a person reads.
    reportError(`\nIngestion aborted: ${error.message}`);
    printVerdict(classifyOutcome({ aborted: true }), log);
    code = 1;
  } finally {
    await shutdown();
  }

  process.exitCode = code;
  return code;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runCli({ argv: process.argv.slice(2) });
}

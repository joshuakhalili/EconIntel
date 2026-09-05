import { RiExternalLinkLine } from '@remixicon/react';
import { useStatus } from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock } from '@/components/Page';
import { useReveal, revealClass } from '@/hooks/useReveal';
import { isFuturePeriod } from '@/components/periodModel';
import PageHero from '@/components/PageHero';

/**
 * Where the numbers come from.
 *
 * WHAT THIS PAGE USED TO BE, AND WHY IT CHANGED
 *
 * Four stat tiles and three data tables — the last dashboard on a site that is
 * a publication. It was also answering the wrong question. Its main table
 * listed which INTEGRATIONS were configured, which is a fact about the
 * server's environment file, while a reader asking "where does this come
 * from?" wants to know who actually supplied the data.
 *
 * The honest answer to that is uncomfortable and was nowhere on the page: two
 * sources carry 79% of every observation on this site. LBMA metals prices and
 * FRED are 29,488 and 29,188 rows; the remaining six sources share 14,869
 * between them. Anyone weighing how much to trust this should be told that
 * first, so it is now the page's organising fact and the register is ordered
 * by it, with each source's share drawn as literal width.
 *
 * Licence sits on each row for the same reason. It is a condition of use for
 * several of these and was previously reachable only one series at a time.
 *
 * The BoardUI Table component went with the redesign, which is not incidental:
 * it was pulling ~190 kB into this route's chunk to render three lists.
 */
export default function PipelinePage() {
  const { data: status, isPending, isError, error } = useStatus();

  usePageTitle('Where this comes from', 'Sources, licences and the state of every job');

  if (isPending) return <LoadingBlock rows={4} />;
  if (isError) return <ErrorBlock error={error} what="the pipeline status" />;

  const { counts, recentRuns, staleIndicators, sources = [], integrations } = status;

  const measured = sources.filter((s) => s.observations > 0);
  const reported = sources.filter((s) => s.observations === 0 && s.documents > 0);
  const totalObservations = measured.reduce((sum, s) => sum + s.observations, 0);
  const missing = integrations.filter((i) => !i.ready);

  /*
   * "Countries" here used to be `count(*) FROM countries` — six of those rows
   * are aggregates (World, EU, OECD…) and one holds nothing at all. The
   * overview prints coverage instead, and two provenance pages printing
   * different country counts is precisely the defect this page exists to
   * catch, so both print the same figure under a label that says which one it
   * is. A figure whose column has not arrived is dropped rather than
   * substituted: a coverage label over a row count would be worse than no
   * figure. "Sources supplying" is the length of the register printed below
   * it, so the two cannot disagree.
   */
  const figures = [
    ['Observations', counts.observations],
    ['Active indicators', counts.indicators],
    ['Documents', counts.documents],
    ['Countries with data', counts.countries_with_data],
    ['Sources supplying', sources.length],
  ].filter(([, value]) => value != null);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHero
        eyebrow="Provenance"
        title="Where this comes from"
        figures={figures}
      >
        A dashboard that will not show its own plumbing is asking to be trusted
        rather than checked. This is every source, what it is licensed under,
        when each job last ran, and which of them are late.
      </PageHero>

      <Register
        eyebrow="Measurements"
        title="Who supplies the numbers"
        note={
          measured.length > 0
            ? `${shareOfTopTwo(measured, totalObservations)} of every observation on this site comes from two sources. That concentration is the single most important thing to know about this data, so it is drawn rather than described.`
            : undefined
        }
        rows={measured}
        total={totalObservations}
        unit="observations"
      />

      <Register
        eyebrow="Reporting"
        title="Who supplies the coverage"
        note="News and official communications. These carry no measurements — nothing on a chart comes from them. They are the context layer: what was being said around a period."
        rows={reported}
        total={reported.reduce((sum, s) => sum + s.documents, 0)}
        unit="articles"
        field="documents"
      />

      <Runs runs={recentRuns} />
      {/* `counts.stale_indicators` does not exist yet — /api/status sends the
          staleness list under a LIMIT and publishes no total. Read here rather
          than waited for, so the day the field lands this band starts printing
          a real count with no change on this page. */}
      <Stale rows={staleIndicators} total={counts.stale_indicators ?? null} />

      {missing.length > 0 && <NotConfigured integrations={missing} />}
    </div>
  );
}

/** The share the top two sources hold, as a sentence-ready percentage. */
function shareOfTopTwo(rows, total) {
  if (total === 0) return '0%';
  const top = rows.slice(0, 2).reduce((sum, s) => sum + s.observations, 0);
  return `${Math.round((top / total) * 100)}%`;
}

/* ── The band the whole page is built from ──────────────────────────────── */

function Band({ children, eyebrow, title, note }) {
  const [ref, revealed] = useReveal();

  return (
    <section
      ref={ref}
      className={`mt-12 rounded-3xl border border-border-button-default bg-panel p-6 sm:p-8 ${revealClass(revealed)}`}
    >
      <p className="eyebrow text-signal">{eyebrow}</p>
      <h2 className="mt-3 text-title-2-medium leading-tight text-text-primary">{title}</h2>
      {note && (
        <p className="prose-measure mt-3 text-body-regular leading-relaxed text-text-tertiary">
          {note}
        </p>
      )}
      {children}
    </section>
  );
}

/**
 * A source register, ordered by contribution, with share as width.
 *
 * The same device the Policy lens uses for enforceability: the quantity that
 * matters is the row's visual weight, so the ranking is legible before any
 * number is read. Here the quantity is how much of the site each source is
 * responsible for.
 */
function Register({ eyebrow, title, note, rows, total, unit, field = 'observations' }) {
  if (rows.length === 0) return null;

  return (
    <Band eyebrow={eyebrow} title={title} note={note}>
      <ul className="mt-7 flex flex-col">
        {rows.map((source) => {
          const value = source[field] ?? 0;
          const share = total > 0 ? value / total : 0;

          return (
            <li
              key={source.id}
              className="border-t border-border-button-default py-4 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <a
                  href={source.homepage_url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tint inline-flex items-center gap-1.5 text-body-medium text-text-primary hover:text-signal"
                >
                  {source.name}
                  {source.homepage_url && (
                    <RiExternalLinkLine className="size-3.5 shrink-0" aria-hidden />
                  )}
                </a>
                <span className="figure text-caption-1-regular text-text-secondary">
                  {value.toLocaleString()} {unit}
                  <span className="text-text-tertiary">
                    {' · '}
                    {share < 0.001 ? '<0.1' : (share * 100).toFixed(1)}%
                  </span>
                </span>
              </div>

              {/* The bar IS the ranking. Rounded to a hairline minimum so a
                  source with 12 rows still draws something — a bar of zero
                  width reads as missing data rather than as a small share. */}
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-raised">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(share * 100, 0.6)}%`,
                    background: 'var(--color-electric)',
                  }}
                  aria-hidden
                />
              </div>

              <p className="mt-2 flex flex-wrap gap-x-3 text-caption-1-regular text-text-tertiary">
                {source.indicators > 0 && (
                  <span>
                    {source.indicators} {source.indicators === 1 ? 'series' : 'series'}
                  </span>
                )}
                <span>{source.licence ?? 'licence not recorded'}</span>
                {/* A period after today is a published forecast, not coverage.
                    One source here carries European Commission projections
                    inside an AMECO history and was printing "latest 2027-01-01"
                    with no marker — on the page a sceptic checks first. What
                    the payload cannot say is where the measured part ends; that
                    needs the server to publish it, so the claim made here is
                    only the one the date itself proves. */}
                {source.latest_period && (
                  <span>
                    latest {source.latest_period}
                    {isFuturePeriod(source.latest_period) && ' · a forecast, not a measurement'}
                  </span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </Band>
  );
}

function Runs({ runs }) {
  if (!runs || runs.length === 0) return null;

  const failed = runs.filter((r) => r.status === 'failed');

  return (
    <Band
      eyebrow="Jobs"
      title="What ran, and what broke"
      note="The fifteen most recent ingestion runs. A failure is kept and shown rather than retried into silence — the run that vanishes is the one you needed to see."
    >
      {failed.length > 0 && (
        <p className="mt-5 rounded-2xl border border-border-button-default px-4 py-3 text-body-regular text-text-secondary">
          <span style={{ color: 'var(--color-neg)' }}>
            {failed.length} of the last {runs.length} runs failed.
          </span>{' '}
          Their messages are below, redacted at the point of storage so a
          request URL carrying a key can never reach this page.
        </p>
      )}

      <ul className="mt-6 flex flex-col">
        {runs.map((run, i) => (
          <li
            key={`${run.job_name}-${run.started_at}-${i}`}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-border-button-default py-3 first:border-t-0 first:pt-0"
          >
            <span
              className="mt-1.5 size-1.5 shrink-0 rounded-full"
              style={{ background: statusColour(run.status) }}
              aria-hidden
            />
            <span className="figure min-w-0 flex-1 truncate text-caption-1-regular text-text-secondary">
              {run.job_name}
            </span>
            <span className="figure text-caption-1-regular text-text-tertiary">
              {run.rows_written == null ? '—' : `${run.rows_written.toLocaleString()} rows`}
            </span>
            <span className="figure w-28 text-right text-caption-1-regular text-text-tertiary">
              {run.finished_at
                ? new Date(run.finished_at).toLocaleString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'still running'}
            </span>
            {run.error_message && (
              <span
                className="prose-measure w-full text-caption-1-regular"
                style={{ color: 'var(--color-neg)' }}
              >
                {run.error_message}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Band>
  );
}

/**
 * What has stopped publishing.
 *
 * THIS LIST USED TO BE EMPTY, AND THAT WAS THE DEFECT.
 *
 * The query behind it tested `last_ingested_at`, which is set on any
 * successful fetch INCLUDING one that returned nothing new. Every active
 * series had been fetched the night before, so the query returned no rows and
 * this page told the reader "Nothing is late. Every active series has run
 * inside its own cadence" while more than half the catalogue held nothing
 * newer than a year — the worst of them nothing newer than 2020. On the one
 * page whose entire job is to say how much to trust the numbers, that is the
 * most expensive sentence on the site.
 *
 * It now measures the DATA: the newest period actually holding a value,
 * against the series' own cadence. The note that used to disclaim a wrong
 * list now describes a right one, and the gap between "we last asked" and
 * "the newest number we hold" is printed where it is large, because a job
 * that has succeeded every night for six years while returning nothing is the
 * exact failure the old badge could not see.
 *
 * AND THE COUNT ABOVE IT WAS A CAPPED LIST PRINTED AS A TOTAL.
 *
 * The query behind this ends `LIMIT 40` and the response carries no total, so
 * `rows.length` is the length of a truncated list. It printed "38 series are
 * behind" — true on the day it was written, and false the moment two more
 * series fall behind, with nothing on the page changing to say so. A sentence
 * that goes wrong on its own while the code stays still is worse than one that
 * is wrong today, because nobody is looking when it turns.
 *
 * So the count is now stated as what it provably is — the rows this page was
 * sent, ordered worst-first — with the cap named rather than left to be
 * inferred. `total` is the honest fix and is read the moment the endpoint
 * publishes it.
 */
function Stale({ rows = [], total = null }) {
  return (
    <Band
      eyebrow="Freshness"
      title="What is late"
      note="Measured on the data, not on the job. A series is listed when its newest published value is more than three of its own periods old — three, because every publisher runs behind its own reference period and one period late is ordinary. Where a job is still running successfully against a series that has stopped publishing, that gap is named: fetching cleanly and finding nothing is not freshness."
    >
      {rows.length === 0 ? (
        <p className="mt-6 text-body-regular text-text-secondary">
          Nothing is late. Every active series has published inside its own cadence.
        </p>
      ) : (
        <>
          <p className="mt-5 text-body-regular text-text-secondary">
            {/* No denominator is invented in either branch. Inventing "of 125"
                here is the class of thing this page exists to stop, and so is
                printing the length of a capped list as though it were the
                answer to "how many are late". */}
            {total == null ? (
              <>
                The <span className="figure">{rows.length}</span> furthest behind are listed,
                worst first. This page is sent a capped list and no total, so it cannot say
                whether these are all of them.
              </>
            ) : (
              <>
                <span className="figure">{total}</span>{' '}
                {total === 1 ? 'series is' : 'series are'} behind
                {rows.length < total && (
                  <>
                    , of which the <span className="figure">{rows.length}</span> furthest behind
                    are listed
                  </>
                )}
                , worst first.
              </>
            )}
          </p>

          <ul className="mt-6 flex flex-col">
            {rows.map((row) => (
              <li
                key={row.id ?? row.indicator_id}
                className="border-t border-border-button-default py-3 first:border-t-0 first:pt-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="min-w-0 flex-1 text-body-regular text-text-secondary">
                    {row.name ?? row.id ?? row.indicator_id}
                  </span>
                  <span className="figure text-caption-1-regular text-text-tertiary">
                    {row.latest_period ? `newest value ${row.latest_period}` : 'no value ever'}
                    {row.days_behind != null && (
                      <>
                        {' · '}
                        {row.days_behind.toLocaleString('en-GB')} days behind
                      </>
                    )}
                  </span>
                </div>

                {/* A year of successful fetches that moved nothing. Named
                    rather than left to be inferred from two dates. */}
                {row.ingest_gap_days > 365 && row.last_ingested_at && (
                  <p className="mt-1 text-caption-1-regular text-text-tertiary">
                    Fetched {row.last_ingested_at.slice(0, 10)} and has returned nothing new for{' '}
                    <span className="figure">
                      {row.ingest_gap_days.toLocaleString('en-GB')}
                    </span>{' '}
                    days.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Band>
  );
}

/**
 * Sources that could work and do not, because no key is configured.
 *
 * Listed rather than hidden. An absent number and an unconfigured source are
 * different problems, and only one of them means the data does not exist.
 */
function NotConfigured({ integrations }) {
  return (
    <Band
      eyebrow="Not configured"
      title="What is switched off"
      note="These would supply data and currently do not, because this server has no key for them. Shown because an absent number and an unconfigured source are different problems, and only one of them is about the world."
    >
      <ul className="mt-6 flex flex-col">
        {integrations.map((integration) => (
          <li
            key={integration.name}
            className="border-t border-border-button-default py-3 first:border-t-0 first:pt-0"
          >
            <p className="text-body-regular text-text-secondary">{integration.name}</p>
            <p className="mt-0.5 text-caption-1-regular text-text-tertiary">{integration.note}</p>
          </li>
        ))}
      </ul>
    </Band>
  );
}

function statusColour(status) {
  if (status === 'succeeded') return 'var(--color-pos)';
  if (status === 'failed') return 'var(--color-neg)';
  return 'var(--color-warn)';
}

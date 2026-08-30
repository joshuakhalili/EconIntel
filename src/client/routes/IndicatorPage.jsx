import { Link, useParams } from 'react-router-dom';
import { RiArrowLeftLine, RiExternalLinkLine } from '@remixicon/react';
import { useIndicator, useSeries } from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { useContextDrawer } from '@/components/chrome/ContextDrawer';
import { LoadingBlock, ErrorBlock } from '@/components/Page';
import ChartCard from '@/components/charts/ChartCard';
import SeriesChart from '@/components/charts/SeriesChart';
import { fmt, fmtDate, displayUnit } from '@/lib/format';

/**
 * One series, on its own terms.
 *
 * Reached from the data browser rather than from an argument, so the reader
 * arrives without the context a question page supplies. That makes provenance
 * the point of this page rather than a footer on it: what the number is, who
 * publishes it, how often it updates, when it was last pulled, and on what
 * licence it may be reused. The licence in particular has never been visible
 * anywhere in this interface despite being recorded for every source.
 *
 * It also names the question that argues with this series, because a bare
 * chart is far less legible than one you know the purpose of.
 */
export default function IndicatorPage() {
  const { id } = useParams();
  const { data: indicator, isPending, isError, error } = useIndicator(id);
  const { open } = useContextDrawer();

  const { data: payload, isPending: seriesPending } = useSeries(id ? [id] : [], {}, {
    enabled: Boolean(id),
  });

  usePageTitle(indicator?.name ?? 'Series', indicator?.source_name);

  if (isPending) return <LoadingBlock rows={3} />;
  if (isError) return <ErrorBlock error={error} what="this series" />;

  const caption = indicator.caption_plain;

  return (
    <article className="mx-auto max-w-4xl">
      <Link
        to="/data"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-body-regular text-text-tertiary hover:text-text-secondary"
      >
        <RiArrowLeftLine className="size-4" aria-hidden />
        The data
      </Link>

      <h1 className="text-display-4-medium text-text-primary">{indicator.name}</h1>
      {indicator.description && (
        <p className="prose-measure mt-2 text-headline-regular text-text-tertiary">
          {indicator.description}
        </p>
      )}

      <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
        <Fact label="Observations" value={fmt(indicator.observation_count ?? 0, 0)} />
        <Fact
          label="Covers"
          value={
            indicator.first_period && indicator.last_period
              ? `${indicator.first_period.slice(0, 4)}–${indicator.last_period.slice(0, 4)}`
              : '—'
          }
        />
        <Fact label="Updates" value={indicator.cadence ?? '—'} />
        <Fact
          label="Unit"
          value={displayUnit(indicator.unit) || '—'}
          title={indicator.unit ?? undefined}
        />
        <Fact label="Confidence" value={indicator.confidence_tier ?? '—'} />
      </dl>

      <div className="mt-6">
        <ChartCard title={indicator.name} caption={caption} footer={<span>{indicator.source_name}</span>}>
          {seriesPending ? (
            <LoadingBlock rows={1} />
          ) : (
            <SeriesChart payload={payload} height={340} onPick={open} />
          )}
        </ChartCard>
      </div>

      {/* Where this came from, and what you may do with it. Recorded for every
          source since the first migration and never shown until now. */}
      <section className="mt-8 rounded-2xl border border-border-button-default bg-background-secondary-default p-5">
        <h2 className="text-title-3-medium text-text-primary">Where this comes from</h2>

        <dl className="mt-3 flex flex-col gap-3">
          <Row label="Published by">
            {indicator.source_homepage ? (
              <a
                href={indicator.source_homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent-700 underline underline-offset-2 hover:text-accent-600 dark:text-accent-600"
              >
                {indicator.source_name}
                <RiExternalLinkLine className="size-3.5" aria-hidden />
              </a>
            ) : (
              indicator.source_name
            )}
          </Row>

          {indicator.source_licence && <Row label="Licence">{indicator.source_licence}</Row>}

          {indicator.attribution_text && (
            <Row label="Attribution">
              {/* Several licences oblige us to display this verbatim. */}
              <span className="font-mono text-caption-1-regular">
                {indicator.attribution_text}
              </span>
            </Row>
          )}

          {indicator.source_url && (
            <Row label="This series">
              <a
                href={indicator.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 break-all text-accent-700 underline underline-offset-2 hover:text-accent-600 dark:text-accent-600"
              >
                {indicator.source_url}
                <RiExternalLinkLine className="size-3.5 shrink-0" aria-hidden />
              </a>
            </Row>
          )}

          {indicator.last_ingested_at && (
            <Row label="Last fetched">
              {fmtDate(indicator.last_ingested_at.slice(0, 10), 'monthly')}
            </Row>
          )}
        </dl>

        <p className="mt-4 text-caption-1-regular text-text-tertiary">
          Diffusion links and cites; it does not redistribute. Take the data from the publisher.
        </p>
      </section>

      {indicator.question_slug && (
        <section className="mt-8">
          <h2 className="text-title-3-medium text-text-primary">Where it is used</h2>
          <Link
            to={`/q/${indicator.question_slug}`}
            className="mt-2 inline-flex items-center gap-2 text-body-regular text-accent-700 underline underline-offset-2 hover:text-accent-600 dark:text-accent-600"
          >
            {indicator.question}
          </Link>
        </section>
      )}
    </article>
  );
}

function Fact({ label, value, title }) {
  return (
    <div title={title}>
      <dt className="text-caption-1-regular text-text-tertiary">{label}</dt>
      <dd className="text-title-3-medium tabular-nums text-text-primary">{value}</dd>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="text-body-regular text-text-tertiary">{label}</dt>
      <dd className="min-w-0 text-body-regular text-text-primary">{children}</dd>
    </div>
  );
}

import { Link, useParams, useSearchParams } from 'react-router-dom';
import { RiArrowLeftLine, RiExternalLinkLine } from '@remixicon/react';
import { useIndicator, useIndicatorCountries, useSeries } from '@/hooks/queries';
import CountrySelect from '@/components/CountrySelect';
import { selectCountry } from '@/components/countrySelection';
import { usePageTitle } from '@/components/chrome/AppShell';
import { useContextDrawer } from '@/components/chrome/ContextDrawer';
import { LoadingBlock, ErrorBlock } from '@/components/Page';
import ChartCard from '@/components/charts/ChartCard';
import SeriesChart from '@/components/charts/SeriesChart';
import { readerDescription, countryScopedCaption } from '@/components/indicatorProse';
import { isFuturePeriod } from '@/components/periodModel';
import { fmt, fmtDate, displayUnit } from '@/lib/format';
import { isProjected } from '../../shared/observationQuality.js';

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
 *
 * THE CHART CARRIES NO TITLE HERE, DELIBERATELY — AND IS STILL NAMED.
 *
 * ChartCard emits an h3, and this page passed it `indicator.name` — the h1
 * verbatim. So the outline ran H1 → H3 (the same words again) → H2 "Where this
 * comes from": a level skipped, a heading duplicated, and a reader navigating
 * by heading told the page has two titles. There is only one thing this page
 * is about and the h1 has already said it, so the card is given no title.
 *
 * Dropping the title dropped the `<figcaption>` with it, and a `<figure>` with
 * no figcaption has no accessible name: a screen reader announced "figure" and
 * left it there, on the one page whose whole subject is that figure. `label`
 * names it without adding a heading — see ChartCard. The placement caption goes
 * back above the chart where a caption belongs, and the footer keeps what a
 * chart footer carries everywhere else in this app: who published the series.
 */
export default function IndicatorPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: indicator, isPending, isError, error } = useIndicator(id);
  const { data: countryPayload, isPending: countriesPending, isError: countriesError, error: countryFailure } = useIndicatorCountries(id);
  const countries = countryPayload?.countries ?? [];
  const requestedCountry = searchParams.get('country')?.toUpperCase() ?? null;
  const selectedCountry = selectCountry(countries, requestedCountry, indicator?.default_country_iso3);
  const unavailableCountry = requestedCountry && !countriesPending && !countries.some((country) => country.country_iso3 === requestedCountry);
  const { open } = useContextDrawer();

  const { data: payload, isPending: seriesPending, isError: seriesError, error: seriesFailure } = useSeries(id ? [id] : [], { countries: selectedCountry ? [selectedCountry] : undefined }, {
    enabled: Boolean(indicator) && !countriesPending && !unavailableCountry && (!indicator?.has_country_dim || Boolean(selectedCountry)),
  });

  usePageTitle(indicator?.name ?? 'Series', indicator?.source_name);

  if (isPending) return <LoadingBlock rows={3} />;
  if (isError) return <ErrorBlock error={error} what="this series" />;

  const caption = countryScopedCaption(indicator, selectedCountry);

  /* The description column holds build notes as well as reader prose — see
     indicatorProse.js. Trimmed at render until the column is split. */
  const description = readerDescription(indicator.description);

  /*
   * WHERE THE MEASUREMENTS STOP, AND WHERE THE SERIES STOPS.
   *
   * They are not the same date for every series. `last_period` on this payload
   * is the newest period holding a value, and a forecast holds a value: AMECO
   * publishes European Commission projections inside the same array as UK
   * productivity history, flagged `projected` per observation. The chart
   * already dashes that tail. "Covers 1990–2027" beside it said the opposite.
   *
   * The per-point flag arrives with the series rather than with the metadata,
   * so the measured end is known only once the chart data has loaded; until
   * then the page falls back to what the date itself proves, which is that a
   * period after today cannot be a measurement.
   */
  const points = payload?.series?.[0]?.points ?? [];
  const measured = points.filter((p) => p.value != null && !isProjected(p) && !isFuturePeriod(p.date));
  const measuredEnd = measured.length > 0 ? measured[measured.length - 1].date : null;
  const lastPeriod = points.filter((point) => point.value != null).at(-1)?.date ?? null;
  const coversEnd = measuredEnd;
  const forecastEnd =
    lastPeriod && coversEnd && lastPeriod > coversEnd
      ? lastPeriod
      : isFuturePeriod(lastPeriod)
        ? lastPeriod
        : null;

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
      {description && (
        <p className="prose-measure mt-2 text-headline-regular text-text-tertiary">
          {description}
        </p>
      )}

      <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
        <Fact label="Observations" value={fmt(points.filter((point) => point.value != null).length, 0)} />
        <Fact
          label="Measured"
          value={
            points[0]?.date && coversEnd
              ? `${points[0].date.slice(0, 4)}–${coversEnd.slice(0, 4)}`
              : '—'
          }
        />
        {forecastEnd && (
          <Fact label="Forecast to" value={forecastEnd.slice(0, 7)} title="Published projections, not measurements. The chart draws them dashed." />
        )}
        <Fact label="Updates" value={indicator.cadence ?? '—'} />
        <Fact
          label="Unit"
          value={displayUnit(indicator.unit) || '—'}
          title={indicator.unit ?? undefined}
        />
        <Fact label="Confidence" value={indicator.confidence_tier ?? '—'} />
      </dl>

      <div className="mt-6">
        {indicator.has_country_dim && <div className="mb-4 flex flex-wrap items-center gap-3">
          <CountrySelect indicator={indicator} value={selectedCountry} onChange={(country) => setSearchParams((previous) => { const next = new URLSearchParams(previous); next.set('country', country); return next; }, { replace: true })} />
          {selectedCountry && <Link className="text-caption-1-regular text-text-secondary underline" to={`/country/${selectedCountry}`}>More data for {countries.find((country) => country.country_iso3 === selectedCountry)?.name}</Link>}
        </div>}
        <ChartCard
          label={indicator.name}
          caption={caption}
          footer={indicator.source_name}
        >
          {countriesError ? <ErrorBlock error={countryFailure} what="the available countries" /> : unavailableCountry ? <p className="text-body-regular text-text-secondary">No non-missing data for the requested country ({requestedCountry}). {selectedCountry && <Link className="underline" to={`/data/${encodeURIComponent(id)}?country=${selectedCountry}`}>Show available data for {selectedCountry}.</Link>}</p> : indicator.has_country_dim && !countriesPending && !selectedCountry ? <p className="text-body-regular text-text-secondary">No non-missing country observations are available yet.</p> : seriesError ? <ErrorBlock error={seriesFailure} what="these observations" /> : seriesPending ? (
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

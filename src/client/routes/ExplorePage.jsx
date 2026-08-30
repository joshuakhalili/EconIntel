import { useMemo, useState } from 'react';
import { RiCloseLine, RiSearchLine } from '@remixicon/react';
import { useIndicators, useSeries } from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock, EmptyBlock, Section } from '@/components/Page';
import ChartCard from '@/components/charts/ChartCard';
import PageHero from '@/components/PageHero';
import CountrySelect from '@/components/CountrySelect';
import { useContextDrawer } from '@/components/chrome/ContextDrawer';
import SeriesChart from '@/components/charts/SeriesChart';
import { displayUnit } from '@/lib/format';

/** The server rejects more than this in one request. */
const MAX_SERIES = 12;

/**
 * Build a chart.
 *
 * The one thing this page must get right is that picking two indicators with
 * different units does not produce a chart with two y-axes. When the units
 * differ the request is sent with index=true and the server rebases every
 * series to 100 at a shared base period, which is stated on the chart rather
 * than left for the reader to infer from the numbers.
 */
export default function ExplorePage() {
  const { data: indicators, isPending, isError, error } = useIndicators({ hasData: true });
  const [chosen, setChosen] = useState([]);
  // Country per chosen indicator, keyed by id. Many indicators hold every
  // country under one id, and asking without naming one returns them all
  // flattened together.
  const [countries, setCountries] = useState({});
  const [search, setSearch] = useState('');
  const { open } = useContextDrawer();

  usePageTitle('Build a chart', 'Put any indicators on one pair of axes');

  const chosenMeta = useMemo(
    () => chosen.map((id) => indicators?.find((i) => i.id === id)).filter(Boolean),
    [chosen, indicators]
  );

  // Different units cannot share a scale. Indexing is the only honest way to
  // put them on one axis; a second axis is not an option.
  const units = new Set(chosenMeta.map((i) => displayUnit(i.unit)).filter(Boolean));
  const mustIndex = units.size > 1;

  // Positional: the endpoint pairs the nth country with the nth id, so a blank
  // is sent for indicators that do not need one.
  const countryList = chosen.map((id) => countries[id] ?? '');

  const { data: payload, isPending: seriesPending, isError: seriesError, error: seriesErrorObj } =
    useSeries(chosen, { countries: countryList, index: mustIndex });

  const matches = useMemo(() => {
    if (!indicators) return [];
    const term = search.trim().toLowerCase();
    const pool = term
      ? indicators.filter(
          (i) =>
            i.name.toLowerCase().includes(term) ||
            i.id.toLowerCase().includes(term) ||
            (i.pillar ?? '').toLowerCase().includes(term)
        )
      : indicators;
    return pool.slice(0, 40);
  }, [indicators, search]);

  if (isPending) return <LoadingBlock rows={3} />;
  if (isError) return <ErrorBlock error={error} what="the indicator list" />;

  const toggle = (id) =>
    setChosen((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      if (current.length >= MAX_SERIES) return current;
      return [...current, id];
    });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHero eyebrow="Workbench" title="Build a chart">
        Put any indicators on one pair of axes. Where the units differ they are
        rebased to 100 at a shared period and the chart says so — there is no
        second y-axis here, because a second scale lets any two lines be made to
        cross wherever the author chooses.
      </PageHero>

      <div className="mt-10 rounded-3xl border border-border-button-default bg-panel p-5 sm:p-6">
        <label className="tint flex items-center gap-2 rounded-2xl bg-raised px-4 py-3 focus-within:ring-1 focus-within:ring-signal">
          <RiSearchLine className="size-4 shrink-0 text-text-tertiary" aria-hidden />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            /* Counted, not hardcoded. This said "Search 110 indicators…" while
               the catalogue held 128 with data — a number frozen at whatever
               it was the day the placeholder was typed. */
            placeholder={`Search ${indicators?.length ?? 0} indicators…`}
            className="min-w-0 flex-1 bg-transparent text-body-regular text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </label>

        {chosen.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {chosenMeta.map((indicator) => (
              <li key={indicator.id} className="flex flex-wrap items-center gap-2">
                {/* The fill, with white on it — the site's one interactive
                    colour. Not a BoardUI chip: those carry their own palette,
                    and `color="blue"` there is a different blue from this
                    site's. */}
                <button
                  type="button"
                  onClick={() => toggle(indicator.id)}
                  aria-label={`Remove ${indicator.name}`}
                  className="tint inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption-1-medium text-on-fill"
                  style={{ background: 'var(--color-electric)' }}
                >
                  {indicator.name}
                  <RiCloseLine className="size-3.5 shrink-0" aria-hidden />
                </button>
                <CountrySelect
                  indicator={indicator}
                  value={countries[indicator.id]}
                  onChange={(iso3) =>
                    setCountries((current) => ({ ...current, [indicator.id]: iso3 }))
                  }
                />
              </li>
            ))}
          </ul>
        )}

        <ul className="mt-4 max-h-72 overflow-y-auto">
          {matches.map((indicator) => {
            const isChosen = chosen.includes(indicator.id);
            return (
              <li key={indicator.id}>
                <button
                  type="button"
                  onClick={() => toggle(indicator.id)}
                  aria-pressed={isChosen}
                  className="tint flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-raised"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-body-regular text-text-primary">
                      {indicator.name}
                    </span>
                    <span
                      className="block truncate text-caption-1-regular text-text-tertiary"
                      title={indicator.unit ?? undefined}
                    >
                      {displayUnit(indicator.unit)} · {indicator.cadence} ·{' '}
                      {indicator.confidence_tier}
                    </span>
                  </span>
                  {isChosen && (
                    <span className="shrink-0 text-caption-1-medium" style={{ color: 'var(--color-signal)' }}>
                      Added
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {matches.length === 0 && (
            <li className="px-3 py-3 text-body-regular text-text-tertiary">
              Nothing matches “{search}”.
            </li>
          )}
        </ul>

        {chosen.length >= MAX_SERIES && (
          <p className="mt-3 text-caption-1-regular text-text-tertiary">
            {MAX_SERIES} is the most the series endpoint will return at once.
          </p>
        )}
      </div>

      <Section>
        {chosen.length === 0 ? (
          <EmptyBlock>Pick an indicator above to draw it.</EmptyBlock>
        ) : (
          <ChartCard
            title={chosenMeta.map((i) => i.name).join(' · ')}
            caption={
              // What the request asked for (`mustIndex`) and what the
              // response actually managed (`payload.indexed`, per-series
              // `indexed`) can differ — a series anchored at 0, or no shared
              // period at all, means "every series" would be a lie. See the
              // per-series raw/dashed handling in SeriesChart for the case
              // where only some of them got rebased.
              mustIndex && payload?.indexed
                ? 'These indicators use different units, so series are rebased to 100 at their first shared period (dashed lines stayed in raw units — see the chart below). The shape is comparable; the levels are not.'
                : mustIndex && payload?.indexNote
                  ? payload.indexNote
                  : undefined
            }
            footer={
              <span>
                {[...new Set(chosenMeta.map((i) => i.source_id).filter(Boolean))].join(', ')}
              </span>
            }
          >
            {seriesPending && <LoadingBlock rows={1} />}
            {seriesError && <ErrorBlock error={seriesErrorObj} what="the series" />}
            {payload && <SeriesChart payload={payload} height={320} onPick={open} />}
          </ChartCard>
        )}
      </Section>
    </div>
  );
}

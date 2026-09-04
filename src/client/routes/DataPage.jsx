import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RiSearchLine, RiArrowRightLine } from '@remixicon/react';
import { useIndicators } from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/Page';
import PageHero from '@/components/PageHero';
import { readerDescription } from '@/components/indicatorProse';
import { isFuturePeriod } from '@/components/periodModel';
import { fmt, displayUnit } from '@/lib/format';

/**
 * Every series, browsable without going through a question.
 *
 * The catalogue was fully consumed — every populated series sits on some
 * question page — but consumed is not the same as findable. Reaching a series
 * meant knowing which argument happened to cite it, which is a fine route for a
 * reader following the writing and useless for one who wants to know what is in
 * here.
 *
 * Filtering is by what the data actually varies on: subject, source, and how
 * often it updates. There is deliberately NO country filter, because coverage
 * is not shaped like a comparison. One country — the United States — holds
 * several times more series than the next best, and the largest single group of
 * countries holds nothing but the same six annual World Bank indicators as each
 * other. A country control would offer a comparison the data cannot support.
 *
 * NO FIGURE IS WRITTEN INTO THIS COMMENT, ON PURPOSE.
 *
 * It used to say "the US, 61 indicators, against 39 with the same six World
 * Bank series". Both numbers had drifted by the time anyone read them again —
 * on 4 September 2026 the two live figures were 63 and 13 — and neither could
 * have been caught, because a number in a comment is not rendered, not gated
 * and not tested. The shape is what the decision rests on and the shape is
 * stable; the counts belong in a query. /api/status publishes
 * `countries_with_data` and `countries_with_depth`, which is where the live
 * version of this sentence lives.
 *
 * THE HEADING OUTLINE
 *
 * This page had exactly one heading — the h1 — for the whole catalogue, so a
 * screen-reader user had no navigation through it at all: no way to reach the
 * filters, and no way to reach the list, short of arrowing through every row.
 * The two h2s below are the whole fix, and the second one carries the live
 * result count so that "how many am I looking at" is answered in the outline
 * rather than only in a figure floated to the right of the controls.
 */
export default function DataPage() {
  const { data: indicators, isPending, isError, error } = useIndicators();
  const [search, setSearch] = useState('');
  const [pillar, setPillar] = useState('all');
  const [source, setSource] = useState('all');

  usePageTitle('The data', 'Every series behind this dashboard');

  const { rows, pillars, sources } = useMemo(() => {
    const all = indicators ?? [];
    const term = search.trim().toLowerCase();

    const matches = all.filter((i) => {
      if (pillar !== 'all' && i.pillar !== pillar) return false;
      if (source !== 'all' && i.source_id !== source) return false;
      if (!term) return true;
      return (
        i.name?.toLowerCase().includes(term) ||
        i.id?.toLowerCase().includes(term) ||
        // The trimmed description, not the raw column: a reader who cannot see
        // the build notes should not be able to find a series by typing
        // "palette" or "adapter" either, and a search that matches text the
        // page does not show returns rows for no visible reason.
        readerDescription(i.description)?.toLowerCase().includes(term)
      );
    });

    // Facet lists come from the whole catalogue, not the filtered set, so an
    // option never disappears just because the current filter excluded it.
    const count = (key) =>
      [...all.reduce((m, i) => m.set(i[key], (m.get(i[key]) ?? 0) + 1), new Map())]
        .filter(([value]) => value)
        .sort((a, b) => b[1] - a[1]);

    return {
      rows: matches.sort((a, b) => (b.observation_count ?? 0) - (a.observation_count ?? 0)),
      pillars: count('pillar'),
      sources: count('source_id'),
    };
  }, [indicators, search, pillar, source]);

  if (isPending) return <LoadingBlock rows={4} />;
  if (isError) return <ErrorBlock error={error} what="the catalogue" />;

  const total = indicators?.length ?? 0;
  const populated = (indicators ?? []).filter((i) => (i.observation_count ?? 0) > 0).length;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHero
        eyebrow="Catalogue"
        title="The data"
        /* "Sources" here is the number of publishers with a SERIES in this
           catalogue. /pipeline counts publishers supplying anything at all,
           including the nine that supply only documents, and the register
           holds more rows again. Three different true numbers were being
           printed under one word on three pages; the label now says which
           one this is. */
        figures={[
          ['Series', total],
          ['With observations', populated],
          ['Sources with series', sources.length],
        ]}
      >
        Every series behind this site, with where it came from and on what terms
        it can be reused. Nothing here is filtered by argument — this is the
        whole catalogue, including the series that turned out to show nothing.
      </PageHero>

      {/* The controls sit in the page rather than in a panel. A filter bar
          boxed in its own surface is a dashboard convention; here it is one
          line of chrome between the hero and the list it acts on. */}
      <section className="mt-10 flex flex-col gap-3" aria-labelledby="data-filters">
        <h2 id="data-filters" className="sr-only">
          Filter the catalogue
        </h2>
        <label className="tint flex items-center gap-2 rounded-2xl border border-border-button-default bg-panel px-4 py-3 focus-within:border-signal">
          <RiSearchLine className="size-4 shrink-0 text-text-tertiary" aria-hidden />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, id or description…"
            className="min-w-0 flex-1 bg-transparent text-body-regular text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </label>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Facet label="Subject" value={pillar} onChange={setPillar} options={pillars} />
          <Facet label="Source" value={source} onChange={setSource} options={sources} />
        </div>
      </section>

      <section className="mt-8">
        {/* The count lives in the heading rather than beside the filters. It
            is the answer to "how many am I looking at", and putting it in the
            outline is what makes it reachable by anyone navigating this page
            by heading instead of by eye. */}
        <h2 className="text-title-3-medium text-text-primary">
          {rows.length === total
            ? `All ${total.toLocaleString('en-GB')} series`
            : `${rows.length.toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')} series`}
        </h2>

        {rows.length === 0 ? (
          <EmptyBlock>Nothing matches those filters.</EmptyBlock>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {rows.map((indicator) => {
              /* The description column doubles as a build notebook — see
                 indicatorProse.js. Trimmed at render until the column is
                 split. */
              const description = readerDescription(indicator.description);
              /* A period after today is a published forecast. One series here
                 (UK total factor productivity, from AMECO) carries a valued
                 row dated 2027 and was printing it as coverage. */
              const forecast = isFuturePeriod(indicator.latest_period);

              return (
                <li key={indicator.id}>
                  <Link
                    to={`/data/${encodeURIComponent(indicator.id)}`}
                    className="lift tint group flex items-start gap-4 rounded-2xl border border-border-button-default bg-panel p-5 hover:border-signal"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-medium text-text-primary">
                        {indicator.name}
                      </span>
                      {description && (
                        <span className="mt-1 line-clamp-2 block text-body-regular text-text-tertiary">
                          {description}
                        </span>
                      )}
                      <span className="mt-2 block text-caption-1-regular text-text-tertiary">
                        <span title={indicator.unit ?? undefined}>
                          {displayUnit(indicator.unit)}
                        </span>
                        {' · '}
                        {indicator.cadence}
                        {' · '}
                        {indicator.source_id}
                      </span>
                    </span>

                    <span className="flex shrink-0 flex-col items-end text-right">
                      <span className="figure text-body-medium text-text-primary">
                        {fmt(indicator.observation_count ?? 0, 0)}
                      </span>
                      <span className="text-caption-1-regular text-text-tertiary">
                        observations
                      </span>
                      {indicator.latest_period && (
                        <span className="figure mt-1 text-caption-1-regular text-text-tertiary">
                          {forecast ? 'forecast to ' : 'to '}
                          {indicator.latest_period.slice(0, 7)}
                        </span>
                      )}
                    </span>

                    <RiArrowRightLine
                      className="mt-1 size-4 shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** A native select — the option list is short and this needs no custom widget. */
function Facet({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-caption-1-regular text-text-tertiary">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="tint min-h-9 rounded-xl border border-border-button-default bg-panel px-2.5 text-body-regular text-text-primary hover:border-signal"
      >
        <option value="all">All</option>
        {options.map(([option, n]) => (
          <option key={option} value={option}>
            {option} ({n})
          </option>
        ))}
      </select>
    </label>
  );
}

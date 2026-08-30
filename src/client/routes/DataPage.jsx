import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RiSearchLine, RiArrowRightLine } from '@remixicon/react';
import { useIndicators } from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/Page';
import { fmt, displayUnit } from '@/lib/format';

/**
 * Every series, browsable without going through a question.
 *
 * The catalogue was fully consumed — all 107 populated indicators sit on some
 * question page — but consumed is not the same as findable. Reaching a series
 * meant knowing which of eleven arguments happened to cite it, which is a fine
 * route for a reader following the writing and useless for one who wants to
 * know what is in here.
 *
 * Filtering is by what the data actually varies on: subject, source, and how
 * often it updates. There is deliberately NO country filter — the catalogue
 * has one country with real depth (the US, 61 indicators) against 39 with the
 * same six World Bank series, so a country control would promise a comparison
 * the data cannot support.
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
        i.description?.toLowerCase().includes(term)
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

  return (
    <div className="mx-auto max-w-5xl">
      <header>
        <h1 className="text-display-4-medium text-text-primary">The data</h1>
        <p className="prose-measure mt-2 text-headline-regular text-text-tertiary">
          Every series behind this dashboard, with where it came from and on what terms it can be
          reused. {fmt(indicators?.length ?? 0, 0)} indicators.
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-3">
        <label className="flex items-center gap-2 rounded-2lg border border-border-button-default bg-background-primary-default px-3 py-2">
          <RiSearchLine className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, id or description…"
            className="min-w-0 flex-1 bg-transparent text-body-regular text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </label>

        <div className="flex flex-wrap gap-4">
          <Facet label="Subject" value={pillar} onChange={setPillar} options={pillars} />
          <Facet label="Source" value={source} onChange={setSource} options={sources} />
        </div>
      </div>

      <p className="mt-4 text-body-regular text-text-tertiary">
        {rows.length === (indicators?.length ?? 0)
          ? `Showing all ${rows.length}`
          : `${rows.length} of ${indicators?.length ?? 0}`}
      </p>

      {rows.length === 0 ? (
        <EmptyBlock>Nothing matches those filters.</EmptyBlock>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((indicator) => (
            <li key={indicator.id}>
              <Link
                to={`/data/${encodeURIComponent(indicator.id)}`}
                className="group flex items-start gap-4 rounded-2lg border border-border-button-default bg-background-primary-default p-4 tint hover:border-accent-300 hover:bg-background-secondary-hover"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-body-medium text-text-primary">{indicator.name}</span>
                  {indicator.description && (
                    <span className="mt-0.5 line-clamp-2 block text-body-regular text-text-tertiary">
                      {indicator.description}
                    </span>
                  )}
                  <span className="mt-1.5 block text-caption-1-regular text-text-tertiary">
                    <span title={indicator.unit ?? undefined}>{displayUnit(indicator.unit)}</span>
                    {' · '}
                    {indicator.cadence}
                    {' · '}
                    {indicator.source_id}
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end text-right">
                  <span className="text-body-medium tabular-nums text-text-primary">
                    {fmt(indicator.observation_count ?? 0, 0)}
                  </span>
                  <span className="text-caption-1-regular text-text-tertiary">observations</span>
                  {indicator.latest_period && (
                    <span className="mt-0.5 text-caption-1-regular text-text-tertiary">
                      to {indicator.latest_period.slice(0, 7)}
                    </span>
                  )}
                </span>

                <RiArrowRightLine
                  className="mt-1 size-4 shrink-0 text-foreground-icon-secondary transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
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
        className="min-h-9 rounded-2lg border border-border-button-default bg-background-primary-default px-2 text-body-regular text-text-primary"
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

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCountryCoverage } from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock } from '@/components/Page';
import { displayUnit } from '@/lib/format';

export default function CountriesPage() {
  const { iso3 } = useParams();
  const { data, isPending, isError, error } = useCountryCoverage(iso3);
  const [search, setSearch] = useState('');
  usePageTitle(data?.country?.name ?? 'Country coverage', 'Available evidence, country by country');
  if (isPending) return <LoadingBlock rows={4} />;
  if (isError) return <ErrorBlock error={error} what="country coverage" />;
  const country = data?.country;
  const countries = data?.countries ?? [];
  const indicators = data?.indicators ?? [];
  return <article className="mx-auto max-w-5xl">
    <Link className="inline-flex min-h-11 items-center text-text-secondary underline" to={country ? '/countries' : '/data'}>{country ? 'All countries' : 'The data'}</Link>
    <h1 className="text-display-4-medium text-text-primary">{country?.name ?? 'Country coverage'}</h1>
    <p className="mt-3 max-w-3xl text-body-regular text-text-secondary">{country?.is_aggregate ? 'This is a regional or world aggregate, not an individual country. ' : ''}Coverage counts active series with non-missing values. More series means more available evidence, not stronger evidence that AI caused an economic change. Dates describe available data and may include published projections.</p>
    {country ? <>
      <h2 className="mt-8 text-title-3-medium text-text-primary">{indicators.length} series available</h2>
      {!indicators.length && <p className="mt-3 text-text-secondary">No non-missing observations are available for this geography yet.</p>}
      <ul className="mt-4 divide-y divide-border-button-default">
        {indicators.map((indicator) => <li key={indicator.id} className="py-4">
          <Link className="text-body-medium text-text-primary underline underline-offset-4" to={`/data/${encodeURIComponent(indicator.id)}?country=${country.iso3}`}>{indicator.name}</Link>
          <p className="mt-1 text-caption-1-regular text-text-secondary">{indicator.source_name} · {indicator.cadence} · {displayUnit(indicator.unit)} · {indicator.observation_count} values</p>
          <p className="mt-1 text-caption-1-regular text-text-tertiary">{indicator.first_period} to {indicator.last_period}</p>
          {indicator.source_licence && <p className="mt-1 text-caption-1-regular text-text-tertiary">Licence: {indicator.source_licence}</p>}
          {indicator.quality_flags?.length > 0 && <p className="mt-1 text-caption-1-regular text-text-secondary">Provider flags: {indicator.quality_flags.join('; ')}</p>}
          {indicator.questions?.length > 0 && <p className="mt-2 text-caption-1-regular text-text-secondary">Used in: {indicator.questions.map((question, index) => <span key={question.slug}>{index > 0 && ' · '}<Link className="underline" to={`/q/${question.slug}`}>{question.question}</Link> ({question.role})</span>)}</p>}
        </li>)}
      </ul>
    </> : <>
      <label className="mt-7 block text-body-regular text-text-secondary">Find a country or economy
        <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" className="mt-2 block min-h-11 w-full rounded-lg border border-border-button-default bg-background-primary-default px-3 text-text-primary" />
      </label>
      {[false, true].map((aggregate) => {
        const rows = countries.filter((item) => Boolean(item.is_aggregate) === aggregate && `${item.name} ${item.iso3}`.toLowerCase().includes(search.toLowerCase()));
        return <section key={String(aggregate)} className="mt-8">
          <h2 className="text-title-3-medium text-text-primary">{aggregate ? 'Regional and world aggregates' : 'Countries and economies'} ({rows.length})</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rows.map((item) => <li key={item.iso3}>
            <Link to={`/country/${item.iso3}`} className="block rounded-xl border border-border-button-default p-4 hover:bg-background-secondary-default">
              <span className="text-body-medium text-text-primary">{item.name}</span>
              <span className="mt-2 block text-caption-1-regular text-text-secondary">{item.indicator_count} series · {item.observation_count} values</span>
              <span className="mt-1 block text-caption-1-regular text-text-tertiary">{item.last_period ? `Latest period: ${item.last_period}` : 'No non-missing values yet'}</span>
            </Link>
          </li>)}</ul>
        </section>;
      })}
    </>}
  </article>;
}

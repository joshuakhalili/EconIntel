import { useEffect } from 'react';
import { useIndicatorCountries } from '@/hooks/queries';
import { selectCountry } from './countrySelection';

/**
 * Country picker for one chosen indicator.
 *
 * Many indicators — the World Bank ones especially — hold every country under
 * a single id. Asking for one without naming a country returns all of them
 * flattened together, which cannot be drawn as a line. So where an indicator
 * has more than one country, one has to be chosen; where it has none or one,
 * this renders nothing and stays out of the way.
 */
export default function CountrySelect({ indicator, value, onChange }) {
  const { data } = useIndicatorCountries(indicator.id);
  const countries = data?.countries ?? [];

  // Choose on the indicator's behalf as soon as the list arrives, so a newly
  // added indicator draws something rather than sitting blank until touched.
  useEffect(() => {
    if (!countries.length) return;
    const preferred = selectCountry(countries, value, indicator.default_country_iso3);
    if (preferred !== value) onChange(preferred);
  }, [value, countries, indicator.default_country_iso3, onChange]);

  if (countries.length < 2) return null;

  return (
    <select
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      aria-label={`Country for ${indicator.name}`}
      className="min-h-8 rounded-md border border-border-button-default bg-background-primary-default px-2 text-caption-1-regular text-text-secondary"
    >
      {[false, true].map((aggregate) => (
        <optgroup key={String(aggregate)} label={aggregate ? 'Regional and world aggregates' : 'Countries and economies'}>
        {countries.filter((country) => Boolean(country.is_aggregate) === aggregate).map((country) => (
        <option key={country.country_iso3} value={country.country_iso3}>
          {country.name}
        </option>
        ))}
        </optgroup>
      ))}
    </select>
  );
}

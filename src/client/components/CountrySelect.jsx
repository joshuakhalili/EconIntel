import { useEffect } from 'react';
import { useIndicatorCountries } from '@/hooks/queries';

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
    if (value || countries.length < 2) return;
    const preferred =
      indicator.default_country_iso3 ??
      countries.find((c) => c.country_iso3 === 'USA')?.country_iso3 ??
      countries[0].country_iso3;
    onChange(preferred);
  }, [value, countries, indicator.default_country_iso3, onChange]);

  if (countries.length < 2) return null;

  return (
    <select
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      aria-label={`Country for ${indicator.name}`}
      className="min-h-8 rounded-md border border-border-secondary bg-background-primary-default px-2 text-caption-regular text-text-secondary"
    >
      {countries.map((country) => (
        <option key={country.country_iso3} value={country.country_iso3}>
          {country.name}
        </option>
      ))}
    </select>
  );
}

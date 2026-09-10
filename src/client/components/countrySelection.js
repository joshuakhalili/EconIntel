/** Prefer requested geography only if the provider actually holds values. */
export function selectCountry(countries, requested, defaultCountry) {
  for (const candidate of [requested, defaultCountry, 'USA']) {
    if (countries.some((country) => country.country_iso3 === candidate)) return candidate;
  }
  return countries.find((country) => !country.is_aggregate)?.country_iso3 ?? countries[0]?.country_iso3 ?? null;
}

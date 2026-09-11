/** Preserve provider words/codes, not inferred survey populations. */
export function dbnomicsDefinition(data, seriesPath) {
  const series = data?.series?.docs?.[0];
  const dataset = data?.dataset ?? {};
  if (!series?.series_name) throw new Error('Mirror metadata missing series definition');
  const dimensions = Object.entries(series.dimensions ?? {}).map(([key, code]) => ({
    dimension: dataset.dimensions_labels?.[key] ?? key, code,
    label: dataset.dimensions_values_labels?.[key]?.[code] ?? String(code),
  }));
  const scope = dimensions.filter((item) => /sex|age|size|sector|activity|occupation|industry|reference area|country|unit|measure/i.test(item.dimension));
  return { population: scope.length ? `Provider-coded scope (not a full sampling frame): ${scope.map((d) => `${d.dimension}: ${d.label}`).join('; ')}` : null,
    estimand: series.series_name, provider_dimensions: dimensions,
    definition_status: 'mirror_metadata_verified', definition_source: `https://db.nomics.world/${seriesPath}`,
    limitations: 'Definition and dimension labels were retrieved from DBnomics, a mirror. They do not independently verify national survey coverage, imputation quality or causal identification. An absent population means the metadata did not supply one.',
    attempted: 'Live DBnomics series metadata; decoded dimensions using dataset code lists',
  };
}
export function fredDefinition(data, code) {
  const series = data?.seriess?.find((row) => row.id === code);
  if (!series?.title) throw new Error('FRED metadata missing requested series');
  return { population: null, estimand: series.title, provider_notes: series.notes ?? null,
    definition_status: 'provider_metadata_verified_population_unstructured',
    definition_source: `https://fred.stlouisfed.org/series/${code}`,
    provider_units: series.units, provider_frequency: series.frequency,
    limitations: 'FRED supplies the series title, units, frequency and notes, but no structured statistical-population field. The original producer may define a narrower sample; read the retained notes before comparison. No population was guessed from the title.',
    attempted: 'Live FRED series endpoint; retained complete provider notes and original producer links where supplied',
  };
}

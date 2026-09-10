const SOURCE_IDS = { FRED: 'fred', 'World Bank': 'worldbank', DBnomics: 'dbnomics', SEC: 'sec_edgar', 'Epoch AI': 'epoch_ai', 'Fed Register': 'federal_register', OpenAlex: 'openalex' };
SOURCE_IDS['Census BTOS'] = 'census_btos';
const KEYLESS = new Set(['World Bank', 'DBnomics', 'Epoch AI', 'Fed Register', 'Census BTOS']);

/** Configuration belongs to this web process; successful batch runs may have
 * different credentials. Never infer configuration from historical success.
 */
export function sourceCapabilities(integrations, sources) {
  return integrations.map((integration) => {
    const source = sources.find((row) => row.id === SOURCE_IDS[integration.name]);
    const implemented = integration.implemented ?? (Boolean(SOURCE_IDS[integration.name]) || integration.name === 'Workers AI');
    return { name: integration.name, implemented,
      configured: KEYLESS.has(integration.name) ? 'not_required' : Boolean(integration.configured ?? integration.ready),
      latest_success: source?.last_success ?? null,
      latest_period: source?.latest_period ?? null,
      note: integration.note,
    };
  });
}

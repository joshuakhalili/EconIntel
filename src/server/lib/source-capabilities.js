import { gdeltFreshness } from './source-freshness.js';
const SOURCE_IDS = { GDELT: 'gdelt', FRED: 'fred', 'World Bank': 'worldbank', DBnomics: 'dbnomics', SEC: 'sec_edgar', 'Epoch AI': 'epoch_ai', 'Fed Register': 'federal_register', OpenAlex: 'openalex' };
SOURCE_IDS['Census BTOS'] = 'census_btos';
const KEYLESS = new Set(['GDELT', 'World Bank', 'DBnomics', 'Epoch AI', 'Fed Register', 'Census BTOS']);

/** Configuration belongs to this web process; successful batch runs may have
 * different credentials. Never infer configuration from historical success.
 */
export function sourceCapabilities(integrations, sources, now = new Date()) {
  const listed = integrations.some((item) => item.name === 'GDELT') ? integrations : [...integrations, { name: 'GDELT', implemented: true, note: 'Bounded complete-month recovery; historical gaps remain explicit.' }];
  return listed.map((integration) => {
    const source = sources.find((row) => row.id === SOURCE_IDS[integration.name]);
    const implemented = integration.implemented ?? (Boolean(SOURCE_IDS[integration.name]) || integration.name === 'Workers AI');
    return { name: integration.name, implemented,
      configured: KEYLESS.has(integration.name) ? 'not_required' : Boolean(integration.configured ?? integration.ready),
      latest_success: source?.last_success ?? null,
      latest_period: source?.latest_period ?? null,
      provider_verification: !source?.verification_state ? 'not_checked'
        : source.verification_state === 'failed' ? 'failed'
          : !Number.isFinite(Date.parse(source.verified_at)) || +now - Date.parse(source.verified_at) > 30 * 86400000 ? 'expired' : 'verified',
      verified_at: source?.verified_at ?? null,
      verification_scope: source?.verification_scope ?? null,
      freshness: integration.name === 'GDELT' ? gdeltFreshness(source?.latest_period_end, now) : null,
      note: integration.note,
    };
  });
}

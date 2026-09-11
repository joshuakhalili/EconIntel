const glossary = (code) => `https://databank.worldbank.org/metadataglossary/world-development-indicators/series/${code}`;
// Source definitions read 2026-09-10. Comparable concept does not establish
// comparable imputation quality, a harmonised survey, or an AI treatment effect.
const DEFINITIONS = {
  'wb.BX.GSR.CCIS.ZS': { population: 'Balance-of-payments service exports of the named economy', estimand: 'Computer, communications and information service exports as a percentage of service exports', limitations: 'Includes telecommunications, postal/courier and information services; neither software-only nor AI-only exports.' },
  'wb.TX.VAL.ICTG.ZS.UN': { population: 'Merchandise goods exports of the named economy', estimand: 'ICT goods exports as a percentage of total goods exports', limitations: 'Includes computers, communications equipment, consumer electronics and components; not a measure of AI domestic value added.' },
  'wb.IT.NET.USER.ZS': { population: 'Individuals in the named economy', estimand: 'Percentage of population who used the internet from any location in the previous three months', limitations: 'Digital-access context; does not measure AI use, connection quality or intensity.' },
  'wb.SL.UEM.TOTL.ZS': { population: 'Total labour force in the named economy', estimand: 'Percentage of the labour force without work, available for and seeking employment; ILO modelled estimate', limitations: 'Excludes people outside the labour force. Modelled inputs and demographic changes qualify comparisons; not an AI job-loss measure.' },
  'wb.GB.XPD.RSDV.GD.ZS': { population: 'Business, government, higher education and private non-profit R&D sectors in the domestic economy', estimand: 'Capital and current domestic R&D expenditure as a percentage of GDP', limitations: 'Includes basic/applied research and experimental development, not specifically AI expenditure.' },
  'wb.TX.VAL.TECH.MF.ZS': { population: 'Manufactured merchandise exports of the named economy', estimand: 'High-R&D-intensity products as a percentage of manufactured exports', limitations: 'Product classification, not a measure of domestic AI capability or domestic value added.' },
  'wb.EG.USE.ELEC.KH.PC': { population: 'Electricity system of the named economy, normalised by population', estimand: 'Electric power production less transmission/distribution/transformation losses and power-plant own use, in kWh per capita', limitations: 'Whole-economy electricity context; does not isolate data centres or AI demand.' },
  'wb.NY.GDP.MKTP.KD.ZG': { population: 'Domestic production in the national-accounts economic territory', estimand: 'Annual percentage change in GDP at constant 2015 prices expressed in US dollars', limitations: 'Aggregate growth does not identify AI contributions or remove other shocks.' },
  'wb.NY.GDP.PCAP.KD': { population: 'General population of the named economy', estimand: 'GDP per person in constant 2015 US dollars', limitations: 'Output per resident, not per worker; not PPP-adjusted international living-standard rankings.' },
  'wb.SL.GDP.PCAP.EM.KD': {
    population: 'Total employment in the named economy; GDP covers the domestic economy',
    estimand: 'Annual GDP divided by persons employed, in constant 2021 PPP international dollars; not output per hour',
    limitations: 'Employment inputs include modelled/imputed observations. Country rankings are not defensible without checking which values are imputed. No AI attribution.',
  },
  'wb.SL.EMP.TOTL.SP.ZS': {
    population: 'Population aged 15 and older in the named economy, both sexes',
    estimand: 'Employed persons divided by population aged 15+, multiplied by 100; ILO modelled estimate',
    limitations: 'Survey coverage, demographic composition and imputation differ. Neither an unemployment rate nor an AI displacement estimate.',
  },
  'wb.NE.GDI.FTOT.ZS': {
    population: 'Resident institutional units in the national-accounts economic territory',
    estimand: 'Acquisitions less disposals of fixed assets during the year, as a percentage of GDP',
    limitations: 'All fixed investment, not AI expenditure. A rising share can reflect a falling GDP denominator. Country SNA vintages differ.',
  },
};

const RECIPES = {
  'derived.information_employment_share': ['US payroll employment: information sector and total nonfarm payrolls', '100 × FRED USINFO / PAYEMS at matching monthly periods', 'Payroll jobs rather than distinct people; information-sector employment is not AI employment.'],
  'derived.productivity_gap_mfg_vs_total': ['US manufacturing and nonfarm-business productivity index series', '(OPHMFG / OPHNFB) divided by its first shared-period ratio, multiplied by100', 'A relative productivity index, not a subtraction of growth rates or a causal counterfactual.'],
  'derived.sec_ai_mention_rate': ['SEC10-K filings by calendar year; denominator requires at least100 filings', 'Share of10-K filings matching the exact phrase artificial intelligence in SEC full-text search', 'Disclosure mentions are not verified adoption; filings, not unique firms, are the counting unit.'],
  'derived.ai_news_volume': ['English-language news matching the coded AI/economy query, relative to GDELT-provided total news norm', '100 × monthly sum of matching article counts / monthly sum of provider normalization counts', 'News attention proxy; not economic activity, adoption or sentiment. Recovery requires a complete monthly daily calendar.'],
  'epoch.gpu_cluster_count': ['Publicly known clusters in the Epoch register with mapped country and first operational date', 'Number of registered clusters first operational in each country/year', 'Flow of recorded cluster openings, not cumulative stock, compute capacity or a population census.'],
  'derived.datacentre_capacity_mw': ['Epoch clusters with mapped country, operational date and positive reported power capacity', 'Cumulative sum of registered cluster megawatts by country/year', 'Known-register capacity, not total national power demand. Missing capacity/locations are excluded; no retirement adjustment.'],
  'epoch.training_compute_frontier': ['Epoch recorded models with publication date and training-compute estimate', 'Running maximum training FLOP, emitted when a dated model sets a new record', 'Convenience-sample frontier, not average model compute, total training energy or a complete census.'],
  'epoch.gpu_price_performance': ['Epoch hardware records with release date and positive price-performance value', 'Running maximum reported FLOP/s per dollar by hardware release date', 'Not a representative price index. Precision and hardware mix can change; flat frontier does not establish flat market prices.'],
  'lbma.gold': ['Published LBMA gold reference price observations', 'Daily positive USD price from the first currency leg of the published JSON record', 'Benchmark price, not average transaction price or country-specific demand. Missing/nonpositive prices are skipped.'],
  'lbma.silver': ['Published LBMA silver reference price observations', 'Daily positive USD price from the first currency leg of the published JSON record', 'Benchmark price, not average transaction price or country-specific demand. Missing/nonpositive prices are skipped.'],
};
for (const [id, type] of [['derived.ai_binding_rules','Rule'], ['derived.ai_presidential_documents','Presidential Document'], ['derived.ai_proposed_rules','Proposed Rule'], ['derived.ai_regulation_volume','all included document types']]) {
  RECIPES[id] = [`Deduplicated Federal Register documents matching the six coded AI-related search terms; ${type}`,
    'Count of matched documents by publication month',
    'Text-search coverage, not regulatory intensity or economic burden. Per-term API page caps can make counts lower bounds; legal effect differs by document type.'];
}

export function measurementDefinition(row) {
  const id = row.indicator_id ?? row.id;
  if (/^eurostat\.ai_any\./.test(id)) return {
    population: 'Enterprises with at least10 employees/self-employed persons; NACE Rev2 sections C–J, L–N and group95.1',
    estimand: 'Share of enterprises reporting use of at least one surveyed AI technology in the reference year',
    limitations: 'Excludes microenterprises and financial services; survey definitions and provider break flags still matter. Use does not measure intensity or effects.',
    definition_status: 'source_definition_verified', definition_source: 'https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20251211-2', definition_checked: '2026-09-10',
  };
  if (id === 'census_btos.ai_use_current.USA') return {
    population: 'US employer businesses covered by the experimental Business Trends and Outlook Survey',
    estimand: 'Share reporting current AI use during the previous two weeks; revised questionnaire from November17,2025',
    limitations: 'Not harmonised with Eurostat/OECD populations. Experimental estimates; chart publication supplies no uncertainty intervals. Never splice across revised wording.',
    definition_status: 'source_definition_verified', definition_source: 'https://www.census.gov/hfp/btos/data', definition_checked: '2026-09-10',
  };
  const definition = DEFINITIONS[id];
  if (definition) return { ...definition, definition_status: 'source_definition_verified', definition_source: glossary(id.slice(3)), definition_checked: '2026-09-10' };
  if (RECIPES[id]) {
    const [population, estimand, limitations] = RECIPES[id];
    return { population, estimand, limitations, definition_status: 'adapter_recipe_verified',
      definition_source: row.source_url ?? dispositions[id]?.definition_source ?? null, definition_checked: '2026-09-11',
      attempted: 'Read the implemented adapter/derived transformation and its source columns. This verifies the app recipe, not independent completeness of the upstream population.' };
  }
  if (dispositions[id]) return dispositions[id];
  return { population: null, estimand: null, definition_status: 'not_verified',
    definition_source: row.source_url ?? null, definition_checked: null,
    limitations: 'Population and estimand are not independently established in this definition register. Do not infer them from the country label, unit or series name.' };
}
import dispositions from '../../../docs/research/country-measurement-dispositions.json' with { type: 'json' };

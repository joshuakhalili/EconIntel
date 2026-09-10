/** Census's own national chart publication (JSON), not the Census data API.
 * Discovered from https://www.census.gov/hfp/btos/js/app.7f27294e.js on
 * 2026-09-10. The source starts with the revised Nov17 2025 questionnaire.
 * Never splice it to the previous question: Census documents a level shift.
 */
import { fetchJson } from '../../lib/http.js';
export const BTOS_PUBLICATION = 'https://www.census.gov/hfp/btos/ai_national.json';
export const BTOS_INDICATOR = 'census_btos.ai_use_current.USA';
const CURRENT_LABEL = 'Current AI Use (Last Two Weeks)';
const EXPECTED_LABEL = 'Expected AI Use (Next Six Months)';

export function parseBtosPublication(rows) {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 10000) throw new Error('Unexpected BTOS publication size or shape');
  const seen = new Set();
  const observations = [];
  for (const row of rows) {
    if (row.xmltag === EXPECTED_LABEL) continue;
    if (row.xmltag !== CURRENT_LABEL) throw new Error('BTOS question labels changed; review the publication before ingestion');
    if (typeof row.Date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.Date)) throw new Error('Invalid BTOS reference date');
    const end = new Date(`${row.Date}T00:00:00Z`);
    if (!Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10) !== row.Date) throw new Error('Invalid BTOS reference date');
    if (row.Date < '2025-11-30') throw new Error('BTOS publication crosses the questionnaire break');
    if (seen.has(row.Date)) throw new Error('Duplicate BTOS reference date');
    seen.add(row.Date);
    const raw = row.Estimate;
    const suppressed = raw === null || raw === '' || raw === 'S' || raw === 'D';
    if (!suppressed && (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > 100)) throw new Error('Invalid BTOS percentage');
    const start = new Date(end.getTime() - 13 * 86400000).toISOString().slice(0, 10);
    observations.push({ indicatorId: BTOS_INDICATOR, countryIso3: 'USA', periodStart: start,
      periodEnd: row.Date, value: suppressed ? null : raw,
      valueStatus: suppressed ? 'suppressed' : 'experimental; revised_question_2025_11', sourceRef: BTOS_PUBLICATION });
  }
  if (!observations.some((row) => row.value !== null)) throw new Error('BTOS publication contains no usable current-use estimates');
  return observations.sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

export async function fetchBtosPublication() {
  return parseBtosPublication(await fetchJson(BTOS_PUBLICATION, { timeoutMs: 30000 }));
}

/** Real provider probes. Read-only upstream; --record writes only their audit
 * state to the configured database. No statistical observations are written.
 */
import { pathToFileURL } from 'node:url';
import { fetchJson, redactUrl } from '../src/server/lib/http.js';
import { query, closePool } from '../src/server/db/pool.js';
import { parseBtosPublication, BTOS_PUBLICATION } from '../src/server/ingestion/sources/census-btos-publication.js';
import { recoverLatestCompleteMonth } from '../src/server/ingestion/sources/gdelt.js';

export const PROBES = {
  worldbank: { scope: 'WDI GDP-per-employed metadata; not all observations', run: async () => {
    const data = await fetchJson('https://api.worldbank.org/v2/indicator/SL.GDP.PCAP.EM.KD?format=json');
    if (!data?.[1]?.some((row) => row.id === 'SL.GDP.PCAP.EM.KD' && row.sourceNote)) throw new Error('WDI metadata contract failed');
  } },
  dbnomics: { scope: 'One Eurostat AI-use series metadata and aligned periods/values', run: async () => {
    const data = await fetchJson('https://api.db.nomics.world/v22/series/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.DE?observations=1');
    const series = data?.series?.docs?.[0];
    if (!series || !Array.isArray(series.period) || series.period.length === 0 || series.period.length !== series.value?.length) throw new Error('DBnomics series contract failed');
  } },
  census_btos: { scope: 'National current-use publication, revised questionnaire only', run: async () => { parseBtosPublication(await fetchJson(BTOS_PUBLICATION)); } },
  gdelt: { scope: 'Latest complete month daily numerator/denominator coverage; no archive guarantee', run: async () => { await recoverLatestCompleteMonth(); } },
};

export async function main(args = process.argv.slice(2)) {
  const record = args.includes('--record');
  const ids = args.filter((arg) => arg !== '--record');
  if (!ids.length || ids.some((id) => !PROBES[id])) throw new Error(`Choose exact source ids: ${Object.keys(PROBES).join(', ')}`);
  let failed = false;
  for (const id of ids) {
    const probe = PROBES[id];
    let state = 'verified', detail = 'Live response passed the specified shape and scope checks';
    try { await probe.run(); } catch (error) { state = 'failed'; detail = redactUrl(error.message).slice(0, 500); failed = true; }
    if (record) await query(`INSERT INTO source_verifications (source_id, state, method, scope, detail)
      VALUES ($1,$2,'live_adapter_contract_probe',$3,$4) ON CONFLICT (source_id) DO UPDATE
      SET checked_at=now(), state=EXCLUDED.state, method=EXCLUDED.method, scope=EXCLUDED.scope, detail=EXCLUDED.detail`, [id, state, probe.scope, detail]);
    console.log(JSON.stringify({ source: id, state, scope: probe.scope, detail }));
  }
  if (failed) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { await closePool(); }
}

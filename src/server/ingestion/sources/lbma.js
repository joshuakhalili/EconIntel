/**
 * LBMA precious metal prices.
 *
 * The London Bullion Market Association publishes its daily benchmark fixes as
 * plain JSON, free and without a key, back to 1968 and current to yesterday.
 *
 * This exists because the obvious route does not work. FRED carries no silver
 * series at all, and the IMF's commodity system — which does carry gold, silver,
 * lithium and cobalt — is mirrored on DBnomics with a last observation of
 * June 2025 and has not advanced since. A precious-metals chart that stops
 * silently in the middle of last year is worse than none, because it still
 * looks current.
 *
 * Why these belong on an AI dashboard at all: silver is the most conductive
 * metal in commercial use and goes into every circuit board and solar panel
 * built to power a data centre; gold is used in chip bonding and is the
 * standard risk gauge against which an investment boom is read.
 */

import { HttpError } from '../../lib/http.js';
import { config } from '../../config.js';

const BASE = 'https://prices.lbma.org.uk/json';

export const METALS = Object.freeze({
  gold: { path: 'gold_pm.json', name: 'gold', unit: 'USD per troy ounce' },
  silver: { path: 'silver.json', name: 'silver', unit: 'USD per troy ounce' },
});

/**
 * Fetch one metal's price history.
 *
 * The payload is an array of `{ d: 'YYYY-MM-DD', v: [usd, gbp, eur] }`. Only
 * the USD leg is taken: mixing currencies on one series would make an exchange
 * rate move look like a price move.
 *
 * @param {'gold'|'silver'} metal
 * @param {string} indicatorId
 */
export async function fetchMetal(metal, indicatorId) {
  const spec = METALS[metal];
  if (!spec) throw new Error(`Unknown metal "${metal}"`);
  if (config.useFixtures) {
    throw new HttpError(`Fixture mode: no recorded LBMA response for ${metal}`, { url: BASE });
  }

  const url = `${BASE}/${spec.path}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Diffusion/1.0 (+https://github.com/joshuakhalili/Diffusion)' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new HttpError(`LBMA returned HTTP ${response.status}`, { url, status: response.status });
  }

  const rows = await response.json();
  if (!Array.isArray(rows)) throw new HttpError('LBMA returned an unexpected shape', { url });

  const observations = [];

  for (const row of rows) {
    const date = row?.d;
    // v[0] is USD. A missing or zero fix means the market did not set one that
    // day — a holiday, or a suspension — which is not the same as a price of
    // nothing, so the row is skipped rather than written as zero.
    const usd = Array.isArray(row?.v) ? Number(row.v[0]) : null;
    if (!date || !Number.isFinite(usd) || usd <= 0) continue;

    observations.push({
      indicatorId,
      periodStart: date,
      periodEnd: date,
      value: usd,
      sourceRef: url,
    });
  }

  if (observations.length === 0) throw new HttpError('LBMA returned no usable observations', { url });
  return observations;
}

export const ingestGold = () => fetchMetal('gold', 'lbma.gold');
export const ingestSilver = () => fetchMetal('silver', 'lbma.silver');

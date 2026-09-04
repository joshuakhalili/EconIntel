/**
 * The five descriptions a reader could actually see today, put through the
 * trimmer.
 *
 * Each string below is the verbatim contents of `indicators.description` for
 * the id named above it, read out of the database on 4 September 2026 — not a
 * paraphrase and not an example. If the seed corrects one of these, the
 * assertion here will still hold: it asserts what the trimmer does to that
 * text, not that the text is still in the column.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { readerDescription } from './indicatorProse.js';

/* dbn.AMECO.ZVGDF.GBR.3.0.0.0.ZVGDF */
const AMECO =
  'TFP is where an AI-driven general-purpose-technology shock would eventually have to appear, ' +
  "and the UK's is flat-to-falling (97.2 in 2022 to 96.0 in 2025) — the sharpest available " +
  'statement of the AI productivity paradox. Caveat: 2025-2027 values are Commission forecasts, ' +
  'not outturns, and should be visually distinguished. WARNING: AMECO mixes European Commission ' +
  'forecasts into the same series as history — observations from 2025 onward are projections, ' +
  'not measurements, and must be rendered distinctly (dashed, or cut off) or the chart asserts ' +
  'something false.';

/* wb.NY.GDP.MKTP.KD.ZG */
const GDP_GROWTH =
  'Annual percentage growth of real GDP. A change-type series, so it renders on a diverging ' +
  'palette — negative growth must be visually distinct from positive.';

/* fred.CES5051800001 */
const NAICS_518 =
  'All employees in computing infrastructure providers, data processing and web hosting, ' +
  'seasonally adjusted. The cloud and data-centre operations subsector — the part of the ' +
  'information supersector that AI capex should be ADDING jobs to, read against software ' +
  'publishers where it may be removing them. NAICS 518 under the 2022 revision, which absorbed ' +
  'the old 5182. Same source and vintage as fred.USINFO, the aggregate it sits inside.';

/* dbn.NBS.M_A02092Q.A02092Q01 — note the column itself ends mid-sentence. */
const CHINA_ICS =
  "The highest-frequency read on China's chip production anywhere in this provider set, showing " +
  'output climbing from 36.3bn units (March 2025) to 48.1bn (December 2025). IMPORTANT CAVEAT: ' +
  'DBnomics mirrors the NBS rolling window, so this returns only a 13-month span (2025-02 to ' +
  '2026-02) of which just 10 points are non-null — the adapter must snapshot each month and ' +
  'accumulate its own history, or the ';

/* dbn.Eurostat.isoc_eb_ain2.A.GE10.J62_J63.E_AI_TANY.PC_ENT.EU27_2020 — one
   long sentence, so there is no sentence boundary to fall back to. */
const EUROSTAT =
  'Shows AI diffusion where it bites first — software and IT services went 28.2% (2021) to ' +
  '65.7% (2025) — and the same dataset carries 50 NACE activities and 36 countries on ' +
  'identical codes, so one adapter pattern yields a full industry adoption matrix ' +
  '(manufacturing C 17.3%, construction F 10.8%, transport H 11.2% in 2025).';

describe('readerDescription — the five a reader meets today', () => {
  test('the AMECO WARNING goes; the caveat a reader needs stays', () => {
    const out = readerDescription(AMECO);
    assert.ok(!out.includes('WARNING'));
    assert.ok(!out.includes('rendered distinctly'));
    assert.ok(
      out.endsWith('and should be visually distinguished.'),
      `kept the forecast caveat, ended: ${JSON.stringify(out.slice(-60))}`
    );
    assert.ok(out.startsWith('TFP is where an AI-driven'));
  });

  test('the diverging-palette instruction goes, the definition stays', () => {
    assert.equal(readerDescription(GDP_GROWTH), 'Annual percentage growth of real GDP.');
  });

  test('the NAICS code and the database id go; the economics stays', () => {
    const out = readerDescription(NAICS_518);
    assert.ok(!out.includes('NAICS'));
    assert.ok(!out.includes('fred.'));
    assert.ok(out.endsWith('where it may be removing them.'));
    assert.ok(out.includes('the part of the information supersector'));
  });

  test('IMPORTANT CAVEAT and everything after it goes', () => {
    assert.equal(
      readerDescription(CHINA_ICS),
      "The highest-frequency read on China's chip production anywhere in this provider set, " +
        'showing output climbing from 36.3bn units (March 2025) to 48.1bn (December 2025).'
    );
  });

  test('with no sentence boundary it falls back to the clause before the note', () => {
    const out = readerDescription(EUROSTAT);
    assert.ok(!out.includes('adapter'));
    assert.ok(out.startsWith('Shows AI diffusion where it bites first'));
    assert.ok(out.endsWith('on identical codes.'), `ended: ${JSON.stringify(out.slice(-40))}`);
  });
});

describe('readerDescription — the edges', () => {
  test('prose with no build vocabulary is returned untouched', () => {
    const clean =
      'Unemployment rate for workers aged 16 to 24, seasonally adjusted. The first place a ' +
      'hiring slowdown shows up.';
    assert.equal(readerDescription(clean), clean);
  });

  test('a description that is nothing but a note yields null, not a fragment', () => {
    assert.equal(readerDescription('WARNING: the adapter must snapshot each month.'), null);
    assert.equal(readerDescription('renders on a diverging palette'), null);
  });

  test('missing, empty and non-string inputs yield null', () => {
    assert.equal(readerDescription(null), null);
    assert.equal(readerDescription(undefined), null);
    assert.equal(readerDescription(''), null);
    assert.equal(readerDescription('   '), null);
    assert.equal(readerDescription(42), null);
  });

  test('a surviving fragment shorter than a phrase is dropped', () => {
    assert.equal(readerDescription('GDP. The adapter does the rest.'), null);
  });

  test('a short description that was never trimmed survives', () => {
    // fred.LRHU24TTAUM156S, fred.LRHU24TTCAM156S and fred.LRHU24TTGBM156S are
    // one clause each. The length floor is a guard against fragments this
    // function created, not an editorial standard it gets to impose.
    assert.equal(readerDescription('Australia.'), 'Australia.');
    assert.equal(readerDescription('Canada.'), 'Canada.');
    assert.equal(readerDescription('The same measure for Britain.'), 'The same measure for Britain.');
  });

  test('nothing is ever added, reordered or rewritten', () => {
    // Every output must be a prefix of the input, give or take the full stop
    // the clause fallback restores.
    for (const input of [AMECO, GDP_GROWTH, NAICS_518, CHINA_ICS, EUROSTAT]) {
      const out = readerDescription(input);
      const body = out.endsWith('.') ? out.slice(0, -1) : out;
      assert.ok(
        input.startsWith(body),
        `output is not a prefix of the input: ${JSON.stringify(out.slice(0, 80))}`
      );
    }
  });
});

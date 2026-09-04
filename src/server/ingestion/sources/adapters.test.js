/**
 * Tests for adapter transform logic.
 *
 * These are the pure functions that turn a provider's response into our row
 * shape. They are tested without a network because that is where silent data
 * corruption lives: a mis-parsed period or a NaN that reaches the database
 * produces a chart that renders happily and is wrong.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import { parsePeriod } from './dbnomics.js';
import { toFrontierComputeObservations, toClusterCountObservations } from './epoch.js';
import { toMonthlyCounts } from './federal-register.js';
import { USER_AGENT } from './user-agent.js';

describe('dbnomics parsePeriod', () => {
  test('expands an annual period to full-year bounds', () => {
    assert.deepEqual(parsePeriod('2025'), {
      periodStart: '2025-01-01',
      periodEnd: '2025-12-31',
    });
  });

  test('expands each quarter to correct bounds', () => {
    assert.deepEqual(parsePeriod('2025-Q1'), {
      periodStart: '2025-01-01', periodEnd: '2025-03-31',
    });
    assert.deepEqual(parsePeriod('2025-Q4'), {
      periodStart: '2025-10-01', periodEnd: '2025-12-31',
    });
  });

  test('handles month-end correctly, including February in a leap year', () => {
    // 2024 is a leap year; 2025 is not. Hard-coding 28 or 30 days is the
    // classic bug this guards against.
    assert.equal(parsePeriod('2024-02').periodEnd, '2024-02-29');
    assert.equal(parsePeriod('2025-02').periodEnd, '2025-02-28');
    assert.equal(parsePeriod('2025-04').periodEnd, '2025-04-30');
    assert.equal(parsePeriod('2025-12').periodEnd, '2025-12-31');
  });

  test('handles semi-annual periods', () => {
    assert.deepEqual(parsePeriod('2025-S2'), {
      periodStart: '2025-07-01', periodEnd: '2025-12-31',
    });
  });

  test('treats a daily period as a single day', () => {
    assert.deepEqual(parsePeriod('2025-03-14'), {
      periodStart: '2025-03-14', periodEnd: '2025-03-14',
    });
  });

  test('returns null for unrecognised formats rather than guessing', () => {
    // Skipping an unknown period is safe; inventing bounds for it is not.
    for (const bad of ['not-a-period', '', '2025-Q5', null, undefined, 42]) {
      assert.equal(parsePeriod(bad), null, `should reject ${JSON.stringify(bad)}`);
    }
  });
});

describe('epoch frontier compute', () => {
  test('emits only new maxima, producing a monotonic frontier', () => {
    const rows = [
      { 'Publication date': '2020-01-01', 'Training compute (FLOP)': '1e21', Model: 'A' },
      { 'Publication date': '2021-01-01', 'Training compute (FLOP)': '5e20', Model: 'B' },
      { 'Publication date': '2022-01-01', 'Training compute (FLOP)': '1e23', Model: 'C' },
      { 'Publication date': '2023-01-01', 'Training compute (FLOP)': '9e22', Model: 'D' },
    ];

    const result = toFrontierComputeObservations(rows);

    assert.equal(result.length, 2, 'only A and C advance the frontier');
    assert.equal(result[0].value, 1e21);
    assert.equal(result[1].value, 1e23);

    // The defining property: a frontier never decreases.
    for (let i = 1; i < result.length; i += 1) {
      assert.ok(result[i].value > result[i - 1].value, 'frontier must be strictly increasing');
    }
  });

  test('sorts by date before computing the frontier', () => {
    // Out-of-order input is normal in a CSV. Computing a running max without
    // sorting first would drop legitimate frontier points.
    const rows = [
      { 'Publication date': '2023-01-01', 'Training compute (FLOP)': '1e23' },
      { 'Publication date': '2020-01-01', 'Training compute (FLOP)': '1e21' },
    ];
    const result = toFrontierComputeObservations(rows);
    assert.equal(result.length, 2);
    assert.equal(result[0].periodStart, '2020-01-01');
  });

  test('skips rows with missing or unparseable values', () => {
    const rows = [
      { 'Publication date': '2020-01-01', 'Training compute (FLOP)': '' },
      { 'Publication date': '', 'Training compute (FLOP)': '1e21' },
      { 'Publication date': '2021-01-01', 'Training compute (FLOP)': 'unknown' },
    ];
    assert.equal(toFrontierComputeObservations(rows).length, 0);
  });

  test('accepts alternative upstream column names', () => {
    const rows = [{ publication_date: '2020-01-01', training_compute_flop: '1e21' }];
    assert.equal(toFrontierComputeObservations(rows).length, 1);
  });
});

describe('epoch cluster counts', () => {
  test('aggregates clusters by country and year', () => {
    const rows = [
      { 'First operational date': '2024-03-01', Country: 'United States' },
      { 'First operational date': '2024-08-01', Country: 'United States' },
      { 'First operational date': '2024-05-01', Country: 'China' },
    ];

    const result = toClusterCountObservations(rows);
    const usa = result.find((r) => r.countryIso3 === 'USA');
    const chn = result.find((r) => r.countryIso3 === 'CHN');

    assert.equal(usa.value, 2);
    assert.equal(chn.value, 1);
    assert.equal(usa.periodStart, '2024-01-01');
    assert.equal(usa.periodEnd, '2024-12-31');
  });

  test('skips unmapped country names rather than guessing', () => {
    // A wrong country attribution on a map is worse than an absent one.
    const rows = [{ 'First operational date': '2024-01-01', Country: 'Freedonia' }];
    assert.equal(toClusterCountObservations(rows).length, 0);
  });
});

describe('federal register monthly counts', () => {
  test('groups documents into calendar months with correct end dates', () => {
    const docs = [
      { publishedAt: '2025-01-15' },
      { publishedAt: '2025-01-28' },
      { publishedAt: '2025-02-03' },
    ];

    const result = toMonthlyCounts(docs);
    const january = result.find((r) => r.periodStart === '2025-01-01');
    const february = result.find((r) => r.periodStart === '2025-02-01');

    assert.equal(january.value, 2);
    assert.equal(january.periodEnd, '2025-01-31');
    assert.equal(february.value, 1);
    assert.equal(february.periodEnd, '2025-02-28');
  });

  test('ignores documents with no publication date', () => {
    assert.equal(toMonthlyCounts([{ publishedAt: null }, {}]).length, 0);
  });
});


/**
 * The User-Agent every adapter sends.
 *
 * WHY THIS IS A TEST AND NOT A CONVENTION
 *
 * The string was copied into five adapters. A pass over the repository fixed
 * four of them and missed the fifth — epoch.js went on sending
 * `Diffusion/1.0 (research dashboard)`, which identifies a piece of software
 * and gives an operator no way to reach anyone. Nothing could have noticed:
 * the miss is invisible in every file that was correct.
 *
 * So the constant now lives in `sources/user-agent.js` and this asserts the
 * two things about it that matter to somebody else's server, plus the rule that
 * stops a sixth copy appearing.
 */
describe('outbound identity', () => {
  const SOURCES = new URL('.', import.meta.url);

  /** Every adapter, excluding this file's siblings and the constant itself. */
  function adapterFiles() {
    return readdirSync(SOURCES)
      .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js') && f !== 'user-agent.js')
      .map((f) => [f, readFileSync(new URL(f, SOURCES), 'utf8')]);
  }

  test('it names the project and a URL a provider can follow', () => {
    assert.match(USER_AGENT, /^Diffusion\/\d/);
    // A bare product name is not a contact route. Resolution was checked by
    // hand on 2026-09-04: /EconIntel 200, /Diffusion 404 — hence this one.
    assert.match(USER_AGENT, /\(\+https:\/\/github\.com\/[\w-]+\/[\w-]+\)$/);
  });

  test('it carries no email address', () => {
    // A personal address in a shipped file is published to every reader of the
    // repository and lands in every provider log it touches. The two places an
    // address is genuinely needed — the SEC, and OpenAlex's polite pool — both
    // read it from the SEC_USER_AGENT secret at runtime.
    assert.doesNotMatch(USER_AGENT, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    assert.doesNotMatch(USER_AGENT, /mailto:/i);
  });

  test('no adapter hard-codes a User-Agent of its own', () => {
    // The rule that would have caught the fifth copy. A header value may be the
    // shared constant, the SEC secret, or a template that interpolates one of
    // them — never a quoted literal.
    const offenders = [];

    for (const [name, source] of adapterFiles()) {
      for (const match of source.matchAll(/['"]User-Agent['"]\s*:\s*([^,\n}]+)/g)) {
        const value = match[1].trim();
        const ok =
          value === 'USER_AGENT' ||
          value === 'config.secUserAgent' ||
          (value.startsWith('`') && value.includes('${'));
        if (!ok) offenders.push(`${name}: ${value}`);
      }
    }

    assert.deepEqual(offenders, [], `hard-coded User-Agent header(s): ${offenders.join(' · ')}`);
  });

  test('no adapter contains a literal email address', () => {
    const offenders = [];
    for (const [name, source] of adapterFiles()) {
      for (const line of source.split('\n')) {
        // sec.js documents the SEC's required FORMAT in its error message.
        // That is a placeholder, not an address, and it must stay readable.
        if (line.includes('your@email.com')) continue;
        if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(line)) {
          offenders.push(`${name}: ${line.trim().slice(0, 70)}`);
        }
      }
    }
    assert.deepEqual(offenders, [], `literal address(es): ${offenders.join(' · ')}`);
  });
});

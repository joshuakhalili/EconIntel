/**
 * `financingGraph()` — the circular-financing rule, which is an editorial claim
 * about named companies and dollar amounts.
 *
 * WHY IT NEEDS A TEST MORE THAN MOST QUERIES DO
 *
 * Everything else on this site reports a figure an agency published. This
 * function DECIDES something: which pairs of companies are in a circular
 * arrangement, and how much money is on each side of it. Getting that wrong
 * does not produce a blank chart — it produces a confident, specific and false
 * statement about two real companies.
 *
 * Two of its decisions are counter-intuitive enough that a future tidy-up would
 * plausibly reverse them, and neither is visible from the SQL:
 *
 *   a circle is a CAPITAL leg plus a COMMERCIAL one, not money flowing both
 *   ways — the NVIDIA/CoreWeave case has NVIDIA as payer on all three edges and
 *   is the single most-reported example in the dataset;
 *
 *   the two sides are NEVER added — Microsoft put $13bn into OpenAI and OpenAI
 *   committed $250bn back in Azure purchases, and "$263bn" describes nothing
 *   that happened.
 *
 * The database is stubbed: `pool.query` is replaced, and an unstubbed statement
 * throws rather than reaching a socket.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = 'postgres://unused:unused@127.0.0.1:5432/unused';
process.env.DB_DRIVER = 'pg';

const { pool } = await import('../db/pool.js');
const { financingGraph } = await import('./events.js');

let edgeRows = [];
let citationRows = [];
let citationParams = null;

pool.query = async (text, params) => {
  const sql = String(text);
  if (sql.includes('FROM investment_edges')) return { rows: edgeRows, rowCount: edgeRows.length };
  if (sql.includes('FROM event_citations')) {
    citationParams = params;
    return { rows: citationRows, rowCount: citationRows.length };
  }
  throw new Error(`unstubbed statement: ${sql.trim().slice(0, 160)}`);
};

pool.connect = async () => {
  throw new Error('financingGraph must only read');
};

beforeEach(() => {
  edgeRows = [];
  citationRows = [];
  citationParams = null;
});

let nextEventId = 1;

/** One row of `investment_edges`, as the SELECT returns it. */
function edge(over = {}) {
  return {
    event_id: nextEventId++,
    from_entity_id: 1,
    from_name: 'Funder Inc',
    from_sector: 'chips',
    to_entity_id: 2,
    to_name: 'Funded Inc',
    to_sector: 'cloud',
    kind: 'investment',
    status: 'announced',
    amount_usd: 1_000_000_000,
    announced_date: '2026-01-01',
    headline: 'A deal',
    loop_status: null,
    loop_description: null,
    structure_label: null,
    evidence_count: 1,
    is_verified: true,
    confidence_tier: 'reported',
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('what makes a pair circular', () => {
  test('a capital leg and a commercial leg between the same pair, whoever pays', async () => {
    /*
     * NVIDIA / CoreWeave in miniature: NVIDIA is the payer on both edges. A
     * both-ways test — A paid B and B paid A — calls this two unrelated deals
     * and misses the arrangement the phrase "circular financing" was coined
     * for: the money leaves as equity and returns as revenue.
     */
    edgeRows = [
      edge({ kind: 'investment', amount_usd: 2_000_000_000 }),
      edge({ kind: 'offtake', amount_usd: 6_300_000_000 }),
    ];

    const { circles } = await financingGraph();
    assert.equal(circles.length, 1);
    assert.equal(circles[0].reverses, false, 'no direction ever reverses here');
    assert.equal(circles[0].funder.name, 'Funder Inc');
    assert.equal(circles[0].funded.name, 'Funded Inc');
  });

  test('two capital legs are not a circle, however much money moves', async () => {
    edgeRows = [
      edge({ kind: 'investment' }),
      edge({ kind: 'debt_facility', from_entity_id: 2, to_entity_id: 1 }),
    ];

    const { circles } = await financingGraph();
    assert.deepEqual(circles, []);
  });

  test('two commercial legs are not a circle either', async () => {
    edgeRows = [
      edge({ kind: 'offtake' }),
      edge({ kind: 'partnership', from_entity_id: 2, to_entity_id: 1 }),
    ];

    const { circles } = await financingGraph();
    assert.deepEqual(circles, []);
  });

  test('the pair key is direction-blind, so both legs land on one row', async () => {
    // Sorted by id rather than by name, because names are editorial and get
    // rewritten while ids do not.
    edgeRows = [
      edge({ kind: 'investment', from_entity_id: 1, to_entity_id: 2 }),
      edge({ kind: 'offtake', from_entity_id: 2, to_entity_id: 1, from_name: 'Funded Inc', to_name: 'Funder Inc' }),
    ];

    const { circles } = await financingGraph();
    assert.equal(circles.length, 1, 'one circle, not two half-circles');
    assert.equal(circles[0].reverses, true);
  });

  test('a one-sided deal has no counterparty and forms no circle', async () => {
    edgeRows = [
      edge({ kind: 'investment', to_entity_id: null, to_name: null }),
      edge({ kind: 'offtake', to_entity_id: null, to_name: null }),
    ];

    const { circles } = await financingGraph();
    assert.deepEqual(circles, []);
  });

  test('every capital kind counts, not just "investment"', async () => {
    for (const kind of ['investment', 'debt_facility', 'convertible_note', 'credit_facility', 'government_grant', 'acquisition']) {
      edgeRows = [edge({ kind }), edge({ kind: 'partnership' })];
      const { circles } = await financingGraph();
      assert.equal(circles.length, 1, `${kind} should count as a capital leg`);
    }
  });

  test('a kind on neither list closes nothing', async () => {
    edgeRows = [edge({ kind: 'investment' }), edge({ kind: 'lawsuit' })];
    const { circles } = await financingGraph();
    assert.deepEqual(circles, []);
  });
});

describe('the two sides of a circle are reported and never added', () => {
  test('capital and commercial totals stay apart', async () => {
    // Microsoft / OpenAI: $13bn in, $250bn committed back. A single total would
    // describe nothing that happened.
    edgeRows = [
      edge({ kind: 'investment', amount_usd: 13_000_000_000 }),
      edge({ kind: 'offtake', amount_usd: 250_000_000_000 }),
    ];

    const [circle] = (await financingGraph()).circles;
    assert.equal(circle.capitalUsd, 13_000_000_000);
    assert.equal(circle.commercialUsd, 250_000_000_000);
    assert.ok(!('totalUsd' in circle), 'there must be no combined figure to render by accident');
  });

  test('several legs on one side are summed within that side only', async () => {
    edgeRows = [
      edge({ kind: 'investment', amount_usd: 2_000_000_000 }),
      edge({ kind: 'investment', amount_usd: 100_000_000 }),
      edge({ kind: 'offtake', amount_usd: 6_300_000_000 }),
    ];

    const [circle] = (await financingGraph()).circles;
    assert.equal(circle.capitalUsd, 2_100_000_000);
    assert.equal(circle.commercialUsd, 6_300_000_000);
    assert.equal(circle.capital.length, 2);
    assert.equal(circle.commercial.length, 1);
  });

  test('an undisclosed amount contributes zero rather than NaN', async () => {
    // A deal with no reported figure is common; NaN would render as "$NaN" on
    // the card and poison the sort below.
    edgeRows = [
      edge({ kind: 'investment', amount_usd: null }),
      edge({ kind: 'offtake', amount_usd: 5_000_000_000 }),
    ];

    const [circle] = (await financingGraph()).circles;
    assert.equal(circle.capitalUsd, 0);
    assert.equal(circle.largestLegUsd, 5_000_000_000);
  });

  test('a NUMERIC that arrived as a string is still added as a number', async () => {
    // `db/pool.js` registers the NUMERIC parser on whichever driver it chose,
    // and records what happens when that registration lands on a registry
    // nothing reads. `Number(...)` here is the defence; this asserts it.
    edgeRows = [
      edge({ kind: 'investment', amount_usd: '2000000000' }),
      edge({ kind: 'investment', amount_usd: '100000000' }),
      edge({ kind: 'offtake', amount_usd: '6300000000' }),
    ];

    const [circle] = (await financingGraph()).circles;
    assert.equal(circle.capitalUsd, 2_100_000_000);
    assert.equal(typeof circle.capitalUsd, 'number');
  });
});

describe('ordering and identity', () => {
  test('circles are sorted by their largest single leg, descending', async () => {
    edgeRows = [
      edge({ kind: 'investment', from_entity_id: 1, to_entity_id: 2, amount_usd: 1_000_000_000 }),
      edge({ kind: 'offtake', from_entity_id: 1, to_entity_id: 2, amount_usd: 2_000_000_000 }),
      edge({ kind: 'investment', from_entity_id: 3, to_entity_id: 4, from_name: 'Big', to_name: 'Bigger', amount_usd: 9_000_000_000 }),
      edge({ kind: 'offtake', from_entity_id: 3, to_entity_id: 4, from_name: 'Big', to_name: 'Bigger', amount_usd: 1_000_000_000 }),
    ];

    const { circles } = await financingGraph();
    assert.deepEqual(
      circles.map((c) => c.largestLegUsd),
      [9_000_000_000, 2_000_000_000]
    );
    assert.equal(circles[0].funder.name, 'Big');
  });

  test('the funder is read off the capital leg, not off whichever row sorted first', async () => {
    /*
     * The commercial leg is listed first here and runs the other way. If the
     * funder were taken from `legs[0]` the card would name the customer as the
     * investor — a specific, false claim about two real companies.
     */
    edgeRows = [
      edge({
        kind: 'offtake',
        from_entity_id: 2,
        from_name: 'Funded Inc',
        from_sector: 'cloud',
        to_entity_id: 1,
        to_name: 'Funder Inc',
        to_sector: 'chips',
      }),
      edge({ kind: 'investment' }),
    ];

    const [circle] = (await financingGraph()).circles;
    assert.deepEqual(circle.funder, { id: 1, name: 'Funder Inc', sector: 'chips' });
    assert.deepEqual(circle.funded, { id: 2, name: 'Funded Inc', sector: 'cloud' });
  });

  test('`latest` is the most recent leg in the circle', async () => {
    edgeRows = [
      edge({ kind: 'investment', announced_date: '2024-03-01' }),
      edge({ kind: 'offtake', announced_date: '2026-09-01' }),
      edge({ kind: 'investment', announced_date: '2025-01-01' }),
    ];

    const [circle] = (await financingGraph()).circles;
    assert.equal(circle.latest, '2026-09-01');
  });
});

describe('evidence', () => {
  test('citations are attached to their edge with the join key stripped', async () => {
    /*
     * The financing section makes specific claims about named companies, and
     * until these were selected it was the one editorial feature on the site
     * with no visible source while every chart carried its publisher and
     * licence.
     */
    edgeRows = [edge({ event_id: 100 }), edge({ event_id: 200, kind: 'offtake' })];
    citationRows = [
      { event_id: 100, url: 'https://example.invalid/8k', publisher: 'SEC', publisher_class: 'primary', is_primary: true, http_status: 200, is_checked: true, checked_at: '2026-08-01' },
      { event_id: 100, url: 'https://example.invalid/news', publisher: 'A paper', publisher_class: 'press', is_primary: false, http_status: 200, is_checked: false, checked_at: null },
    ];

    const { edges } = await financingGraph();
    assert.equal(edges[0].citations.length, 2);
    assert.ok(!('event_id' in edges[0].citations[0]), 'the join key is not part of the payload');
    assert.equal(edges[0].citations[0].publisher_class, 'primary');
    assert.deepEqual(edges[1].citations, [], 'an edge with no citation gets an array, not undefined');
  });

  test('the citations are fetched in one statement, keyed on the edges just read', async () => {
    // One round trip for all of them: the whole citation table is smaller than
    // the edge list it belongs to.
    edgeRows = [edge({ event_id: 11 }), edge({ event_id: 22 })];
    await financingGraph();
    assert.deepEqual(citationParams, [[11, 22]]);
  });

  test('no edges means no citation lookup with an empty array', async () => {
    edgeRows = [];
    const { edges, circles } = await financingGraph();
    assert.deepEqual(edges, []);
    assert.deepEqual(circles, []);
    assert.deepEqual(citationParams, [[]]);
  });
});

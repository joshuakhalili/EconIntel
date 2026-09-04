/**
 * Event identity.
 *
 * `events.dedup_hash` is `TEXT NOT NULL UNIQUE` in migration 0007 and, until
 * now, nothing in the codebase generated one. That is a column every writer
 * must fill and none could agree on, which is how the same deal ends up in the
 * table twice under two different hashes.
 *
 * So the generator lives here, beside `documents.js`'s `buildDedupHash`, for
 * the same reason that one does: the grain of "these are the same thing" is a
 * decision, and a decision made independently by each writer is not a decision.
 * A future extractor reading deals out of filings must import this rather than
 * hash whatever fields it happens to have.
 */

import { createHash } from 'node:crypto';
import { query } from '../db/pool.js';

/**
 * Build the deduplication key for a deal.
 *
 * WHAT IT HASHES
 *
 *   from_entity_id | to_entity_id | kind | announced_date
 *
 * WHY THOSE FOUR, AND NOT THE OBVIOUS OTHERS
 *
 * The problem this column solves, per 0007, is that "the same deal is reported
 * by dozens of outlets and extracted repeatedly across ingestion runs". So the
 * grain has to be everything two reports of one deal agree on, and nothing they
 * disagree on.
 *
 * `amount_usd` is EXCLUDED. Reuters says $4 billion, a filing says
 * $4,000,000,000, a summary says "about $4bn" and a later correction says
 * $3.95bn. Including it would create a new event every time a figure was
 * rounded differently — which is the exact duplication the column exists to
 * prevent — and would mean a corrected amount silently became a second deal
 * rather than an update to the first.
 *
 * `headline` is EXCLUDED for the same reason, more strongly: two outlets never
 * write the same headline.
 *
 * `status` is EXCLUDED because a deal's status changes over its life. An
 * announced deal that completes must UPDATE, not insert a twin. That is also
 * why this dataset models "Amazon completes its $4bn Anthropic investment" as a
 * status change on the September 2023 announcement rather than as a second
 * $4bn event: two rows would sum to $8bn of money that was $4bn.
 *
 * `to_entity_id` may be null — 0007 allows a one-sided event — and null is
 * folded to the empty string so a one-sided deal hashes stably rather than
 * producing "null" or "undefined" depending on the caller.
 *
 * WHAT THIS DELIBERATELY CANNOT CATCH
 *
 * Two genuinely different deals between the same parties, of the same kind, on
 * the same day collide. That is real and rare, and the honest response is for
 * the writer to refuse rather than for this function to add a tiebreaker that
 * would reopen the rounding problem. `scripts/load-financing-deals.js` checks
 * for collisions across its batch and rejects.
 *
 * @param {object} event
 * @param {string} event.fromEntityId
 * @param {string|null} [event.toEntityId]
 * @param {string} event.kind            an `event_kind` value
 * @param {string|Date} event.announcedDate
 * @returns {string} 64-character hex digest
 */
export function buildEventDedupHash({ fromEntityId, toEntityId, kind, announcedDate }) {
  if (!fromEntityId) throw new Error('buildEventDedupHash: fromEntityId is required');
  if (!kind) throw new Error('buildEventDedupHash: kind is required');
  if (!announcedDate) throw new Error('buildEventDedupHash: announcedDate is required');

  // DATE, not timestamp: `events.announced_date` is a DATE column, and a caller
  // passing a Date object must hash the same as one passing '2024-03-26'.
  const day =
    announcedDate instanceof Date
      ? announcedDate.toISOString().slice(0, 10)
      : String(announcedDate).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error(`buildEventDedupHash: announcedDate "${announcedDate}" is not a date`);
  }

  return createHash('sha256')
    .update(`${fromEntityId}|${toEntityId ?? ''}|${kind}|${day}`)
    .digest('hex');
}

/**
 * The financing graph, as edges and the round trips inside it.
 *
 * WHY THIS RETURNS ROUND TRIPS AND NOT A NODE GRAPH
 *
 * The thing being reported is that money is going in circles: an investor puts
 * capital into an AI lab, and the lab commits a comparable sum straight back
 * as a purchase of the investor's compute. Drawn as a force-directed graph
 * that fact is somewhere in a hairball of 23 arrows. Drawn as PAIRS — here is
 * A paying B, here is B paying A, here are the two amounts and the two dates —
 * it is the first thing you see.
 *
 * So the pairing is computed here, in SQL, rather than left to the browser to
 * infer from a flat list.
 *
 * THE AMOUNTS ON A ROUND TRIP MUST NEVER BE ADDED
 *
 * They point in opposite directions. Microsoft put $13bn into OpenAI and
 * OpenAI committed $250bn back in Azure purchases; "$263bn" describes nothing
 * that happened. The same warning is why the diagram reads `investment_edges`
 * and never `monthly_investment`, whose whole premise is summing legs. No
 * total is computed here and none should be added downstream.
 */
export async function financingGraph() {
  const { rows: edges } = await query(
    `SELECT event_id, from_entity_id, from_name, to_entity_id, to_name,
            kind, status, amount_usd, announced_date::text AS announced_date,
            headline, loop_status, loop_description, structure_label,
            from_sector, to_sector, evidence_count, is_verified, confidence_tier
       FROM investment_edges
      ORDER BY announced_date DESC`
  );

  /*
   * THE EVIDENCE, WHICH NOTHING HAS EVER SELECTED.
   *
   * `event_citations` holds a URL, a publisher, the HTTP status when the link
   * was last fetched and whether a person has checked it. Migration 0020 goes
   * as far as a trigger — `event_citations_evidence_required` — making it
   * impossible to store an event with no evidence at all, and its comment says
   * outright that "evidence_count is what a reader should be shown". Until now
   * `grep -rIn event_citations src scripts` found not one SELECT: this query
   * took the COUNT and left the links in the table.
   *
   * That made the financing section the one editorial feature on the site with
   * no visible source, while every chart carries its publisher and its licence
   * — and it makes specific claims about named companies and dollar amounts.
   * Six of the original 33 deals were rejected for dead source URLs; none of
   * that diligence reached anybody.
   *
   * `publisher_class` rides along because it is the distinction the column was
   * added to allow: a company's own 8-K and a newsletter summarising it are not
   * equal evidence, and a reader should be able to see which they are being
   * offered without following the link.
   *
   * One query for all of them rather than one per edge. The whole citation
   * table is smaller than the edge list it belongs to, so a round trip per edge
   * would cost more in latency than the rows weigh.
   */
  const { rows: citationRows } = await query(
    `SELECT event_id, url, publisher, publisher_class, is_primary,
            http_status, is_checked, checked_at
       FROM event_citations
      WHERE event_id = ANY($1::bigint[])
      ORDER BY event_id, is_primary DESC, publisher`,
    [edges.map((edge) => edge.event_id)]
  );

  const citationsByEvent = new Map();
  for (const citation of citationRows) {
    const key = String(citation.event_id);
    if (!citationsByEvent.has(key)) citationsByEvent.set(key, []);
    const { event_id: _eventId, ...withoutKey } = citation;
    citationsByEvent.get(key).push(withoutKey);
  }
  for (const edge of edges) {
    edge.citations = citationsByEvent.get(String(edge.event_id)) ?? [];
  }

  /*
   * WHAT MAKES A PAIR CIRCULAR, AND WHY IT IS NOT "MONEY BOTH WAYS"
   *
   * The obvious test is that A paid B and B paid A. It finds four pairs here
   * and it misses the single most-reported case in the whole dataset.
   *
   * NVIDIA and CoreWeave have three edges and NVIDIA is the payer on all
   * three: it invested $2.0bn, invested $0.1bn earlier, and separately
   * committed $6.3bn to BUY CAPACITY BACK from the company it had just
   * funded. No direction ever reverses, and that is exactly the arrangement
   * the phrase "circular financing" was coined for — the money leaves as
   * equity and returns as revenue. A both-ways test calls it two unrelated
   * deals.
   *
   * So the test is about the KIND of leg, not its direction: a pair is
   * circular when the same two parties are joined by both a CAPITAL leg
   * (someone funded someone) and a COMMERCIAL one (someone bought from
   * someone). That is what closes a circle, whoever happens to be named as
   * payer on each line.
   *
   * It finds five pairs, and the four that the direction test found are all
   * still among them.
   */
  const CAPITAL = new Set([
    'investment',
    'debt_facility',
    'convertible_note',
    'credit_facility',
    'government_grant',
    'acquisition',
  ]);
  const COMMERCIAL = new Set(['offtake', 'partnership']);

  /*
   * A pair key that is the same in both directions, so both legs of one circle
   * collapse onto one row. Sorted by id rather than by name: names are
   * editorial and get rewritten, ids do not.
   */
  const pairKey = (a, b) => [a, b].sort().join('::');
  const pairs = new Map();

  for (const edge of edges) {
    if (!edge.to_entity_id) continue; // one-sided deal; no circle to find
    const key = pairKey(edge.from_entity_id, edge.to_entity_id);
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(edge);
  }

  const circles = [...pairs.values()]
    .filter(
      (legs) =>
        legs.some((l) => CAPITAL.has(l.kind)) && legs.some((l) => COMMERCIAL.has(l.kind))
    )
    .map((legs) => {
      const capital = legs.filter((l) => CAPITAL.has(l.kind));
      const commercial = legs.filter((l) => COMMERCIAL.has(l.kind));

      /*
       * The funder is whoever pays on the capital legs. Named from the data
       * rather than from the pair's first row, because the first row is
       * whichever edge sorted first by date and carries no meaning.
       */
      const funderId = capital[0].from_entity_id;
      const funded = capital[0].to_entity_id;

      const named = (id) => {
        const hit = legs.find((l) => l.from_entity_id === id) ?? legs.find((l) => l.to_entity_id === id);
        return hit?.from_entity_id === id
          ? { id, name: hit.from_name, sector: hit.from_sector }
          : { id, name: hit?.to_name, sector: hit?.to_sector };
      };

      return {
        funder: named(funderId),
        funded: named(funded),
        capital,
        commercial,
        /*
         * Both sides are reported, and they are NEVER added. They point in
         * opposite economic directions: Microsoft put $13bn into OpenAI and
         * OpenAI committed $250bn back in Azure purchases, and "$263bn"
         * describes nothing that happened. This is the same reason the
         * feature reads `investment_edges` and never `monthly_investment`,
         * whose premise is summing legs.
         */
        capitalUsd: capital.reduce((sum, l) => sum + (Number(l.amount_usd) || 0), 0),
        commercialUsd: commercial.reduce((sum, l) => sum + (Number(l.amount_usd) || 0), 0),
        /* Whether direction actually reverses. Shown on the card, because
           "they bought from each other" and "the funder bought back from the
           company it funded" are different arrangements and a reader should
           not have to work out which one they are looking at. */
        reverses: new Set(legs.map((l) => l.from_entity_id)).size > 1,
        largestLegUsd: Math.max(...legs.map((l) => Number(l.amount_usd) || 0)),
        latest: legs.map((l) => l.announced_date).sort().at(-1),
      };
    })
    .sort((x, y) => y.largestLegUsd - x.largestLegUsd);

  return { edges, circles };
}

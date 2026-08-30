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

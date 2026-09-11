import { createHash } from 'node:crypto';
import { STRANDS, CORPUS_START, fetchStrand } from './sources/openalex.js';
import { openAlexBudget } from './openalex-budget.js';

/** Save a cursor only AFTER its documents commit. A crash between the two
 * replays a page; document deduplication makes that safe. No key is persisted.
 */
export async function ingestCheckpointedCorpus({ previous = null, save, insert, fetch = fetchStrand }) {
  const signature = createHash('sha256').update(JSON.stringify(
    STRANDS.map((strand) => strand.filters({ fromDate: CORPUS_START }))
  )).digest('hex');
  const checkpoint = previous?.signature === signature && !previous.complete
    ? { ...previous, cursors: { ...previous.cursors } }
    : { signature, cursors: {}, complete: false };
  let written = 0, fetched = 0, skipped = 0;
  const budget=openAlexBudget({maxRequests:100,onUsage:async usage=>{
    checkpoint.provider_usage=usage;await save(checkpoint);
  }});
  await save(checkpoint);
  for (const strand of STRANDS) {
    if (checkpoint.cursors[strand.id] === null) continue;
    await fetch(strand, {
      request:budget.request,
      startCursor: checkpoint.cursors[strand.id] ?? '*',
      onPage: async ({ documents, nextCursor }) => {
        const result = await insert(documents);
        written += result.written;
        skipped += result.skipped + result.duplicates;
        fetched += documents.length;
        checkpoint.cursors[strand.id] = nextCursor;
        await save(checkpoint);
      },
    });
  }
  checkpoint.complete = STRANDS.every((strand) => checkpoint.cursors[strand.id] === null);
  await save(checkpoint);
  return { written, fetched, skipped, details: { checkpoint, provider_usage:budget.usage,truncated: !checkpoint.complete } };
}

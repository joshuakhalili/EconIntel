/**
 * `indicators.description`, made safe to show a reader.
 *
 * THE COLUMN IS TWO COLUMNS WEARING ONE NAME.
 *
 * It holds reader-facing prose — what a series measures, why it is here — and
 * it also holds build notes addressed to whoever wires the adapter. Both are
 * rendered: as the subtitle under the h1 on every /data/:id page, and as the
 * body of every row on /data. So the second thing a reader meets on the page
 * whose entire purpose is to explain what a series IS has been, live:
 *
 *   "A change-type series, so it renders on a diverging palette — negative
 *    growth must be visually distinct from positive."
 *   "WARNING: AMECO mixes European Commission forecasts into the same series
 *    as history … must be rendered distinctly (dashed, or cut off) or the
 *    chart asserts something false."
 *   "…the adapter must snapshot each month and accumulate its own history"
 *   "NAICS 518 under the 2022 revision… Same source and vintage as
 *    fred.USINFO, the aggregate it sits inside."
 *
 * An instruction to a programmer, in capitals, quoting a database id, reads as
 * an internal tool published by accident — which undercuts the provenance
 * argument these two pages otherwise make very well.
 *
 * THIS IS THE INTERIM, NOT THE FIX.
 *
 * The fix is to split the column: `description` becomes reader prose and the
 * build notes move to a `notes_internal` column the API never selects. That is
 * a migration plus a pass over 134 descriptions. Until then this trims at
 * render time, which means the notes are still in the API payload and visible
 * to anyone reading it in the network tab — that part cannot be fixed from the
 * client. /data's search runs on the trimmed text for the same reason it is
 * trimmed on screen: a search that matches words the page will not show
 * returns rows for no visible reason.
 *
 * HOW IT TRIMS
 *
 * Two rules, in order. Everything from "WARNING:" or "IMPORTANT CAVEAT:"
 * onward goes — those markers are always sentence-initial and always begin a
 * note to a developer. Then the first engineering token is found and the text
 * is cut back to the last sentence boundary before it, or failing that the
 * last clause boundary, so what survives is whole sentences rather than a
 * phrase with a hole in it. Cutting at the token itself is what would leave
 * "A change-type series, so it" on the page.
 *
 * Everything here is a truncation. Nothing is rewritten, reordered or
 * summarised: the words a reader sees are the words in the column, or they are
 * absent.
 */

/** Markers that begin a note to a developer and never end one. */
const NOTE_MARKERS = /\b(WARNING:|IMPORTANT CAVEAT:)/;

/**
 * Vocabulary that only appears when the sentence is addressed to whoever is
 * building the thing rather than reading it. Taken from the audit's own list.
 * `fred.` catches a bare database id used as a noun ("the same vintage as
 * fred.USINFO"); a source named in prose is written "FRED".
 */
const BUILD_VOCABULARY = /adapter|renders|palette|fred\.|NAICS \d+ under/i;

/** A sentence ends at . ! or ? followed by a space or the end of the string. */
const SENTENCE_END = /[.!?](?=\s|$)/g;

/** Failing a sentence, a clause ends at one of these. */
const CLAUSE_END = /[,;:—]/g;

/** Below this, what is left is a fragment rather than a description. */
const TOO_SHORT = 30;

/** The last index at which `pattern` matches before `limit`, or -1. */
function lastMatchBefore(text, pattern, limit) {
  pattern.lastIndex = 0;
  let found = -1;
  let match = pattern.exec(text);
  while (match !== null && match.index < limit) {
    found = match.index;
    match = pattern.exec(text);
  }
  return found;
}

/**
 * The part of a description a reader should see, or null when none of it is.
 *
 * Null rather than an empty string so a caller can decide between rendering
 * nothing and rendering a fallback, and so `description && <p>…</p>` keeps
 * working unchanged.
 */
export function readerDescription(description) {
  if (typeof description !== 'string') return null;

  let text = description.trim();
  if (text === '') return null;

  let trimmed = false;

  const marker = text.search(NOTE_MARKERS);
  if (marker >= 0) {
    text = text.slice(0, marker).trim();
    trimmed = true;
  }

  const build = text.search(BUILD_VOCABULARY);
  if (build >= 0) {
    trimmed = true;
    const sentence = lastMatchBefore(text, SENTENCE_END, build);
    if (sentence >= 0) {
      text = text.slice(0, sentence + 1).trim();
    } else {
      const clause = lastMatchBefore(text, CLAUSE_END, build);
      // Nothing readable came before the note at all.
      if (clause < 0) return null;
      text = `${text.slice(0, clause).replace(/[\s—,;:]+$/, '')}.`;
    }
  }

  // A trailing conjunction is what a mid-sentence truncation upstream leaves
  // behind — one description in the catalogue ends "…accumulate its own
  // history, or the ". Trim it rather than print it.
  text = text.replace(/[\s,;:—]+(?:and|or|so|but|which|that|the)$/i, '').trim();

  /* The length floor applies only to text this function cut. Three
     descriptions in the catalogue are one word long ("Australia.",
     "Canada.") — terse, but a reader's sentence, and dropping them would be
     this function inventing an editorial standard rather than removing a
     build note. Caught by sweeping all 134 through it rather than by
     reasoning. */
  if (trimmed && text.length < TOO_SHORT) return null;
  return text === '' ? null : text;
}

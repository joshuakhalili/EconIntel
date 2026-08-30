# The research layer, and what it may and may not be used for

## What is in here

`blocked-questions-2026-08-30-raw.md` is **Perplexity deep-research output**,
commissioned to answer eight questions the database could not settle from its
own series. It was requested on 2026-08-30 after those questions were written
up as prompts on the Desktop, and it is filed verbatim.

## The rule that governs it

> No figure or claim on this site is written by a language model.

That rule does not have an exception for research assistants, and this file is
a language model's output. So:

**It may be used to decide things.** Whether a break in a series is a
methodology change or real diffusion; whether a plateau is a plateau or a
disclosure gap; whether two consumption bands are comparable across twenty
years. Those are judgements about the world, the research reports what the
primary literature says about them, and acting on it is no different from
acting on a reading of the same papers.

**Its numbers may not be ingested.** Not as observations, not as report
figures, not as a quoted figure in a caveat. Every number this document
reports is a number it read somewhere; the somewhere is the citable thing.

**Its citations may not be copied without checking.** A model's bibliography is
the classic place for a fabricated reference, and this project already rejected
six financing deals for dead source URLs. Every URL cited in a caveat drawn
from this research was fetched and returned 200 on 2026-08-30 before it was
written down. Fifteen were checked; fifteen resolved.

## How it was actually used

Eight verdicts, mapped onto the eight drafted questions they unblock. The
mapping and what each one changed is in
`blocked-questions-2026-08-30-verdicts.md`, and the caveats themselves are in
`db/seeds/030_research_caveats.sql`.

Every caveat cites a primary source — a Federal Reserve working paper, a BLS
methodology article, a Eurostat regulation, a BEA handbook chapter — not this
document.

## What it did NOT do

It did not activate any question. Six of the eight are now unblocked in the
sense that their methodological objection has an answer, but publishing a
claim about the economy is Joshua's call and the prose on those pages is still
Claude-drafted and unreviewed. The activation statement is written out at the
end of the verdicts file, ready to run, and deliberately not run.

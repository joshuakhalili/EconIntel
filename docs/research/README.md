# The research layer, and what it may and may not be used for

The 1.1.0 intervention adds the [claim-review ledger](claim-review-completion.md),
[review contract](claim-ledger-contract.md), [research workflow](research-workflow-completion.md)
and [current release record](release-current-status.md). These distinguish
agent assessment from human approval and source fidelity from causal validity.

## Historical research inputs

`blocked-questions-2026-08-30-raw.md` is **Perplexity deep-research output**,
commissioned to answer eight questions the database could not settle from its
own series. It was requested on 2026-08-30 after those questions were written
up as prompts on the Desktop, and it is filed verbatim.

## The rule that governs it

The original research policy prohibited model-authored claims. The 1.1.0
intervention instead records agent-drafted and agent-assessed prose explicitly;
it does not label that work human-reviewed. Numbers must still be bound to
their primary sources or labelled scenario assumptions. Model output is not
itself a source, so the following restrictions on these historical inputs remain:

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

The August 30 work produced eight verdicts, mapped onto eight drafted questions. The
mapping and what each one changed is in
`blocked-questions-2026-08-30-verdicts.md`, and the caveats themselves are in
`db/seeds/030_research_caveats.sql`.

Every caveat cites a primary source — a Federal Reserve working paper, a BLS
methodology article, a Eurostat regulation, a BEA handbook chapter — not this
document.

## What it did NOT do

That historical work did not activate any question. Its verdicts described six
methodological objections as answered, not six verified economic findings.
The 1.1.0 intervention retains all 17 inactive questions, records their current
evidence gaps and does not execute the historical activation proposal.

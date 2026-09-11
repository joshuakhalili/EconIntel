# Claim ledger and source review

`node scripts/research-ledger.js` exports the current active-question ledger as JSON.
`node scripts/research-ledger.js --check` exits nonzero for missing question ledgers,
missing evidence, incomplete source locators, unsupported evidence access or stale reviews.
These commands only read the database. Passing is structural validation, not proof of truth.

Each research_claims row is one proposition with scope, verdict, limitations and a
condition that would change the conclusion. research_evidence rows link specific
findings to that proposition, with source version, locator, study method, access
basis and the reason it supports, challenges or contextualises the claim. A metadata
record is discovery, not substantive supporting evidence. Full-text access alone
does not establish causal identification.

The question API includes `research`, displayed by ResearchReview. Drafts are labelled
as drafts. Readers can inspect findings, source methods and limitations without
mistaking a page-level reading list for proof of every sentence.

## Record a review

Review the exported ledger against the actual source and current editorial answer.
Record the actor honestly as agent or human; an agent must never select human.
Make an explicit, reviewable SQL seed containing an INSERT into
research_review_events with claim_id, the exported fingerprint, snapshot (the
exported claim including editorial_snapshot and evidence), actor_type, reviewer,
reviewed_at and notes describing the checks. The exact fingerprint is a literal
from the reviewed export, never a SELECT of whatever happens to be current when
the seed runs. No web endpoint permits writing review events.

The repository compares the latest event's fingerprint with the current snapshot.
Any change to the claim, linked evidence (including version) or question answer,
theory, method or caveat makes the review stale. A new review appends an event and
retains the old snapshot. Fingerprints detect content changes; they cannot detect
an upstream publisher replacing a PDF at the same URL. Refresh checks must compare
the optional evidence content_hash with the fetched source before certifying a new
review.

Migration 0029 adds chart placements (including captions) and a deterministic
fingerprint of the question's scoped observations, value/status/source fields and
indicator units, cadence and description. Unchanged fetch timestamps do not stale
a review. Migration 0030 adds the complete question and parent-lens reading rows,
report-figure metadata and their ordered points to `editorial_snapshot`. Inserting,
changing, removing or reassigning these dependencies invalidates earlier reviews,
including changed takeaways, report values, source URLs and provenance actors.
This is a conservative question-level boundary: it may stale a claim even when an
editor considers that particular source unrelated. It does not silently certify
source changes, nor automatically re-review a claim. The public dependency view
retains `(question_id, snapshot)` and the claim API's existing snapshot shape.

Migration 0031 adds `indicator_definitions` independently of observations, so
empty-series placements are covered too. Indicator source identity/URL, quantity
kind, units, dimensions, confidence and other semantic metadata participate, as do
the source name, homepage, licence, attribution, credibility and notes. Observation
confidence changes also invalidate. Indicator creation/update/fetch timestamps and
refresh intervals are excluded: an operational refresh alone is not new evidence.

Run `DIFFUSION_STAGING_TEST=1 node scripts/verify-research-review.js` only against
an isolated staging database. Its transaction is rolled back and checks independent
observation, caption, indicator/source metadata (including empty series),
question/lens reading, report metadata/value, source-version
and editorial invalidation, plus append-only review-event enforcement.

Legacy figure and reading flags are preserved. Seed 053 records the known agent
reviews documented in seeds 050 and 051. Unidentified legacy reviewers remain
unknown and are labelled accordingly. Source fidelity, economic interpretation and
human sign-off are separate facts.

Migration 0034 adds explicit study families/versions and structured evidence fields
(`sample`, `exposure`, `outcome`, `estimate`, `estimate_unit`, `uncertainty`,
`identification`, `geography_studied`, `study_period`). Missing values remain
unassessed. Author affiliation countries never fill study geography. Provider work
identity groups locations; cross-work family merges require a recorded review.
The latest source-byte hash/access state and linked study-version metadata enter
the claim fingerprint. A repeated unchanged fetch does not stale a review; changed
bytes, inaccessibility or semantic version metadata do. Immutable source refreshes
and `research_review_queue` provide the reason and next action. Discovery results
are candidates, not automatic evidence links or approvals. The separate granular
editorial artifact is live-hash checked for question/lens prose, readings and
report points; its completeness status never implies human review.

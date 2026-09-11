# Research workflow completion — 11 September 2026

## Delivered contract

All 40 questions have explicit topical search profiles, a complementary mechanism
query, an institutional-working-paper lane, and incoming/outgoing citation lanes.
Discovery has no inherited journal-only, abstract-required, date or title-veto
gate. A rotation fetches two 20-result search pages and at most one outgoing and
one incoming citation, one hop only. Subsequent rotations resume persisted cursors
and expand up to 20 references/citations. This is bounded discovery, not exhaustive
coverage. Candidates never become endorsed claims or statistical observations.

Migration 0034 stores provider work families and separately identified location/
version records, candidate routes, run plans/checkpoints, reported provider costs,
structured evidence and immutable source-refresh events. Distinct provider work
IDs are not merged by fuzzy title. `research-link-versions.js` provides an explicit,
reviewer-attributed family linkage with prior identities retained in the decision.
Version metadata corrections, including publication dates, propagate on re-fetch.
Author institution countries are labelled **affiliations**, never studied geography.
Evidence has separate nullable sample, exposure, outcome, estimate, estimate unit,
uncertainty, identification, geography studied and study-period fields. Null means
unassessed, not zero. Existing evidence is not automatically populated by a model.
Seed 064 explicitly populates 14 source-bound AI-at-Work v2 abstract records and
one contrasting METR investigator-summary record: distinct populations, tasks and
outcome directions, with unavailable precision/geography still unassessed. Fifteen
structured rows now exercise this contract; the other evidence is not fabricated.

The authenticated question research endpoint and ResearchReview component expose
candidate families/versions, search queries, physical request/cost accounting,
study metadata, global sentinel recall, source refresh actions and current/stale
claim states. Economics' granular ledger is independently checked against live
question/lens prose, lens readings and linked report points; its JSON is explicitly
included in the deployment bundle. Agent disposition is not human verification.

## Staging evidence

Migrations 0034 and 0035 and editorial seeds 059/060 applied only to the isolated
staging database. Rollback verification passes source-version/publication-date
corrections, baseline/unchanged/changed/inaccessible source hashes, stale queues,
immutable events and all earlier observation/editorial dependency cases.

The first all-question run visited **40/40**, with a source check for every question.
It returned 24 bounded successful searches and 16 HTTP 429 failures, honestly
recorded as failures with resumable phase checkpoints. It made 116 physical
requests: 568 reported credits / $0.0568 observed cost; 16 error responses omitted
cost telemetry. A fresh one-result probe subsequently returned HTTP 200 with 409
credits remaining, ruling out an exhausted daily allowance at that moment. A
bounded failed-only resume and two delayed productivity resumes recovered all
40 questions. The provider explicitly described anonymous-search cluster overload
and supplied Retry-After values of 10–12 seconds. All 40 latest runs are now
`bounded`, not failed or exhaustive. Across all 59 discovery run records, including
the initial failed probe and retries: **189 physical attempts, 950 reported credits,
$0.095 observed cost, 22 responses with unreported cost**. Five diagnostic singleton
requests outside discovery runs reported another five credits. The last probe
reported 45 of 1,000 daily credits remaining; no additional retrieval was needed.
The corpus contains 756 study families, 2,021 versions and 5,147 question/version
candidate placements. These counts are retrieval output, not reviewed-paper counts.

Every one of the 325 evidence bindings across all 40 questions now has a source
refresh result: **34 baseline, 282 unchanged, 9 changed, zero inaccessible and zero
never checked**. These are latest-state binding counts, not distinct source URLs.
The nine changed bindings remain actionable reviews; accessibility does not prove
the economics. Exact approved MIT IDE source hosting was added and its original
PDF fetched successfully. Migration 0036 enforces a non-null hash for successful
refreshes, closing PostgreSQL's nullable-CHECK loophole.

The frozen independently selected essential-study sentinel denominator is **6**:
five foundational workplace/labour/macro papers and an OECD evidence review. Legacy
corpus recall was 2/6; the initial narrow targeted probe was 1/6. Mechanism searches
and broader question-specific retrieval subsequently reached **5/6**, finding
Generative AI at Work and the Productivity J-Curve as well as Robots and Jobs and
the Modern Productivity Paradox and the OECD labour review. Simple Macroeconomics
of AI remains a miss in that measurement. No sentinel DOI was seeded into results.
This is global corpus sentinel recall, not per-question recall or a population
estimate. Multiple paper versions never increase the numerator.

## Operational limits and execution

`research-rotate.js --execute` is wired into the existing scheduled ingestion job:
five least-recently searched questions, maximum 20 physical OpenAlex attempts,
$0.03 observed-cost stop, and two oldest source URLs per question. `--all` explicitly
selects 40 questions with 180 attempts/$0.09 observed stop; `--failed` selects only
questions whose latest run failed. The budget records attempts before sending,
including shared-batch attempts, and captures every response's reported credits,
USD, remaining allowance and error/Retry-After information. Missing cost is unknown.
An observed-dollar stop is not a prepaid guarantee: one response may cross it.
It never purchases credits or changes a provider plan. HTTP failures retain their
last committed phase and do not advance a cursor past unpersisted candidates.

The scheduled job selects production credentials only for exact `refs/heads/main`,
isolated staging credentials only for exact `refs/heads/codex/diffusion-intervention`,
and fails closed for every other ref or absent credential. Feature dispatch must
not fall back to production. New-commit workflow execution is a release gate, not
proven by earlier successful main-branch runs.

`research-refresh.js <question> --execute` fetches only exact allowlisted primary
hosts, validates every redirect, caps bytes/time, hashes without storing full
copyrighted originals, and appends baseline/unchanged/changed/inaccessible events.
Changed hashes are not silently adopted: obtain the changed original, assess the
claim, update its explicit source version/hash, and append a new review. An
inaccessible original produces an actionable queue entry, never an unchanged
claim. HTML byte changes can be navigation-only, so stale is a review request,
not proof of changed economics. DOI resolver and unapproved hosts remain explicit
inaccessible dispositions until an approved primary-original URL is supplied.

Commands: `research-discover.js <question> --execute`, `research-benchmark.js`,
`research-provider-probe.js --record`, `verify-research-workflow.js`, and
`check-editorial-completeness.js --database`. All mutation commands in this work
were run through the isolated staging wrapper; production remains outside this
subtask's authority. Provider probe scope is two live citation contracts, not an
assertion that every API lane or paper is complete.

`research-bootstrap.js export FILE` writes a checksum-protected, mode-0600 metadata
artifact outside the repository, using an internally consistent read-only snapshot.
`research-bootstrap.js import FILE` previews it; `--verify` exercises its transaction
then rolls back, and only explicit `--execute` commits. The exact whitelist includes
study families/versions, discovery runs/candidates and source refresh provenance;
no users, auth, observations or narrative assertions transfer. Numeric run IDs are
remapped, existing semantic conflicts reject the import, and source bindings require
identical evidence ID, URL and source version. Mismatches are counted/skipped.
Older source checks never supersede newer destination checks; rollback verification
inserts a newer inaccessible fixture and proves it survives import. Original check
time orders incoming events, with original numeric ID breaking ties. Bootstrap
locks evidence against new row-locking writers, then locks refresh-event inserts,
before reading destination cutoffs. Both locks last to transaction end; ordinary
SELECT remains available. This prevents a concurrent refresh from slipping between
cutoff capture and import. The two-connection rollback test verifies row-locking
writers and direct event inserts are blocked while reads remain possible. Do not
run a source-refresh batch concurrently with this one-off maintenance import.
Original check
dates and staging-origin labels are retained. Imported API costs are clearly labelled
historical staging requests in the reader, not fresh production traffic. A target
with newer discovery state rejects bootstrap to preserve its cursor history.

Validation: 824 passing tests, one skipped in the integrated 825-test run; later
focused reader/budget/ticker-binding regressions also pass. Production build passed
including route, contrast, token and deployment-config checks. The question reader's
live granular gate returned current agent disposition with no binding issues.

## Primary documentation checked

Current [OpenAlex authentication](https://help.openalex.org/api/authentication/)
documents bearer authentication, response rate-limit telemetry and a maximum
100 results per page; the [API overview](https://help.openalex.org/api/) describes
response cost metadata. [Work attributes](https://help.openalex.org/data/works/attributes/)
distinguish author institutions, source locations/versions and work metadata.
[Citation guidance](https://help.openalex.org/data/works/citations/) explicitly
warns that citation linking is incomplete. The official
[citation tutorial](https://help.openalex.org/tutorials/journals-you-cite/) confirms
the work-ID filter and reference traversal. Small singleton reference/cites probes
passed live; large batched reference queries were replaced by bounded rotation.

The benchmark's primary pages and selection reasons are frozen in
`src/server/lib/research-benchmark.js`; these sources were selected independently
of app search hits. Retrieval quality and source fidelity remain separate from
economic validity, identification quality, external validity and human sign-off.

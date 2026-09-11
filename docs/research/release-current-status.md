# Diffusion intervention — current release record

11 September 2026. Branch `codex/diffusion-intervention`, based on `a93ea26`. **Release verification in progress, not deployment confirmation.** The user requires all original deliverables before publication; none are deferred. Version 1.1.0 and the GitHub/Vercel destination are approved. Optional project settings remain unchanged.

## Implemented and verified locally

All 40 question packages are revised; 17 inactive questions remain inactive. All 300 inherited chart placements have dispositions; Census and three matched-country additions bring the total to 304. Individual captions and survey panels are visible. The 56 report figures/422 points have source dispositions, including corrected qualitative findings and separate heterogeneous study outcomes. Three IMF percentages do not reconcile with published endpoints and remain unresolved. Exact-content bindings cover 200 question fields, 498 spans, lens prose/readings and all 25 tickers. The final construct-alignment pass individually inspected all 110 expert-answer spans. Offline and live binding gates pass with zero issues. A passing binding gate is not a truth certificate or human approval.

Typed narration renders validated source-bound facts and rejects stale/tampered caches. Countries, units, dates, provider qualifications and comparison eligibility are bound together. Scenario results are not observations. Country browsing separates economies/aggregates without US fallback. All179active-question indicators have primary/provider/mirror/adapter measurement dispositions, with unstructured populations explicitly null. HTTP retries, GDELT recovery, provider verification and freshness gates are implemented.

All 40 questions executed bounded topical/institutional/citation discovery. Study families/versions are separate; author affiliations are not study geography. Benchmark recall improved from 2/6 legacy to 5/6 targeted. Source refresh checks are append-only; changed bytes remain review work, not automatically accepted evidence. Bootstrap import now blocks concurrent review writers while retaining ordinary reads; a two-connection rollback test verified that newer inaccessible evidence cannot be superseded by imported history. Browser QA corrected incompatible adoption rankings, policy flow/stock labels and mixed-version review rendering. Mobile table containment and cached landing-asset fixes are verified: authenticated Growth is 375px wide at a 375px viewport, labels remain visible, and hydrated homepage copy is current.

## Measured staging state

Fresh database reads:101,157stored observations (including missing records),187active indicators,304placements,2021study-version locations in756families. There are99economies;98have more than six usable indicators. More macro context is not an AI effect, and Taiwan remains thin.

Census has 21 nonnull current-use observations through 6 September 2026. GDELT has 116 nonnull months through 31 August 2026. Each added World Bank series has 2,678 stored rows, 2,673/2,674 nonnull respectively; all nine priority economies have 2000–2025 histories. Seed 063 corrects their inherent-country metadata without changing observations. All 12 live data-integrity gates and 39 chart-group palette checks pass. Latest complete suite: 866 tests, 865 passing, zero failures, one skipped because the local-only original mirror fixture is absent. The production build and authenticated 23-question/99-economy/typed-narration integration pass. Local authenticated smoke passes 29 checks; deployed-SHA and the unconfigured optional durable-error sink are explicit skips. Hosted preview and production verification remain required.

## Destination, isolation and recovery

Local GitHub CLI is `joshuakhalili`; origin is `joshuakhalili/EconIntel`. The friend's connector is not used. Vercel CLI is `joshuakhalili`; approved project `diffusion-econintel` belongs to **Arman labs**, serving `https://trydiffusion.vercel.app`.

The remote feature branch exists at unchangedmain solely so Vercel could accept branch-specific overrides. No implementation commits have been pushed. Preview database/direct database/session overrides and the GitHub staging database secret are configured; production variables are unchanged.

Staging branch `br-odd-waterfall-zadrkbj9` expires17September23:00UTC. Recovery branch `br-dawn-king-za2kkccz` was created from production at LSN`0/AD92448`, confirmedready without compute, and expires25September23:00UTC. Prior deployment: `https://diffusion-econintel-n69d2kbnn-arman-labs.vercel.app`. No production migration or new deployment has occurred.

## Required release order

1. Finish source alignment, ticker bindings, research-bootstrap safety checks and independent findings. Rerun full tests, live data/chart/editorial gates, authenticated staging, build and browser regressions.
2. Reconcile approved1.1.0/changelog/docs, commit deliberate files, push the complete branch and create its PR. Verify actual GitHub-hosted staging ingestion, isolated preview, authenticated content and deployedSHA on the new commit.
3. Reverify production identity/recovery. Apply validated additive migrations. Do not replay all historical seeds over editorial work.
4. **Deploy the new null-safe reader before applying seeds059/060.** Those seeds introduce qualitative null values the old app would coerce to zero. Additive schema can precede deployment; the new intervention content batch must follow compatible code, in one transaction. Then run approved country/source backfills, checked research bootstrap and narration generation. Imported research events retain staging provenance and must not supersede newer production evidence.
5. Verify final production data, editorial state, authentication and `/healthz` commit; run authenticated `scripts/smoke-deploy.js` on the canonical URL. Record actual PR/mergeSHA/deployment results only after success.
6. **Application rollback alone is not safe after qualitative seeds.** It neither undoes data changes nor preserves correct null rendering in the old app. Database restoration requires an explicit recovery decision and must account for intervening production activity.

## Evidence boundary

Agent disposition is not human sign-off. Proprietary raw datasets/estimation code were not replicated. Source fidelity, measurement validity and causal identification are distinct. Unimplemented providers remain unavailable even if credentials exist. Anonymous OpenAlex retrieval worked with bounded retries; no credits or paid plan were purchased. Benchmark misses and unresolved report calculations remain explicit.

See [source/country completion](source-reliability-completion.md), [research workflow](research-workflow-completion.md), [typed narration](typed-narration-completion.md), [review contract](claim-ledger-contract.md), and [historical checkpoint](intervention-release-handoff.md).

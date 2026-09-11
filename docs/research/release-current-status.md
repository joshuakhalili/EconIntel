# Diffusion intervention — current release record

11 September 2026. Branch `codex/diffusion-intervention`, based on `a93ea26`. **Release verification in progress, not deployment confirmation.** The user requires all original deliverables before publication; none are deferred. Version 1.1.0 and the GitHub/Vercel destination are approved. Optional project settings remain unchanged.

## Implemented and verified locally

All 40 question packages are revised; 17 inactive questions remain inactive. All 300 inherited chart placements have dispositions; Census and three matched-country additions bring the total to 304. Individual captions and survey panels are visible. The 56 report figures/422 points have source dispositions, including corrected qualitative findings and separate heterogeneous study outcomes. Three IMF percentages do not reconcile with published endpoints and remain unresolved. Exact-content bindings cover 200 question fields, 498 spans, lens prose/readings and all 25 tickers. The final construct-alignment pass individually inspected all 110 expert-answer spans. Offline and live binding gates pass with zero issues. A passing binding gate is not a truth certificate or human approval.

Typed narration renders validated source-bound facts and rejects stale/tampered caches. Countries, units, dates, provider qualifications and comparison eligibility are bound together. Scenario results are not observations. Country browsing separates economies/aggregates without US fallback. All 179 active-question indicators have primary/provider/mirror/adapter measurement dispositions, with unstructured populations explicitly null. HTTP retries, GDELT recovery, provider verification and freshness gates are implemented.

All 40 questions executed bounded topical/institutional/citation discovery. Study families/versions are separate; author affiliations are not study geography. Benchmark recall improved from 2/6 legacy to 5/6 targeted. Source refresh checks are append-only; changed bytes remain review work, not automatically accepted evidence. Bootstrap import now blocks concurrent review writers while retaining ordinary reads; a two-connection rollback test verified that newer inaccessible evidence cannot be superseded by imported history. Browser QA corrected incompatible adoption rankings, policy flow/stock labels and mixed-version review rendering. Mobile table containment and cached landing-asset fixes are verified: authenticated Growth is 375px wide at a 375px viewport, labels remain visible, and hydrated homepage copy is current.

## Measured staging state

Fresh database reads: 101,157 stored observations (including missing records), 187 active indicators, 304 placements, and 2,021 study-version locations in 756 families. There are 99 economies; 98 have more than six usable indicators. More macro context is not an AI effect, and Taiwan remains thin.

Census has 21 nonnull current-use observations through 6 September 2026. GDELT has 116 nonnull months through 31 August 2026. Each added World Bank series has 2,678 stored rows, 2,673/2,674 nonnull respectively; all nine priority economies have 2000–2025 histories. Seed 063 corrects their inherent-country metadata without changing observations. All 12 live data-integrity gates and 39 chart-group palette checks pass. Latest complete suite: 866 tests, 865 passing, zero failures, one skipped because the local-only original mirror fixture is absent. The local production build passes with 328 static shells, 542 files and a 23.2 MB output. Authenticated integration passes for 23 questions, 99 economies, five lens narrations and simulation narration. Local authenticated smoke passes 29 checks; deployed-SHA and the unconfigured optional durable-error sink are explicit skips. Hosted preview and production verification remain required.

GitHub CI [run 34611613911](https://github.com/joshuakhalili/EconIntel/actions/runs/34611613911) passed for implementation commit `a4ecb78372843a49ddc38801d6cadf19d7865245`. Branch-specific staging Ingest [run 34616386214](https://github.com/joshuakhalili/EconIntel/actions/runs/34616386214) also passed: 21 Census observations fetched, with data, chart, provider-contract and freshness gates passing. Research rotation was intentionally skipped for this Census-only run. These results do not verify production ingestion or every provider's scheduled operation.

## Destination, isolation and recovery

Local GitHub CLI is `joshuakhalili`; origin is `joshuakhalili/EconIntel`. The friend's connector is not used. Vercel CLI is `joshuakhalili`; approved project `diffusion-econintel` belongs to **Arman labs**, serving `https://trydiffusion.vercel.app`.

Implementation commit `a4ecb78372843a49ddc38801d6cadf19d7865245` is pushed to the personal repository's `codex/diffusion-intervention` branch. No pull request is open at this checkpoint. Preview database/direct database/session overrides and the GitHub staging database secret are configured; production variables are unchanged. Hosted preview testing found that the runtime bundle omitted `country-measurement-dispositions.json`; its packaging fix and exact-commit preview verification are still pending at this checkpoint.

Staging branch `br-odd-waterfall-zadrkbj9` expires 17 September at 23:00 UTC. Recovery branch `br-dawn-king-za2kkccz` was created from production at LSN `0/AD92448`, confirmed ready without compute, and expires 25 September at 23:00 UTC. Prior production deployment: `https://diffusion-econintel-n69d2kbnn-arman-labs.vercel.app`. No production migration or replacement production deployment has occurred.

## Required release order

1. Source alignment, ticker bindings, research-bootstrap safety checks and the local verification listed above are complete. Finish the hosted-preview packaging correction and verify the affected runtime routes on its exact commit; rerun relevant checks for that change.
2. Finish the approved 1.1.0 release documentation and create the branch's PR. Hosted CI and Census staging ingestion have passed for the implementation checkpoint. Verify the final isolated preview, authenticated content and deployed SHA before proceeding.
3. Reverify production identity/recovery. Apply validated additive migrations. Do not replay all historical seeds over editorial work.
4. **Deploy the new null-safe reader before applying seeds 059/060.** Those seeds introduce qualitative null values the old app would coerce to zero. Additive schema can precede deployment; the new intervention content batch must follow compatible code, in one transaction. Then run approved country/source backfills, checked research bootstrap and narration generation. Imported research events retain staging provenance and must not supersede newer production evidence.
5. Verify final production data, editorial state, authentication and `/healthz` commit; run authenticated `scripts/smoke-deploy.js` on the canonical URL. Record actual PR, merge SHA and deployment results only after success.
6. **Application rollback alone is not safe after qualitative seeds.** It neither undoes data changes nor preserves correct null rendering in the old app. Database restoration requires an explicit recovery decision and must account for intervening production activity.

## Evidence boundary

Agent disposition is not human sign-off. Proprietary raw datasets/estimation code were not replicated. Source fidelity, measurement validity and causal identification are distinct. Unimplemented providers remain unavailable even if credentials exist. Anonymous OpenAlex retrieval worked with bounded retries; no credits or paid plan were purchased. Benchmark misses and unresolved report calculations remain explicit.

See [source/country completion](source-reliability-completion.md), [research workflow](research-workflow-completion.md), [typed narration](typed-narration-completion.md), [review contract](claim-ledger-contract.md), and [historical checkpoint](intervention-release-handoff.md).

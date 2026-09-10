# Diffusion intervention — implementation and release handoff

10 September 2026. Implemented on `codex/diffusion-intervention`, based on `a93ea26`. The original checkout remains on unchanged `main`. Nothing has been pushed or deployed; production data is unchanged.

## Implemented

- All 40 question packages rebuilt: thesis, expert answer, mechanism, method and limitations. The 17 inactive questions stay inactive.
- All 300 inherited chart placements inspected; seed 055 corrects 276 and records dispositions for 24 retained. Series-specific captions and instrument panels now reach the reader.
- All 32 inherited report takeaways assessed; nine corrected. All 56 report figures have an explicit provenance disposition; two interpretation notes corrected. This is not a second independent verification of all 422 numeric points.
- 175 draft claim records and 324 evidence links, with source versions, locators, access basis and relevance. These are not 175 certified empirical findings. Most section-level links provide context; high-risk corrections carry more specific synthesis.
- Append-only review snapshots. Changes to claims, sources, captions, observations, readings or report figures invalidate the previous review. Agent and human review labels are distinct.
- Final release review added migration 0031: indicator definitions and source attribution invalidate reviews even before observations arrive; operational refresh timestamps do not. Split-chart fallback now retains explicit forecast and unverified-outturn warnings, covered by rendered-markup regressions.
- Country browsing and country-specific indicator links; economies and aggregates separated; missing country data never replaced silently with US observations. A reproducible country/question/indicator export documents gaps.
- World Bank country-set backfill scheduling; OpenAlex optional key, 100-result page limit and durable bounded checkpoints; source capability states distinguish implementation, configuration and recent data.
- Keyless Census BTOS current AI-use publication adapter, 20 fortnightly observations. The revised November 2025 questionnaire is a separate series; expected-use responses are excluded. The new chart brings total placements to 301.
- Source flags persist through ingestion. Statistical breaks interrupt lines and block inappropriate comparisons/rebasing. Forecast classification survives metadata refreshes; ambiguous former AMECO forecasts remain explicitly unverified, not silently relabelled as measured.

## Measured staging results

| Measure | Before | After |
|---|---:|---:|
| Stored observations, including missing-value records | 87,200 | 95,800 |
| Economies with non-null observations | 99 | 99 |
| Economies with six indicators or fewer | 56 | 1 |
| Active questions | 23 | 23 |

The increase is 8,580 World Bank records plus 20 Census observations. More macro context is not evidence of an AI effect. Taiwan remains thin; the country-depth export records the missing concepts in the nine priority economies. Staging's latest stored US BTOS window is August 10–23, 2026, with 22.4% reporting current AI use. That survey has a different population/instrument from OECD and Eurostat. A later read-only release-check fetch accepted 21 current-use records through September 6; that additional record has not been ingested into staging or production, so refresh and reconcile the counts before release.

## Verification

- Final release-check suite: 750 tests, 749 passed, zero failed, one skipped (optional local mirror-cache fixture absent). Eight new regression/edge-case tests were added during the final review, including a guard rejecting future-dated Census current-use observations.
- Production-mode Vercel build and static assembly passed; 326 shells generated.
- Data integrity: all 12 checks passed, including the Census addition.
- Production-style authentication exercised on isolated staging: signed-out protected endpoints return 401; signed-in requests validate all 23 active question packages and country-specific data.
- Review-invalidation rollback tests cover values, captions, question/lens readings, report metadata/points and source/editorial versions; historical events reject mutation.
- New seeds 052–056 run twice with identical counts: 175 claims, 324 links, 23 active questions, 301 placements, 95,800 observations.
- World Bank and Census backfills validated in staging; Census replay writes zero rows. ILO metadata-only update preserved its numeric value and persisted a break flag; replay writes zero rows. AMECO forecast-protection resolution checked in a rolled-back transaction.
- One live anonymous OpenAlex request returned a usable document under the updated contract.
- Browser checks: country coverage, UK-selected GDP series, corrected orders argument, clerical break warning and expandable draft evidence records.

## Release gate and safe sequence

Local GitHub authentication is `joshuakhalili`, with origin `joshuakhalili/EconIntel`. The friend's connector was not used. Vercel CLI authenticates as `joshuakhalili`; the existing project `diffusion-econintel` is owned by **Arman labs**. The user confirmed that destination and approved version 1.1.0 on September 10. A fresh fetch found `main` unchanged. The final plan audit identified unfinished original-plan deliverables below; publication is paused for the user's choice between completing them first and explicitly deferring them.

1. Resolve the unfinished-plan scope. The destination is confirmed, but the existing GitHub integration can create deployments on push, so do not publish the branch before its preview database is deliberately configured and the completion gate is resolved.
2. Preserve the pre-release production database with a recoverable Neon branch and record the prior deployment. Staging is `codex-diffusion-intervention` in project `hidden-rice-12425013`, branch `br-odd-waterfall-zadrkbj9`; it expires September 17 at 23:00 UTC. Keep secrets in environment configuration, not Git.
3. Configure an isolated preview database; apply pending migrations 0028–0031, then only the new seeds 052–056 in one transaction. Do not blindly replay all historical seeds over editorial work.
4. Push the complete branch through the verified local GitHub account, open/review its PR and run authenticated preview smoke checks. Do not merge individual intermediate commits into production.
5. After preview passes, apply the validated additive migrations/new seed batch to production and run the six explicit World Bank backfills plus Census ingestion. Check country counts and source status, then deploy the approved commit. Verify `/healthz` reports that commit and run `scripts/smoke-deploy.js` with an authenticated smoke reader.
6. If release checks fail, restore the previous application deployment. Restore content/data from the preserved database branch only under an explicit recovery decision; an application rollback alone does not undo seeds or ingestion.

## Remaining limits, not hidden successes

- Original-plan deliverables remain incomplete: typed-fact deterministic narration with country/unit/date/estimate-swap tests; question-specific research discovery, citation chaining, essential-study recall checks and study-family deduplication; full atomic claim-by-claim paper-method assessment; a fresh explicit disposition for every one of the 422 report points; and a GDELT-specific recovery lane/freshness alerts. These are not completed merely because related scaffolding exists. No deferral has yet been approved.
- No production rollout or remote push has occurred. Local/staging success is not deployment success.
- `OPENALEX_API_KEY` is wired but was not provisioned; anonymous retrieval works. Sustained research needs the user's own provider key in the ingestion environment.
- Ember, direct EIA/BLS and Copernicus placeholders still do not have operational adapters. They are labelled unavailable; possessing keys does not enable them. Existing GDELT degraded-source policy remains in place.
- The evidence ledger is an agent-authored draft. Full independent paper-method assessment, unresolved report-source checks and human editorial approval remain explicitly open in the linked audits. No citation count or automated test certifies economic truth.
- Source hashes do not automatically detect a publisher replacing a PDF at the same URL. Refresh/source-access checks and editorial review are still required.

Detailed records: [economic review](economic-intervention-2026-09-10.md), [300-caption audit](chart-caption-audit-2026-09-10.md), [32-takeaway and 56-figure audit](report-review-2026-09-10.md), [review contract](claim-ledger-contract.md).

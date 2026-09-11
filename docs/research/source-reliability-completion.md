# Source reliability and country-depth completion

Verified in isolated staging on 10–11 September 2026. No production ingestion, commit, push or deployment was performed by this workstream.

## Request and recovery limits

`src/server/lib/http.js` now applies a total wall-clock request budget (default120 seconds, configurable up to600 seconds), at most5 retries, per-attempt aborts bounded by remaining time, rate limiting on every attempt, and at most30 seconds for a retry wait. Retry-After supports seconds and HTTP dates. A server instruction longer than30 seconds aborts this run rather than retrying prematurely or sleeping indefinitely. Network failures consume the same budget. Fixture tests cover hostile delays, exhausted budgets, nonretryable failures, and both header forms.

GDELT's normal derived job now recovers the latest **complete month**, not the entire archive on every run. It uses at most2 attempts within180 seconds and rejects incomplete daily calendars, wrong resolution, zero/missing denominators, duplicates and impossible numerator/denominator values before upserting. Historical observations are preserved. The existing tolerated-failure policy still cannot excuse a new regression. A separate bounded recovery step, explicit contract probes and a75-day completed-period freshness gate are wired into the existing ingestion workflow. No additional external automation was created.

The75-day threshold is an operational alert policy, not a GDELT publication guarantee. GDELT documentation establishes timeline modes and normalization, but old launch documentation does not guarantee present-day archive access: [DOC2 API documentation](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) and [search-window update](https://blog.gdeltproject.org/doc-geo-2-0-api-updates-full-year-searching-and-more/). Live August2026 recovery succeeded in staging: one monthly observation written,116 retained monthly observations from January2017 through August2026. Freshness check returned `current`, with last completed period2026-08-31. Provider probes are recorded independently; a transient failed probe is not concealed by a successful ingestion.

## Provider verification is not configuration

Migration0032 adds the scoped `source_verifications` register. `scripts/verify-source-providers.js` supports bounded live World Bank, DBnomics, Census and GDELT checks; `--record` stores only verification metadata in the configured database. Each record states method, scope, actual state and timestamp. Credentials and request URLs containing keys are never exported. Verification expires after30 days; this is distinct from ingestion success and observation freshness.

The real staging `/api/status` payload was checked after migration0032. World Bank metadata, one DBnomics Eurostat series and the Census national publication passed their specified probes. GDELT first passed, subsequently timed out during a recorded probe, and then successfully ingested the completed month. A final bounded GDELT probe also passed and was recorded in staging. The register deliberately permits a failed latest probe alongside current data; the final success supersedes only the check state, not this chronology.

The supplying-source count still excludes providers with verification records but no observations/documents. Pipeline UI shows all these states separately. Actual GitHub-hosted execution and production release remain the release owner's verification step, not inferred from local success.

## Matched country context

Seed057 adds two indicators using the existing World Bank adapter, refreshes the existing fixed-investment definition and adds/reconciles three supporting placements (`productivity`, `jobs`, `money`). These are matched **concepts**, not harmonized AI-exposure measures or causal estimates.

| Series | Staged rows | Non-null | Economies | Aggregates | Priority-nine coverage |
|---|---:|---:|---:|---:|---|
| GDP per person employed |2678|2673|98|5|All9:2000–2025,26 non-null annual values each|
| Employment/population15+ |2678|2674|98|5|All9:2000–2025,26 non-null annual values each|
| Fixed capital formation/GDP |2678|2490|95|5|CHN/JPN/USA through2024; other6 through2025|

Priority economies: USA,GBR,DEU,FRA,JPN,CAN,CHN,IND,BRA. Two new series wrote5356 rows including9 null-valued records; fixed-investment replay fetched2678 and changed0. Do not describe aggregate rows as additional countries or count null rows as usable depth.

Current definitions were checked directly: GDP/worker is now constant2021PPP dollars, not output/hour; the employment ratio uses ages15+ and ILO modelled inputs; fixed investment covers the national economy, not AI expenditure. Source warnings about imputation and differing country methods are retained. Primary references: [GDP/worker](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/SL.GDP.PCAP.EM.KD), [employment/population](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/SL.EMP.TOTL.SP.ZS), [fixed investment](https://databank.worldbank.org/metadataglossary/world-development-indicators/series/NE.GDI.FTOT.ZS).

Census BTOS was refreshed separately:21 non-null observations, from reference window beginning2025-11-17 through window ending2026-09-06; one new row written. Current-use and expected-use rows remain separate, and revised wording is not spliced to older surveys. Source: [Census national publication](https://www.census.gov/hfp/btos/ai_national.json).

## Population/estimand dispositions

All179 distinct active-question indicators now have a source-specific disposition, exceeding the127 indicators used by priority-country or global-context observations. `docs/research/country-measurement-dispositions.json` stores the inspected evidence, dates, attempted checks and limitations:

- 46 source-definition checks: 12 World Bank concepts, 33 Eurostat country AI-use measures, and Census BTOS.
- 83 DBnomics metadata checks: actual series titles and decoded dimension labels. Mirror scope is explicitly not called a full sampling frame or independently verified national methodology.
- 36 FRED metadata checks: original series title, units, frequency and complete provider notes. An unstructured population field stays null; the notes and attempted check are retained instead of guessing a population from the title.
- 14 inspected adapter recipes: counting units, numerators/denominators, frontier definitions and reference-price transformations. Recipe verification is not independent certification of upstream completeness.

No live metadata probe failed. Known-definition gaps are therefore concrete source-schema limitations, not skipped indicators. Eurostat scope was checked against the [official2025 survey release](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20251211-2). Additional WDI definitions came from the official `/v2/indicator/{code}?format=json` endpoint. Other-country OECD survey levels retain mirror/national-instrument cautions and cannot form a supposedly harmonized adoption ranking.

The final read-only export under task outputs `country-depth-completed/` has22473 country×question×indicator rows and45 priority country-domain dispositions. It includes sourced/decoded population, estimand, unit, cadence, dates, reference links, licence, flags and explicit gaps. More macro coverage does not count as more AI-effect evidence. Country UI exposes the same definition audit, including source notes and limitations.

Reproduce locally using the isolated staging wrapper:

```text
node scripts/audit-country-definitions.js docs/research/country-measurement-dispositions.json --refresh
node scripts/export-country-matrix.js OUTPUT_DIRECTORY
node scripts/check-source-freshness.js
node scripts/verify-source-providers.js worldbank dbnomics census_btos gdelt
```

Omit`--refresh` to reuse the recorded definitions without repeating provider traffic. Explicit `--record` is required to persist provider-probe state; metadata auditing/export does not write statistical observations.

## Tests and independent narration check

Full suite at this checkpoint:796 tests,795 passed,0 failed,1 skipped. One additional Retry-After test was subsequently added and its22-test HTTP/discovery subset passed. Final integration rerun belongs after all parallel edits settle. `git diff --check` passed.

Read-only independent review covered `narration-facts.js`, production `narrate()`, lens ticker grounding/repository reads and simulation cached-narration reads. The deterministic renderer binds country/unit/period/value/status/source tuples, rejects stale/tampered selections, distinguishes forecasts/scenarios and withholds cross-country comparisons. A constructed mixed-geography/unverified-projection case rendered the correct warning and no directional comparison. No additional demonstrated factual regression was found in this bounded review. This does not certify the source statistics, simulation assumptions or every human editorial claim.

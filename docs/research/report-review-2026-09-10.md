# Independent report interpretation review, 10 September 2026

Scope: all **32 inherited extracted takeaways** and the provenance of all **56 report figures** in isolated staging. The 76 new reading placements from seed 052 are a separate research pass and are excluded here by their explicit agent-authored source-note marker. This is not a second audit of all 422 plotted values.

The pass found errors that a transcription check alone misses. Nine takeaway corrections and two figure interpretation corrections are in `db/seeds/054_report_interpretation_corrections.sql`. Two primary citations are added. Existing extracted/reviewed flags are preserved; none is promoted to human review. An agent identified and authored the corrections.

## Material findings

1. **A cited report can be faithfully quoted and still be wrong.** HAI printed p. 191 really says Google's 2025 capex exceeded $150 billion. The rendered chart also labels 2025 and 2026 as estimates. Alphabet's own filing reports $91.4 billion for 2025. The corrected note identifies the disagreement and uses the filing for realised spending, without calling company-wide capex AI-only investment. [Alphabet 2025 Form 10-K](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000018/goog-20251231.htm).
2. **Denominators matter.** The HAI adoption takeaway calls Microsoft telemetry population-level. The original report specifies working-age people; it does not estimate the fraction of businesses productively deploying AI. [Microsoft original](https://www.microsoft.com/en-us/corporate-responsibility/topics/ai-economy-institute/reports/global-ai-adoption-2025/).
3. **A picture contains evidence the PDF text extractor misses.** IMF Note Figure 2 explicitly names models and dates, contradicting the inherited claim that these are absent. The image was rendered and inspected. Its frontier annotations also do not exactly reconcile with its displayed endpoint prices. Both the takeaway and chart caveat now distinguish source annotations from computed, constant-quality price changes.
4. **Scope cannot be borrowed from a nearby paragraph.** IMF SDN p. 23 explains occupational composition in *potential demand for all new skills*. The inherited AI-skill takeaway used this to explain the observed international AI-skill gap. That inference is now explicitly withheld.
5. **A pooled sample is not four country replications.** PwC's early-career chart pools four countries and says roughly 73% of postings are US observations. Its other firm charts backfill 2024 when 2025 is missing. The takeaway layer now carries limitations already visible in some figure notes.
6. **Elapsed time and output per hour are different estimands.** The METR result is 19% longer task completion time; the HAI chart represents it as -19%. The existing source value is retained with the convention explained, but the chart is renamed to reported task outcomes rather than a common productivity measure. The later METR study has selection and measurement problems; it is not clean evidence disproving the first result. [METR initial study](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/), [METR follow-up](https://metr.org/blog/2026-02-24-uplift-update/).

## Takeaway disposition checklist: all 32 inherited rows

IDs identify the inspected staging snapshot, not stable keys across rebuilds. The correction seed targets question plus publisher. `Retain` means the selected source passage supports the attributed summary, not independent validation of the publisher's underlying data or econometrics. `Correct` means seed 054 changes the text. `Unresolved` means access or underlying identification still needs work. Review flags remain unchanged.

| Staging ID | Page / source | Disposition and check |
|---|---|---|
| 5 | investment lens / BIS | Retain, pp. 22-23, 25: historical boom and financing passages match. Treat recession parallels as BIS interpretation, not a forecast or independent causal historical audit. |
| 77 | money / BIS | Retain, pp. 22-23: trillion-dollar 2025-26 commitments match. These include planned spending and cannot be summed with financing transactions as realised investment. |
| 87 | productivity / BIS | Retain with caution, p. 19: task savings and smaller aggregate estimates are actually stated. Do not convert the loosely specified aggregate horizon into an annual growth rate. |
| 92 | jobs / BIS | Retain, p. 21: sector patterns and automation intent match. The prose is BIS's interpretation; the graph is not a causal national job-loss estimate. |
| 106 | power / BIS | Retain, p. 22: bottleneck and potential price-pressure passage matches. It supplies no identified inflation magnitude. |
| 84 | adoption / Deloitte | Retain, p. 8 and methodology p. 40: access/use distinction and daily-AI-user sample restriction match. Sample is selected on adoption. |
| 90 | productivity / Deloitte | Retain, p. 10: reported benefit prevalence, including efficiency and revenue, matches. These are respondent percentages, not measured productivity effect sizes. |
| 99 | entry-level / Deloitte | Retain, pp. 12-13: automation expectations and job-redesign responses match. Keep expectations separate from realised headcount and interviews separate from representative estimates. |
| 193 | jobs / Economic Policy | **Unresolved full text.** Publisher issue listing confirms identity and pages 145-194. Article/DOI retrieval failed in this pass; no fresh abstract or coefficient verification claimed. Preserve existing abstract-only disclosure and no quantitative coefficient. |
| 86 | adoption / IMF SDN | **Correct:** p. 23 occupational-composition argument concerns potential all-new-skills demand, not an identified decomposition of observed AI adoption. AI-posting growth on pp. 9, 11 retained. |
| 93 | jobs / IMF SDN | Retain, pp. 19-20: 6.3% is a conditional medium-run subgroup comparison for a one-percentage-point demand difference, not 6.3% of all US jobs. Identification robustness still requires full appendix review. |
| 97 | entry-level / IMF SDN | **Correct:** label the 13% citation as a historical 2025 paper vintage, not an IMF estimate or a current number. pp. 18-19 checked. |
| 101 | vacancies / IMF SDN | Retain, p. 19: 0.18 pp exposure difference, 0.4 pp vacancy-share difference and 2.5% relative vacancy-growth result are separate quantities. The share and growth measures must not be interchanged. |
| 103 | markets / IMF Note | **Correct:** names and dates do appear in Figure 2, PDF p. 8 / printed p. 6. Different frontier points do not define a constant-quality price index. |
| 80 | money / KPMG | Retain, pp. 5, 9, 11 and methodology: planned weighted-average spending and recession intention match. This is executive intent from a selected large-company survey. |
| 104 | markets / KPMG | Retain, pp. 18-19: deployment rephasing and cost visibility values match source text/labels. These are response frequencies, not an estimate of AI's net return. |
| 83 | adoption / McKinsey | Retain, printed p. 14 / PDF p. 15 and footnote 3: 78/72/55 sequence and deliberately undefined adoption wording match. Definitions permit experimentation. |
| 79 | money / OECD | Retain, pp. 42-43: 2027 spending is projected; financing risks are explicitly discussed. Neither projection nor corporate financing is booked AI-specific national investment. |
| 82 | building / OECD | Retain, p. 42 footnote 5: data-centre construction equalling office construction in December 2025 is stated. Both are nominal spending measures, not physical capacity. |
| 91 | productivity / OECD | Retain, p. 291: cautious capital-deepening interpretation matches. “Likely driven” is not an identified treatment effect. |
| 100 | vacancies / OECD | Retain, pp. 25-26: industry-level comparison and US exception match. Absence of broad displacement is not absence of subgroup harm. |
| 105 | power / OECD | Retain, p. 41 Box 1.3: 60% refers to operating costs as cited to IEA, not total annualised cost including capital. Underlying IEA cost-accounting validation remains open. |
| 89 | productivity / PwC | **Correct:** add 2024 substitution at the 2025 endpoint, revenue-per-worker definition and sector-proxy limitation. Rendered p. 19 confirms endpoint labels. |
| 94 | jobs / PwC | **Correct:** add mixed 2024/25 endpoint and make selected surviving-firm interpretation explicit. p. 20 chart footnote checked. |
| 98 | entry-level / PwC | **Correct:** four-country pooled result is about 73% US; 0-2 advertised experience years proxy early career. Postings are not hires; p. 11 explicitly disclaims causality. |
| 78 | money / HAI | Retain, p. 178: corporate and private investment values match Quid-based report text. They measure financial investment activity, not national-accounts fixed capital formation. |
| 81 | building / HAI | **Correct:** Google >$150bn claim conflicts with primary filing; chart years 2025/26 are estimates. Source text and chart visually checked at printed p. 191. |
| 85 | adoption / HAI | **Correct:** denominator is working-age population, confirmed from Microsoft original. Do not equate telemetry usage with enterprise adoption or productivity. |
| 88 | productivity / HAI | Retain with unresolved underlying-study validation, p. 220: table contains the macro growth, firm study and model quantities quoted. They have different units and identification; none makes the aggregate 2.7% an AI effect. |
| 95 | jobs / HAI | Retain, p. 223: the two unemployment-rate changes match. Exposure quintiles describe occupational groups, not assigned AI treatment. |
| 96 | entry-level / HAI | **Correct:** explicitly historical payroll-paper vintage; firm controls do not eliminate every competing explanation. pp. 221-222 checked. |
| 102 | vacancies / HAI | Retain, p. 204: country shares match the Lightcast summary. Samples of online postings are not the whole labour market and need country-specific coverage assessment. |

## Figure provenance disposition: all 56 records

The staging query returned 56 figures, **zero missing source URLs, zero missing page references, zero missing quotes and zero missing actors**. All actors are recorded as agents from the prior pass. This establishes metadata completeness, not a second numerical audit. The original source PDFs are locally available.

Common gap for every row: the legacy figure schema does not preserve a reviewed content snapshot/hash, reviewer identity and timestamp as a versioned review event. Seed 050 documents the earlier pass and corrections; seed 053 records its agent actor. None establishes a human check. Claim-level review events introduced in migration 0028 do not retroactively certify figure values.

`P` = provenance complete; previous agent value check retained, not independently repeated here. `S` = a selected passage/figure was independently checked in this pass. `C` = interpretation corrected in seed 054; underlying point values preserved.

| Figure ID | Source locator | Disposition |
|---|---|---|
| bis-equity-market-concentration | BIS printed pp. 24, 36 | P |
| deloitte-agentic-ai-usage-today-vs-two-years | p. 17 | P |
| deloitte-ai-benefits-achieved-vs-hoped | p. 10 | S: response percentages, not productivity magnitudes |
| deloitte-ai-risks-most-concerning | p. 21 | P |
| deloitte-depth-of-ai-transformation | p. 11 | P |
| deloitte-highly-prepared-for-ai-by-domain | p. 28 | P |
| deloitte-physical-ai-adoption-by-region | p. 23 | P |
| deloitte-physical-ai-greatest-expected-impact | p. 25 | P |
| deloitte-talent-strategy-adjustments | p. 14 | P |
| imf-macro-agi-forecast-horizon | printed p. 5 / PDF p. 7 | P: forecast, not observation |
| imf-macro-frontier-model-query-price | printed p. 6 / PDF p. 8 | S: rendered model/date/price labels |
| imf-macro-inference-cost-decline | printed p. 6 / PDF p. 8 | C: printed annotations do not exactly reconcile to displayed prices |
| imf-skills-ai-exposed-employment-shortfall | p. 20 | S: conditional subgroup estimand and demand scaling |
| imf-skills-ai-exposure-by-income-group | p. 11 | P |
| imf-skills-degree-share-by-new-skill-use | p. 21 | P |
| imf-skills-new-skill-rate-by-job-title | p. 15 | P |
| imf-skills-us-local-labour-market-effects | pp. 15-16 | P |
| imf-skills-wage-premium-four-plus-new-skills | p. 14 | P |
| kpmg-ai-agent-deployment-rephasing | p. 18 | S: question and labels checked |
| kpmg-ai-confidence-measures-q1-q2 | p. 9 | P |
| kpmg-ai-decision-accountability | p. 14 | P |
| kpmg-ai-maturity-phase-q1-q2 | p. 10 | P |
| kpmg-ai-operating-cost-visibility | p. 19 | S: question and labels checked |
| kpmg-ai-priorities-q1-q2 | p. 11 | P |
| kpmg-ai-strategy-influences-q1-q2 | p. 12 | P |
| kpmg-outcomes-by-ceo-accountability | p. 16 | P: correlation, not governance treatment effect |
| mckinsey-ai-and-gen-ai-adoption-over-time | PDF p. 16 / printed p. 15, Exhibit 8 | P: prior label correction retained |
| mckinsey-ai-deployment-centralization | PDF p. 5 / printed p. 4 | P |
| mckinsey-expected-headcount-change-from-gen-ai | PDF p. 14 / printed p. 13 | P: expectations |
| mckinsey-gen-ai-content-types | PDF p. 21 / printed p. 20 | P |
| mckinsey-gen-ai-cost-decrease-by-function | PDF p. 23 / printed p. 22 | P |
| mckinsey-gen-ai-revenue-increase-by-function | PDF p. 22 / printed p. 21 | P |
| mckinsey-gen-ai-use-by-industry | PDF p. 18 / printed p. 17 | P |
| oecd-median-labour-productivity-growth | printed p. 25 / PDF p. 27 | P |
| oecd-private-capital-assets-2012-2025 | printed p. 44 / PDF p. 46 | P |
| oecd-software-share-of-us-private-capital | printed p. 44 / PDF p. 46 | P |
| pwc-ai-skill-wage-premium-by-sector | p. 23 | P |
| pwc-entry-level-postings-seniorised | p. 13 | S: reported posting growth; not realised hiring |
| pwc-headcount-growth-by-ai-exposure | p. 20 | S: selected survivor sample, mixed endpoint |
| pwc-human-intensive-new-tasks-by-exposure-quartile | p. 16 | P |
| pwc-job-share-by-expertise-category | p. 6 | P |
| pwc-productivity-growth-by-ai-exposure | p. 19 | S: rendered values and footnotes |
| pwc-professionalised-vs-democratised-growth | p. 8 | P |
| pwc-wage-growth-by-ai-exposure | p. 21 | P |
| hai-ai-funding-events-by-size-2024-2025 | printed p. 181 / chapter PDF p. 11 | P |
| hai-ai-job-postings-share-by-country-2025 | printed p. 204 / chapter PDF p. 34 | S: source summary supports country percentages |
| hai-ai-job-postings-share-by-us-sector | printed p. 209 / chapter PDF p. 39 | P |
| hai-ai-use-by-function-technology-sector | printed p. 195 / chapter PDF p. 25 | P |
| hai-measured-productivity-change-by-study | printed pp. 219-220 / chapter PDF pp. 49-50 | C: heterogeneous outcomes, METR time/rate distinction |
| hai-organizational-ai-use-by-region | printed p. 194 / chapter PDF p. 24 | P |
| hai-private-ai-investment-by-country-2025 | printed p. 182 / chapter PDF p. 12 | P |
| hai-workforce-reductions-observed-vs-expected | printed p. 225 / chapter PDF p. 55 | P |
| wef-business-ai-adoption-2022-2025 | p. 5 | P |
| wef-executive-expectations-of-ai-impact | p. 5 | P |
| wef-jobs-created-vs-displaced-by-2030 | p. 5 | P: all macrotrends, not AI-only forecast |
| wef-task-automation-age-of-displacement-2030 | p. 10 | P: scenario narrative, not a realised measurement |

## Source archive and reproducibility

Original PDFs were read from the user's `Desktop/Consulting reports on ai (for econ intel)` folder, not copied into the public repository. Text extraction used Poppler; selected IMF, PwC and HAI pages were rendered and inspected. These hashes identify the local versions reviewed and do not assert identity with a publisher's current downloadable file.

| Local PDF | SHA-256 |
|---|---|
| ar2026e1.pdf | 57ed3297e5d9e71f0e3fae124dc096d887313a6407210e49afc99eed07d94bee |
| state-of-ai-2026-global.pdf | df72e674c9719adfb025105c7fd271ee1466864a200226fdb5658378d2c15c7e |
| sdnea2026001.pdf | 805f4dcd05ead9825ff76776746d431bd6c06f9c710c399a4bb84abfd91c2805 |
| insea2026002.pdf | ab541aae5067f9ae9da3471dc7b9d0f8450f20154f8b5f9f6be01d04345d5a05 |
| global-ai-pulse-q2.pdf | a23ba6040cdfced91c35e9f92f0f04fecfa59340820547f51a2a1fef5c6bd75b |
| the-state-of-ai-how-organizations-are-rewiring-to-capture-value_final.pdf | b2a4c5bc5283d8a00e4bf1419bf7d39254d90d6b1f7fa288c8929c9046aff714 |
| 2d1956f0-en.pdf | 2abb06218955d9b705b46edcc2cf74190fd8fa3954fda785232dcf908760d61a |
| 2026-global-ai-jobs-barometer-full-report.pdf | e9a13b2a283370ac4e1e7b7bda129c8d9d0cf99fba38e8b29d6cd08dccdc7cb2 |
| ai_index_report_2026_chapter_4_economy.pdf | 6654b484b0c20213ead6ed8388f3145928c2dde9bca86e16a5b7efe9a00d8269 |
| WEF_Four_Futures_for_Jobs_in_the_New_Economy_AI_and_Talent_in_2030_2025.pdf | fa602ff7749b97972ba9b70b374bd32108bf1286fbf17dba1f6e3023332151be |

## Open review work

- Obtain the exact published Economic Policy paper before endorsing its instrument, coefficients or causal language. Do not substitute an older draft's coefficient under the published DOI.
- Trace the HAI p. 220 firm and macro findings to their underlying paper versions. Their appearance in a review table does not validate identification.
- Validate the OECD energy operating-cost figure against the cited IEA cost definition before using it in a financial model.
- Extend versioned review events to figure and takeaway snapshots; actor labels alone cannot detect later source or value changes.
- Present heterogeneous study outcomes as distinct study cards or a table before permitting quantitative cross-study comparison; seed 054 warns and renames but does not redesign the chart.
- Independently recheck the remaining P-marked figures if a fresh 422-value certification is required. This report deliberately does not award one.

# Eight blocked questions — verdicts, and what each one changed

Source: `blocked-questions-2026-08-30-raw.md` (Perplexity, filed verbatim).
Read `README.md` in this directory first for what that output may and may not
be used for.

Each row below names the drafted question the verdict settles, what the answer
was, and whether the question is now publishable.

| # | Question in the raw file | Page | Verdict | Now publishable? |
|---|---|---|---|---|
| 1 | Have semiconductor prices stopped falling? | `chip-prices` | **No — nominal only.** Quality-adjusted prices are still falling. | Yes, with caveat |
| 2 | Did the enterprise AI survey question change 2023→2024? | `adoption` (live) | **No documented change.** The jump is real diffusion. | Already live; caveat added |
| 3 | Anything past 5×10²⁶ FLOP since July 2025? | `frontier-compute` | **Disclosure gap, not a plateau.** | Yes, with caveat |
| 4 | How much of the construction boom is fabs? | `the-buildings` | **Not answerable yet.** Series exists but unconfirmed. | No — still blocked |
| 5 | Information-sector jobs: AI or over-hiring? | `sector-jobs` | **Both, and inseparable with current data.** | Yes, with caveat |
| 6 | How much software investment is own-account? | `software-not-steel` | **~15–25%, and mechanically tied to wages.** | Yes, with caveat |
| 7 | Did Eurostat revise the electricity bands? | `bulk-discount` | **No.** IE vs IG is comparable 2007–2025. | Yes, with caveat |
| 8 | Is there an external count of federal AI documents? | `when-noticed` | **No. The count is ours alone.** | Yes, heavily caveated |

---

## 1 — `chip-prices` · the flattening is nominal

The US PPI for semiconductors (`PCU334413334413`) has been flat since about
2021, and the page was on the edge of reading that as "chips stopped getting
cheaper".

The literature says the PPI understates quality-adjusted declines, and has
since roughly 2006. Byrne, Oliner and Sichel's Federal Reserve work
constructed hedonic microprocessor indices that keep falling while the official
PPI flattens; BLS itself published a revised quality-adjustment method in 2018
that produces faster declines than its own previous practice. Epoch's hardware
datasets show FLOP/s per dollar still improving into the 2020s.

**What is missing and is stated as missing:** there is no published
quality-adjusted semiconductor index covering 2019–2026. The bias is
documented for the earlier period and carried forward qualitatively. That is
why the caveat says the evidence is about measurement rather than offering a
corrected number.

Primary sources cited on the page:
- <https://www.federalreserve.gov/econres/feds/how-fast-are-semiconductor-prices-falling.htm>
- <https://www.bls.gov/opub/mlr/2018/article/a-new-approach-for-quality-adjusting-ppi-microprocessors.htm>
- <https://epoch.ai/publications/trends-in-gpu-price-performance>

## 2 — `adoption` · the 2023→2024 jump is real

This one was live already, which makes it the most urgent of the eight: the
page was showing a near-doubling of EU enterprise AI use without knowing
whether the survey question had changed underneath it.

It had not. Eurostat's model questionnaire and the compilers' manual show the
same "used at least one of the following AI technologies" construction across
waves, and Eurostat's own commentary treats the increase as a change in
behaviour rather than a break in series. OECD's `G14_B` is likewise stable.

**Residual doubt, and it is on the page:** the question is new — 2023 was the
first harmonised wave — so national implementation is still bedding in, and
minor local variation would not be visible in the harmonised EU metadata.

- <https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Use_of_artificial_intelligence_in_enterprises>
- <https://ec.europa.eu/eurostat/cache/metadata/en/isoc_e_esms.htm>

## 3 — `frontier-compute` · the plateau is a reporting gap

The largest training run in the data is still dated July 2025, and a chart of
that reads as scaling having stopped. It has not: the labs stopped publishing.

Epoch's public database carries no training-compute estimate for any
closed-weight frontier model released after July 2025. The trend estimate —
roughly 4–5× a year — is unbroken, and open-weight models were projected to
cross 1×10²⁶ FLOP around late 2025. The absence of a new record is an absence
of disclosure.

**This is the same class of problem as the AMECO forecast**: a chart that is
technically accurate about its data and misleading about the world. The caveat
is the fix available today.

- <https://epoch.ai/data-insights/open-models-threshold>

## 4 — `the-buildings` · still blocked

Census's Value of Construction Put in Place now has experimental monthly
subnational tables that appear to include a computer-and-electronic-products
category, which would be the closest available proxy for fab construction. The
exact sector code and series identifier are not confirmed, and no
FRED-published series exists for it.

**So this one stays off.** The honest position is that a large share of the
post-2021 manufacturing construction boom is chips, batteries and data-centre
adjacent structures — and that the project cannot yet put a number on it. The
next step is confirming the Census sector code and ingesting it beside
`TLMFGCONS`, which is real work rather than a caveat.

- <https://www.census.gov/construction/c30/monthlysubnational.html>

## 5 — `sector-jobs` · both causes, and they cannot be separated

The finding is that information-sector employment fell while output rose. The
objection is that 2022 was a hiring bubble and the fall is its correction.

The answer is that both are happening and no published work separates them.
Challenger, Gray & Christmas began coding AI as a distinct layoff reason in
2023 and it has grown into the leading cited reason through 2026 — but
cost-cutting and restructuring still account for more cuts in absolute terms,
and Challenger's own analysts attribute the tech-sector wave to AI adoption
*and* a decade of over-hiring together.

**What would sharpen it:** BLS CES subsector employment for NAICS 5112
(software publishers) and 5182 (data processing and hosting), plus JOLTS flows
for the information sector. Both are free and monthly. Neither is ingested yet;
see the note at the end.

- <https://www.bls.gov/web/empsit/cesseriespub.htm>
- <https://www.bls.gov/news.release/jolts.a.htm>

## 6 — `software-not-steel` · a fifth of it is an estimate built from wages

BEA splits software investment three ways: prepackaged, custom, and
own-account. Own-account is roughly 15–25% of the total.

The thing that matters for this page is *how* own-account is measured. It is
not observed — there is no transaction. BEA estimates it as the compensation
of the programmers and systems analysts doing in-house development, plus
intermediate inputs and a margin. So it rises when programmer pay rises,
whether or not more software was produced.

That is a real limit on any claim that software investment is booming, and it
was not stated anywhere on the page.

- <https://www.bea.gov/resources/methodologies/nipa-handbook/pdf/chapter-06.pdf>

## 7 — `bulk-discount` · the bands did not move

The page compares Eurostat electricity price bands IE and IG for non-household
consumers and finds the bulk discount narrowing sharply. The objection was that
the band definitions might have been redefined mid-series, which would make the
comparison meaningless.

They were not. Bands IA–IG are set by Regulation (EU) 2016/1952 and its
implementing act, band IG is ≥150,000 MWh/year throughout, and `nrg_pc_205`
runs on those definitions from 2007. There was a methodological transition
around 2016–17 — new legal basis, harmonised tax treatment, sampling changes —
which the caveat names, but the thresholds themselves are unchanged.

**This is the cleanest unblock of the eight.** The comparison is valid.

- <https://eur-lex.europa.eu/eli/reg/2016/1952/oj>

## 8 — `when-noticed` · nobody else counts this, so say so

The page finds Federal Register documents mentioning AI jumping from low single
digits a year to over twenty in 2012, and reads that as the moment the US
government started paying attention.

There is no external series to check it against. Stanford HAI's AI Index counts
AI-related *regulations* and reports the recent surge (25 in 2023 to 59 in
2024) but publishes no year-by-year Federal Register series reaching back to
the 2000s. Live tools like AI Regulation Radar query the same API but do not
publish history.

So the count is the project's own, produced by its own keyword matching — and
keyword counts measure vocabulary at least as much as substance. A change in
boilerplate language moves this number.

**This is the answer to one of the three blocking checks** (whether the
2023→2024 doubling is a search-term artefact): it cannot be ruled out, and the
page has to say the count is its own method rather than a measurement.

- <https://hai.stanford.edu/assets/files/hai_ai-index-report-2025_chapter6_final.pdf>

---

## Activation — written out, deliberately not run

Six questions are unblocked. **They are still switched off**, because
"the methodological objection has an answer" and "the prose is ready to
publish" are different things, and the prose on these pages is Claude-drafted
and unreviewed — STATUS.md has said so since it was written.

Read the six pages, and if the writing holds up:

```sql
UPDATE questions
   SET is_active = TRUE, last_reviewed = current_date, updated_at = now()
 WHERE slug IN (
   'chip-prices',        -- caveat: PPI understates quality-adjusted declines
   'frontier-compute',   -- caveat: post-July-2025 plateau is a disclosure gap
   'sector-jobs',        -- caveat: over-hiring correction is a confounder
   'software-not-steel', -- caveat: own-account is estimated from wages
   'bulk-discount',      -- caveat: bands stable, 2016-17 transition noted
   'when-noticed'        -- caveat: our own keyword count, not a measurement
 );
```

`the-buildings` stays off until the Census sector code is confirmed.

## Data this research says is worth ingesting, and is not yet

None of these are blocked on anything but time:

| Series | Why | Where |
|---|---|---|
| BLS CES NAICS 5112, 5182 | splits AI-intensive subsectors out of "information" | DBnomics `BLS/ce`, or BLS flat files |
| JOLTS information-sector flows | openings, hires and quits, to see whether the fall is firing or not hiring | DBnomics `BLS/jt` |
| BEA software components | prepackaged / custom / own-account, annual | BEA NIPA, fixed-assets tables |
| Census VIP computer & electronic products | the fab share of the construction boom | Census C30 subnational (code unconfirmed) |
| Epoch GPU price-performance | a real quality-adjusted compute price, against the flat PPI | `epoch.ai` CSV, CC BY |

The last one is the most valuable: it would let `chip-prices` show the
quality-adjusted series next to the nominal PPI instead of describing the gap
in prose.

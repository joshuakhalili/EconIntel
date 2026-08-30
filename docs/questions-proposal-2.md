# Twenty more questions for Diffusion

Drafted 2026-08-30 against the live database, seeded inactive in
`db/seeds/025_more_questions.sql`. Every indicator named below exists, is
active, and carries real observations; every figure quoted was read from the
database on the day of writing. This is the follow-up to
`docs/questions-proposal.md`, which covered the nine in `024_new_questions.sql`.

---

## Where the lenses stand

| lens | live | drafts (024) | drafts (025) | total |
|---|---|---|---|---|
| Investment & Capital | 2 | 2 | 5 | **9** |
| Growth & Productivity | 2 | 2 | 4 | **8** |
| Labour Markets | 3 | 1 | 4 | **8** |
| Prices & Markets | 3 | 1 | 4 | **8** |
| Policy & Regulation | 1 | 3 | 3 | **7** |

Regulation stops at seven and it should. The whole lens rests on four derived
Federal Register series and nothing else — US-only, keyword-matched, counts of
documents. Three of the four questions already there slice those four series
three ways, and an eighth would be a fourth slice of the same thing pretending
to be a new question. The two things that would actually deepen it — non-US
policy, and any measure of what a rule costs — are in the research file, not
here.

Investment gets nine because it is where the data is: BEA capital formation,
Epoch compute and cluster counts, OECD venture and R&D, Eurostat capital
indices, Census construction. It is also one of the two lenses Joshua named in
the concept grill as wanting the deepest personal investment.

---

## What changed since proposal 1

**1. There are now four unplaced indicators, not three, and every one of them
is deactivated.** `007_corrections.sql` — which did not exist when proposal 1
was written — deactivated five series after a source audit. Four are unplaced
because they are switched off, not because nobody wanted them:

| indicator | why 007 switched it off | verdict here |
|---|---|---|
| `dbn.BEA.NIPA-T50605.B985RC-A` | duplicate of `fred.B985RC1Q027SBEA`, which is quarterly and fresher | **agreed.** I checked the annual values against the FRED copy: $65.5bn in 1995, $693.0bn in 2024, identical. `software-not-steel` uses FRED. |
| `dbn.Eurostat.isoc_eb_ai.…E_AI_TANY.…` | duplicate of the OECD EU27 copy, which carries an extra year | **agreed.** `diffusion-speed` uses the OECD copy. |
| `dbn.IMF.PCPS.M.W00.PGOLD.USD` | stale — ends 2025-06 and not advancing | **agreed.** Not used. |
| `derived.datacentre_investment` | holds zero observations | schema, not data. Not used. |
| `dbn.Eurostat.nrg_pc_205.…MWH20000-69999` | "duplicate" of band IG | **reversed — see below.** |

**2. The rebase rule is not the one proposal 1 documented.** That proposal
said `chart_group` rebases only when unit *strings* differ, and grouped
conservatively because of it. `/api/series` now measures the failure directly:
if any series in a group would occupy under a tenth of a zero-based axis,
every series in the group is indexed to 100 at their first shared period —
**unless every series in the group is a `rate`, `index`, `change` or `score`,
in which case levels are treated as comparable and nothing is rebased.**

That second clause changes the grouping advice in both directions:

- Two currency series of similar magnitude can now safely share an axis.
  `software-not-steel` puts software investment on the same axis as total
  information-processing investment, and the ratio between the lines is the
  finding.
- Two *index* series with different base years will **not** be rebased, and
  will be drawn raw. A 30 against a 108 invites a comparison that means
  nothing. That is why `chip-prices` keeps the semiconductor PPI (Dec 1998 =
  100) and the semiconductor-machinery PPI (Dec 2003 = 100) on separate
  charts, even though editorially they belong together.

I replayed the rebase decision against the live data for all ten chart groups
in this file. None of them rebases. Seven are all-index or all-rate groups
where the threshold is suppressed by design; the other three are currency and
count groups whose smallest member covers 47%, 69% and 73% of its axis, well
clear of the threshold. One group reads badly anyway despite passing — see the
known limitation at the end.

**3. A 48-country series cannot be a cross-country page.**
`question_indicators` carries one `country_iso3` per (question, indicator), so
a World Bank series with 48 economies appears on a question as exactly one
line. The multi-country pages that exist (`adoption`, `entry-level`) work by
placing one *indicator* per country, which only exists where ingestion built
one. Two questions were designed as cross-country comparisons and dropped for
this reason — they are under "what could not be built" below.

**4. Fifty-six report figures are in the database.** Three of them move onto a
question in this file. The rest stay where 023 put them.

---

## The one audit decision reversed

`007_corrections.sql` deactivated the EU electricity price series for
consumption band IE (20,000–69,999 MWh a year), keeping band IG (150,000 MWh
and over), under the heading "Duplicate: two electricity price bands, one
question". Its reasoning: IG is the hyperscale band, IE is a large factory.

Both halves of that are true and the conclusion does not follow. These are not
two publications of one statistic — they are the prices paid by two different
populations, and the **difference between them** is a quantity neither one
contains:

| period | band IG (≥150 GWh) | band IE (20–70 GWh) | discount for the largest buyers |
|---|---|---|---|
| 2007 H1 | €0.0381 | €0.0620 | 38.5% |
| 2020 H1 | €0.0462 | €0.0607 | 23.9% |
| 2022 H1 | €0.1549 | €0.1484 | **−4.4%** (inverted) |
| 2025 H1 | €0.1022 | €0.1200 | 14.8% |

The bulk discount for buying electricity at data-centre scale has narrowed
from about two fifths to about one seventh over eighteen years, and briefly
disappeared. Nothing else in the catalogue can compute that. The series is
reactivated in `025` for one page, with the reasoning in the file and a
one-line revert.

Reactivating also returns it to the ingestion runner, which is correct: it is
the same Eurostat dataset on the same schedule as the band already fetched.

---

## The twenty questions

Slug, lens, strength, and the one thing each turns on. Full prose, figures and
the per-question "check before activating" note are in the seed.

### Growth & Productivity

**`total-factor-productivity` — Is there anything left over?** `insufficient`
US TFP 0.964 (2019) → 0.993 (2023), series ends there. UK TFP 95.7 (2019) →
96.0 (2025), and its last three values are European Commission projections,
not measurements. Output per hour rose far faster than either, which is what
capital deepening looks like rather than what better use of capital looks
like. The caveat is the one that matters most on this page: TFP is a residual,
so incompletely capitalised intangibles show up as *lower* measured TFP —
biasing the page towards finding nothing in exactly the period where the claim
is being made.

**`computer-dividend` — How much did computers ever add?** `insufficient`
The best number in this batch. OECD growth accounting puts ICT capital's
contribution to US labour productivity growth at **1.02 percentage points in
1999 and 0.31 in 2022**. Over the same period software's contribution to the
growth of the capital stock went 1.49 (1999) → 0.30 (2003) → **1.49 (2022)**,
matching the dot-com peak. Money going in at 1999 rates; productivity coming
out at a third of 1999 rates. Both series end in 2022, which is why the page is
a benchmark and not a test — and the benchmark is useful on its own, because
almost every claim about AI and growth is implicitly a claim about magnitude
and almost none of them states one.

**`diffusion-speed` — Is AI spreading faster than the internet did?**
`insufficient` World internet use 15.6% (2005) → 28.4% (2010), 12.8 points in
five years. OECD enterprise AI use 5.6% (2020) → 20.3% (2025), 14.7 points in
five years. About the same, on measures that are not the same — individuals
against firms. The readable part is the spread inside the enterprise data:
57.5% of information-and-communication firms against 17.3% of European
manufacturers in 2025.

**`china-mirror` — Does the boom show up in China's own numbers?** `consistent`
Software and IT services revenue ¥4.8tn (2016) → ¥15.5tn (2025). Sector
employment 3.64m → 5.53m. Average sector pay ¥122,478 → ¥238,966. Integrated
circuits 132bn → 484bn units. All of it already compounding in 2016, which is
the point. Also the only sectoral wage series anywhere in the catalogue.

### Investment & Capital

**`the-buildings` — What is the concrete actually costing?** `suggestive`
BEA data centre structures $9.2bn (2020) → $31.1bn (2024) — five annual
observations, ending two years ago, counting only the shell. Against it, the
other construction boom has already turned: manufacturing construction $82bn
(2021) → $244bn (2024) → $178bn (2026 H1, annualised).

**`orders-and-output` — Are the factories busy?** `consistent`
Computer and electronics production index 110.3 (2021) → 135.4 (2026) while
total industrial production went 99.3 → 102.2. New orders $29.6bn a month in
2026 H1 against $36.3bn in 2000 — nominal, twenty-six years apart, so the
order book has not been back to its dot-com peak in real terms.

**`software-not-steel` — Machines or code?** `consistent`
Software investment is now about half of all information-processing
investment: $806bn of $1,585bn in 2026 H1. The last bust is the interesting
part — the total fell 14% after 2000 and took five years to recover, computers
and peripherals fell from $103bn to $84bn and took four, and software fell
three per cent and carried on.

**`is-europe-in-this` — Is Europe in this at all?** `insufficient`
On research spending yes: EU ICT-services business R&D €24.7bn (2019) →
€35.1bn (2023), up 42%, against a US rise of 49%. On capital equipment the
question cannot be answered here — the EU series is a chain-linked volume
index (+12%) and the US series is nominal dollars (+40%), and the page declines
to difference them rather than producing a headline that is mostly deflation.

**`frontier-compute` — Are the models still getting bigger?** `suggestive`
Largest known training run 2.6 × 10²⁴ FLOP (Mar 2022) → 5.0 × 10²⁶ (Jul 2025):
190× in three years and four months, about 4.5× a year. The four years before:
8.7 × 10²¹ (May 2018) → 2.6 × 10²⁴ (Mar 2022), 295× in under four years. **The
frontier did not accelerate when the money arrived — it continued.** Nothing
in the series after July 2025, which is either the most interesting fact on the
page or a stale ingestion, and the database cannot tell you which.

### Labour Markets

**`sector-jobs` — Is the industry that sells AI hiring?** `consistent`
US information-sector employment 3.06m (2022) → 2.79m (2026 Jan–Jul), below
its 2015 level and well below its March 2001 peak of 3.72m. Real value added
over the same four years $1,496bn → $1,963bn. Output up a third, headcount
down nine per cent. The sector's employment share, 1.75%, is the lowest since
the series begins in 1990.

**`skills-shortage` — Is the technology skills shortage over?** `suggestive`
EU information-and-communication vacancy rate 4.3% (2022 Q2) → 2.2% (2025 Q3),
lowest since 2013. Firms reporting hard-to-fill ICT vacancies 6.0% (2022) →
5.5% (2024). But the stock keeps rising: ICT specialists 4.0% of EU employment
(2019) → 5.0% (2024). Fewer firms looking; the people already hired still
there. The page's own admission is that no whole-economy EU vacancy rate is in
the catalogue to difference the sector against.

**`ai-wages` — Does working with AI pay more?** `insufficient`
The page that exists to say what this project cannot measure. Three report
figures carry the finding — PwC's 62% average advertised premium, PwC's
exposed-quartile wage growth, the IMF's 15.1%/8.5% posted premium — and all
three are measured on job advertisements. The only sectoral wage series
available to check them is China's. **This is the largest single gap in the
labour lens and it is free to fix** (see the research file).

**`aggregate-unemployment` — Has unemployment risen anywhere?** `consistent`
World unemployment 5.59% (2019) → 4.79% (2025), the lowest in the series. US
payrolls at a record 158.7m; Japanese employment at a record 68.4m. The one
number that rose is US youth unemployment, 8.4% → 9.1%, still below 2015. The
weakest test in the dashboard, deliberately — and it is what makes the
narrower findings elsewhere readable as evidence rather than as selection.

### Prices & Markets

**`chip-prices` — Have chips stopped getting cheaper?** `suggestive`
**The strongest finding in the batch.** US producer prices for semiconductors
fell from 153 (Jan 1990) to 30 (2021) — about eighty per cent over three
decades. Since then: 30.0, 31.0, 31.7, 31.1, 29.9, 29.9. Five years without a
fall. Over the same five years semiconductor *machinery* prices rose from 89.9
to 107.5, and Japan's export price index for the same equipment rose 12%
between 2020 and May 2024. Two countries, two statistical offices, same
conclusion about the equipment.

**`compute-price-abroad` — Dearer everywhere, or only in America?**
`suggestive` US data-processing and hosting PPI +11.5% between 2019 and 2026 —
as much as in the whole nineteen years before. Japan's internet data centre
index 100.0 (2015) → 97.6 (early 2024); cloud applications 95.0. Neither has
risen in nine years. Japanese *software development* prices rose 13%. The
Japanese series end April 2024, which is the page's main weakness and is stated
as such.

**`bulk-discount` — Do the biggest power buyers still get a discount?**
`suggestive` See the table above. The series this needs is the one 007
deactivated.

**`labour-vs-compute` — What got more expensive, an hour of work or an hour of
compute?** `suggestive` US unit labour costs +19.5% (2019 → 2026 H1). Data
processing and hosting +11.5%. Semiconductors −8%. The relative price did move
in favour of compute — by about one per cent a year, which is not the collapse
the substitution argument usually assumes. The hosting index is the wrong
instrument (it prices contracts, not computation) and no free index is the
right one.

### Policy & Regulation

**`when-noticed` — When did the state start paying attention?** `suggestive`
**2012, not 2022.** Between 1996 and 2011 the Federal Register published one
to six AI-related documents a year, in most years fewer than three. In 2012 it
published twenty-one, and has published at least nineteen every year since —
63 (2019), 120 (2023), 243 (2024), 248 (first eight months of 2026). The page
does not assert *why*: a step that size is equally what a phrase entering
federal boilerplate produces, and the check that would settle it is one query
against the underlying documents by search term.

**`rules-vs-adoption` — Is the rulebook keeping up?** `insufficient`
Regulatory volume doubled 2023 → 2024 (120 → 243). OECD enterprise AI adoption
also doubled 2023 → 2024 (8.7% → 14.3%). One step each, in the same year: no
lead, no lag, nothing to test. The page refuses to order them, which is its
content.

**`cost-of-compliance` — Does regulation cost anything you can see?**
`insufficient` Rules in force 16 (2023) → 57 (2024) → 33 (2025). The producer
price for data processing and hosting rose 4.5% across those two years against
4.0% across 2019–2021, when there were a third as many rules. Half a
percentage point over two years is not evidence of anything. The one page in
this lens where jurisdiction matches on both sides.

---

## Strength distribution

| strength | count | slugs |
|---|---|---|
| `insufficient` | 7 | total-factor-productivity, computer-dividend, diffusion-speed, is-europe-in-this, ai-wages, rules-vs-adoption, cost-of-compliance |
| `suggestive` | 8 | the-buildings, frontier-compute, skills-shortage, chip-prices, compute-price-abroad, bulk-discount, labour-vs-compute, when-noticed |
| `consistent` | 5 | china-mirror, orders-and-output, software-not-steel, sector-jobs, aggregate-unemployment |
| `contested` | 0 | — |

Nothing is `contested`, and that is deliberate rather than an oversight. Per Joshua's
instruction, disagreement across *time* is not contestation — a newer study
measuring the same thing more recently supersedes an older one. `contested` is
reserved for genuine methodological disagreement between sources measuring the
same period, and none of these twenty has one. `clerical` in 024 does: two
statistical agencies counting the same occupational group in the same years
and disagreeing by two million people. That is what the label is for.

---

## The three report figures that move

`ai-wages` takes the only three extracted figures in the whole set that
measure a wage:

- `pwc-ai-skill-wage-premium-by-sector` (was: labour lens)
- `pwc-wage-growth-by-ai-exposure` (was: labour lens)
- `imf-skills-wage-premium-four-plus-new-skills` (was: labour lens)

`report_figures` permits exactly one parent, so acquiring a question means
releasing the lens. **The cost, stated plainly: `ai-wages` is inactive, so
until it is activated those three charts are reachable by nobody.** They leave
the Labour Markets lens page immediately and arrive nowhere. Five figures
remain on that lens. If the trade is not wanted, delete the `UPDATE` at the
foot of `025` — nothing else depends on it, though `ai-wages` would then quote
three figures that are not on its own page.

All three are `figure_source = 'extracted'` and appear in
`unreviewed_figures`. `ai-wages` quotes all three in its answer, so it must not
go live before they have been checked against their page references.

---

## What could not be built

Designed, then dropped, for reasons in the data rather than in the writing.

**"Which countries are actually getting the compute?"**
`derived.datacentre_capacity_mw` holds 28 countries and shows the US at
1,946 MW against China's 267 in 2025 — a nine-fold gap that opened after 2022.
`epoch.gpu_cluster_count` holds 22. Both are genuinely interesting.
`question_indicators` carries one country per indicator per question, so this
would render as a single country's line. It needs either a per-country
indicator split in ingestion (the pattern `adoption` and `entry-level` already
use) or a panel role the schema does not have.

**"Which states actually fund the research?"** `wb.GB.XPD.RSDV.GD.ZS` holds 48
economies — Israel 6.35%, Korea 4.94%, US 3.45% of GDP in 2023 — and
`wb.TX.VAL.TECH.MF.ZS` holds high-technology export shares for the same
economies. Same country-dimension problem, plus a second one: World Bank R&D
is gross domestic expenditure across all sectors, so it does not measure
government funding and cannot answer the question as posed even with the panel.

**"Is any of the paperwork actually binding?"** Binding rules as a share of all
AI documents rose from about one in ten in 2019 to about one in five in 2024.
Real, and too close to `executive-action`'s instrument-mix framing to justify a
fourth regulation page on the same four series.

---

## Known front-end limitation worth fixing

`LineChart` floors a non-rebased chart at zero. For an index series that moves
in a tight band far above zero and is *not* rebased — which is now the norm,
since the server suppresses rebasing when every series in a group is an index
— the whole shape compresses into a near-horizontal line near the top of the
frame.

The clearest case in this file is `compute-price-abroad`: the three Japanese
indices sit between 92.8 and 113.2, so their individual ranges cover 3.5%,
8.3% and 12.7% of a zero-based axis. The gap *between* the three lines reads
fine; the movement *within* each does not. That question's method text says so
explicitly and tells the reader to take the percentages from the text rather
than the slopes, which is a workaround rather than a fix.

This is not new and not confined to this file — `exposed-productivity` in 024
has the same shape, and so does any single index series in a narrow band. The
fix is in `LineChart.buildChartModel`: `nearZero` currently tests `min < range
* 0.35`, which is a test of whether the data is near zero relative to its own
movement, and it fails exactly when a series barely moves. An index scale
already has permission to use a padded floor (`niceFloor`), and it is granted
only when the server rebased. Extending that permission to any chart whose
series are all `quantity_kind = 'index'` would fix every case, and the existing
`axisTruncated` flag already puts the disclosure on the chart. Out of scope for
this file — `src/` was not mine to touch — and recorded here so it does not have
to be rediscovered.

---

## Notes for activation

- Seeds run in filename order inside one transaction, so `025` lands after
  `023` and `024` and its `UPDATE`s win. The financing seeds `026` and `027`
  run after it and do not touch anything here.
- Every question is `is_active = FALSE`, `last_reviewed = NULL`. The worklist:
  `SELECT id, lens_id, sort_order, strength FROM questions WHERE NOT is_active
  ORDER BY lens_id, sort_order;`
- Three cross-cutting checks are in the seed header: 2026 is a part year and a
  different part in each series; four questions rest on a series that stops
  before the present; and UK total factor productivity mixes European
  Commission forecasts into the same series as outturns.
- The 2024 spike in `derived.ai_binding_rules` — 57, against 16 the year before
  — is now load-bearing on **three** pages: `executive-action` and
  `rule-conversion` from 024, and `cost-of-compliance` here. It may be a single
  agency publishing a batch. Resolve it once against the underlying documents
  by agency, then fix all three.

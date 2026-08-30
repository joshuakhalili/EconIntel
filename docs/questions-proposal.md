# Nine new questions for Diffusion

Drafted 2026-08-30 against the live database. Every indicator named below exists,
carries real observations, and I read the values quoted here myself — the queries
are recorded under each question so you can re-run them. Nothing here is a
remembered figure.

---

## Read this first — two things the catalogue got wrong or hid

**1. There are no unused indicators.** The brief said "40-odd indicators sitting
in the database attached to no question". That is not true as of today. Of 126
indicators, **123 are placed on exactly one question and 3 are unplaced** —
`derived.ai_news_volume`, `derived.policy_investment_stance` and
`derived.policy_regulation_stance`, all of which hold **zero observations**. They
are schema, not data. So every question below works by *recombining* series that
already appear elsewhere. `question_indicators` has a primary key of
`(question_id, indicator_id)`, so an indicator can sit on several questions with a
different role, group and caption on each — that is the mechanism these proposals
use, and it is the same one `016_question_split.sql` used.

**2. `chart_group` only rebases when the UNIT STRINGS differ.**
`ChartGroup.jsx:35-36` sets `mustIndex` from `new Set(units).size > 1`. Series
that share a unit but not a scale are drawn raw on one axis. The live
`productivity` page already has this problem: `fred.RVAI` (1,962.5) and
`fred.RVASPI` (17,664.6) share the group `us-value-added` and the unit "Billions
of Chained 2017 Dollars", so the Information line is drawn a ninth the height of
the other and reads as flat when it has nearly quadrupled. **Wherever two of my
indicators share a unit but differ by more than ~3x in level, I have put them in
separate chart groups.** That is why some groupings below look conservative.

**3. Lens balance now vs after.**

| lens | now | proposed | after |
|---|---|---|---|
| Policy & Regulation | 1 | +3 | 4 |
| Investment & Capital | 2 | +2 | 4 |
| Growth & Productivity | 2 | +2 | 4 |
| Labour Markets | 3 | +1 | 4 |
| Prices & Markets | 3 | +1 | 4 |

Weighted to Policy & Regulation, which is thinnest — though it is thin *because*
it is data-poor (four Federal Register series, US only), so two of the three new
regulation questions deliberately import indicators from other lenses rather than
slicing the same four series three ways.

---

# LENS: Policy & Regulation

## 1. `executive-action` — Who is actually writing AI policy?

**lens_id** `regulation`
**subtitle** Executive orders against the rulemaking process

**theory**
There are two routes to a binding AI policy in the United States and they run at
different speeds. An agency rule takes twelve to twenty-four months, survives a
change of administration, and is written by people who take comments. A
presidential document takes a day, binds only the executive branch, and can be
undone by the next signature. If AI policy is being made faster than the
rulemaking process can move, it is being made by the pen — and that has
consequences for how durable any of it is.

**method**
Federal Register documents matched on the project's six AI search terms and split
by the government's own document-type field. The three types share a unit
(documents per month) and a scale small enough to sit on one axis honestly. The
weakness: a count treats a one-paragraph notice and a thousand-page rule as one
event each. It measures activity, not weight, and there is no free way to weight
them.

**caveat**
This is the United States only, and it is a count of documents, not of policy.
A single executive order that restructures federal AI procurement and a routine
delegation of authority are the same data point. It also cannot see state
legislatures, where most binding US AI law was actually written in 2025 and 2026 —
that data does not exist here in machine-readable form.

**strength** `suggestive` — the compositional shift is large and clean in the data,
but a document count is a weak proxy for policymaking and the series cannot say
whether the executive documents did anything.

**indicators**

| indicator_id | role | chart_group | country | caption_plain (draft) |
|---|---|---|---|---|
| `derived.ai_presidential_documents` | hero | `us-policy-type` | USA | Executive orders and presidential memoranda touching AI. These take days to issue and are the easiest thing on this chart for a successor to reverse. |
| `derived.ai_binding_rules` | supporting | `us-policy-type` | USA | Rules actually in force. These are slow, survive an administration change, and are the only line here that carries legal obligation. |
| `derived.ai_proposed_rules` | supporting | `us-policy-type` | USA | Proposals open for comment. A proposal leads a rule by one to two years, where it converts at all. |

**answer — DRAFT, check before publishing**
Shape the data supports: presidential AI documents were a trickle until 2024 and
then jumped sharply, while rules in force peaked earlier and have not repeated
that peak. Figures I read on 2026-08-30, calendar-year sums of the monthly series:
presidential documents 1 (2021), 3 (2023), 3 (2024), **28 (2025)**, 9 (2026 to
August); binding rules 15 (2021), 16 (2023), **57 (2024)**, 33 (2025), 44 (2026 to
August). So the honest line is that the pen accelerated in 2025 while the process
did not, but that 2026 rulemaking is running ahead of 2025 and the year is not
finished.
**You need to check:** (a) whether the 2026 partial year is being compared like
for like — the series ends 2026-08-01, so any calendar-year figure for 2026 is
eight months, and the page must say so; (b) whether the 2024 rules spike is AI
policy or a matching artefact from one agency publishing a batch — worth eyeballing
the underlying document titles before writing "peaked".

```sql
select date_trunc('year', period_start)::date yr, sum(value)
from observations where indicator_id = 'derived.ai_presidential_documents'
group by 1 order by 1 desc;
```

---

## 2. `rule-conversion` — Does proposing a rule mean anything?

**lens_id** `regulation`
**subtitle** The gap between what is proposed and what binds

**theory**
Regulatory intent is cheap and regulatory obligation is expensive. A proposed rule
signals that an agency wants to act; a rule in force means it did. The ratio
between the two, and the lag between them, is a measure of how much of the stated
policy appetite for AI actually converts into something a firm has to comply with.
If proposals climb and rules do not follow, the regulatory burden being discussed
is larger than the one being imposed.

**method**
Two Federal Register document types counted monthly, plotted on one axis because
they share a unit and a comparable scale, read against the total document volume
as context on its own chart. The weakness is severe and stated on the page: these
are **counts of documents matched on search terms, not linked dockets**. A
proposal and the rule it became are two independent rows here, so the page can
show the two aggregate lines but cannot follow any individual proposal to its
outcome. That is a real conversion rate this dashboard does not have.

**caveat**
There is no docket linkage, so nothing here measures conversion in the strict
sense — only whether the two populations move together. The total-volume series
also includes notices, guidance and requests for information that are neither
proposals nor rules, which is why it is roughly three times the sum of the two
plotted lines and sits on a separate chart rather than being read as their total.

**strength** `insufficient` — the question is about conversion and the data cannot
observe conversion. The page is worth having because the gap it *can* show is
interesting and because stating the missing linkage is the useful part.

**indicators**

| indicator_id | role | chart_group | country | caption_plain (draft) |
|---|---|---|---|---|
| `derived.ai_proposed_rules` | hero | `proposals-vs-rules` | USA | Rules proposed. Each opens a comment period; most take a year or more to become anything, and many become nothing. |
| `derived.ai_binding_rules` | supporting | `proposals-vs-rules` | USA | Rules in force. This is the line that costs somebody money. |
| `derived.ai_regulation_volume` | context | *(none — own chart)* | USA | Every AI-related document the Federal Register published, including notices and guidance. It runs about three times the two lines above put together, which is a reminder of how much regulatory paper is neither a proposal nor a rule. |

**answer — DRAFT, check before publishing**
Shape: the two lines have moved together in level but not in timing, and neither
has a clean lead-lag relationship visible by eye. Read 2026-08-30, calendar-year
sums: proposed 15 (2021), 26 (2023), 24 (2024), 30 (2025), 44 (2026 to Aug);
in force 15 (2021), 16 (2023), 57 (2024), 33 (2025), 44 (2026 to Aug). The 2024
rules total exceeds the 2024 proposals total, which on its own would be impossible
if rules came from proposals in this dataset — good direct evidence for the page's
own caveat that these are unlinked populations.
**You need to check:** whether that 2024 crossover holds monthly as well as
annually, and whether you want to say plainly on the page that it disproves any
naive reading of the two lines as a pipeline. I think you do — it is the most
honest thing on the page.

---

## 3. `policy-lag` — Does the state react to the boom, or shape it?

**lens_id** `regulation`
**subtitle** Regulatory attention against corporate attention and capital spending

**theory**
Regulation of a new technology is usually reactive: firms adopt, something goes
wrong or gets noticed, and the state responds. If that is what is happening with
AI, regulatory document volume should lag both the point at which companies start
telling their investors about AI and the point at which capital starts being
committed. If instead regulation moves first or in step, the state is doing
something closer to shaping the market than reacting to it.

**method**
Three series with three different units, so **three separate charts** — regulatory
documents per month, the share of SEC filings mentioning AI, and US fixed
investment in information-processing equipment and software in billions. The page
compares turning points by eye across charts rather than by regression, which is
the weakness: eyeballing three lines on three axes for a lead-lag relationship is
not identification, and with annual-ish resolution on two of the three there are
too few turning points to test anything formally.

**caveat**
Three series, three units, no common axis and no statistical test — this page
shows sequence, not causation, and cannot rule out that all three respond to the
same third thing (the public arrival of ChatGPT in late 2022 moved corporate
disclosure, capital markets and legislative attention simultaneously). The
investment series is also far broader than AI, and the regulation series is US
federal only against a filings series that is US public companies only, so the two
populations do at least match on country.

**strength** `insufficient` — the mechanism is plausible and the ordering is
visible, but three annual-to-quarterly series cannot establish a lead-lag
relationship, and the common-cause explanation is at least as good.

**indicators**

| indicator_id | role | chart_group | country | caption_plain (draft) |
|---|---|---|---|---|
| `derived.ai_regulation_volume` | hero | *(none)* | USA | Every AI-related document the US Federal Register published each month, back to 1996. |
| `derived.sec_ai_mention_rate` | supporting | *(none)* | USA | The share of large US companies mentioning AI in their annual report. Companies talk to investors before regulators talk to companies — or that is the claim being tested. |
| `fred.A679RC1Q027SBEA` | supporting | *(none)* | USA | US investment in information-processing equipment and software. The money moves before the paperwork, if the reactive story is right. |
| `derived.ai_presidential_documents` | context | *(none)* | USA | Executive action, the fastest of the three policy instruments, shown separately because it is the one that could plausibly move first. |

**answer — DRAFT, check before publishing**
Shape: corporate disclosure moved earliest and fastest, capital spending is on a
long rise with no obvious break, and regulatory volume broke upward last. Read
2026-08-30: SEC AI mention rate 0.51% (2015) → 14.84% (2022) → 35.42% (2024) →
60.87% (2026 Q1). Regulatory volume by calendar year 63 (2019), 84 (2022), 120
(2023), 243 (2024), 207 (2025), 248 (2026 to August). Investment
$431.3bn (2000 Q1) → $1,057.5bn (2022 Q1) → $1,612.9bn (2026 Q2).
**You need to check:** whether the regulation jump between 2023 and 2024 is real
or a search-term artefact — the derived series matches on six terms and if any of
them became common boilerplate in 2024 the whole break is a measurement change.
This is the load-bearing check for the page and I would not publish the ordering
claim without it.

---

# LENS: Investment & Capital

## 4. `dot-com` — Is this bigger than the last computing boom?

**lens_id** `investment`
**subtitle** The 2026 build-out against 1995–2001, in the same series

**theory**
The dot-com boom is the obvious reference class: a general-purpose computing
technology, a capital-spending surge, a widely held belief that the old rules had
changed, and a bust. If the current AI build-out is the same phenomenon at a
different scale, the same national-accounts series that captured the first one
should capture this one, and comparing them in a single unbroken series is the
cleanest test available without inventing anything.

**method**
Three BEA capital-formation series that all begin well before 1995, so the
comparison is within a series rather than across two. US fixed investment in
information-processing equipment and software (quarterly, 1990–) and the software
component (same unit, same scale, one chart); investment in computers and
peripheral equipment (annual, 1959–) on its own chart because it is denominated in
millions rather than billions. **The weakness is fatal to the literal question**:
all three are nominal, so a comparison of levels 26 years apart mixes real
spending with the price level, and neither the page nor the database has a
deflator. What the page can honestly show is the *shape* — how the first boom
plateaued and how this one has not.

**caveat**
These are nominal dollars and unscaled by the size of the economy. Any statement
that this boom is "bigger" than 2000 is arithmetic about the dollar, not about
computing. Quality-adjusted semiconductor prices also fell dramatically across
both periods, which means nominal spending understates the real capital being
bought — and understates it by more in the earlier period, which cuts against the
comparison in the direction the headline would want.

**strength** `insufficient` — the question as posed cannot be settled with nominal
series and no deflator. The shape comparison is worth publishing; the size
comparison is not, and the page should say so in the first line.

**indicators**

| indicator_id | role | chart_group | country | caption_plain (draft) |
|---|---|---|---|---|
| `fred.A679RC1Q027SBEA` | hero | `us-investment-bn` | USA | US investment in information-processing equipment and software, quarterly since 1990. Both booms are in this one line. |
| `fred.B985RC1Q027SBEA` | supporting | `us-investment-bn` | USA | The software half of it. Same unit and a comparable scale, so it belongs on the same axis. |
| `dbn.BEA.NIPA-T50505.B935RC-A` | supporting | *(none — millions, own chart)* | USA | Investment in computers and peripheral equipment, annual back to 1959. The narrowest of the three and the one that shows the dot-com bust most clearly. |
| `fred.GDPC1` | context | *(none)* | USA | Real GDP, as the reminder that the economy is also much bigger than it was in 2000 and that none of the lines above are scaled by it. |

**answer — DRAFT, check before publishing**
Shape: the dot-com boom shows as a peak-and-plateau in the computers series and
this one does not yet. Read 2026-08-30: computers and peripherals $81,375m (1997)
→ $103,178m (2000) → $87,556m (2001) → $84,175m (2004), then $118,902m (2019) →
$178,731m (2024) — but note $160,258m (2022) and $149,064m (2023), so it is not
monotonic. Information-processing equipment and software $243.95bn (1995 Q1) →
$431.26bn (2000 Q1) → $453.96bn (2001 Q1) → $1,612.85bn (2026 Q2).
**You need to check:** the 2022→2023 dip in the computers series. If it is real it
weakens any "no plateau this time" claim significantly and should be the most
prominent thing on the page rather than a footnote. Also decide whether to say
outright that you cannot answer the size question — I think the page is better if
its own headline is "we can't tell you, and here is why".

---

## 5. `who-funds-it` — Who is actually putting up the money?

**lens_id** `investment`
**subtitle** Corporate balance sheets, venture capital and public R&D

**theory**
Where a boom's money comes from tells you how it ends. A venture-funded boom is
financed by investors who can walk away, and it stops when they do. A boom
financed out of the operating cash flow of a handful of very large companies is
much harder to stop and much harder to see, because it never shows up as a
fundraise. Which of those the AI build-out is determines whether the usual
early-warning signals for a bubble apply to it at all.

**method**
Three funding channels, three units, three charts: national-accounts fixed
investment (corporate spending, billions, quarterly), OECD later-stage venture
capital (millions USD, annual), and business R&D in programming and IT services.
The weakness is coverage — the VC series is US later-stage only and stops at the
national aggregate, so it cannot isolate AI deals, and the national-accounts
series cannot isolate AI either. The page compares the *trajectories* of two
funding channels neither of which is AI-specific.

**caveat**
Neither series is AI-only, so this page describes the financing environment
around the build-out rather than the build-out's own financing. Private company
spending that never reaches a public filing or a national account is invisible
here, and a great deal of the most-discussed AI capital — vendor financing,
equity-for-compute arrangements between chip makers and model labs, special
purpose vehicles for data centres — is structured precisely so that it does not
appear as fixed investment or as venture funding in either series.

**strength** `suggestive` — the divergence between the two channels is clean and
large in the data, and it points somewhere, but neither series is AI-specific so
the inference is one step removed.

**indicators**

| indicator_id | role | chart_group | country | caption_plain (draft) |
|---|---|---|---|---|
| `fred.A679RC1Q027SBEA` | hero | *(none)* | USA | Corporate capital spending on information processing equipment and software — money out of operating cash flow, not out of a fundraise. |
| `dbn.OECD.DSD_VC_DF_VC_INV.USA.VC_INV_MKT.LATER.USD_EXC.A` | supporting | *(none)* | USA | US later-stage venture capital. This is the channel most people picture when they think of an AI funding boom, which is what makes its shape interesting. |
| `dbn.OECD.DSD_ANBERD_DF_ANBERDi4.USA.A.MA.J62_63.USD_PPP.V.B` | supporting | *(none)* | USA | US business R&D in programming and IT services — money spent on making the thing rather than on buying it. |
| `wb.GB.XPD.RSDV.GD.ZS` | context | *(none)* | USA | R&D as a share of GDP, the long-run backdrop against which any of this counts as a surge or does not. |

**answer — DRAFT, check before publishing**
Shape, and this is the most interesting finding in the whole batch: **venture
capital has not made a new high through the AI boom.** Read 2026-08-30, US
later-stage VC: $61.9bn (2019), $71.7bn (2020), **$159.1bn (2021)**, $96.5bn
(2022), $74.2bn (2023), $83.9bn (2024), $101.9bn (2025). The 2021 peak is still
the peak, and 2025 is well below it. Corporate fixed investment over the same
window went from $842.3bn (2019 Q1) to $1,612.9bn (2026 Q2). If both readings hold
up, the honest line is that this is a balance-sheet boom, not a venture boom — and
that is a genuinely different animal from 1999.
**You need to check:** (a) that the OECD VC series is on the basis you think —
"later stage" excludes seed and early rounds, and a lot of AI money went into very
large early rounds that this series may miss entirely, which would weaken the
finding badly; (b) the 2025 annual figure is the last observation, so nothing here
covers 2026 at all.

---

# LENS: Growth & Productivity

## 6. `sector-output` — Is the AI sector itself getting bigger?

**lens_id** `growth`
**subtitle** Value added and world trade in computer services

**theory**
Before AI can raise anyone else's output it has to raise its own. The information
sector sells the compute, the software and the services; if the boom is real in
any economic sense, the sector's own value added and its exports should be growing
faster than the economy it is supposedly transforming. This is the weakest
possible version of the productivity claim and therefore the one most likely to be
answerable — and if it fails, everything downstream of it fails too.

**method**
US real value added by industry for Information, read against private
services-producing industries and real GDP, plus world exports of computer
services as an independent construction from a different statistical system (trade
rather than national accounts). **Value added for Information and for private
services share a unit but differ nine-fold in level, so they are on separate
charts** — grouping them squashes the Information line to a flat baseline, which
is what the current `productivity` page does. The weakness of the whole approach:
"Information" is a NAICS sector that includes publishing, film, broadcasting and
telecoms, and is a poor stand-in for "the AI industry".

**caveat**
This measures a sector, not a technology. The Information sector's growth includes
streaming, telecoms and publishing, and none of these series can separate the part
of it that is AI. It also says nothing at all about whether anyone outside the
sector benefited — a sector growing by selling to itself and to a handful of
customers looks identical here to one transforming the economy.

**strength** `consistent` — for the narrow claim actually being made (the sector's
own output has grown much faster than the rest of the private economy) the data
agrees across two independent constructions. It is `insufficient` for anything
about AI specifically, and the page's headline must be the narrow claim.

**indicators**

| indicator_id | role | chart_group | country | caption_plain (draft) |
|---|---|---|---|---|
| `fred.RVAI` | hero | *(none — see method)* | USA | Real output of the US information sector. Nearly quadrupled since 2005 while the rest of private services grew by about two thirds. |
| `fred.RVASPI` | supporting | *(none — see method)* | USA | Everything else in private services, on its own chart because it is nine times larger and would flatten the line above onto the axis. |
| `dbn.WTO.ITS_CS_AX6.000.SI2.000.A` | supporting | *(none)* | — | World exports of computer services — the same story told by the trade statistics rather than the national accounts, which is why it is worth having. |
| `dbn.WTO.ITS_CS_AX6.840.SI221.000.A` | supporting | *(none)* | USA | US exports of cloud computing and data storage specifically. The narrowest available series that is unambiguously about renting compute. |
| `fred.GDPC1` | context | *(none)* | USA | Real GDP, so the sector's growth is read against the economy rather than in isolation. |

**answer — DRAFT, check before publishing**
Shape: yes, and by a wide margin. Read 2026-08-30: US Information real value added
$514.3bn (2005 Q1) → $1,962.5bn (2026 Q1), roughly 3.8x. Private services-producing
$10,485.4bn (2005 Q1) → $17,664.6bn (2026 Q1), roughly 1.7x. World exports of
computer services $120,453m (2005) → $1,077,199m (2024). US cloud and data storage
exports $230m (2006) → $8,291m (2023).
**You need to check:** whether the Information sector's growth rate actually
accelerates after 2022 or just continues — from the two endpoints alone I cannot
tell, and if it does not accelerate then the page cannot imply AI without
overclaiming. Plot the quarterly growth rate before writing the answer. Also note
the WTO series ends in 2024 and the US cloud series in 2023, so neither of them
sees the AI period properly at all — that belongs in the caveat if it holds.

---

## 7. `exposed-productivity` — Does productivity rise where AI is used most?

**lens_id** `growth`
**subtitle** Output per hour in information and communication, against the whole economy

**theory**
The aggregate productivity statistics cannot see AI because AI-using firms are a
small fraction of the economy. But the information and communication sector adopts
AI at roughly three times the all-sector rate, so if the technology raises
productivity anywhere it should raise it there first and most visibly. Comparing
that sector's output per hour with the whole market sector, in the same country
and the same statistical series, differences out the macro shocks that hit both.

**method**
UK output per hour for information and communication against the UK market sector
— both from ONS, both indexed to 2023 = 100, so they share a unit and a scale and
belong on one axis. EU27 real labour productivity per hour for NACE J is included
on its own chart as an independent check from a different statistical office with
a different base year. AI adoption in the sector sits alongside as context, on its
own chart, since it is a percentage. The weakness: the sector's productivity has
been rising steeply since long before 2022, so the test is not "is it rising" but
"did the rate of rise change", and quarterly index data on a decade-long trend is
a poor instrument for detecting a break.

**caveat**
Sector-level productivity in information and communication is dominated by
measurement problems that have nothing to do with AI — deflating software and
telecoms output is one of the hardest problems in national accounting, and the
sector's measured productivity is unusually sensitive to those deflator choices.
It is also the sector whose output is hardest to price, which means the series
most likely to show a spurious AI effect is exactly this one.

**strength** `insufficient` — the level difference between sector and economy is
enormous and clean, but I can see no break at 2022 in the data, and without a
break there is nothing here to attribute to AI. The page is worth publishing as
the strongest available *negative* result in the growth lens.

**indicators**

| indicator_id | role | chart_group | country | caption_plain (draft) |
|---|---|---|---|---|
| `dbn.ONS.PRDY.DJR5.Q` | hero | `uk-sector-vs-economy` | GBR | UK output per hour in information and communication. It has roughly doubled since 2010 — and it was doing that long before anyone had heard of a large language model. |
| `dbn.ONS.PRDY.GYY7.Q` | supporting | `uk-sector-vs-economy` | GBR | The whole UK market sector over the same period, on the same base year. Broadly flat. The gap between these two lines is the entire content of this page. |
| `dbn.Eurostat.nama_10_lp_a21.A.I15.J.RLPR_HW.EU27_2020` | supporting | *(none — 2015 base, own chart)* | — | The same sector across the EU27, from a different statistical office with a different base year, as a check that the UK result is not an ONS artefact. |
| `dbn.Eurostat.isoc_eb_ain2.A.GE10.J62_J63.E_AI_TANY.PC_ENT.EU27_2020` | context | *(none)* | — | Two thirds of Europe's programming and consultancy firms now use AI. This is why this sector is the right place to look. |

**answer — DRAFT, check before publishing**
Shape: the sector is far more productive than the economy and getting more so, but
**the trend does not break where the theory says it should.** Read 2026-08-30,
UK information and communication output per hour, annual means of the quarterly
index (2023 = 100): 47.4 (2010), 61.6 (2015), 78.4 (2019), 92.8 (2022), 100.1
(2023), 105.4 (2025), 109.7 (2026 Q1). UK market sector over the comparable
window: 92.9 (2015 Q1), 96.6 (2019 Q4), 100.8 (2022 Q4), 99.3 (2026 Q1). EU27
NACE J: 100.0 (2015), 110.1 (2019), 116.8 (2022), 117.9 (2024).
By eye the 2018–2022 rise in the UK sector series is at least as steep as the
2022–2026 rise, which is the opposite of what an AI effect predicts.
**You need to check:** compute the annualised growth rate for 2014–2019 and
2022–2026 explicitly before writing this — my read is from endpoints and could be
wrong about which period is steeper. If 2022–2026 turns out steeper the strength
goes to `suggestive`; if it is flatter, say so plainly, because a clean negative
in this lens is more valuable than another hedge. Also note the ONS series carries
values dated to 2026 Q1 while the EU series stops at 2024.

---

# LENS: Labour Markets

## 8. `clerical` — Has the work most like a language model's actually gone?

**lens_id** `labour`
**subtitle** Office and administrative employment, two ways

**theory**
If AI substitutes for tasks, the occupations most exposed are the ones that are
almost entirely those tasks: drafting, filing, scheduling, summarising,
correspondence. Office and administrative support is the largest such occupation
group in any developed economy. It is the single clearest place to look for
substitution, and the absence of an effect there is meaningful evidence in a way
that its absence in aggregate employment is not.

**method**
Two independent constructions of roughly the same occupational group, plotted on
one chart because they share a unit — the US household survey's office and
administrative support series (monthly, 1990–) and the ILO's ISCO-08 major group 4
clerical count for the United States (annual, 2003–). They disagree by two to
three million people, and **showing that disagreement is the point of putting them
together**: an occupational boundary is a definition, and two statistical agencies
drawing it differently is the honest measure of how much precision this question
can bear. Information-sector employment share sits alongside as context on its own
chart.

**caveat**
Occupational counts cannot see task composition. The same job title can lose half
its actual work to software and stay in the statistics as one employed person, so
a flat line here is fully consistent with substantial substitution inside the job.
Nor can these series see hiring that never happened — an employer who quietly stops
replacing leavers produces no signal until attrition accumulates, which takes
years. And both series were disrupted by the pandemic in a way that makes any
post-2020 trend estimate fragile.

**strength** `contested` — the two constructions disagree on level and partly on
shape, the long decline clearly predates AI, and the most recent years point the
opposite way to the substitution story. Genuine disagreement in the evidence, not
absence of it.

**indicators**

| indicator_id | role | chart_group | country | caption_plain (draft) |
|---|---|---|---|---|
| `fred.LNU02032207` | hero | `us-clerical` | USA | US office and administrative employment. It fell hard in 2020 and has been drifting sideways since — not falling, which is what the substitution story predicts. |
| `dbn.ILO.EMP_TEMP_SEX_OCU_NB.USA.BA_453.OCU_ISCO08_4.SEX_T.A` | supporting | `us-clerical` | USA | The same idea counted by the ILO on an international occupational classification. It sits two to three million lower than the US series. Neither is wrong; they are drawing the boundary in different places, and the gap is a fair measure of how precise this question can get. |
| `derived.information_employment_share` | context | *(none — percent, own chart)* | USA | The information sector's share of US employment, for contrast: this one really is falling — and has been since 2000, which is twenty-two years before anything relevant happened. |

**answer — DRAFT, check before publishing**
Shape: no, not on this evidence, and the long decline that people point to started
a generation ago. Read 2026-08-30, US office and administrative employment, annual
means of the monthly series (thousands): 17,789 (2019), 15,558 (2020), 16,097
(2022), 15,954 (2023), 15,795 (2024), **16,444 (2025), 16,383 (2026 to July)**.
It rose in 2025. ILO clerical for the US (thousands): 16,322 (2003), 15,615
(2019), 12,328 (2021), 13,572 (2023) — a different level and a much deeper
pandemic trough. Information employment share: 2.71% (2000), 2.01% (2022), 1.76%
(2026 to July).
**You need to check:** (a) whether `fred.LNU02032207` is seasonally adjusted — it
is an LNU-prefixed series, which normally means *not* adjusted, and if so the
annual means above are fine but any month-on-month reading on the page is not;
(b) whether the 2025 rise survives revision. If it does, "the most exposed
occupation grew last year" is a strong and publishable line, and it is the kind of
finding this project exists to publish.

---

# LENS: Prices & Markets

## 9. `expectations` — What is the market paying for the story?

**lens_id** `prices`
**subtitle** Share prices, corporate disclosure and venture money

**theory**
Everything else in this dashboard measures what has happened. Asset prices measure
what people believe is going to happen, which for a technology in its investment
phase is the only forward-looking evidence available at all. If the market has
repriced on AI, that repricing is a claim about future cash flows — and comparing
it with what firms actually say and what capital actually does is the closest this
project can get to asking whether the belief is supported.

**method**
A broad US share price index as the hero, read against the share of SEC filings
mentioning AI and against later-stage venture investment. Three units, three
charts. **The weakness is disqualifying for the strong version of the question**:
there is no AI sector index, no technology sub-index and no individual company
prices in this database, because most free market-data providers forbid public
redisplay. A broad national index moves on interest rates, earnings and everything
else at once, and cannot be decomposed here.

**caveat**
A whole-market index cannot isolate AI, and this page should not be read as saying
it can. Over the period shown the same index responded to a pandemic, the fastest
tightening cycle in forty years, and the subsequent easing. Anyone reading an AI
premium off this line is reading it into the line. The filings series is also a
count of mentions, not of exposure — a company disclosing AI as a *risk* and one
disclosing it as a product are the same data point.

**strength** `insufficient` — the question needs a sector index the project does
not have, and the series present cannot substitute for one. Publishing the page
with that stated is more useful than leaving the lens without a
market-expectations question at all.

**indicators**

| indicator_id | role | chart_group | country | caption_plain (draft) |
|---|---|---|---|---|
| `fred.SPASTT01USM661N` | hero | *(none)* | USA | US share prices. This is the whole market, not the AI part of it, and that limitation is the main thing this page has to say. |
| `derived.sec_ai_mention_rate` | supporting | *(none)* | USA | The share of large US companies mentioning AI to their regulator. Three in five now do, against one in two hundred a decade ago. |
| `dbn.OECD.DSD_VC_DF_VC_INV.USA.VC_INV_MKT.LATER.USD_EXC.A` | supporting | *(none)* | USA | Later-stage venture investment — private capital's version of the same bet, and notably not at a record. |
| `fred.PCU518210518210` | context | *(none)* | USA | What renting compute actually costs, as the ground truth underneath the expectations. |

**answer — DRAFT, check before publishing**
Shape: the market has risen a great deal and nothing here can tell you how much of
it is AI. Read 2026-08-30: US share prices index (2015 = 100) 62.87 (Jan 2000),
120.17 (Jun 2019), 139.73 (Jun 2022), 220.08 (Jun 2026). SEC AI mention rate
0.51% (2015) → 60.87% (2026 Q1). Later-stage VC peaked at $159.1bn in 2021 and
stood at $101.9bn in 2025.
**You need to check:** nothing about the numbers — check whether you want this page
at all. It is honest and it is thin, and the argument for publishing it is that a
Prices & Markets lens with no market-expectations question implies the project
thinks expectations do not matter. If you would rather wait for a licensable
sector index, park this one.

---

# Would need data we lack

Questions I wanted to propose and could not, with the exact series each needs.

**"Is AI pay different?"** — Wages in the exposed sector against the whole
economy. The only sectoral wage series in the database is
`dbn.NBS.A_A040I.A040I08` (China, IT services, yuan per year, 10 annual
observations). *Needs:* FRED `CES5051200003` (average hourly earnings,
information sector) plus `CES0500000003` (total private) for the US, and ONS
average weekly earnings by SIC section for the UK. Both free.

**"Where is AI policy outside the US?"** — Three of the five lenses are
multi-country and Policy & Regulation is US-only, which makes the whole lens read
as an American dashboard. *Needs:* EUR-Lex document counts for the EU, and
legislation.gov.uk for the UK; both have APIs. `derived.policy_investment_stance`
and `derived.policy_regulation_stance` already exist as empty indicators for the
stance version of this, which needs document-level classification that is not
built.

**"Which occupations are exposed?"** — The entire task-exposure literature
(Felten, Eloundou, Webb) turns on an occupation-level exposure score, and this
database holds exactly one occupational series per country. *Needs:* BLS
Occupational Employment and Wage Statistics (annual, ~800 occupations, free bulk
download), joined to a published exposure index. This is the single highest-value
missing dataset in the project — it would carry two or three questions on its own
and it is the gap the existing `jobs` caveat already admits to.

**"Do AI-adopting firms grow faster?"** — The firm-level question the whole
dashboard is a proxy for. *Needs:* firm-level panel data (Census BTOS in the US
publishes AI-use rates by firm size and sector quarterly, and it is free — that
would at least give a sector cross-section). BTOS is the most tractable of
everything in this section.

**"How much electricity do data centres actually use?"** — `building` currently
infers it from total commercial and industrial sales, which is far too coarse.
*Needs:* EIA Form 861 utility-level sales, or the IEA data centre energy series.
The IEA one is not free; EIA 861 is.

**"Is compute getting cheaper per unit of capability?"** —
`epoch.training_compute_frontier` gives compute per model but there is no price
series to divide it by. *Needs:* a GPU rental price index (there is no free
authoritative one; Epoch publishes hardware price-performance data that would be
the closest substitute).

---

# Notes on writing these into seeds

- All nine reuse indicators already placed elsewhere. `question_indicators` keys on
  `(question_id, indicator_id)`, so these are plain inserts, not moves — unlike
  `016_question_split.sql`, nothing needs deleting and no existing caption is at
  risk.
- Captions above are drafts written to match the voice in `010` and `016`. They
  contain no figures for that reason; where a figure would help, add it after
  reading the series.
- Every `answer_plain` / `answer_expert` here is deliberately unwritten. The
  "shape" paragraphs are what the evidence would let you say, and the figures in
  them are ones I read on 2026-08-30 — re-read them at publication time, since the
  ingestion is manual and the series will have moved.
- Suggested `sort_order`: regulation 2/3/4 after `policy`; investment 3/4;
  growth 3/4; labour 4; prices 4.
- If you want fewer than nine, drop `expectations` (thin by construction) and
  `rule-conversion` (closest to the existing `policy` page). The other seven each
  bring a claim the site does not currently make.

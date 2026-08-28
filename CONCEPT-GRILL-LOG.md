# EconIntel concept grill — decision log

Running record of a `/grill-me` session on the project's concept (not the code —
see STATUS.md for that). Updated after every round so nothing gets lost if this
conversation gets summarized. When the frontier is empty, this becomes the input
to a re-plan (plan mode) and an updated STATUS.md.

## Round 1

**Q1 — What is this for?**
Portfolio project. Joshua is a CS student with a master's in economics; this is
where he applies the economics side. Niche: AI's effect on the economy —
specifically (a) AI investment cycles / circular financing between AI companies
(Nvidia/OpenAI/Oracle-style loops) with diagrams and animations, and (b) AI's
effect on labour markets / job vacancies across countries. Secondary audience:
open source for researchers and students, to inspire and let them explore — not
a growth/attention product.

**Q2 — Can one person maintain 8+ ingestion sources?**
Accepted risk. Manual monthly health check. Some breakage is fine because it's
free and partly a personal tool. Decided, not revisited unless a failure proves
monthly isn't often enough (the RSS silent-failure precedent is the risk case).

**Q3 — Does "never invent a number, caveat everything" cap reach?**
Moot — this isn't a reach play (see Q1). Hedged, honest prose is correct for a
research/portfolio audience, not a liability.

**Q4 — Why isn't this deployed?**
The front end was actually broken (Joshua's words, mid-session) — not
procrastination. Deploy was never really "next"; fixing what's broken is. He
built a lot of this by coding first, in the wrong order (see process note
below), which produced a period of things being broken before the grill process
started catching it.

## Round 2

**Q5 — Circular financing diagrams: hand-curated or automated extraction?**
Hand-curated. Joshua will research via Perplexity and hand over a file with the
deal/entity details for the known AI mega-deals (Nvidia/OpenAI/Oracle/
Microsoft/CoreWeave/Anthropic etc.). Automated LLM extraction from SEC 8-Ks is
explicitly deferred, not needed for v1 of this feature.

**Open item (not yet needed):** Joshua wants the UI to be visually polished —
company logos, "beautiful" design — for this feature specifically. He asked to
be reminded and prompted for these inputs **only when the build actually
reaches that stage**, not now.

**Q6 — Where's the actual econometrics? [assumption corrected]**
NOT "Joshua re-runs his thesis's diff-in-diff on newer data." Actual vision: a
literature-aggregation layer —
  - An academic paper database at OpenAlex scale: ~25k AI-related papers,
    filtered to ~4k that are AI-and-economics relevant. Refreshed quarterly or
    yearly.
  - PLUS a second corpus: long-form reports (50-100pp PDFs) from major
    consulting firms (McKinsey, PwC, Deloitte, KPMG, Accenture, EY) and think
    tanks / NGOs / governmental bodies, **globally**, not just US.
  - A mix of source credibility: industry practitioners, PhD researchers,
    world-renowned academics.
  - An LLM layer extracts models, regression results, and primary findings
    from this corpus and surfaces them (charts, analysis) in the UI.
  - This is what STATUS.md's "literature layer" (`0011_literature.sql`,
    currently unwritten) was always meant to be, but the scope is much larger
    than OpenAlex alone — the consulting/think-tank corpus is new information,
    not previously in STATUS.md at all.

**Q7 — Open source: giving away the database, or something else?**
Not giving away the database. Intent: researchers/students use the **UI** to
get information and inspiration; each stat has a source note that links out to
the primary provider (FRED, World Bank, etc.) so they fetch the underlying data
themselves. Recommended and to be implemented later: a dedicated "Data &
Sources" page surfacing every `sources` row (logo, licence, attribution,
homepage link) — schema for this already exists, just not exposed as a page.

**Satellite imagery (NASA GIBS / Copernicus, found in seed data, absent from
STATUS.md):** Confirmed real and intentional (a "Phase 3" idea — likely
tracking physical AI data-centre buildout as ground-truth evidence of the
investment cycle). To be added to STATUS.md explicitly so it stops looking like
undocumented scope creep.

## Process note (Joshua's own account, important context for future rounds)

Joshua did NOT plan-then-build in order. He started coding the React rewrite
directly (skipped plan mode by mistake), it went badly ("looked like shit"),
and only then did he find and start using the `/grill-me` skill. The current
sprawl (8+ ingestion sources, satellite imagery seeds, an unfinished front end)
partly reflects that build-first-plan-later sequence, not a single coherent
up-front design.

**His stated intent for these grill conversations:** surface every problem,
question, and gap through many rounds (he's explicitly fine with 50+
questions) — niche, big-picture, and "you" questions all welcome — then use
the accumulated answers (this file) to:
  1. Update STATUS.md to reflect reality and the corrected/expanded vision.
  2. Re-enter plan mode with this file as context, to re-plan the remaining
     build — fixing logic and structure, not discarding existing progress.
  3. Produce a reusable "master prompt" he can use to kick off that
     re-planning session efficiently.

This file is maintained turn-by-turn specifically so step 1-3 don't depend on
conversation memory surviving intact.

## Round 3

**Q9 — Literature layer: smallest shippable v1?**
Agrees with the OpenAlex-first recommendation logically, but does NOT want
consulting reports deferred to v2 — wants **at least 10 recent consulting/
think-tank reports included in v1**, not just OpenAlex metadata. So v1 scope
is: OpenAlex (curated set) + ≥10 consulting reports, not OpenAlex alone.

**Q10 — Trust tiering across source types?**
Not a ranked confidence tier. Instead: show multiple findings on the same
topic **side by side, each labeled by source type/origin** ("this is from an
industry report," "this is from academic research") rather than picking a
winner. Rationale in his own words: results differ because of differing
methodology, motivation, and data access — showing that plurality IS the
honest move, not ranking one as more trustworthy. This is a direct match for
STATUS.md's existing (unbuilt) idea that "a conflict between two papers is a
SQL query" — Joshua's answer confirms and sharpens that into a real feature:
a structured comparison view, not a single ranked list.

**Q11 — How do consulting reports actually get collected?**
Manual, Claude-assisted: Claude finds and links candidate reports; Joshua
signs up / accesses them himself and pastes the content back. Requirements:
**at least 10 reports**, prioritizing 2026 publication date, falling back to
2025 if needed, spanning multiple firms (McKinsey, PwC, Deloitte, KPMG,
Accenture, EY, plus others/think tanks), all relevant to the project's actual
scope (AI's economic effects — investment, labour market, productivity,
adoption). A background search for these was kicked off after this round.

**Q12 — What does "done enough to show" mean?**
Not either/or — wants BOTH: a deployed live site (he intends to use it
himself and post it on LinkedIn) AND a well-structured, industry-standard
GitHub README documenting the thinking and problem-solving, not just the
deployed product. No compromise between the two accepted.

## Candidate consulting/think-tank reports (found for Q11, 2026-08-28)

Found by background search, not yet accessed/verified by Joshua. He signs up
and pastes content back per the Q11 workflow; extraction is Claude-assisted
per the Q13 direction, into seed data — no live scrape/fetch was done.

1. McKinsey (QuantumBlack) — *The State of AI: How Organizations Are Rewiring
   to Capture Value* — Nov 2025 — mckinsey.com/capabilities/quantumblack/
   our-insights/the-state-of-ai-how-organizations-are-rewiring-to-capture-value
2. PwC — *2026 Global AI Jobs Barometer* — 2026 — pwc.com/gx/en/issues/
   artificial-intelligence/job-barometer/2026/2026-global-ai-jobs-barometer-full-report.pdf
3. IMF — *Global Economic and Financial Implications of Artificial
   Intelligence* (IMF Notes 2026/002) — 2026 — imf.org/en/publications/
   imf-notes/issues/2026/04/03/global-economic-and-financial-implications-of-artificial-intelligence-lessons-from-a-574924
4. IMF — *New Jobs Creation in the AI Age* (SDN/2026/001) — 2026 —
   imf.org/-/media/files/publications/sdn/2026/english/sdnea2026001.pdf
5. World Economic Forum — *Four Futures for Jobs in the New Economy: AI and
   Talent in 2030* — 2026 — weforum.org/publications/
   four-futures-for-jobs-in-the-new-economy-ai-and-talent-in-2030/
6. Deloitte AI Institute — *The State of AI in the Enterprise* (7th ed.) —
   2026 — deloitte.com/global/en/issues/generative-ai/state-of-ai-in-enterprise.html
7. OECD — *OECD Economic Outlook, Volume 2026 Issue 1* — 2026 —
   oecd.org/en/publications/2026/06/oecd-economic-outlook-volume-2026-issue-1_8be0dba6.html
8. KPMG International — *Global AI Pulse Q2 2026* — 2026 —
   kpmg.com/xx/en/our-insights/ai-and-technology/ai-pulse.html
9. EY — *Economic Growth Through Capital Investment in GenAI* — updated May
   2026 — ey.com/en_gl/insights/ai/economic-growth-through-capital-investment-in-gen-ai
10. Accenture — *Pulse of Change: Business and Technology Trends 2026* —
    2026 — accenture.com/us-en/insights/pulse-of-change
11. **BIS — *Annual Economic Report 2026*, Ch. I "Progress and peril"** —
    2026 — bis.org/publ/arpdf/ar2026e1.htm — flags AI capex-driven circular
    financing between hyperscalers/AI labs as a top financial-stability
    risk. Directly on-topic for the circular-financing feature (Q5) — worth
    prioritizing.
12. Stanford HAI — *2026 AI Index Report*, Economy chapter — 2026 —
    hai.stanford.edu/ai-index/2026-ai-index-report/economy

Mix achieved: 5 of the Big 6 named firms + IMF (x2) + WEF + OECD + BIS +
Stanford HAI. 11 of 12 are dated 2026. Links found via web search — confirm
each still resolves and is the intended document before extraction.

## Round 4

**Q13 — Does literature layer v1 need a live LLM?**
Wants the LLM eventually, not ruled out — but agrees the sequencing should be
manual first: he and Claude build reports/groupings by hand now (multiple
reports per lens), and when the LLM layer is built later, it "learns from
what we've done so far" — i.e., the manual reports become the pattern/template
the LLM replicates for new incoming information. In substance this matches
the recommendation (defer live LLM, do manual first); he frames the future
automation step as learning from the manual work rather than building from
scratch.

**Fact-check triggered by this question — data freshness:** Joshua asked
whether the ingestion APIs (FRED, World Bank, DBnomics, SEC EDGAR, etc.) are
"live" — i.e. does checking in January vs. August actually show new data
without him doing anything. **Checked the code: no.** There is no cron
dependency, no GitHub Actions workflow, no `render.yaml`, and no
`setInterval`/scheduler anywhere in `src/server`. Every ingestion source only
updates when `npm run ingest` is run manually. Comments in the ingestion code
saying a job "runs on a schedule" describe the *external* provider's update
cadence, not anything in this codebase that triggers automatically. This
matters directly for the "numbers change over time" tracker concept from
round 1, Q3 — right now that only happens if Joshua manually re-runs
ingestion, which lines up with his accepted "monthly health check" plan (Q2)
but is worth being explicit about: nothing here is live/real-time yet.

**New source requested:** Forex Factory — daily-updating forex trader
sentiment/analysis, not just structured indicator data. Added to source
wishlist; note it's opinion/sentiment content, not measured statistics — see
open Q about mixing sentiment with hard indicators.

**Q14 — Comparison view: flagship or full showcase?**
Rejected the flagship-comparison recommendation as unnecessarily narrowing.
Actual intent: a broad **showcase** of everything — every relevant McKinsey/
PwC/Deloitte/etc. report, every relevant academic paper, forex sentiment,
each shown with its own data/sentiment, browsable in full. Joshua and Claude
then manually synthesize/write reports FROM that showcased material — doing
by hand now what an LLM would eventually do (ties back to Q13's "LLM learns
from what we've done" plan). Breadth is the point, not a narrowed comparison.

**Q15 — Build sequencing?**
Deferred entirely to plan mode: Joshua wants everything from this grill log
fed into a plan-mode session and have plan mode decide execution order —
explicitly said "I don't know" when asked to sequence it himself. No further
grill-round question on sequencing needed.

**Q16 — Time budget?**
High availability, wants speed and iteration over caution: "build, build,
build," comfortable changing scope and stress-testing ideas quickly, treats
this partly as reps/practice as a CS student. **Recalibration for future
rounds:** stop defaulting to "shrink scope" as the recommended answer —
Joshua has explicitly rejected that once already (Q14) and has the bandwidth
and appetite for a large, fast-iterating build. Recommendations should favor
sequencing and structure over cutting scope.

## Round 5

**Q17 — Where does the showcase live in the IA?**
"Where this comes from" (existing sidebar item) becomes a **Research/Sources**
section — that part is settled. But answering this surfaced a much bigger
open question Joshua flagged himself: he is **not confident the current 5
lenses (Money, Work, Infrastructure, Policy, Adoption) are the right
structure at all**. His words: "economics is a study of everything," floated
"prices" as a possibly-missing lens, wants to potentially break "Money" down
further. Explicitly: "we should definitely talk about the lenses and the
whole thesis of how to structure it. I have no clue." This is now the
dominant open thread — see Round 6 below.

**Q18 — Showcase entry interaction.**
Accepted the recommendation (card grid, filter chips, search, expand-in-
place) and explicitly delegated the detailed design to Claude — "solve that
problem and explain to me" — with an explicit quality bar: don't sacrifice
detail, usability, or visual impressiveness for simplicity. Design ownership,
not a rubber stamp — hold to that bar when this actually gets built.

**Q19 — Circular financing diagram ambition.**
Wants it ambitious: animated, visually beautiful, company logos, will use
"many UI skills" to execute, and Joshua will send visual references later.
Confirmed as one of the harder, higher-effort build items — accepted
knowingly.

**Q20 — Forex Factory / sentiment treatment.**
Visually distinct card style — settled. Placement is NOT settled: Joshua
does not want a single walled-off "Forex Factory" page/section; he wants
sentiment treated as a reusable component attachable contextually wherever
relevant (e.g. a "spending sentiment" component surfaced within the Money
lens specifically). He was explicit that he's not fully sure of the mechanics
("I don't know, I'll be honest... we can talk about this later") — leave this
open for a dedicated design pass rather than treating it as fully resolved.

**Q21 — Logo/attribution prominence.**
Settled: small logos, citation-style only, never larger or more visually
prominent than Joshua's own editorial content. Matches the recommendation
exactly.

## Round 6 — lens taxonomy (RESOLVED)

**Q22 — Organizing principle: settled on Option A** (classical economics
subfields, not a mix of classical + AI-specific categories). New lens set:
**Growth & Productivity, Labour Markets, Investment & Capital, Prices &
Markets, Policy & Regulation.** Infrastructure and Adoption stop being
top-level lenses — see the migration mapping proposed in Round 7 below for
where their existing content goes.

**Q23 — Depth balance.** Not an even split, but not a flagship-vs-afterthought
split either. Two lenses get the deepest personal investment:
  - **Investment & Capital** — Joshua's own words: "real investment into AI
    and how that investment is actually leading to changes within the
    economy... I don't understand the financial side of things." This lens
    is partly a personal-learning vehicle for him, not just a showcase of
    expertise he already has — worth keeping in mind when writing content
    here (it should teach, not just assert).
  - **Growth & Productivity** — his thesis question directly: has AI actually
    changed companies' and people's lives enough to be "worth it."
  Policy & Regulation still needs real depth — he wants to understand
  government sentiment on AI investment approval and how policy shifts feed
  through to prices/financial markets, not a thin summary lens. Same for
  Prices & Markets and Labour Markets — "enough depth in everything else,"
  not superficial treatment.

**Q24 — Settle now, before more building.** Confirmed, unconditionally:
"if everything needs a revamp it's good, it's better to settle it early."

**Offered, accepted:** Joshua will share his actual master's thesis (diff-
in-diff on generative AI and US industry productivity) as source material —
he flagged it didn't get full marks so it may have flaws, but it's real
primary-source grounding for the Growth & Productivity lens specifically.
Follow up: get the file/text when he sends it, use as grounding, not as an
unquestioned source — his own caveat about its marks is itself useful
context to log if it goes into the literature layer.

Joshua explicitly asked to shift the grill here next: "how everything should
be shown and the UI elements and how it interacts with the users." Not yet
answered:

- Where does the report/study showcase live in the IA — embedded per-lens
  (matching "multiple reports per lens"), or its own top-level section
  cross-linked from lenses?
- Interaction model for a showcase entry — expand in place vs. own page;
  filter/sort by source type, date, relevance; search?
- Circular financing diagram — static annotated illustration, or an animated,
  timeline-scrubbable visualization? Very different build cost.
- Sentiment content (Forex Factory) sitting next to hard SQL-computed
  indicators — visual/structural distinction needed to protect the
  "honest data layer, no agenda" identity?
- Real company logos next to report summaries — pure attribution/citation,
  or more branded/decorative? Risk of reading as implied endorsement.

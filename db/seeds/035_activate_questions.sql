-- ═══════════════════════════════════════════════════════════════════════════
-- 035_activate_questions.sql — publish twelve of the twenty-nine drafts.
--
-- WHAT THIS FILE IS
--
-- `024_new_questions.sql` and `025_more_questions.sql` seeded twenty-nine
-- questions with `is_active = FALSE` and `last_reviewed = NULL`, each carrying
-- a CHECK BEFORE ACTIVATING note in the comment above it. This file is that
-- check, carried out on 2026-09-02, and its result.
--
-- Twelve pass and are switched on below. Seventeen do not, and the block at
-- the foot of this file names each one and the specific thing that stopped it.
--
-- WHAT WAS ACTUALLY CHECKED, FOR EVERY ONE OF THE TWENTY-NINE
--
--   1. COVERAGE. Every indicator on the question is `is_active`, holds
--      observations, and those observations span the period the answer talks
--      about. Nothing here is bound to a series that /api/series would filter
--      out or draw as an empty chart.
--
--   2. THE FIGURES. Every number in `answer_plain` was recomputed from
--      `observations` — annual means for monthly and quarterly series,
--      calendar-year sums for the Federal Register counts, endpoint values
--      where the prose quotes a month or a quarter — and compared with the
--      prose at the precision the prose states. The queries are named in the
--      comment above each question.
--
--   3. THE CAVEAT. Present, and naming a limitation of THIS data rather than a
--      general disclaimer. `030_research_caveats.sql` had already appended a
--      sourced paragraph to five of these.
--
--   4. `contested`. Reserved for two sources disagreeing about the SAME period
--      on method. Data disagreeing across TIME is not contestation — newer
--      evidence superseding older evidence makes a question settled, not
--      contested. One draft carries the label and earns it: `clerical`, where
--      BLS and the ILO count the same American clerical workers in the same
--      years and differ by two million because they draw the occupational
--      boundary in different places.
--
--   5. THE SEED'S OWN GATE. The CHECK BEFORE ACTIVATING note above each
--      question in 024 and 025. Where it asked something answerable from the
--      database it was answered; where it asked something that is not in the
--      database — which agency published the 2024 rules, what OECD means by
--      "later stage" — the question stays off, because a gate nobody can open
--      is not a gate you walk through.
--
-- WHY THREE OF THE SIX THE RESEARCH UNBLOCKED ARE STILL OFF
--
-- `docs/research/blocked-questions-2026-08-30-verdicts.md` cleared six pages
-- and wrote out the activation statement for all six. Three of them are not in
-- it: `sector-jobs`, `software-not-steel` and `when-noticed`.
--
-- That is not a disagreement with the research. The research settled the
-- METHODOLOGICAL objection to each page and settled it convincingly. Its own
-- closing instruction was "read the six pages, and if the writing holds up" —
-- and on three of them the writing no longer does, because ingestion has moved
-- numbers the prose quotes. Every one is a small fix in 024 or 025, and every
-- one is stated exactly in the block at the foot of this file.
--
-- WHAT `last_reviewed` MEANS HERE
--
-- 024 is explicit that a NULL `last_reviewed` records that no person has
-- checked the prose against the series, and that `stale_questions` is the
-- safety net if a draft is ever switched on without being read. Setting the
-- date is therefore a claim, and the claim being made is a narrow one: every
-- figure on these twelve pages was recomputed from the observations on
-- 2026-09-02 and matches. It is not an editorial sign-off on the writing.
--
-- A literal date rather than CURRENT_DATE, and `AND NOT is_active` on every
-- statement, so that re-running the seed after a genuine later review cannot
-- drag the review date backwards or re-activate something a person has since
-- retired. Following 028, which guards its UPDATE the same way.
--
-- NOTHING ELSE IS TOUCHED. No prose, no caveat, no placement, no indicator.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── PRICES & MARKETS ────────────────────────────────────────────────────────

-- chip-prices — cleared by the research (verdict 1) and by the numbers.
--
-- fred.PCU334413334413, annual means: 153.4 at Jan 1990, 101.7 (1998),
-- 76.8 (2003), 47.2 (2010), 37.7 (2015), then 30.0, 31.0, 31.7, 31.1, 29.9,
-- 29.9 for 2021 through 2026 to July — the six readings the answer lists, in
-- order, unchanged. 30.0 against 153.4 is a fall of 80.4%, which is the
-- answer's "about eighty per cent". fred.PCU333242333242 runs 89.9 (2021) to
-- 107.5 (2026 to July); dbn.BOJ.CGPI.2300440015 runs 100.0 (2020) to 112.2
-- (2024 to May), +12.2%, which is the answer's "twelve per cent".
--
-- The gate was whether the flattening survives deflation, and the research
-- answered a larger version of it: the PPI is documented to understate
-- quality-adjusted declines. 030 appended that with two primary sources, and
-- 033 placed epoch.gpu_price_performance beside it as the nearest published
-- quality-adjusted measure, with its three limits in the caption. The page now
-- says the flattening is nominal, which is what the evidence supports.
UPDATE questions
   SET is_active = TRUE, last_reviewed = DATE '2026-09-02', updated_at = now()
 WHERE slug = 'chip-prices' AND NOT is_active;


-- bulk-discount — the cleanest of the eight, and it verifies exactly.
--
-- Both Eurostat bands, 37 half-years each, 2007 H1 to 2025 H1, no gaps. Band
-- IG against band IE: 0.0381 vs 0.0620 in 2007 H1, a discount of 38.5% —
-- the answer's "39 per cent"; 0.1022 vs 0.1200 in 2025 H1, a discount of
-- 14.8% — the answer's "15 per cent". The 2022 H1 inversion is real and in
-- the direction claimed: 0.1549 for the largest buyers against 0.1484 for the
-- smaller ones. The discount also inverted in 2010 H2, 2013 H2, 2021 H2 and
-- 2022 H2, which is what the answer's "briefly disappeared" describes.
--
--   select period_start, indicator_id, value from observations
--    where indicator_id like 'dbn.Eurostat.nrg_pc_205%' order by 1;
--
-- The gate was whether the band definitions moved mid-series. Verdict 7 says
-- they did not — the thresholds are fixed by Regulation (EU) 2016/1952 — and
-- 030 has already written that into the caveat along with the 2016-17
-- methodological transition, which is a real limit on this data and is named.
UPDATE questions
   SET is_active = TRUE, last_reviewed = DATE '2026-09-02', updated_at = now()
 WHERE slug = 'bulk-discount' AND NOT is_active;


-- ── INVESTMENT & CAPITAL ────────────────────────────────────────────────────

-- frontier-compute — the gate asked whether Epoch had published anything after
-- 2025-07-09, because a fourteen-month gap at the frontier is either the most
-- interesting fact on the page or a stale ingestion. Verdict 3 answers it: the
-- gap is real and it is a disclosure gap, not a plateau. Epoch's public
-- database carries no training-compute estimate for any closed-weight frontier
-- model released after July 2025. 030 appended that with its source.
--
-- epoch.training_compute_frontier still ends 2025-07-09 at 5.0e26, and the
-- growth arithmetic holds on both windows: 2.578e24 (2022-03-15) to 5.0e26 is
-- 194x over 3.32 years, the answer's "about 190 times in three years and four
-- months"; 8.744e21 (2018-05-02) to 2.578e24 is 295x in 3.87 years, the
-- answer's "about 295 times in under four years". epoch.gpu_cluster_count for
-- the USA reads 12, 20, 11, 18, 31, 5 across 2020 to 2025 — the sequence the
-- method quotes, including the 2025 reporting lag it warns about.
UPDATE questions
   SET is_active = TRUE, last_reviewed = DATE '2026-09-02', updated_at = now()
 WHERE slug = 'frontier-compute' AND NOT is_active;


-- dot-com — dbn.BEA.NIPA-T50505.B935RC-A verifies to the dollar: 103,178
-- (2000), 87,556 (2001), 84,175 (2004), 160,258 (2022), 149,064 (2023),
-- 178,731 (2024), in millions, which are the six figures the answer quotes.
-- fred.A679RC1Q027SBEA and fred.B985RC1Q027SBEA both run 1990 to 2026 Q2, so
-- both booms sit inside one unbroken series, which is the method's whole claim.
--
-- The gate was the 2022-to-2023 dip in the computers series — real, or a
-- revision artefact, and if real it should be more prominent. It is unchanged
-- from the reading taken on 2026-08-30, and the answer already carries it in
-- the same sentence as the recovery. It is also no longer load-bearing: 2024
-- at 178,731 is the highest value in a series that starts in 1959, so the
-- shape claim — that this boom has not peaked and fallen back the way
-- 2000-2004 did — holds whichever way the dip is explained.
--
-- The answer refuses the size comparison outright because all three series are
-- nominal, and the caveat says so. That refusal is the finding, and it is why
-- `strength` is `insufficient` rather than a hedge.
UPDATE questions
   SET is_active = TRUE, last_reviewed = DATE '2026-09-02', updated_at = now()
 WHERE slug = 'dot-com' AND NOT is_active;


-- orders-and-output — fred.IPG334S 110.3 (2021) to 135.4 (2026 to July), a
-- rise of 22.8%, against fred.INDPRO 99.3 to 102.2, a rise of 3.0%: the
-- answer's "roughly a quarter" and "three per cent". fred.A34SNO averages
-- $29,611m a month over January to June 2026 against $36,279m in 2000 — the
-- answer says "the first half of 2026" and means it, so the July figure now in
-- the series does not touch the claim.
--
-- The gate was whether a deflator had since been added that would let the 2000
-- comparison be made in real terms. It has not: the catalogue holds six
-- producer price series and none of them covers NAICS 334 as a whole —
-- fred.PCU334413334413 is semiconductors only, a minority of the industry the
-- orders series counts. So the comparison stays nominal and stays pointed in
-- the one direction the missing deflator cannot reverse, which is what the
-- answer does.
--
--   select id, name from indicators
--    where name ilike '%producer price%' or name ilike '%deflator%';
UPDATE questions
   SET is_active = TRUE, last_reviewed = DATE '2026-09-02', updated_at = now()
 WHERE slug = 'orders-and-output' AND NOT is_active;


-- ── GROWTH & PRODUCTIVITY ───────────────────────────────────────────────────

-- sector-output — fred.RVAI 514.3 (2005 Q1) to 1,962.5 (2026 Q1) is 3.8x, the
-- answer's "close to four times"; fred.RVASPI 10,485.4 to 17,664.6 over the
-- same quarters is +68.5%, the answer's "roughly seven tenths". WTO world
-- exports of computer services 120,453 (2005) to 1,077,199 (2024), in millions
-- — the answer's $120bn and $1,077bn.
--
-- The load-bearing claim is the negative one, that the sector did not
-- accelerate after 2022, and it holds on annual means: RVAI compounds at 8.9%
-- a year over 2018-2022 and 7.2% over 2021-2025. Faster before than since,
-- which is what the answer says and why `strength` is `consistent` rather than
-- anything stronger.
--
-- The gate was that neither WTO series can see the end of the period. Both
-- still stop where they stopped — world exports 2024, US cloud exports 2023 —
-- and the answer dates both, and the caveat names both. Nothing on the page
-- implies either covers 2025 or 2026.
UPDATE questions
   SET is_active = TRUE, last_reviewed = DATE '2026-09-02', updated_at = now()
 WHERE slug = 'sector-output' AND NOT is_active;


-- exposed-productivity — dbn.ONS.PRDY.DJR5.Q annual means 47.4 (2010) and
-- 105.4 (2025); dbn.ONS.PRDY.GYY7.Q 92.9 (2015 Q1) and 99.3 (2026 Q1). Both
-- on 2023 = 100, one publication, one seasonal adjustment, so the gap between
-- the lines is not a splice.
--
-- The gate was the "faster before than after" claim, computed over two
-- four-year windows of annual means with 2026 excluded because it holds one
-- quarter. 2026 still holds exactly one quarter, so the comparison is
-- unchanged and it is not close: the sector gained 37.1% over 2017-2021 and
-- 16.2% over 2021-2025. The EU27 check series slows in the same place —
-- +10.1% over 2015-2019, +6.1% over 2019-2022, +0.9% over 2022-2024.
--
-- The caveat names the right limit, and it is a limit of this series
-- specifically rather than a general one: deflating software and
-- telecommunications output is among the hardest problems in national
-- accounting, so the sector most likely to show a spurious effect is this one.
UPDATE questions
   SET is_active = TRUE, last_reviewed = DATE '2026-09-02', updated_at = now()
 WHERE slug = 'exposed-productivity' AND NOT is_active;


-- total-factor-productivity — fred.RTFPNAUSA632NRUG 0.9643 (2019) to 0.9930
-- (2023), +3.0% over four years, and the series still ends at 2023.
-- dbn.AMECO.ZVGDF.GBR 95.69 (2019) and 95.96 (2025), which is the answer's
-- "no growth in six years". fred.OPHNFB 103.6 (2019) to 119.8 (2026 H1),
-- rising far faster than either residual, which is the page's actual content.
--
-- The gate was whether the AMECO forecast years have become outturns. They
-- have not: 2025, 2026 and 2027 stand at 95.96, 96.29 and 96.77, the same
-- values 029 was written against, and 029 marked 2027 `value_status =
-- 'projected'` while explaining in its own comment why 2025 and 2026 escaped
-- the date rule and are equally Commission forecasts. The answer says the last
-- three values are projections, which is what 029 documents.
--
--   select period_start, value, value_status from observations
--    where indicator_id = 'dbn.AMECO.ZVGDF.GBR.3.0.0.0.ZVGDF' order by 1;
UPDATE questions
   SET is_active = TRUE, last_reviewed = DATE '2026-09-02', updated_at = now()
 WHERE slug = 'total-factor-productivity' AND NOT is_active;


-- computer-dividend — the gate was whether the OECD had extended either
-- decomposition past 2022, because that would turn a historical benchmark into
-- a test of the AI period and require the answer to be rewritten around the
-- new years. It has not. Both series still hold 38 annual observations,
-- 1985 to 2022, and the answer's first instruction to the reader is that they
-- stop there.
--
-- ICT capital's contribution to labour productivity growth: 1.021 pp (1999),
-- 0.305 (2022) — the answer's "1.02" and "0.31", and 0.305/1.021 is the "third
-- of the peak" it claims. Software's contribution to capital growth: 1.488
-- (1999), 0.296 (2003), 1.493 (2022) — the answer's 1.49, 0.30, 1.49.
UPDATE questions
   SET is_active = TRUE, last_reviewed = DATE '2026-09-02', updated_at = now()
 WHERE slug = 'computer-dividend' AND NOT is_active;


-- china-mirror — the gate was the unit multipliers, and it named itself the
-- most likely error on the page and the hardest for a reader to catch. Every
-- conversion was re-derived from `indicators.unit` rather than from the seed
-- comment:
--
--   A_A0G11.A0G1101   'Tens of thousands of yuan'    482,322,235 -> Y4.82tn
--                                                  1,548,310,000 -> Y15.48tn
--   A_A0406.A040608   'Tens of thousands of persons'      364.07 -> 3.64m
--                                                          553.40 -> 5.53m
--   A_A040I.A040I08   'Yuan per year'                    122,478 -> Y122,478
--                                                        238,966 -> Y238,966
--   A_A0E0H.A0E0H28   'Tens of thousands of units'    13,179,500 -> 132bn
--                                                     48,428,000 -> 484bn
--
-- All four match the answer. The wage series carries no multiplier and the
-- answer does not apply one; the other three do and it does. Revenue is 3.2x
-- over the period, the answer's "a little over three times"; pay is +95.1%,
-- the answer's "95 per cent". Employment and wages still hold nulls for 2025
-- and the answer ends both at 2024.
UPDATE questions
   SET is_active = TRUE, last_reviewed = DATE '2026-09-02', updated_at = now()
 WHERE slug = 'china-mirror' AND NOT is_active;


-- ── LABOUR MARKETS ──────────────────────────────────────────────────────────

-- clerical — the one draft carrying `contested`, and it earns the label under
-- the recency rule. fred.LNU02032207 and the ILO's ISCO-08 group 4 count the
-- same American clerical workers in the same years and differ by about two
-- million throughout: 17.79m against 15.62m in 2019, 15.95m against 13.57m in
-- 2023. That is two statistical agencies drawing an occupational boundary in
-- different places over an identical period, which is method rather than
-- vintage, and it is what the label is for.
--
-- The gate was whether the 2025 rise survives revision, it being the most
-- quotable thing on the page. It has: annual means 17,789 (2019), 15,558
-- (2020), then 15,797, 16,097, 15,954, 15,795, 16,444, 16,383 across 2021 to
-- 2026 — so the answer's "between 15.8 and 16.4 million since" and its 2025
-- average above 2022, 2023 and 2024 both hold. The Jan 2000 value is 20,241,
-- the answer's "above 20 million in 2000".
--
-- One thing the prose does not say and a reader cannot see: October 2025 is
-- NULL in fred.LNU02032207, so the 2025 average is over eleven months. It
-- cannot reverse the claim — September reads 16,608 and November 17,102, so
-- the missing month sits above the mean, not below it — but it is worth
-- knowing before anyone quotes the figure more precisely than the page does.
UPDATE questions
   SET is_active = TRUE, last_reviewed = DATE '2026-09-02', updated_at = now()
 WHERE slug = 'clerical' AND NOT is_active;


-- aggregate-unemployment — the gate was that the World Bank series still ends
-- in 2025 with 48 economies reporting, because 4.79 being a series low is the
-- whole headline and it is one revision away from not being one. It does: 48
-- distinct countries report 2025, the world aggregate reads 4.7913, and that
-- is the minimum of all 26 world observations back to 2000, where it reads
-- 6.111. 2019 is 5.588 and 2020 is 6.588, both as quoted.
--
-- The two records are records. fred.PAYEMS averages 158,725 thousand over
-- January to July 2026, the highest annual mean in the series, and its highest
-- single month, 158,881, is June 2026. Japanese employed persons average 6,842
-- over the same months, again the highest annual mean, peaking at 6,882 in May
-- 2026. Both are read as annual means, which is the convention the method
-- states. fred.LNS14024887 gives 8.39% (2019), 9.07% (2026 to July) and 11.62%
-- (2015), so youth unemployment has risen and is still below its 2015 level,
-- exactly as the answer has it.
--
-- The page is built as a null result and the caveat is unusually honest about
-- why the instrument is weak — a job never created generates no unemployment,
-- which is the mechanism most of the displacement literature proposes.
UPDATE questions
   SET is_active = TRUE, last_reviewed = DATE '2026-09-02', updated_at = now()
 WHERE slug = 'aggregate-unemployment' AND NOT is_active;


-- ═══════════════════════════════════════════════════════════════════════════
-- NOT ACTIVATED, AND WHY
--
-- Seventeen questions. Grouped by what stopped them, because the groups are
-- the useful thing: five are one-line prose fixes, five wait on a single
-- unanswered question about the Federal Register, and the rest each wait on
-- something specific.
--
--
-- ── Prose that quotes a figure the database no longer holds ────────────────
--
-- These pages were right when they were written on 2026-08-30 and ingestion
-- has moved underneath them. Each is a small edit in 024 or 025 followed by an
-- activation; none of them needs new research.
--
--   sector-jobs        The answer says the 2026 headcount "takes it below
--                      where it stood in 2015". It does not. fred.USINFO
--                      averages 2,788 thousand over January to July 2026 and
--                      its lowest month in that window is 2,769, against a
--                      2015 range of 2,737 to 2,766 and a 2015 mean of 2,750.
--                      The 2026 figure is above all of 2015 and below 2016.
--                      Everything else on the page verifies — 3,063 in 2022,
--                      the 275,000 fall, output up a third against headcount
--                      down nine per cent, the 1.75% share, the March 2001
--                      peak of 3,718 — so this is one clause. Verdict 5 has
--                      already settled the methodological objection and 030
--                      has written the Challenger evidence into the caveat, so
--                      fixing the clause is all that stands between this page
--                      and publication.
--
--   software-not-steel Two stale figures, both from BEA revisions.
--                      fred.B985RC1Q027SBEA now averages 807.1 over 2026 H1,
--                      against the answer's "$806bn";
--                      fred.A679RC1Q027SBEA now averages 1,584.0, against the
--                      answer's "$1,585bn". Everything else holds exactly,
--                      including the whole dot-com passage the page is built
--                      on — 156.8, 157.7, 152.5, 155.0 for software across
--                      2000 to 2003, and 450.6 falling to 389.3 and not
--                      recovering until 2005 for the total. Software is 50.9%
--                      of the total, so "about half" is still right. Verdict 6
--                      has settled the own-account objection, 030 has written
--                      it into the caveat and 033 has placed the three BEA
--                      components on the page. Two numbers.
--
--   when-noticed       derived.ai_regulation_volume has been recomputed since
--                      the draft was written. 2024 now sums to 240, not the
--                      243 the answer quotes, and 2026 to August sums to 252,
--                      not 248. The rest of the answer is intact: 21 documents
--                      in 2012, no year between 1996 and 2011 above 6, and no
--                      year since 2012 below 19. Verdict 8 has settled what
--                      the page is allowed to claim and 030 has already
--                      written the "this count is our own" caveat, so this is
--                      two numbers as well.
--
--   executive-action   Same recomputation. The answer's "nine presidential
--                      documents and forty-four rules" through August 2026 are
--                      now 10 and 45. The 2024 and 2025 figures it leans on —
--                      3 and 28 presidential documents, 57 and 33 rules — are
--                      unchanged. It is also blocked by the agency question
--                      below.
--
--   rules-vs-adoption  The answer's "from 120 to 243" between 2023 and 2024 is
--                      now 120 to 240. It is also blocked by the caveat
--                      problem below.
--
--
-- ── Waiting on which agency published the 2024 rules ───────────────────────
--
-- 024's header made this the condition for `executive-action` and
-- `rule-conversion` going live, and 025 extended it to `cost-of-compliance`:
-- derived.ai_binding_rules jumps to 57 in 2024 from 16 in 2023 and falls back
-- to 33 in 2025, and a single agency publishing a batch of related rules would
-- produce exactly that shape and would mean nothing.
--
-- It cannot be settled from this database. The Federal Register documents are
-- not stored — `documents` holds only research, news and gov_release rows, and
-- the derived series keep counts alone. Answering it means going back to the
-- Federal Register API by agency, which is ingestion work rather than a check.
--
--   executive-action   Blocked on the agency question and on the two stale
--                      2026 counts above.
--   rule-conversion    Its central fact — 57 rules in force against 24
--                      proposals in 2024 — verifies exactly, and the answer is
--                      an honest refusal to compute a conversion rate. 024
--                      still names it as leaning on the disputed number.
--   cost-of-compliance Every figure verifies: 16, 57 and 33 rules across 2023
--                      to 2025, and fred.PCU518210518210 up 4.5% over 2023-25
--                      against 4.0% over 2019-21. The caveat already warns
--                      that the 57 may be one agency's batch. 025 asks for the
--                      spike to be resolved once and all three pages fixed
--                      together, which is the right order.
--
--   policy-lag         A different Federal Register question, equally open.
--                      The gate is whether the 2023-to-2024 doubling is a
--                      search-term artefact, and verdict 8 answers it: it
--                      cannot be ruled out. The page's whole argument is the
--                      ORDER in which three series moved, so a measurement
--                      change in one of them is disqualifying rather than
--                      caveatable — and the caveat does not currently mention
--                      the possibility at all. The answer also quotes
--                      "$1,613bn by mid-2026" for fred.A679RC1Q027SBEA, which
--                      now reads 1,611.5 at 2026 Q2.
--
--
-- ── A caveat that now contradicts a live page ──────────────────────────────
--
--   diffusion-speed    Every figure verifies — 15.6 to 28.4 for world internet
--                      use across 2005-2010, 5.6 to 20.3 for OECD firms across
--                      2020-2025, 57.5% in information and communication
--                      against 17.3% in European manufacturing in 2025. But
--                      the caveat says the 2023-to-2024 doubling in the
--                      enterprise series is a break "a change in the wording of
--                      the question would explain", and that "nothing in the
--                      data can exclude that". Verdict 2 excluded it — the
--                      Eurostat and OECD questions did not change and the jump
--                      is diffusion — and 030 has already written that onto
--                      `adoption`, which is live. Publishing this page as
--                      drafted would have the site hedge on one page what it
--                      asserts on another about the same survey. Rewrite the
--                      caveat around the residual doubt the research actually
--                      left, which is that 2023 was the first harmonised wave.
--
--   rules-vs-adoption  Carries the same superseded hedge — "a survey question
--                      whose wording may have been revised on the other" —
--                      alongside the stale 243.
--
--
-- ── Waiting on something outside this database ─────────────────────────────
--
--   the-buildings      Verdict 4: still blocked. The Census Value of
--                      Construction Put in Place subnational tables appear to
--                      carry a computer-and-electronic-products category, the
--                      sector code is unconfirmed, and no FRED series exists.
--                      The hero, dbn.BEA.NIPA-T50405.LA001282-A, holds five
--                      annual observations ending 2024. Ingest the Census
--                      series beside fred.TLMFGCONS; that is real work, not a
--                      caveat.
--
--   compute-price-abroad  All three Japanese BOJ series still end 2024-04-01:
--                      internet data centres 97.6, cloud applications 95.0,
--                      software development 113.2, against 100.0 in 2015. The
--                      US index verifies at +11.5% over 2019 to 2026 to July.
--                      But 025's gate is explicit — re-ingest the BOJ series
--                      to the present before publishing this page at all,
--                      because two of the three years the answer describes are
--                      American only. Whether the BOJ still publishes these on
--                      the 2015 base is a question for the source, not for a
--                      SELECT, so the gate stays shut.
--
--   who-funds-it       The gate is what the OECD series means by "later
--                      stage", and 025 calls it the first thing to verify
--                      because a great deal of AI money went into very large
--                      EARLY rounds this series may not see at all. That is a
--                      question about OECD's definition, not about the data
--                      here. The venture figures verify — $159.1bn in 2021,
--                      $101.9bn in 2025 — but the answer also quotes
--                      "$1,613bn by mid-2026" for fred.A679RC1Q027SBEA, now
--                      1,611.5.
--
--   is-europe-in-this  The gate is the 2018-to-2019 jump in
--                      dbn.Eurostat.nama_10_an6 intellectual property: +22% in
--                      one year, most of it given back by 2021, which is the
--                      signature of intangible assets relocating between
--                      member states. 025 says that if it is that, the series
--                      should be DROPPED from the page rather than caveated
--                      on it. Deciding which requires Eurostat's country
--                      detail, which is not ingested. The research figures on
--                      the page verify: EU business R&D in ICT services +42%
--                      and the US equivalent +49% across 2019 to 2023.
--
--   ai-wages           025 forbids publication until the three extracted
--                      report figures the answer quotes have been checked
--                      against their page references. All three are still in
--                      `unreviewed_figures` — the two PwC wage-premium figures
--                      and the IMF posted premium. The official series on the
--                      page verify (fred.ULCNFB 103.6 to 123.8, fred.OPHNFB
--                      103.6 to 119.8), but they are the check, not the
--                      finding; the finding is three unverified numbers.
--
--
-- ── Prose the check itself found wanting ───────────────────────────────────
--
--   skills-shortage    The headline is that the EU information and
--                      communication vacancy rate "was 2.2 per cent in the
--                      third quarter of 2025, the lowest reading since 2013".
--                      025 already warned that the series is NOT seasonally
--                      adjusted, that third quarters run low in it, and that
--                      the figure must be re-read as a four-quarter mean
--                      before publishing. It has not been. The 2.2 is a single
--                      unadjusted Q3, and 2020 Q2 also reads 2.2, so it is not
--                      even the unique low the sentence claims. The stock
--                      series behind the second half of the answer verifies
--                      (4.0% of EU employment in 2019, 5.0% in 2024).
--
--   labour-vs-compute  Every figure verifies: unit labour costs +19.5%, output
--                      per hour +15.6%, hosting +11.5%, semiconductors -8.0%,
--                      all 2019 to 2026 H1, and the eight-point gap the answer
--                      turns on. What does not survive is the gloss. The page
--                      asks what got dearer, "an hour of work or an hour of
--                      compute", and then describes fred.ULCNFB as "what an
--                      hour of output costs in wages and benefits". Unit
--                      labour costs are compensation per unit of output, which
--                      already nets out productivity — 025's own gate names
--                      this and says average hourly earnings is the series the
--                      question wants and is not in the catalogue. The
--                      answer_expert and the caveat handle it correctly; the
--                      sentence a reader meets first does not.
--
--   expectations       Nothing wrong with the figures — the OECD share price
--                      index reads 139.73 in June 2022 and 220.08 in June
--                      2026, the SEC mention rate 14.84% and 60.87%, and
--                      later-stage venture is below its 2021 peak throughout.
--                      025's gate is not a data question at all: "decide
--                      whether the page is worth having", given that it is
--                      honest, thin, and would be rebuilt around a licensable
--                      sector index if one ever became available. That is an
--                      editorial call for a person, and this file does not
--                      make editorial calls.
-- ═══════════════════════════════════════════════════════════════════════════

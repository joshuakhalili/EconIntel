-- ============================================================================
-- 024_new_questions.sql — nine drafted questions, none of them active
--
-- WHAT THIS FILE IS
--
-- Nine new questions across all five lenses, weighted towards Policy &
-- Regulation, which held one question against three or four everywhere else.
-- Every one is answerable from series already in the database; nothing here
-- required an ingestion change. All nine recombine indicators that already sit
-- on another question — `question_indicators` keys on (question_id,
-- indicator_id), so a series can carry a different role, group and caption on
-- each page it appears on. No placement is moved and no existing caption is
-- touched.
--
-- NOTHING IN THIS FILE IS ACTIVE
--
-- Every question is seeded `is_active = FALSE` and `last_reviewed = NULL`. They
-- exist in the database, they are fully formed, and no reader can reach them.
--
-- The prose was drafted by a model. `answer_plain` is the site making a claim
-- about the economy in its own voice, and this project's founding rule is that
-- no such claim is written by a model — `theory`, `method` and `caveat` carry
-- exactly the same status. NULL `last_reviewed` is not an oversight: it records
-- that no person has checked this prose against the series, and it is the
-- safety net if one of these is ever activated without being read, because
-- `stale_questions` will surface it immediately.
--
-- Note that `stale_questions` filters on `is_active`, so it does NOT list these
-- nine while they are drafts. The worklist for the drafts themselves is:
--
--   SELECT id, lens_id, question, strength FROM questions
--    WHERE NOT is_active ORDER BY lens_id, sort_order;
--
-- Every figure quoted in the prose below was read from the series, on
-- 2026-08-30, with the query that produced it recorded next to each question.
-- The answers are written to be true if published unchanged: where the data
-- cannot settle the question, the answer says so and `strength` is
-- `insufficient` rather than a hedge dressed as a finding.
--
-- TO ACTIVATE ONE
--
--   UPDATE questions
--      SET is_active = TRUE, last_reviewed = CURRENT_DATE
--    WHERE id = 'executive-action';
--
-- Do that only after reading the page's own series and rewriting whatever the
-- data no longer supports. Re-running this seed will NOT undo it: the conflict
-- clause below preserves `is_active` and `last_reviewed` as they stand in the
-- database. It does overwrite the prose, so once a question has been rewritten,
-- edit it here too or the next `npm run db:seed` will put the draft back.
--
-- WHAT HAS TO BE CHECKED FIRST
--
-- Two problems run across several questions and are the reason none of this is
-- live:
--
--   1. 2026 IS AN EIGHT-MONTH YEAR. Every Federal Register series ends
--      2026-08-01. Any calendar-year total for 2026 covers eight months, and
--      the three regulation questions all quote one. The prose says so each
--      time; check it still does after any edit, and check the series end date
--      has not moved since the last ingestion run.
--
--   2. THE 2024 RULES SPIKE MAY BE ONE AGENCY'S BATCH. `derived.ai_binding_rules`
--      jumps to 57 documents in 2024 from 16 in 2023 and falls back to 33 in
--      2025. A single agency publishing a batch of related rules would produce
--      that shape and would mean nothing. Nothing in the derived series can
--      distinguish the two — the underlying Federal Register documents have to
--      be looked at by agency before `executive-action` or `rule-conversion`
--      can go live, because both lean on that number.
--
-- Per-question checks are recorded in the comment above each question.
-- ============================================================================


-- ── The questions ───────────────────────────────────────────────────────────
--
-- sort_order avoids the existing occupants of each lens:
--   growth      adoption 1, productivity 4        → 2, 3
--   investment  money 2, building 5               → 3, 4
--   labour      jobs 1, entry-level 2, vacancies 3 → 4
--   prices      markets 1, power 2, materials 3   → 4
--   regulation  policy 6                          → 7, 8, 9

INSERT INTO questions (id, slug, question, subtitle, answer_plain, answer_expert,
                       caveat, theory, method, strength, last_reviewed,
                       lens_id, sort_order, is_active) VALUES


-- ─────────────────────────────────────────────────────────────────────────────
-- POLICY & REGULATION
-- ─────────────────────────────────────────────────────────────────────────────

-- Figures read 2026-08-30, calendar-year sums of the monthly series:
--   presidential documents  1 (2021), 3 (2023), 3 (2024), 28 (2025),
--                           9 (2026 to August)   (derived.ai_presidential_documents)
--   rules in force         15 (2021), 16 (2023), 57 (2024), 33 (2025),
--                          44 (2026 to August)         (derived.ai_binding_rules)
--   rules proposed         15 (2021), 26 (2023), 24 (2024), 30 (2025),
--                          44 (2026 to August)        (derived.ai_proposed_rules)
--     select date_trunc('year', period_start)::date yr, sum(value)
--       from observations where indicator_id = '…' group by 1 order by 1;
--
-- CHECK BEFORE ACTIVATING: the 2024 rules spike (see header). If it is one
-- agency's batch, the second half of this answer has to be rewritten.
('executive-action', 'executive-action',
 'Who is actually writing AI policy?',
 'Executive action against the rulemaking process',
 'Increasingly the President rather than the agencies — though the pattern is two years old and has not held into 2026. Presidential AI documents, meaning executive orders and memoranda, numbered three in 2024 and twenty-eight in 2025. Rules actually in force moved the other way over the same two years, from fifty-seven to thirty-three. The distinction is the whole point: a rule takes a year or more, survives a change of administration and is written by people who take comments, while an executive order takes a day and can be undone by the next signature. Through August 2026, an incomplete year, there have been nine presidential documents and forty-four rules — so the 2025 pattern has not repeated so far.',
 'Federal Register documents matched on the project''s six AI search terms and split by the government''s own document-type field, counted monthly. The three types share a unit and sit on one axis. Two limits bound what the counts can mean. A count weights a one-paragraph delegation of authority and a thousand-page rule identically, and there is no free way to weight them by scope or by compliance cost. And the types are unlinked populations rather than a pipeline: in 2024 there were more rules in force than proposals, which would be impossible if these rows tracked individual documents from proposal to promulgation. Read the three lines as three separate instruments being used at different rates, not as stages of one process.',
 'United States federal only, and a count of documents rather than of policy. It cannot see state legislatures, where a large share of binding US AI law has actually been written, and it cannot see enforcement — a rule in force that no agency acts on and one that reshapes an industry are the same data point here. It also says nothing about direction: whether a document permits or restricts is not classified anywhere in this dataset.',
 'There are two routes to a binding AI policy in the United States and they run at very different speeds. An agency rule is slow, durable and consultative; a presidential document is immediate, unilateral and reversible. If AI policy is being made faster than the rulemaking process can move, then it is being made by the pen — and that changes how much of it should be expected to survive.',
 'The government''s own document-type field does the classification, so the split is not an editorial judgement. All three series are counts on the same monthly basis and share an axis. The comparison is within-instrument over time rather than across instruments, because the three are not comparable in weight.',
 'suggestive', NULL, 'regulation', 7, FALSE),


-- CHECK BEFORE ACTIVATING: the 2024 crossover is the load-bearing fact here.
-- Confirm it holds on the monthly series and not only on calendar-year sums.
('rule-conversion', 'rule-conversion',
 'Does proposing an AI rule mean anything?',
 'The gap between what is proposed and what binds',
 'These series cannot tell you, and the reason is more useful than a guess would be. Proposals and rules are counted here as two populations matched on search terms, not linked by docket number, so no proposal can be followed to the rule it became. The clearest evidence of that limit is in the data itself: 2024 carried fifty-seven AI rules in force against twenty-four proposals, which is impossible if the first came from the second. What this page can show is two populations rising together over a decade; what it cannot show is a conversion rate, and no free source would let it.',
 'Federal Register documents of type Proposed Rule and Rule, matched on six AI search terms, counted monthly and plotted on one axis. Total AI document volume sits on its own chart at roughly three times the two lines combined, because it also carries notices, guidance and requests for information — it is a superset, not a total, and reading it as the sum of the plotted types would be wrong. The missing element is docket linkage: the Federal Register publishes a regulation identifier that would allow a proposal to be traced to its rule, and this project does not ingest it. Until it does, any conversion statistic on this page would be constructed rather than measured.',
 'No proposal here is linked to any rule, so nothing on this page measures conversion in the strict sense — only whether the two populations move together. Comment periods, withdrawals and rules issued without a prior proposal are all invisible. And as with everything in this lens, it is United States federal only.',
 'Regulatory intent is cheap and regulatory obligation is expensive. A proposed rule says an agency would like to act; a rule in force says it did, and that somebody now has to comply. The ratio between the two, and the lag between them, would measure how much of the stated appetite for AI regulation actually converts into a burden — if the two could be linked.',
 'Two document types on a shared axis and shared unit, with total volume kept on a separate chart to stop it being read as their sum. The page is deliberately built around the limitation rather than around a headline, because the limitation is the finding.',
 'insufficient', NULL, 'regulation', 8, FALSE),


-- Figures read 2026-08-30:
--   SEC AI mention rate   0.51% (2015) → 14.84% (2022) → 60.87% (2026 Q1)
--                                                 (derived.sec_ai_mention_rate)
--   AI regulatory volume  63 (2019), 84 (2022), 120 (2023), 243 (2024),
--                         207 (2025), 248 (2026 to August)
--                                              (derived.ai_regulation_volume)
--   Info-processing investment  $431.3bn (2000 Q1), $1,057.5bn (2022 Q1),
--                               $1,612.9bn (2026 Q2)   (fred.A679RC1Q027SBEA)
--
-- CHECK BEFORE ACTIVATING: whether the 2023→2024 doubling in regulatory volume
-- is real or a search-term artefact. The derived series matches on six terms; if
-- one of them became boilerplate in 2024 the entire break is a measurement
-- change and this page has nothing to say.
('policy-lag', 'policy-lag',
 'Does the state react to the boom, or shape it?',
 'Regulatory attention against corporate disclosure and capital spending',
 'The order runs the way the reactive story predicts, and three series cannot prove that the order means anything. Corporate disclosure moved earliest and most sharply — the share of large US companies mentioning AI in their annual report went from 0.51 per cent in 2015 to 60.87 per cent by early 2026. Capital spending shows no break at all, only a long rise, from $431bn in early 2000 to $1,613bn by mid-2026. AI-related Federal Register documents roughly doubled between 2023 and 2024, later than either. That sequence is consistent with a state reacting to a boom it did not cause, and equally consistent with all three responding to the same public arrival of the technology at the end of 2022.',
 'Three series with three units on three charts: Federal Register AI document volume monthly, the share of 10-K filings mentioning AI quarterly, and BEA fixed investment in information-processing equipment and software quarterly. Turning points are compared by eye across charts, which is the method''s weakness rather than a presentational choice — with two of the three series effectively annual in resolution there are too few turning points to test a lead-lag relationship formally, and no attempt is made to. The populations at least match on country: US federal rulemaking against US public companies against the US national accounts.',
 'Sequence is not causation, and with a common shock available as an explanation it is not even suggestive. All three series changed behaviour within roughly a year of the same event, and no arrangement of them can separate "regulation followed capital" from "both followed the same news". The investment series is also far broader than AI and would look much as it does with no AI at all.',
 'Regulation of a new technology is usually reactive: firms adopt it, something is noticed, the state responds. If that is what is happening with AI, regulatory volume should lag both the point at which companies start telling investors about it and the point at which capital starts being committed. If regulation instead moves first or in step, the state is doing something closer to shaping the market than reacting to it.',
 'Three units means three charts and no shared axis. The page compares the timing of changes rather than their levels, and states plainly that eyeballing three lines is not identification.',
 'insufficient', NULL, 'regulation', 9, FALSE),


-- ─────────────────────────────────────────────────────────────────────────────
-- INVESTMENT & CAPITAL
-- ─────────────────────────────────────────────────────────────────────────────

-- Figures read 2026-08-30:
--   Computers & peripherals  $81.4bn (1997), $103.2bn (2000), $87.6bn (2001),
--                            $84.2bn (2004), $118.9bn (2019), $160.3bn (2022),
--                            $149.1bn (2023), $178.7bn (2024)
--                                        (dbn.BEA.NIPA-T50505.B935RC-A, millions)
--   Info-processing equipment & software  $243.95bn (1995 Q1), $431.26bn
--                            (2000 Q1), $453.96bn (2001 Q1), $1,612.85bn (2026 Q2)
--                                                     (fred.A679RC1Q027SBEA)
--
-- CHECK BEFORE ACTIVATING: the 2022→2023 dip in the computers series. If it is
-- real rather than a revision artefact it weakens the "no plateau yet" reading
-- and should be more prominent than it currently is in the answer.
('dot-com', 'dot-com',
 'Is this bigger than the last computing boom?',
 'The current build-out against 1995 to 2001, in the same series',
 'Not answerable from these series, and the reason is worth more than a false answer would be. All three are nominal dollars with no deflator and no scaling by the size of the economy, so comparing 2026 with 2000 compares the price level as much as it compares the spending. What the shapes can show is that the earlier boom peaked and fell back — US investment in computers and peripheral equipment was $103bn in 2000, $88bn in 2001 and still $84bn in 2004 — while the current one has not done that, though it did dip from $160bn in 2022 to $149bn in 2023 before reaching $179bn in 2024. Shape is what this page offers. Size it cannot.',
 'Three BEA capital-formation series, all beginning well before 1995, so the two booms are compared within a series rather than across two. Fixed investment in information-processing equipment and software and its software component share a unit and a scale and sit on one axis; investment in computers and peripheral equipment is annual and denominated in millions, so it takes its own chart rather than being forced onto a quarterly axis. The nominal problem is not incidental: quality-adjusted prices for computing equipment fell steeply across both periods, which means nominal spending understates real capital purchased, and understates it by more in the earlier period — cutting against the comparison in exactly the direction a headline would want.',
 'Nominal, unscaled and undeflated. Any claim that this boom is larger than 2000 is arithmetic about the dollar rather than about computing. The series also cannot separate AI from the rest of information-processing investment, which includes a great deal — payroll systems, telephony, ordinary enterprise software — that has nothing to do with it.',
 'The dot-com boom is the obvious reference class: a general-purpose computing technology, a capital-spending surge, a widespread belief that the old rules had changed, and a bust. If the current build-out is the same phenomenon at a different scale, the national-accounts series that captured the first one should capture this one, and comparing them inside a single unbroken series is the cleanest test available without inventing anything.',
 'Within-series comparison rather than across two, so no splice or definitional change sits between the two booms. Annual and quarterly series are kept on separate charts because mixing frequencies on one axis is a resolution mismatch, not a scale one.',
 'insufficient', NULL, 'investment', 3, FALSE),


-- Figures read 2026-08-30:
--   US later-stage VC  $61.9bn (2019), $71.7bn (2020), $159.1bn (2021),
--                      $96.5bn (2022), $74.2bn (2023), $83.9bn (2024),
--                      $101.9bn (2025)
--                (dbn.OECD.DSD_VC_DF_VC_INV.USA.VC_INV_MKT.LATER.USD_EXC.A)
--   Info-processing investment  $842.3bn (2019 Q1) → $1,612.9bn (2026 Q2)
--
-- CHECK BEFORE ACTIVATING: what the OECD series means by "later stage". It
-- excludes seed and early rounds, and a great deal of AI money went into very
-- large early rounds that this series may not see at all. If so the central
-- finding weakens badly. The series also ends in 2025 and sees no part of 2026.
('who-funds-it', 'who-funds-it',
 'Who is actually putting up the money?',
 'Corporate balance sheets, venture capital and research spending',
 'Corporate balance sheets rather than venture capital, which makes this a different kind of boom from 1999. US later-stage venture investment peaked at $159bn in 2021 and stood at $102bn in 2025 — below that peak throughout the AI period, not above it. Over the same years US fixed investment in information-processing equipment and software went from $842bn in early 2019 to $1,613bn by mid-2026. Neither series is AI-specific, so this describes the financing environment around the build-out rather than the financing of the build-out itself, and the distinction matters: a boom paid for out of operating cash flow does not stop when investors lose their nerve.',
 'Three funding channels on three charts. National-accounts fixed investment stands in for corporate spending; OECD later-stage venture capital for the private markets; ANBERD business R&D in programming and IT services for money spent making rather than buying. The venture series is US later-stage only and cannot isolate AI deals, which is its main limitation — early-stage rounds, where much of the AI money went, are outside its scope. Corporate spending is rebased against venture on one chart where a common base is available, since the comparison the question wants is between trajectories rather than between levels that differ by an order of magnitude.',
 'Neither headline series is AI-only, so this is the financing environment rather than the financing of AI. And much of the capital most discussed in this boom is structured so that it appears in neither: vendor financing between chip makers and model developers, equity taken in exchange for compute, and special-purpose vehicles holding data-centre assets off balance sheet are all invisible to both fixed investment and venture statistics.',
 'Where a boom''s money comes from tells you how it ends. A venture-funded boom is financed by investors who can walk away, and it stops when they do. A boom financed out of the operating cash flow of a handful of very large companies is much harder to stop and much harder to see, because it never appears as a fundraise. Which of the two this is determines whether the usual early-warning signals for a bubble apply to it at all.',
 'Channels are compared by trajectory, not level, because they are not the same size and were never going to be. Where two series can share a rebased axis they do; where the units cannot be reconciled they are kept apart.',
 'suggestive', NULL, 'investment', 4, FALSE),


-- ─────────────────────────────────────────────────────────────────────────────
-- GROWTH & PRODUCTIVITY
-- ─────────────────────────────────────────────────────────────────────────────

-- Figures read 2026-08-30:
--   US Information real value added  $514.3bn (2005 Q1) → $1,962.5bn (2026 Q1)
--     annual means: $1,066.1bn (2018), $1,496.4bn (2022), $1,840.4bn (2025)
--                                                                (fred.RVAI)
--   Private services-producing  $10,485.4bn (2005 Q1) → $17,664.6bn (2026 Q1)
--                                                              (fred.RVASPI)
--   World exports of computer services  $120,453m (2005) → $1,077,199m (2024)
--                                        (dbn.WTO.ITS_CS_AX6.000.SI2.000.A)
--   US cloud & data storage exports  $230m (2006) → $8,291m (2023)
--                                     (dbn.WTO.ITS_CS_AX6.840.SI221.000.A)
--
-- CHECK BEFORE ACTIVATING: both WTO series stop before the AI period is over —
-- world exports end 2024, US cloud exports end 2023. The answer must not imply
-- they cover 2025 or 2026.
('sector-output', 'sector-output',
 'Is the AI sector itself getting bigger?',
 'Value added and world trade in computer services',
 'Yes, and much faster than the economy around it — but it was already doing that before AI. Real output of the US information sector was $514bn in early 2005 and $1,963bn by early 2026, close to four times larger, while private services-producing industries grew by roughly seven tenths over the same period. World exports of computer services went from $120bn in 2005 to $1,077bn in 2024. What the series do not show is any acceleration after 2022: on annual averages the sector grew at least as fast in the four years before that as in the four years since. So the sector is large and growing and has been for two decades, which is a weaker statement than it first sounds.',
 'US real value added by industry for Information, read against private services-producing industries and real GDP, plus world exports of computer services from the WTO as an independent construction out of the trade statistics rather than the national accounts. The Information sector and the rest of private services are kept on separate charts: they share a unit but differ ninefold in level, and the automatic rebase triggers on axis share rather than on unit, so grouping them risks drawing the smaller line flat against the axis. The deeper limitation is the classification — NAICS Information carries publishing, film, broadcasting and telecommunications alongside data processing and software, and is a poor stand-in for anything that could be called the AI industry.',
 'This measures a sector, not a technology, and says nothing about whether anyone outside the sector benefited. A sector growing by selling to itself and to a handful of very large customers looks identical here to one transforming the economy around it. Both WTO series also stop before the period of interest closes — world exports end in 2024 and the US cloud series in 2023 — so neither sees the most recent two years at all.',
 'Before AI can raise anyone else''s output it has to raise its own. The information sector sells the compute, the software and the services, so if the boom is real in any economic sense the sector''s own value added and its exports should be growing faster than the economy it is supposedly transforming. This is the weakest version of the productivity claim and therefore the one most likely to be answerable — and if it failed, everything downstream of it would fail too.',
 'Two independent constructions of the same idea, one from the national accounts and one from the trade statistics, so a definitional artefact in either does not carry the finding. Growth rates are compared across equal-length windows before and after 2022 rather than read off endpoints.',
 'consistent', NULL, 'growth', 2, FALSE),


-- Figures read 2026-08-30:
--   UK output per hour, information & communication (index 2023=100), annual
--     means: 47.4 (2010), 66.1 (2017), 78.4 (2019), 90.6 (2021), 92.8 (2022),
--     105.4 (2025). Latest quarter 109.7 (2026 Q1)      (dbn.ONS.PRDY.DJR5.Q)
--   UK market sector, same base: 92.9 (2015 Q1), 96.6 (2019 Q4),
--     100.8 (2022 Q4), 99.3 (2026 Q1)                   (dbn.ONS.PRDY.GYY7.Q)
--   EU27 NACE J real labour productivity per hour (2015=100): 100.0 (2015),
--     110.1 (2019), 116.8 (2022), 117.9 (2024)
--                    (dbn.Eurostat.nama_10_lp_a21.A.I15.J.RLPR_HW.EU27_2020)
--
-- CHECK BEFORE ACTIVATING: the "faster before than after" claim is computed from
-- annual means over two four-year windows (2017-2021 and 2021-2025). 2026 holds
-- one quarter only and is excluded from that comparison — confirm that is still
-- true after the next ingestion, because a fuller 2026 could change it.
('exposed-productivity', 'exposed-productivity',
 'Does productivity rise where AI is used most?',
 'Output per hour in information and communication, against the whole economy',
 'The gap is enormous and it is not new, which is the problem. UK output per hour in information and communication rose from 47.4 in 2010 to 105.4 in 2025 on an index where 2023 is 100, while the whole UK market sector went from 92.9 in early 2015 to 99.3 in early 2026 — essentially flat across eleven years. The EU27 figure for the same sector tells the same story more slowly. But the sector''s rise did not steepen after 2022: on annual averages it was faster in the four years before than in the four years since, and the EU series slowed too. A gap that predates the technology by a decade cannot be evidence for the technology.',
 'UK output per hour for information and communication against the UK market sector, both from ONS, both indexed to 2023 = 100, so they share a unit and a base and belong on one axis. EU27 real labour productivity per hour for NACE J is included on its own chart as a check from a different statistical office with a different base year. The test is not whether the sector''s productivity is rising — it plainly is, and has been since long before 2022 — but whether the rate of rise changed, and quarterly index data on a decade-long trend is a poor instrument for detecting a break of the size AI would plausibly produce in three years.',
 'Productivity in information and communication is dominated by measurement problems unrelated to AI. Deflating software and telecommunications output is among the hardest problems in national accounting, and this sector''s measured productivity is unusually sensitive to those choices — which means the series most likely to show a spurious AI effect is precisely this one. Sector-level adoption also does not imply that the adopting firms are the productive ones.',
 'Aggregate productivity statistics cannot see AI because AI-using firms are a small fraction of the economy. But information and communication adopts AI at roughly three times the all-sector rate, so if the technology raises productivity anywhere it should raise it there first and most visibly. Comparing that sector''s output per hour with the whole market sector, in the same country and the same statistical series, differences out the macro shocks that hit both.',
 'A sector and its own economy from one statistical office on one base year, so the difference between the lines is not a splice. A second country from a second office as a check. Growth is compared across equal-length windows either side of 2022 rather than read off the endpoints.',
 'insufficient', NULL, 'growth', 3, FALSE),


-- ─────────────────────────────────────────────────────────────────────────────
-- LABOUR MARKETS
-- ─────────────────────────────────────────────────────────────────────────────

-- Figures read 2026-08-30:
--   US office & administrative employment, annual means of the monthly series
--     (thousands): 17,789 (2019), 15,558 (2020), 16,097 (2022), 15,954 (2023),
--     15,795 (2024), 16,444 (2025), 16,383 (2026 to July). Monthly 20,241
--     (Jan 2000)                                          (fred.LNU02032207)
--   ILO clerical support, US, ISCO-08 major group 4 (thousands): 16,322 (2003),
--     15,615 (2019), 12,328 (2021), 13,572 (2023)
--            (dbn.ILO.EMP_TEMP_SEX_OCU_NB.USA.BA_453.OCU_ISCO08_4.SEX_T.A)
--   US information-sector employment share: 2.71% (Jan 2000), 2.01% (Jul 2022),
--     1.75% (Jul 2026)             (derived.information_employment_share)
--
-- CHECK BEFORE ACTIVATING: whether the 2025 rise survives revision — it is the
-- most quotable thing on the page and the most likely to move. The monthly
-- series is read as annual averages throughout so that seasonal movement cannot
-- drive the reading; keep it that way if the prose is rewritten.
('clerical', 'clerical',
 'Has the work most like a language model''s actually gone?',
 'Office and administrative employment, counted two ways',
 'Not on this evidence, and the two ways of counting it disagree with each other. US office and administrative employment averaged 17.8 million in 2019, fell to 15.6 million in 2020, and has moved between 15.8 and 16.4 million since — with the 2025 average, 16.4 million, higher than 2022, 2023 and 2024. The ILO''s count of the same kind of work on the international occupational classification sits about two million lower and has a far deeper 2021 trough. Both show a long decline that began well before AI: the US series was above 20 million in 2000. Neither shows one accelerating.',
 'Two independent constructions of roughly the same occupational group on one chart: the US household survey''s office and administrative support series, monthly since 1990, and the ILO''s ISCO-08 major group 4 count for the United States, annual since 2003. They differ by around two million people, and showing that disagreement is the point of putting them together — an occupational boundary is a definition, and two statistical agencies drawing it differently is the honest measure of how much precision this question can bear. The monthly series is read as annual averages so that seasonal movement is not mistaken for trend. Information-sector employment share sits alongside as context on its own chart, on a different unit.',
 'Occupational counts cannot see task composition. A job can lose half its actual work to software and remain one employed person in these statistics, so a flat line here is fully consistent with substantial substitution inside the job. Nor can either series see hiring that never happened: an employer who quietly stops replacing leavers produces no signal until attrition accumulates, which takes years. Both series were also badly disrupted in 2020, which makes any trend estimated across that break fragile.',
 'If AI substitutes for tasks rather than for whole jobs, the occupations most exposed are the ones that are almost entirely those tasks — drafting, filing, scheduling, summarising, correspondence. Office and administrative support is the largest such group in any developed economy. It is the clearest single place to look for substitution, and an absence of effect there is meaningful in a way that its absence in aggregate employment is not.',
 'Two constructions of the same occupational group on one axis, chosen so that the disagreement between them is visible rather than resolved. The long series is used deliberately: the question is whether anything changed after 2022, which cannot be answered without knowing what the twenty years before looked like.',
 'contested', NULL, 'labour', 4, FALSE),


-- ─────────────────────────────────────────────────────────────────────────────
-- PRICES & MARKETS
-- ─────────────────────────────────────────────────────────────────────────────

-- Figures read 2026-08-30:
--   US share prices (index 2015=100): 62.87 (Jan 2000), 120.17 (Jun 2019),
--     139.73 (Jun 2022), 220.08 (Jun 2026)          (fred.SPASTT01USM661N)
--   SEC AI mention rate: 14.84% (2022) → 60.87% (2026 Q1)
--   US later-stage VC: peak $159.1bn (2021), $101.9bn (2025)
--
-- CHECK BEFORE ACTIVATING: nothing about the figures. Decide whether the page
-- is worth having at all. It is honest and it is thin, and the argument for it
-- is that a Prices & Markets lens with no question about expectations implies
-- the project thinks expectations do not matter. If a licensable sector index
-- becomes available, this page should be rebuilt around it rather than shipped.
('expectations', 'expectations',
 'What is the market paying for the story?',
 'Share prices, corporate disclosure and venture money',
 'These series cannot tell you, because the database holds no AI sector index — only the whole US market, which moves on interest rates and earnings and everything else at once. That index stood at 220 in June 2026 against a 2015 base of 100, up from 140 in June 2022. Over the same period the share of large US companies mentioning AI to their regulator went from 14.8 per cent to 60.9 per cent, and later-stage venture investment stayed below its 2021 peak throughout. Those are three facts that are all consistent with a large AI repricing and all consistent with none, and no arrangement of them separates the two.',
 'A broad US share price index as the anchor, read against the share of 10-K filings mentioning AI and against later-stage venture investment, on three charts because there are three units. The limitation is disqualifying for the strong version of the question and is stated as the answer rather than buried in a caveat: there is no AI sector index, no technology sub-index and no individual company prices here, because most free market-data providers forbid public redisplay. A whole-market index cannot be decomposed into the part that is a bet on AI. The OECD index is included at all because it is one of the few equity series licensed for public redisplay.',
 'A whole-market index cannot isolate AI, and over the period shown the same index also responded to a pandemic, the fastest tightening cycle in forty years and the easing that followed. Anyone reading an AI premium off this line is reading it into the line. The filings series counts mentions, not exposure — a company disclosing AI as a risk to its business and one disclosing it as its business are the same data point.',
 'Everything else in this dashboard measures what has happened. Asset prices measure what people believe is going to happen, which for a technology still in its investment phase is the only forward-looking evidence there is. If the market has repriced on AI, that repricing is a claim about future cash flows — and setting it beside what firms actually say and what capital actually does is the closest this project can get to asking whether the belief is supported.',
 'Three units, three charts, no shared axis and no attempt to decompose the index. The page is built to state what it cannot do, because a market-expectations page that implied more than that would be the least defensible thing on the site.',
 'insufficient', NULL, 'prices', 4, FALSE)


-- `is_active` and `last_reviewed` are deliberately NOT taken from EXCLUDED.
-- Re-running this seed after a question has been checked and activated must not
-- silently retire it, and must not reset the review date. The prose IS
-- overwritten, so a question rewritten in the database and not here will lose
-- the rewrite on the next seed run.
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug, question = EXCLUDED.question, subtitle = EXCLUDED.subtitle,
  answer_plain = EXCLUDED.answer_plain, answer_expert = EXCLUDED.answer_expert,
  caveat = EXCLUDED.caveat, theory = EXCLUDED.theory, method = EXCLUDED.method,
  strength = EXCLUDED.strength,
  lens_id = EXCLUDED.lens_id, sort_order = EXCLUDED.sort_order,
  is_active = questions.is_active, last_reviewed = questions.last_reviewed,
  updated_at = now();


-- ── The placements ──────────────────────────────────────────────────────────
--
-- Every indicator below already appears on another question. These are plain
-- inserts, not moves: the existing placement, and its caption, is untouched.
--
-- On `chart_group`: series are grouped where they belong on one pair of axes
-- editorially, and /api/series rebases when one would otherwise cover under a
-- tenth of the axis. Two exceptions are grouped apart on purpose and say so in
-- the comment above them — where the scale ratio sits near the rebase threshold,
-- and where the two series are on different frequencies, which a rebase does not
-- fix.

INSERT INTO question_indicators
  (question_id, indicator_id, role, sort_order, chart_group, country_iso3,
   caption_plain, caption_expert) VALUES

-- ── executive-action ────────────────────────────────────────────────────────
-- All three share a unit and a comparable scale, so one axis is honest.
('executive-action', 'derived.ai_presidential_documents', 'hero', 1, 'us-policy-type', 'USA',
 'Executive orders and presidential memoranda touching AI. These take days to issue and are the easiest thing on this chart for a successor to reverse.',
 'Federal Register Presidential Documents matched on the project''s six AI terms. Unilateral, immediate and binding only on the executive branch; the instrument of choice when the rulemaking timetable is too slow for the political one.'),

('executive-action', 'derived.ai_binding_rules', 'supporting', 2, 'us-policy-type', 'USA',
 'Rules actually in force. Slow to make, durable once made, and the only line here that creates a legal obligation.',
 'Final rules. Twelve to twenty-four months from proposal where a proposal existed, survives a change of administration, and carries compliance cost. The 2024 total is high enough that a single agency batch should be ruled out before it is interpreted.'),

('executive-action', 'derived.ai_proposed_rules', 'supporting', 3, 'us-policy-type', 'USA',
 'Proposals open for public comment. A proposal leads a rule by a year or two, where it converts at all.',
 'Notices of proposed rulemaking. Counted as an independent population rather than as a stage — see the rule-conversion question for why that distinction is forced on the data.'),

-- ── rule-conversion ─────────────────────────────────────────────────────────
('rule-conversion', 'derived.ai_proposed_rules', 'hero', 1, 'proposals-vs-rules', 'USA',
 'Rules proposed. Each opens a comment period; most take a year or more to become anything, and many become nothing at all.',
 'Notices of proposed rulemaking matched on six AI terms. No regulation identifier is ingested, so these rows cannot be joined to the rules they may have produced.'),

('rule-conversion', 'derived.ai_binding_rules', 'supporting', 2, 'proposals-vs-rules', 'USA',
 'Rules in force. This is the line that costs somebody money.',
 'Final rules on the same match and the same monthly basis. In 2024 this series exceeds the proposals series, which is direct evidence that the two are unlinked populations rather than stages of one pipeline.'),

('rule-conversion', 'derived.ai_regulation_volume', 'context', 3, NULL, 'USA',
 'Every AI-related document the Federal Register published, including notices and guidance. It runs about three times the two lines above put together — a reminder of how much regulatory paper is neither a proposal nor a rule.',
 'The superset, on its own chart specifically so it is not read as the sum of the plotted types. Notices, requests for information and guidance documents make up the difference.'),

-- ── policy-lag ──────────────────────────────────────────────────────────────
-- Four units, four charts. Nothing here shares an axis, and the comparison the
-- page makes is between turning points rather than between levels.
('policy-lag', 'derived.ai_regulation_volume', 'hero', 1, NULL, 'USA',
 'Every AI-related document the US Federal Register published each month, back to 1996.',
 'Six-term match, deduplicated on the government''s document number. The 2023 to 2024 step is large enough that a change in the prevalence of one search term would explain it, and that possibility has not been excluded.'),

('policy-lag', 'derived.sec_ai_mention_rate', 'supporting', 2, NULL, 'USA',
 'The share of large US companies mentioning AI in their annual report. Companies talk to investors before regulators talk to companies — or that is the claim being tested here.',
 '10-K filings matching "artificial intelligence" over total 10-K filings from the quarterly form index. The earliest-moving of the three series on this page and the one with the cleanest break.'),

('policy-lag', 'fred.A679RC1Q027SBEA', 'supporting', 3, NULL, 'USA',
 'US investment in information-processing equipment and software. If the reactive story is right, the money moves before the paperwork.',
 'BEA fixed investment, quarterly, seasonally adjusted annual rate, nominal. Shows no break at all over the relevant period — only a continuous rise — which is itself informative about how much can be read into timing here.'),

('policy-lag', 'derived.ai_presidential_documents', 'context', 4, NULL, 'USA',
 'Executive action, the fastest of the three policy instruments, shown separately because it is the one that could plausibly move before the rest.',
 'Included as the sharpest available test of the lag: if any policy instrument could lead rather than follow, it is this one.'),

-- ── dot-com ─────────────────────────────────────────────────────────────────
-- Grouped apart on purpose: the computers series is annual and the other two are
-- quarterly. A rebase fixes a scale mismatch, not a frequency one.
('dot-com', 'fred.A679RC1Q027SBEA', 'hero', 1, 'us-investment-bn', 'USA',
 'US investment in information-processing equipment and software, quarterly since 1990. Both booms are in this one line.',
 'BEA fixed investment, nominal, SAAR. The broadest of the three and the one that includes the most that has nothing to do with AI.'),

('dot-com', 'fred.B985RC1Q027SBEA', 'supporting', 2, 'us-investment-bn', 'USA',
 'The software half of it, on the same axis because it shares both the unit and the scale.',
 'BEA nonresidential intellectual property products: software. Expensed rather than capitalised in the firm''s own accounts, which is part of why an intangible investment boom depresses measured productivity before it raises it.'),

('dot-com', 'dbn.BEA.NIPA-T50505.B935RC-A', 'supporting', 3, NULL, 'USA',
 'Investment in computers and peripheral equipment, annual back to 1959. The narrowest of the three, and the one where the dot-com bust is unmistakable.',
 'NIPA table 5.5.5, annual, millions of current dollars. Kept off the quarterly axis because the frequency mismatch would misrepresent the timing of both peaks.'),

('dot-com', 'fred.GDPC1', 'context', 4, NULL, 'USA',
 'Real GDP, as the reminder that the economy is also far larger than it was in 2000 and that none of the lines above are scaled by it.',
 'Chained 2017 dollars. Present precisely because the investment series are nominal — the two cannot be divided here, and the page says so rather than doing it.'),

-- ── who-funds-it ────────────────────────────────────────────────────────────
('who-funds-it', 'fred.A679RC1Q027SBEA', 'hero', 1, 'funding-channels', 'USA',
 'Corporate capital spending on information processing and software — money out of operating cash flow rather than out of a fundraise.',
 'BEA fixed investment, nominal, SAAR. Rebased against the venture series so the comparison is between trajectories; the levels are not comparable and are not meant to be.'),

('who-funds-it', 'dbn.OECD.DSD_VC_DF_VC_INV.USA.VC_INV_MKT.LATER.USD_EXC.A', 'supporting', 2, 'funding-channels', 'USA',
 'US later-stage venture capital. This is the channel most people picture when they imagine an AI funding boom, which is exactly what makes its shape interesting.',
 'OECD venture capital investment, later stage, exchange-rate converted, annual to 2025. Excludes seed and early-stage rounds — a material gap given how much AI capital went into very large early rounds, and the first thing to verify before leaning on this series.'),

('who-funds-it', 'dbn.OECD.DSD_ANBERD_DF_ANBERDi4.USA.A.MA.J62_63.USD_PPP.V.B', 'supporting', 3, NULL, 'USA',
 'US business research spending in programming and IT services — money spent making the technology rather than buying it.',
 'OECD ANBERD, ISIC J62-63, current USD PPP-converted, annual to 2023. The slowest-reporting series on the page and the one least able to see recent years.'),

('who-funds-it', 'wb.GB.XPD.RSDV.GD.ZS', 'context', 4, NULL, 'USA',
 'Research spending as a share of GDP — the long-run backdrop against which any of this counts as a surge, or does not.',
 'World Bank, all R&D, all sectors. Far too broad to say anything about AI; included so the scale of the channels above can be judged against the economy''s total research effort.'),

-- ── sector-output ───────────────────────────────────────────────────────────
-- Value added is grouped apart on purpose: the two share a unit but differ
-- ninefold, which sits close enough to the automatic rebase threshold that the
-- smaller line could be drawn flat against the axis.
('sector-output', 'fred.RVAI', 'hero', 1, NULL, 'USA',
 'Real output of the US information sector. Close to four times its 2005 level, while the rest of private services grew by about seven tenths.',
 'BEA real value added by industry, chained 2017 dollars, quarterly. NAICS Information also carries publishing, film, broadcasting and telecommunications, so it overstates anything that could be called an AI sector.'),

('sector-output', 'fred.RVASPI', 'supporting', 2, NULL, 'USA',
 'Everything else in private services, on its own chart because it is nine times larger and would flatten the line above onto the axis.',
 'The comparison group. Shares the sector''s macro shocks, which is the point of using it rather than GDP alone.'),

('sector-output', 'dbn.WTO.ITS_CS_AX6.000.SI2.000.A', 'supporting', 3, 'computer-services-trade', NULL,
 'World exports of computer services — the same story told by the trade statistics rather than the national accounts, which is why it is worth having.',
 'WTO trade in commercial services, millions of current USD, annual to 2024. An independent construction from a different statistical system; rebased against the narrower series below.'),

('sector-output', 'dbn.WTO.ITS_CS_AX6.840.SI221.000.A', 'supporting', 4, 'computer-services-trade', 'USA',
 'US exports of cloud computing and data storage specifically — the narrowest series here that is unambiguously about renting compute.',
 'WTO code SI221, annual to 2023. Two orders of magnitude smaller than the world total, so the pair is rebased; the comparison is between growth rates, not levels.'),

('sector-output', 'fred.GDPC1', 'context', 5, NULL, 'USA',
 'Real GDP, so the sector''s growth is read against the economy rather than in isolation.',
 'Chained 2017 dollars, quarterly. The denominator the sector''s share would be taken against if this page took one, which it does not.'),

-- ── exposed-productivity ────────────────────────────────────────────────────
('exposed-productivity', 'dbn.ONS.PRDY.DJR5.Q', 'hero', 1, 'uk-sector-vs-economy', 'GBR',
 'UK output per hour in information and communication. It has roughly doubled since 2010 — and it was doing that long before anyone had heard of a large language model.',
 'ONS PRDY, SIC07 section J, index 2023 = 100, seasonally adjusted, to 2026 Q1. The most current productivity series in the project and the only UK route to sector productivity after Eurostat stopped covering Britain in 2019.'),

('exposed-productivity', 'dbn.ONS.PRDY.GYY7.Q', 'supporting', 2, 'uk-sector-vs-economy', 'GBR',
 'The whole UK market sector over the same period and on the same base year. Broadly flat. The gap between these two lines is the entire content of this page.',
 'Same publication, same base, same seasonal adjustment, so the difference between the two lines is not a splice or a definitional artefact.'),

('exposed-productivity', 'dbn.Eurostat.nama_10_lp_a21.A.I15.J.RLPR_HW.EU27_2020', 'supporting', 3, NULL, NULL,
 'The same sector across the EU27, from a different statistical office, as a check that the UK result is not an artefact of one agency''s method.',
 'Eurostat national accounts, NACE J, chain-linked index 2015 = 100, annual to 2024. Different base year, so it takes its own chart; it slows after 2022 in the same way the UK series does.'),

('exposed-productivity', 'dbn.Eurostat.isoc_eb_ain2.A.GE10.J62_J63.E_AI_TANY.PC_ENT.EU27_2020', 'context', 4, NULL, NULL,
 'Two thirds of Europe''s programming and consultancy firms now use AI. This is why this sector is the right place to look.',
 'Eurostat ICT usage survey, NACE J62-J63, enterprises with 10+ employees. Establishes that the exposure assumption behind this page is real rather than assumed; it does not establish that the adopting firms are the productive ones.'),

-- ── clerical ────────────────────────────────────────────────────────────────
('clerical', 'fred.LNU02032207', 'hero', 1, 'us-clerical', 'USA',
 'US office and administrative employment. It fell hard in 2020 and has drifted sideways since — not downwards, which is what the substitution story predicts.',
 'Current Population Survey occupational employment, thousands of persons, monthly. Read as annual averages on this page so that seasonal movement in an unadjusted monthly series is not mistaken for trend.'),

('clerical', 'dbn.ILO.EMP_TEMP_SEX_OCU_NB.USA.BA_453.OCU_ISCO08_4.SEX_T.A', 'supporting', 2, 'us-clerical', 'USA',
 'The same kind of work counted by the ILO on an international occupational classification. It sits about two million lower than the US series. Neither is wrong — they draw the boundary in different places, and the gap is a fair measure of how precise this question can get.',
 'ILO ISCO-08 major group 4, clerical support workers, United States, annual to 2023. Same unit as the series above, so they share an axis; the level difference is definitional and is the reason both are shown.'),

('clerical', 'derived.information_employment_share', 'context', 3, NULL, 'USA',
 'The information sector''s share of US employment, for contrast: this one really is falling — and has been since 2000, which is twenty-two years before anything relevant happened.',
 'Information-sector payrolls over total non-farm payrolls, monthly. On its own chart because it is a percentage. Included to keep the occupational reading honest: one exposed measure is flat and another is falling on a trend that long predates AI.'),

-- ── expectations ────────────────────────────────────────────────────────────
('expectations', 'fred.SPASTT01USM661N', 'hero', 1, NULL, 'USA',
 'US share prices. This is the whole market, not the AI part of it, and that limitation is the main thing this page has to say.',
 'OECD share price index for the United States via FRED, index 2015 = 100, monthly. Present because it is one of the few equity series licensed for public redisplay, not because it is the right instrument — the right instrument would be a sector index, and there is not one here.'),

('expectations', 'derived.sec_ai_mention_rate', 'supporting', 2, NULL, 'USA',
 'The share of large US companies mentioning AI to their regulator. Three in five now do, against one in two hundred a decade ago.',
 'A count of mentions, not of exposure: a company disclosing AI as a risk and one disclosing it as a product are the same data point. Rises far more smoothly than the index above, which is itself a reason not to read the two as one story.'),

('expectations', 'dbn.OECD.DSD_VC_DF_VC_INV.USA.VC_INV_MKT.LATER.USD_EXC.A', 'supporting', 3, NULL, 'USA',
 'Later-stage venture investment — private capital''s version of the same bet, and notably not at a record.',
 'OECD, US later stage, annual to 2025. The one series on this page whose peak is in 2021 rather than now, which is the most awkward fact available to anyone reading the others as an AI repricing.'),

('expectations', 'fred.PCU518210518210', 'context', 4, NULL, 'USA',
 'What renting compute actually costs, as the ground truth underneath the expectations.',
 'PPI for data processing, hosting and related services, index Dec 2000 = 100. The closest available proxy for a cloud price index; included so the page has at least one series measuring a realised price rather than a belief about one.')

ON CONFLICT (question_id, indicator_id) DO UPDATE SET
  role = EXCLUDED.role, sort_order = EXCLUDED.sort_order,
  chart_group = EXCLUDED.chart_group, country_iso3 = EXCLUDED.country_iso3,
  caption_plain = EXCLUDED.caption_plain, caption_expert = EXCLUDED.caption_expert;

-- ============================================================================
-- 025_more_questions.sql — twenty more drafted questions, none of them active
--
-- WHAT THIS FILE IS
--
-- Twenty new questions, taking every lens to seven or eight. It follows
-- `024_new_questions.sql` in every respect that matters: nothing here is
-- active, nothing here has been reviewed by a person, and every figure quoted
-- in the prose was read out of the database on 2026-08-30 with the query
-- recorded beside it.
--
-- WHERE THIS FILE DIFFERS FROM 024
--
-- 024 recombined series that already sat on another question. Most of this
-- file does the same, but one indicator appears on a question here for the
-- FIRST time, and getting it there required reversing an audit decision:
--
--   dbn.Eurostat.nrg_pc_205.…MWH20000-69999 EU electricity price, band IE,
--                                           37 half-years back to 2007
--
-- `007_corrections.sql` deactivated it as a duplicate of band IG. That is the
-- one call in 007 that does not hold, and the reversal — with the reasoning —
-- is at the foot of this file. The other four series 007 deactivated stay
-- deactivated and this file routes around them:
--
--   dbn.BEA.NIPA-T50605.B985RC-A    annual BEA software investment. A true
--                                   duplicate of fred.B985RC1Q027SBEA, which
--                                   is quarterly and two years fresher and
--                                   carries identical annual figures — I
--                                   checked: $65.5bn in 1995, $693.0bn in
--                                   2024, the same to a decimal place.
--                                   `software-not-steel` uses the FRED copy.
--   dbn.Eurostat.isoc_eb_ai.…       EU27 AI adoption. A true duplicate of the
--                                   OECD EU27 series, which is live, carries
--                                   an extra year and is used instead by
--                                   `diffusion-speed`.
--   dbn.IMF.PCPS.M.W00.PGOLD.USD    stale gold. Not used here.
--   derived.datacentre_investment   holds zero observations. Not used here.
--
-- Three report figures also MOVE. See the block at the foot of this file.
--
-- WHAT THE COUNTRY DIMENSION CANNOT DO
--
-- `question_indicators` keys on (question_id, indicator_id) and carries ONE
-- `country_iso3`. A 48-country World Bank series can therefore appear on a
-- question as exactly one country's line, not as a panel — the cross-country
-- pages in this project (`adoption`, `entry-level`) work by placing one
-- indicator per country, which only exists where the ingestion built one.
-- Two questions that were drafted as cross-country comparisons — where the
-- compute is being built, and which states fund research — were dropped for
-- this reason rather than shipped as a single country pretending to be a map.
-- They are in `docs/questions-proposal-2.md` under what could not be built.
--
-- NOTHING IN THIS FILE IS ACTIVE
--
-- `is_active = FALSE`, `last_reviewed = NULL`, for the reason 024 gives at
-- length: `answer_plain` is the site making a claim about the economy in its
-- own voice, and no such claim in this project is written by a model. The
-- worklist for the drafts is:
--
--   SELECT id, lens_id, sort_order, strength FROM questions
--    WHERE NOT is_active ORDER BY lens_id, sort_order;
--
-- The answers are written so that publishing one unchanged would still leave
-- it true. Where the series cannot settle the question the answer says so and
-- `strength` is `insufficient` — seven of the twenty are, against eight
-- `suggestive` and five `consistent`. Nothing here is `contested`: data
-- disagreeing across TIME is not contestation, and none of these twenty has
-- two sources disagreeing methodologically about the same period. `clerical`
-- in 024 does, which is what the label is for.
--
-- TO ACTIVATE ONE
--
--   UPDATE questions
--      SET is_active = TRUE, last_reviewed = CURRENT_DATE
--    WHERE id = 'chip-prices';
--
-- The conflict clause preserves `is_active` and `last_reviewed` as they stand
-- in the database, so re-seeding will not retire an activated question. It DOES
-- overwrite the prose.
--
-- WHAT HAS TO BE CHECKED FIRST
--
-- Three things run across several questions here:
--
--   1. 2026 IS A PART YEAR, AND IT IS A DIFFERENT PART IN EACH SERIES.
--      Federal Register series end 2026-08-01. Monthly FRED series end
--      2026-07-01. Quarterly national-accounts series end 2026 Q1 or Q2.
--      Every 2026 figure below is stated with the months it covers; check that
--      is still true after the next ingestion run, because the answer text will
--      not update itself.
--
--   2. SERIES THAT STOP BEFORE THE PERIOD OF INTEREST. Japan's BOJ price
--      indices end April 2024. The OECD productivity decomposition ends 2022.
--      US total factor productivity ends 2023. BEA data centre structures ends
--      2024. Four of these questions are built on a series that cannot see the
--      last two years, and each says so in its own caveat — check the end date
--      has not moved before rewriting any of them.
--
--   3. UK TOTAL FACTOR PRODUCTIVITY CARRIES FORECASTS. AMECO publishes
--      projections in the same series as outturns, and does not say which of
--      its own releases a figure came from. Revised 2026-09-03: this note used
--      to assert that 2025, 2026 and 2027 in `dbn.AMECO.ZVGDF.GBR.…` were all
--      Commission forecasts. Two of the three can be established — 2026 and
--      2027 have not happened, so nothing about them can be an outturn, and
--      seed 036 marks them `value_status = 'projected'`. The 2025 figure
--      cannot: it depends on the release vintage, which is not stored and
--      which DBnomics does not return. `total-factor-productivity` now says
--      exactly that. If the series is ever used on another page, it has to say
--      it there too.
--
-- Per-question checks are in the comment above each question.
-- ============================================================================


-- ── The questions ───────────────────────────────────────────────────────────
--
-- sort_order avoids the existing occupants of each lens, drafts included:
--   growth      adoption 1, sector-output 2, exposed-productivity 3,
--               productivity 4                                  → 5, 6, 7, 8
--   investment  money 2, dot-com 3, who-funds-it 4, building 5   → 6, 7, 8, 9, 10
--   labour      jobs 1, entry-level 2, vacancies 3, clerical 4   → 5, 6, 7, 8
--   prices      markets 1, power 2, materials 3, expectations 4  → 5, 6, 7, 8
--   regulation  policy 6, executive-action 7, rule-conversion 8,
--               policy-lag 9                                     → 10, 11, 12

INSERT INTO questions (id, slug, question, subtitle, answer_plain, answer_expert,
                       caveat, theory, method, strength, last_reviewed,
                       lens_id, sort_order, is_active) VALUES


-- ─────────────────────────────────────────────────────────────────────────────
-- GROWTH & PRODUCTIVITY
-- ─────────────────────────────────────────────────────────────────────────────

-- Figures read 2026-08-30, base year re-read 2026-09-03:
--   US TFP (index 2021=1, annual): 0.809 (1990), 0.964 (2019), 1.000 (2021),
--     0.984 (2022), 0.993 (2023) — series ends 2023 (fred.RTFPNAUSA632NRUG)
--     The base is 2021, not 2017: 2021 reads exactly 1 and 2017 reads 0.9534.
--     The unit said 2017 until 2026-09-03; see the note in seed 004.
--   UK TFP (index 2020=100, annual): 93.31 (2007), 95.69 (2019), 100.0 (2020),
--     94.50 (2021), 97.24 (2022), 96.10 (2024), 95.96 (2025), 96.29 (2026),
--     96.77 (2027)                    (dbn.AMECO.ZVGDF.GBR.3.0.0.0.ZVGDF)
--   US output per hour (2017=100): 103.6 (2019), 119.8 (2026 H1) (fred.OPHNFB)
--     select date_trunc('year', period_start)::date yr, avg(value)
--       from observations where indicator_id = '…' group by 1 order by 1;
--
-- CHECK BEFORE ACTIVATING: that 2026 and 2027 in the AMECO series are still
-- unfinished years carrying Commission forecasts rather than outturns, and
-- that 2025 has not moved. The whole point of including the UK is that its TFP
-- has not moved; if the forecast years are replaced by measurements that show
-- movement, this page changes. Seed 036 marks the unfinished years projected
-- and explains why 2025 cannot be classified either way.
('total-factor-productivity', 'total-factor-productivity',
 'Is there anything left over?',
 'Total factor productivity, where a general-purpose technology should appear',
 'Not yet, and the two series that could show it both stop short. Total factor productivity is what is left after more workers and more machines have been accounted for — the part of growth that comes from using the same inputs better, which is exactly what a general-purpose technology is supposed to deliver. US total factor productivity was 0.964 in 2019 and 0.993 in 2023 on an index where 2021 is 1, a rise of three per cent over four years, and the series ends there. UK total factor productivity was 95.7 in 2019 and 96.0 in 2025 on a 2020 base — no growth in six years — and the two points after it, 2026 and 2027, are European Commission projections rather than measurements, because neither year has ended. AMECO mixes forecasts into the same column as outturns and publishes no release vintage, so whether the 2025 figure is already a forecast is not something this database can tell you. Output per hour has risen much faster than either, which is what more capital per worker looks like rather than what better use of it looks like.',
 'Two national total factor productivity series from two statistical traditions — Penn World Table for the United States via FRED, AMECO for the United Kingdom — each on its own chart, because they have different base years and different base values and nothing is gained by forcing them together. US output per hour and the OECD''s PPP-converted level of GDP per hour sit alongside as the labour-productivity comparison, which is the measure that moves when capital deepens. The method''s central weakness is the residual itself: total factor productivity is not measured, it is computed as whatever growth the measured inputs do not explain, so every error in the capital stock enters it with the opposite sign. Reading a flat residual as evidence of no technological effect assumes the inputs were counted correctly, and in an intangible-heavy boom that is the assumption most likely to fail.',
 'Total factor productivity absorbs mismeasurement. If firms are buying capital the national accounts capitalise incompletely — models, data, trained staff — the measured capital stock is too small, and the residual that is supposed to capture the technology gets attributed to capital instead. That biases this page towards finding nothing, and it biases it in exactly the period where the claim is being made. The 2020 and 2021 values in both series are also dominated by pandemic composition rather than by technology: low-productivity jobs disappearing raises measured productivity, and any window spanning those years inherits that.',
 'Every other productivity measure in this dashboard can be raised by simply using more of something. Output per hour rises when a firm buys machines; value added rises when a sector sells more. Total factor productivity is the residual designed to strip those out — it is the number that moves only when the same labour and the same capital start producing more. It is the strictest available test of whether a technology has changed anything, and it is the number the Solow paradox was originally about.',
 'Two countries, two statistical offices, two constructions of the same concept, kept on separate charts because their bases differ. Labour productivity is shown next to them deliberately: the gap between a rising output-per-hour series and a flat residual is the page''s actual content, because that gap is what capital deepening looks like.',
 'insufficient', NULL, 'growth', 5, FALSE),


-- Figures read 2026-08-30, both annual, both ending 2022:
--   ICT capital contribution to US labour productivity growth (pp):
--     0.527 (1985), 1.021 (1999), 0.376 (2004), 0.214 (2015), 0.335 (2019),
--     0.232 (2021), 0.305 (2022)
--             (dbn.OECD.DSD_PDB_DF_PDB_GR.USA.A.ICTHRS_PCCONLP._T.PD.V.GOY…)
--   Software contribution to US total capital growth (pp):
--     0.565 (1985), 1.488 (1999), 0.296 (2003), 1.021 (2019), 1.282 (2021),
--     1.493 (2022)   (dbn.OECD.DSD_PDB_DF_PDB_GR.USA.A.SOFT_PCCONK._T.PD…)
--   US software investment: $447.4bn (2019) → $806.1bn (2026 H1)
--                                                    (fred.B985RC1Q027SBEA)
--
-- CHECK BEFORE ACTIVATING: whether OECD has extended either series past 2022.
-- If it has, this page stops being a historical benchmark and becomes a test,
-- and the answer has to be rewritten around the new years rather than around
-- the absence of them.
('computer-dividend', 'computer-dividend',
 'How much did computers ever add?',
 'What the last general-purpose technology contributed, decomposed',
 'About one percentage point of productivity growth a year, at the very peak, and a third of that lately. The OECD''s decomposition puts the contribution of ICT capital to US labour productivity growth at 1.02 percentage points in 1999 and 0.31 in 2022. Over the same period software''s contribution to the growth of the US capital stock went the other way: 1.49 percentage points in 1999, 0.30 in 2003, and 1.49 again in 2022, matching the dot-com peak. That is the productivity paradox stated in two numbers from one dataset — capital is flowing into software at the rate it did at the height of the last boom, and the productivity that flow delivers is a third of what it was then. Both series end in 2022, so neither has seen a single year of the generative-AI period.',
 'Two series from the OECD Productivity Database, both annual from 1985 to 2022, on separate charts because their denominators differ: one is percentage points of labour productivity growth, the other percentage points of total capital growth. They are not two views of the same quantity and are not drawn as though they were. US software investment from the national accounts sits alongside as the raw flow the second series decomposes. The decomposition rests on a growth-accounting framework with an assumed production function and a measured ICT capital stock built from investment series and assumed service lives — none of which is neutral. If software capital is overstated, the contribution to capital growth is overstated and the residual productivity contribution is understated, which is precisely the pair of errors that would manufacture the paradox this page describes.',
 'Both series stop in 2022, which is the first thing a reader should take from this page and the reason it cannot be used to argue anything about AI. What it can do is set the benchmark: one percentage point a year was what the last computing revolution delivered at its best, so a claim that AI will transform growth is a claim about clearing a bar the personal computer only briefly reached. The decomposition also credits capital with whatever the capital stock says it is worth, and quality-adjusted price indices for software are among the least settled numbers in national accounting.',
 'Every argument about AI and growth is implicitly an argument about magnitude, and almost none of them state one. The last time a general-purpose computing technology diffused through the economy, growth accounting measured what it contributed — so there is a number to compare against rather than a feeling. If AI is bigger than the personal computer, it has to beat roughly one percentage point of labour productivity growth a year, sustained. That is the bar, and it was cleared for about four years.',
 'One statistical office, one framework, one country, so the two contributions are computed on consistent assumptions and the comparison between the 1999 peak and the 2022 reading is not a splice. The charts are kept apart because the two series divide by different things.',
 'insufficient', NULL, 'growth', 6, FALSE),


-- Figures read 2026-08-30:
--   World internet users (% of individuals): 15.6 (2005), 28.4 (2010),
--     39.9 (2015), 53.9 (2019), 73.6 (2025)      (wb.IT.NET.USER.ZS, WLD)
--   OECD firms 10+ using AI (%): 5.62 (2020), 8.06 (2022), 8.73 (2023),
--     14.28 (2024), 20.30 (2025)
--                  (dbn.OECD.DSD_ICT_B_DF_BUSINESSES.OECD.A.G14_B.PT_ENT._T…)
--   Same, information & communication: 14.43 (2020), 28.65 (2023),
--     45.76 (2024), 57.51 (2025)
--   Same, EU27 aggregate: 5.98 (2020), 7.65 (2021), 8.06 (2023), 13.48 (2024),
--     19.95 (2025)
--                  (dbn.OECD.DSD_ICT_B_DF_BUSINESSES.EU27.A.G14_B.PT_ENT._T…)
--   EU27 manufacturers using AI (%): 6.93 (2021), 6.79 (2023), 10.57 (2024),
--     17.27 (2025)          (dbn.Eurostat.isoc_eb_ain2.manufacturing)
--
-- CHECK BEFORE ACTIVATING: whether the survey question behind the OECD and
-- Eurostat adoption series changed between the 2023 and 2024 waves. All four
-- enterprise series roughly double in that one year. If the questionnaire was
-- revised, the comparison this page makes is against a break rather than
-- against a trend.
('diffusion-speed', 'diffusion-speed',
 'Is AI spreading faster than the internet did?',
 'Two diffusion curves, and why they cannot be laid on top of each other',
 'Not obviously, and the comparison is not clean enough to insist on. Internet use among individuals worldwide went from 15.6 per cent in 2005 to 28.4 per cent in 2010 — 12.8 points in five years. AI use among OECD firms with ten or more employees went from 5.6 per cent in 2020 to 20.3 per cent in 2025 — 14.7 points in five years. Those are close enough that the honest answer is "about the same, on measures that are not the same". One counts people and the other counts firms; a firm where one team uses a chatbot is a yes in these surveys, as is a firm that has rebuilt itself around the technology. What the enterprise data does show clearly is the spread inside it: 57.5 per cent of information and communication firms in 2025, against 17.3 per cent of European manufacturers — the same technology four or five years apart depending on where you look.',
 'World internet penetration from the World Bank against four enterprise AI adoption series — the OECD aggregate for firms with ten or more employees, the same for information and communication, the same for the EU27, and Eurostat''s count for European manufacturers. All four are the same measure on different populations, share a unit, and sit on one axis. Internet penetration takes its own chart: it is a different population on a different definition, and putting the two together would suggest a comparability the page spends its caveat denying. EU cloud purchasing sits alongside as the most recent enterprise technology to have diffused far enough to be measured through. The comparison is between five-year gains at similar points on each curve rather than between levels, because the curves start in different decades and the level of a diffusion curve is mostly a statement about when it started.',
 'The two populations are not comparable and no arrangement of them makes them so. Individual internet use is a binary about a person; enterprise AI use is a binary about an organisation, self-reported, with a threshold the respondent chooses. Every one of the enterprise series also roughly doubles between 2023 and 2024, which is a large enough break in an annual survey that a change in the wording of the question would explain it — and nothing in the data can exclude that.',
 'A diffusion curve is the most reliable regularity in the economics of technology: the S-shape recurs across electricity, the telephone, the personal computer and the internet, and its slope is what determines whether an economy has years or decades to absorb a shock. If AI is diffusing faster than anything before it, the labour-market adjustment problem is qualitatively different from every previous one. If it is diffusing at the ordinary pace, the historical analogies apply and the urgency is rhetorical.',
 'Populations that cannot be reconciled are kept on separate charts and the mismatch is stated as the finding rather than buried. Five-year gains are compared at comparable points on each curve rather than endpoints, because a diffusion curve read from its endpoints tells you when it started, not how fast it moved.',
 'insufficient', NULL, 'growth', 7, FALSE),


-- Figures read 2026-08-30, all annual, NBS via DBnomics:
--   Software & IT services income: 482,322,235 (2016) → 1,548,310,000 (2025),
--     in tens of thousands of yuan — i.e. ¥4.82tn → ¥15.48tn
--                                            (dbn.NBS.A_A0G11.A0G1101)
--   IT sector urban-unit employment: 364.07 (2016) → 553.40 (2024), in tens of
--     thousands of persons — 3.64m → 5.53m; 2025 is NULL
--                                            (dbn.NBS.A_A0406.A040608)
--   IT sector average wage: ¥122,478 (2016) → ¥238,966 (2024); 2025 is NULL
--                                            (dbn.NBS.A_A040I.A040I08)
--   Integrated circuit output: 13,179,500 (2016) → 48,428,000 (2025), in tens
--     of thousands of units — 132bn → 484bn   (dbn.NBS.A_A0E0H.A0E0H28)
--
-- CHECK BEFORE ACTIVATING: the unit multipliers. Three of these four series are
-- denominated in tens of thousands and the fourth is not, and the prose
-- converts all of them. Re-derive each conversion from `indicators.unit` before
-- publishing — a misplaced factor of ten thousand is the most likely error on
-- this page and the hardest for a reader to catch.
('china-mirror', 'china-mirror',
 'Does the boom show up in China''s own numbers?',
 'The sector, the wage and the chips, from the National Bureau of Statistics',
 'Yes, and it was already happening in 2016. Revenue of China''s software and information technology services industry rose from ¥4.8 trillion in 2016 to ¥15.5 trillion in 2025, a little over three times. Employment in information transmission, software and IT services in urban units went from 3.64 million in 2016 to 5.53 million in 2024. Average annual pay in the same sector went from ¥122,478 to ¥238,966 across those eight years, a rise of 95 per cent in nominal yuan with nothing here to deflate it and no other Chinese wage series to compare it against. Integrated circuit output went from 132 billion units to 484 billion. Every one of these was already on this path before generative AI existed, which is the point of showing them together: a sector compounding for a decade does not become evidence for something that arrived in the middle of it.',
 'Four National Bureau of Statistics series through DBnomics, each on its own chart because each has a different unit — revenue in tens of thousands of yuan, employment in tens of thousands of persons, wages in yuan a year, chip output in tens of thousands of units. Nothing shares an axis. The revenue and output series run to 2025; the employment and wage series carry a null for 2025 and effectively end in 2024. The essential limitation is the sampling frame rather than the numbers: NBS urban-unit statistics cover formally registered urban employers, which in this sector means state-owned enterprises and large private firms, and understate the smaller and less formal end. So the wage series describes pay in the large-firm segment of a sector, not pay in the sector.',
 'None of these four series is about AI. They are about software, IT services, and semiconductor manufacturing, all of which China was expanding aggressively before 2022 under an explicit industrial policy. All are nominal, and the wage series in particular has no comparator — a 95 per cent nominal rise over eight years is not evidence that IT pay outran the rest of the Chinese economy, because this database holds no Chinese wage series for the rest of the economy to check it against.',
 'Almost everything else in this dashboard is American or European, which makes the whole project vulnerable to describing an American boom and calling it a phenomenon. China is the second place where the compute, the chips and the software actually are, and its statistical agency publishes the sector directly. If the boom is global it should be visible in a national statistical system that has no reason to construct it the way the Western ones do.',
 'One statistical office, four series, four charts. The window starts in 2016 because that is where the series start, and the length of the window is the argument: the question is not whether these lines are rising but whether anything happened to them after 2022, and that cannot be seen without the years before.',
 'consistent', NULL, 'growth', 8, FALSE),


-- ─────────────────────────────────────────────────────────────────────────────
-- INVESTMENT & CAPITAL
-- ─────────────────────────────────────────────────────────────────────────────

-- Figures read 2026-08-30:
--   Data centre structures ($m, annual): 9,231 (2020), 9,947 (2021),
--     12,583 (2022), 19,995 (2023), 31,141 (2024) — five observations, ends 2024
--                                     (dbn.BEA.NIPA-T50405.LA001282-A)
--   Manufacturing construction, annual means of the monthly SAAR ($m):
--     81,949 (2021), 124,582 (2022), 202,151 (2023), 244,093 (2024),
--     215,365 (2025), 178,379 (2026 Jan-Jun)          (fred.TLMFGCONS)
--   US announced/operational data centre capacity (MW, cumulative):
--     105.5 (2021), 213.8 (2022), 386.6 (2023), 1,299.8 (2024), 1,945.9 (2025)
--                                   (derived.datacentre_capacity_mw, USA)
--
-- CHECK BEFORE ACTIVATING: that the manufacturing construction series is still
-- seasonally adjusted at an ANNUAL RATE. The 2026 figure is the mean of six
-- monthly annualised rates, which is comparable with a full prior year only
-- because of that. If the series ever changes basis, the 2026 comparison breaks
-- silently.
('the-buildings', 'the-buildings',
 'What is the concrete actually costing?',
 'Data centre structures against the other construction boom',
 'Thirty-one billion dollars in 2024, up from nine billion in 2020. US private fixed investment in data centre structures is the most direct dollar measure of the build-out that the national accounts contain, and it went $9.2bn, $9.9bn, $12.6bn, $20.0bn, $31.1bn across 2020 to 2024 — three and a half times in four years. It is also five annual observations that end in 2024, so it cannot see the period in which the largest announcements were made. The other construction boom has already turned: US manufacturing construction spending averaged $82bn in 2021, peaked at $244bn in 2024, and ran at $178bn through the first half of 2026, a quarter below its peak. Documented US data centre capacity, meanwhile, went from 214 megawatts in 2022 to 1,946 in 2025.',
 'Four series and four charts, because nothing here shares a unit and a frequency. BEA data centre structures is annual, in millions of current dollars, with five observations. Census manufacturing construction is monthly at a seasonally adjusted annual rate, so its annual figures are means of annualised rates and a part-year mean is comparable with a full year — which is what makes the 2026 half-year usable at all. Capacity in megawatts is a cumulative stock aggregated from documented sites, not a flow. The structures series is the load-bearing one and it is the weakest: five points, ending two years before the present, counting buildings rather than the servers inside them — and the servers are the larger share of the cost, so this series measures the smaller half of the build-out.',
 'BEA''s data centre structures line counts every corporate server room, not only hyperscale sites, and counts only the shell — the computing equipment inside is capitalised elsewhere in the accounts and is much the larger number. The manufacturing construction series is not a comparison group in any clean sense: it covers all manufacturing plant, and much of its 2022 to 2024 rise coincides with the CHIPS Act subsidy programme, which is a policy response to a supply-chain shock rather than a market response to AI demand. Capacity in megawatts is documented capacity, so it rises when disclosure improves as well as when concrete is poured.',
 'Every other measure of this boom is a promise: an announcement, a commitment, a memorandum of understanding. A building is not. Construction spending is recorded when the money is actually laid out, which makes it the hardest available evidence that the announced capital exists — and the point at which a capital cycle turns shows up in construction before it shows up anywhere else, because construction is the part that cannot be cancelled quietly.',
 'The two construction series are kept apart: one is annual current dollars, the other monthly annualised, and a shared axis would misrepresent both the level and the timing. Capacity is included as the physical counterpart to the dollars, on its own chart, with its own undercounting stated rather than netted out.',
 'suggestive', NULL, 'investment', 6, FALSE),


-- Figures read 2026-08-30, annual means of the monthly series:
--   New orders, computers & electronic products ($m):
--     36,279 (2000), 20,360 (2015), 23,354 (2021), 24,988 (2022),
--     25,480 (2024), 26,571 (2025), 29,617 (2026 Jan-Jun)   (fred.A34SNO)
--   Industrial production, computer & electronic (2017=100):
--     110.3 (2021), 117.0 (2022), 116.6 (2023), 118.3 (2024), 126.8 (2025),
--     135.4 (2026 to Jul)                                  (fred.IPG334S)
--   Total industrial production (2017=100): 99.3 (2021), 101.0 (2022),
--     100.1 (2024), 102.2 (2026 to Jul)                    (fred.INDPRO)
--
-- CHECK BEFORE ACTIVATING: the new-orders series is nominal and the answer says
-- so, but confirm nobody has since added a deflator to the project — if a
-- producer price series for the same industry can be used to deflate it, the
-- comparison with 2000 becomes possible and the answer changes.
('orders-and-output', 'orders-and-output',
 'Are the factories busy?',
 'Orders and production for computers and electronics',
 'Production yes, orders less so. US industrial production of computers and electronic products rose from an index of 110.3 in 2021 to 135.4 over the first seven months of 2026, while total US industrial production went from 99.3 to 102.2 on the same base — the sector grew by roughly a quarter while American industry as a whole, manufacturing and mining and utilities together, grew by three per cent. New orders are flatter: they averaged $29.6bn a month in the first half of 2026 against $36.3bn a month in 2000, and those are nominal dollars twenty-six years apart, so in real terms the order book for American computer and electronics manufacturing has not been back to its dot-com peak at any point in this boom.',
 'Two US series on separate charts because one is an index and the other is dollars: the Federal Reserve''s industrial production index for computer and electronic product manufacturing, read against total industrial production on the same base, and Census new orders for the same industry, monthly and nominal. The producer price index for semiconductors sits alongside as the price counterpart. The geographic limitation is the one that matters: an American industrial production index measures what is made in America, and most of the semiconductors in an American data centre are not. Taiwanese and Korean fabrication does not appear anywhere in this page, which means a rising line here is consistent with the US share of the industry falling.',
 'The industry classification is far broader than anything that could be called AI hardware — phones, medical devices, navigation and defence electronics all sit inside it. The orders series is nominal and undeflated, which is why the comparison with 2000 is made in the direction that survives it. And industrial production indices are constructed from a mix of physical output and deflated value, so in an industry whose product doubles in capability without doubling in price, the index depends heavily on quality adjustments the published series does not expose.',
 'A boom in demand for computing hardware should be visible in the factories that make it before it is visible anywhere else. Orders lead production, production leads shipments, and both are measured monthly by agencies with no interest in the outcome. If the capital being announced is real, this is where it becomes physical — and if orders were rolling over while announcements continued, that gap would be the earliest available warning.',
 'The sector is compared with total industrial production from the same publication on the same base, so the difference between the two lines is not an artefact of two different index constructions. Orders are kept on their own chart in dollars and read only as a within-series comparison over time.',
 'consistent', NULL, 'investment', 7, FALSE),


-- Figures read 2026-08-30. The two quarterly series are annual means; the
-- computers series is annual as published.
--   Software ($bn): 65.5 (1995), 156.8 (2000), 157.7 (2001), 152.5 (2002),
--     155.0 (2003), 447.4 (2019), 693.0 (2024), 806.1 (2026 H1)
--                                            (fred.B985RC1Q027SBEA)
--   All information-processing equipment & software ($bn): 253.8 (1995),
--     450.6 (2000), 423.6 (2001), 389.3 (2002), 397.7 (2003), 445.6 (2005),
--     852.7 (2019), 1,194.1 (2024), 1,584.7 (2026 H1)  (fred.A679RC1Q027SBEA)
--   Computers & peripherals ($m): 103,178 (2000), 87,556 (2001), 84,175 (2004),
--     118,902 (2019), 160,258 (2022), 149,064 (2023), 178,731 (2024)
--                                     (dbn.BEA.NIPA-T50505.B935RC-A)
--
-- NOTE ON THE SOFTWARE SERIES: the annual BEA copy of it,
-- dbn.BEA.NIPA-T50605.B985RC-A, is deactivated by 007 as a duplicate and that
-- is correct — its annual values match the FRED quarterly copy exactly. The
-- FRED copy is used here and runs two years further.
--
-- CHECK BEFORE ACTIVATING: nothing about the figures — but decide whether the
-- own-account software point belongs in the caveat or in the answer. It is the
-- single largest reason the software line might be overstating itself, and it
-- is currently in the caveat where fewer readers will reach it.
('software-not-steel', 'software-not-steel',
 'Is the money going into machines, or into code?',
 'What survived the last bust, and what did not',
 'Into code, and it is now about half of the total. US private fixed investment in software was $65bn in 1995, $693bn in 2024 and $806bn in the first half of 2026 — against $1,585bn for all information-processing equipment and software together. Investment in computers and peripheral equipment was $179bn in 2024. But the level is not the interesting part; the last bust is. Total information-processing investment fell from $451bn in 2000 to $389bn in 2002 and did not regain its 2000 level until 2005. Computer and peripheral investment fell from $103bn in 2000 to $88bn in 2001 and was still $84bn in 2004. Software investment across the same years went $156.8bn, $157.7bn, $152.5bn, $155.0bn — a fall of three per cent — and then carried on. One of these is a capital good firms stop buying when times are bad. The other is mostly the salaries of people who stay employed.',
 'Software investment and total information-processing investment share a unit, a frequency and a publication, so they sit on one axis and the share of the total that is software can be read directly off the chart. Investment in computers and peripheral equipment takes its own chart: it is annual rather than quarterly and denominated in millions rather than billions, and a frequency mismatch is not something a rebase fixes. All three are nominal, which limits comparison across three decades but not the comparison between them within a year — and that within-year comparison is what the page is built on. The construction of the software series is the thing to understand before reading it: a large share is own-account software, which the BEA estimates from the compensation of the programmers who wrote it plus intermediate inputs, because there is no transaction to observe. A rise in software wages raises measured software investment directly.',
 'All three series are nominal, so any statement about levels across decades is partly about the dollar. More seriously, the software series is estimated rather than observed for its own-account component: it moves with programmer pay whether or not more software was produced, and programmer pay rose sharply over exactly the years this page covers. That biases the headline in the direction the headline goes. None of the three is AI-specific, and all include a great deal — payroll systems, enterprise resource planning, telephony — that has nothing to do with it.',
 'The composition of a capital boom tells you what happens when it ends. A boom in physical equipment leaves a stock of machines that has to be written down and a supply chain that has to shrink; a boom in software leaves people who can be redeployed and code that costs nothing to keep. Which of the two this is determines whether an AI bust looks like 2001 in the semiconductor industry or like 2001 in the software industry, and those were very different events.',
 'The two series that share a unit and a frequency share an axis, so the composition is visible rather than computed for the reader. The 1990 start is deliberate: the claim is about how the parts behave through a cycle, which needs a cycle inside the window.',
 'consistent', NULL, 'investment', 8, FALSE),


-- Figures read 2026-08-30:
--   EU27 ICT equipment investment (chain-linked index, 2015=100):
--     117.9 (2019), 116.9 (2020), 124.5 (2021), 131.8 (2024)
--                            (dbn.Eurostat.nama_10_an6.ict_equipment)
--   EU27 intellectual property products (chain-linked, 2015=100):
--     107.9 (2018), 131.4 (2019), 120.7 (2021), 134.6 (2023), 131.0 (2024)
--                   (dbn.Eurostat.nama_10_an6.A.CLV_I15.N117G.EU27_2020)
--   EU27 business R&D in ICT services (€m): 24,658 (2019), 28,066 (2021),
--     35,119 (2023)   (dbn.Eurostat.rd_e_berdfundr2.A.TOTAL.G-U_ICT.MIO_EUR…)
--   US business R&D, programming & IT services (USD PPP): 53.6bn (2019),
--     79.8bn (2023)   (dbn.OECD.DSD_ANBERD_DF_ANBERDi4.USA.A.MA.J62_63…)
--   US info-processing investment ($bn, annual means): 852.7 (2019),
--     1,194.1 (2024)                              (fred.A679RC1Q027SBEA)
--
-- CHECK BEFORE ACTIVATING: the 2018→2019 jump in the EU intellectual property
-- series, +22% in one year, most of it given back by 2021. That is the shape a
-- single multinational relocating intangible assets between member states
-- produces. If it is that, the series should be dropped from this page rather
-- than caveated on it.
('is-europe-in-this', 'is-europe-in-this',
 'Is Europe in this at all?',
 'European capital and research spending against American',
 'On research spending, yes. Business research spending in EU information and communication services rose from €24.7bn in 2019 to €35.1bn in 2023, up 42 per cent; the American equivalent for computer programming and information services went from $53.6bn to $79.8bn, up 49 per cent. Those growth rates are close, and the gap between them is smaller than the story of European irrelevance implies. On capital equipment the honest answer is that these series cannot say. EU investment in ICT equipment is published as a chain-linked volume index and is up 12 per cent between 2019 and 2024; the American series is nominal dollars and is up 40 per cent over the same years. A real index and a nominal series cannot be differenced, and how much of the difference between 12 and 40 is the price level is not recoverable here.',
 'Four series and no shared axis with a like-for-like counterpart, which is the page''s difficulty rather than a design choice. The two EU capital series share a base year and a construction and sit on one chart; the two research series are in different currencies and take their own charts; American fixed investment sits on its own in dollars. The comparison the page can actually make is between growth rates in the two research series, both of which are nominal in their own currency and neither of which is deflated, so it is a comparison of nominal growth in two economies with different inflation over the period. The comparison it cannot make is the capital one, and that is stated in the answer rather than attempted.',
 'A chain-linked volume index and a nominal dollar series measure different things, and the entire capital half of this question turns on a difference between them that this database cannot decompose. The EU intellectual property series is also unreliable at exactly the frequency the page reads it: it jumps 22 per cent between 2018 and 2019 and gives most of it back by 2021, which is the signature of intangible assets being moved between member states by a small number of multinationals rather than of European firms investing.',
 'The AI build-out is discussed as an American event, and if that is right it is the largest divergence in technological capability between the two economies since the 1990s. But most of the evidence offered for it is company news rather than statistics, and the European statistical system publishes its own capital and research accounts. If Europe is genuinely absent, the absence should be visible in what European firms spend, not only in which firms are famous.',
 'Series are only compared where the basis allows it, which here means the two research series and not the two capital series. The page states which comparison it is declining to make and why, because making it anyway would produce a headline number that is mostly an artefact of deflation.',
 'insufficient', NULL, 'investment', 9, FALSE),


-- Figures read 2026-08-30 (Epoch AI, irregular dates, largest known run):
--   8.74e21 (2018-05-02), 1.12e23 (2020-01-28), 2.578e24 (2022-03-15),
--   2.1e25 (2023-03-15), 5.0e25 (2023-12-06), 3.5e26 (2025-02-17),
--   5.0e26 (2025-07-09) — nothing after July 2025
--                                    (epoch.training_compute_frontier)
--   Documented US large GPU clusters: 12 (2020), 20 (2021), 11 (2022),
--     18 (2023), 31 (2024), 5 (2025)      (epoch.gpu_cluster_count, USA)
--
-- GROWTH RATES RECOMPUTED 2026-09-03, because the answer was quoting a rate its
-- own two endpoints do not produce. Compounded between the named observations,
-- exact dates from the table above:
--   2022-03-15 → 2025-07-09: 1,212 days (3.318 y), ×193.95 → 4.89 a year
--   2018-05-02 → 2022-03-15: 1,413 days (3.869 y), ×294.83 → 4.35 a year
-- The answer said "roughly four and a half times a year" for the first of those
-- and called the second "the same pace". It is 4.89 against 4.35 — the later
-- window is about 12 per cent faster per year. The finding survives (a tenth
-- faster is a continuation, not an acceleration) but the numbers had to change
-- to state it. Recompute with the dates above if either endpoint moves.
--
-- CHECK BEFORE ACTIVATING: whether Epoch has published anything after
-- 2025-07-09. A fourteen-month gap at the frontier is either the most
-- interesting fact on this page or a stale ingestion, and the two are
-- indistinguishable from inside the database. Check the source before the page
-- says anything at all about the gap.
('frontier-compute', 'frontier-compute',
 'Are the models still getting bigger?',
 'The largest known training run, and the rate it has grown at',
 'Yes, and only a little faster than it was already growing. The largest known training run went from 2.6 × 10^24 floating-point operations in March 2022 to 5.0 × 10^26 in July 2025 — about 190 times in three years and four months, which compounds to 4.9 times a year. The three years and ten months before that ran at 4.3 times a year: 8.7 × 10^21 in May 2018 to 2.6 × 10^24 in March 2022 is about 295 times. So the frontier grew roughly twelve per cent faster per year once the money arrived. That is a continuation, not an acceleration — the difference between the two windows is far smaller than the difference in the capital behind them. The most recent observation in this series is July 2025, and there is nothing after it — which means either that nothing larger has been trained in over a year or that nobody has said so, and this database cannot tell you which.',
 'Epoch AI''s estimate of the training compute of the largest known model, plotted against the count of documented large GPU clusters in the United States and against documented US data centre capacity in megawatts. Three charts, three units, and the compute series is on a logarithmic scale by necessity — it spans twenty-five orders of magnitude and cannot be drawn any other way. It is a sequence of record-holders at irregular dates rather than a series with a period, so the growth rates quoted are compound rates between named observations, not annual averages of a continuous measure. The cluster count has a known and severe recency problem: clusters are documented after the fact, so the most recent year is always the most incomplete, and the 2025 figure of five against 31 in 2024 is far more likely to be reporting lag than a collapse in building.',
 'None of these numbers is disclosed by the people who would know. Training compute is reconstructed by Epoch from hardware, run time and published details, and developers have become less forthcoming rather than more as the stakes have risen — so the series is most likely to undercount exactly where it matters most, at the current frontier. The cluster count is documented clusters only. And a record-holder series says nothing about the distribution beneath it: the frontier can stall while total compute spent on training rises, if the spending goes into many models rather than one larger one.',
 'The capital in this boom is being raised against a specific technical bet: that spending more on training a single model keeps making it better. That bet is what turns a research programme into a capital expenditure cycle, and it is testable in a way that most claims here are not. If frontier training compute stopped growing exponentially, the argument for the data centres would have to be made on inference demand instead — a completely different economic case with a completely different cost structure.',
 'Growth is measured as a compound rate between two named observations at each end of two windows of similar but unequal length — three years four months and three years ten months — rather than read off a trend line through irregularly spaced points. The two rates are quoted to one decimal and compared as a ratio, because the whole finding is how close they are. The log scale is stated on the chart, because an exponential drawn linearly makes every year before the last one look like nothing happened.',
 'suggestive', NULL, 'investment', 10, FALSE),


-- ─────────────────────────────────────────────────────────────────────────────
-- LABOUR MARKETS
-- ─────────────────────────────────────────────────────────────────────────────

-- Figures read 2026-08-30:
--   US information-sector employment (thousands): 2,671 (Jan 1990),
--     3,718 (Mar 2001, series peak), 3,063 (2022 mean), 3,007 (2023),
--     2,922 (2024), 2,861 (2025), 2,788 (2026 Jan-Jul mean)   (fred.USINFO)
--   Information share of US employment: 2.45% (Jan 1990), 2.80% (Mar 2001),
--     2.01% (2022 mean), 1.75% (Jul 2026)
--                                  (derived.information_employment_share)
--   US Information real value added ($bn chained 2017): 1,496.4 (2022 mean),
--     1,962.5 (2026 Q1)                                         (fred.RVAI)
--
-- CHECK BEFORE ACTIVATING: whether the 2022 employment peak survives the annual
-- benchmark revision. The whole page is a comparison between that peak and now,
-- and payroll benchmarks have moved by more than the difference being claimed.
('sector-jobs', 'sector-jobs',
 'Is the industry that sells AI hiring?',
 'Information-sector output and information-sector headcount',
 'No. US information-sector employment averaged 3.06 million in 2022 and 2.79 million over the first seven months of 2026 — a fall of about 275,000, which takes it below where it stood in 2015 and well below its March 2001 peak of 3.72 million. Over the same four years the sector''s real value added rose from $1,496bn to $1,963bn. Output up by roughly a third, headcount down by nine per cent. The sector''s share of all US employment is 1.75 per cent, the lowest in a series that begins in 1990 at 2.45 per cent and peaked at 2.80 per cent in 2001.',
 'Payroll employment for the NAICS Information sector, its share of total non-farm payrolls, and the sector''s real value added, on three charts because they are a count, a percentage and a chained-dollar volume. Total non-farm payrolls sit alongside as the denominator made explicit. Monthly series are read as annual means so that seasonal movement in the payroll data cannot be mistaken for trend, and 2026 is stated as a seven-month mean rather than a year. The classification is the limitation and it is not a small one: NAICS Information is publishing, motion pictures, broadcasting and telecommunications as well as software and data processing, and the first four have been shedding employment more or less continuously since 2001. A falling headcount in this sector is the long-run norm.',
 'The 2022 peak is the top of a hiring surge the firms themselves described afterwards as over-expansion, and the correction began in 2023 with reductions announced before generative AI was deployed at any scale. So the most natural reading of this page — output rising while employment falls because software replaced the workers — is indistinguishable in these series from a sector that hired too many people in 2021 and stopped. Neither can the value-added series be attributed to the surviving workers: real value added rises when prices are deflated differently as well as when more is produced, and software deflators are among the least settled in the national accounts.',
 'If AI raises output per worker anywhere, it should do so first in the firms that build and sell it — they adopt first, they adopt hardest, and they have the least excuse not to. The information sector is where those firms are counted. Rising output against falling headcount in the one sector with no adoption lag is the cleanest version of the productivity claim available in official statistics, and it is testable without any assumption about who uses what.',
 'Employment and output come from two different BEA and BLS programmes on the same industry definition, so the divergence between them is not an artefact of one survey. The long window is deliberate: a sector whose employment share has been falling since 2001 cannot be read from the last four years alone.',
 'consistent', NULL, 'labour', 5, FALSE),


-- Figures read 2026-08-30:
--   EU27 job vacancy rate, information & communication (%):
--     2.4 (2012 Q1), 3.4 (2019 Q1), 4.3 (2022 Q2, series peak since 2012),
--     3.1 (2024 Q1), 2.2 (2025 Q3, latest)
--                     (dbn.Eurostat.jvs_q_nace2.Q.NSA.J.TOTAL.JVR.EU27_2020)
--   EU27 enterprises with hard-to-fill ICT vacancies (%): 2.82 (2012),
--     5.19 (2019), 4.68 (2020), 5.96 (2022), 5.49 (2024)
--                    (dbn.Eurostat.isoc_ske_itrcrn2.…E_ITSPVAC2.PC_ENT…)
--   EU27 ICT specialists as share of employment (%): 3.1 (2004), 4.0 (2019),
--     4.5 (2021), 5.0 (2024)   (dbn.Eurostat.isoc_sks_itspt.A.PC_EMP.EU27_2020)
--   OECD firms employing ICT specialists (%): 25.4 (2012), 21.2 (2020),
--     22.8 (2023), 21.9 (2024)
--                 (dbn.OECD.DSD_ICT_B_DF_BUSINESSES.OECD.A.H1_B.PT_ENT._T…)
--
-- CHECK BEFORE ACTIVATING: the vacancy series is NOT seasonally adjusted. The
-- 2.2 quoted for 2025 Q3 is a single unadjusted quarter and third quarters run
-- low in this series. Re-read it as a four-quarter mean before publishing, or
-- the headline number is a season.
('skills-shortage', 'skills-shortage',
 'Is the technology skills shortage over?',
 'European vacancies against the stock of people who fill them',
 'Easing sharply on everything that moves quickly, and not at all on the thing that moves slowly. The job vacancy rate in the EU''s information and communication sector was 3.4 per cent at the start of 2019, peaked at 4.3 per cent in the second quarter of 2022 and was 2.2 per cent in the third quarter of 2025, the lowest reading since 2013. The share of EU firms reporting hard-to-fill vacancies for technology specialists peaked at 6.0 per cent in 2022 and was 5.5 per cent in 2024. But the stock has not turned: technology specialists were 4.0 per cent of EU employment in 2019 and 5.0 per cent in 2024, still rising every year. Fewer firms are looking. The people already hired are still there.',
 'Four series from two statistical systems, on separate charts because they are four different quantities — a vacancy rate is a share of posts, a hard-to-fill rate is a share of firms, a specialist share is a share of employment, and the OECD series is a share of firms on a different sampling frame. The vacancy series is quarterly and unadjusted, which is why the page reads it as a trend across years rather than quarter to quarter. What this page badly lacks is a whole-economy European vacancy rate to difference against: the sector''s fall from 4.3 to 2.2 happened during a period when hiring cooled across every European sector, and without the aggregate the sector-specific part of that fall cannot be isolated.',
 'A vacancy rate falls when hiring slows and also when hiring succeeds, and nothing here separates those. The 2022 peak is the top of a post-pandemic hiring surge that affected every sector in Europe, so a sector falling from it is not evidence about that sector until it is compared with the aggregate — and the aggregate is not in this database. The stock series is also slow by construction: technology specialists are counted by occupation in the labour force survey, annually, and a hiring freeze takes several years to show up in a stock that people mostly do not leave.',
 'The standard argument against AI displacing technology workers is that demand for them is insatiable. That is a testable claim about vacancies, and Europe publishes the data quarterly by sector. If the argument were right, the vacancy rate in information and communication should be at or near its record while adoption is at its record. It is at its lowest since 2013, and the two facts have to be reconciled by someone.',
 'Flow measures and stock measures are shown separately and read differently, because they respond on different timescales and mixing them is how a hiring freeze gets mistaken for a labour shortage. The missing comparison group is named in the method rather than substituted for.',
 'suggestive', NULL, 'labour', 6, FALSE),


-- Figures read 2026-08-30:
--   US unit labour costs (2017=100): 103.6 (2019), 115.0 (2022),
--     123.8 (2026 H1)                                       (fred.ULCNFB)
--   US output per hour (2017=100): 103.6 (2019), 119.8 (2026 H1) (fred.OPHNFB)
--   China IT sector average wage: ¥122,478 (2016) → ¥238,966 (2024)
--                                              (dbn.NBS.A_A040I.A040I08)
-- Report figures moved onto this question — values read from
-- `report_figure_points` on 2026-08-30:
--   PwC AI-skill advertised wage premium by sector: 118% consumer markets,
--     84% TMT, 16% government and public sector; 62% across all sixteen
--   PwC wage growth since a 2018 baseline: most-exposed quartile +24.4% by
--     2025, least-exposed +16.6%
--   IMF posted premium for a vacancy listing four or more new skills:
--     15.1% UK, 8.5% US
--
-- CHECK BEFORE ACTIVATING: all three report figures are `extracted` and
-- unverified — they appear in `unreviewed_figures`. This page quotes all three
-- in its answer, so it must not go live before they have been checked against
-- the page references they carry.
('ai-wages', 'ai-wages',
 'Does working with AI pay more?',
 'What the surveys measure, and what the wage statistics can check',
 'The surveys say yes, emphatically, and the official statistics in this database cannot check them. PwC''s 2026 barometer puts the advertised-salary premium for AI skills at 118 per cent in consumer markets and 16 per cent in the public sector, averaging 62 per cent across sixteen sectors. The IMF, controlling for occupation, industry, county and year, puts the posted premium for a vacancy asking for four or more new skills at 15.1 per cent in the United Kingdom and 8.5 per cent in the United States — a much smaller number for a much more careful question. Every one of those is measured on job advertisements rather than on pay received. The only sectoral wage series in this database is China''s: average pay in information transmission, software and IT services went from ¥122,478 a year in 2016 to ¥238,966 in 2024, with no comparator to say whether that beat the rest of the Chinese economy. Economy-wide, US unit labour costs rose from 103.6 in 2019 to 123.8 in the first half of 2026 — faster than output per hour over the same period, which is the opposite of what a labour-saving technology delivers in aggregate.',
 'Three extracted report figures carry the finding and three official series are used to check it, which is the wrong way round and is the honest description of what this project can currently do on wages. US unit labour costs and output per hour share a unit and a base year and sit on one axis; the Chinese wage series and the Australian unit-labour-cost growth rate take their own charts. The gap this page exists to expose is that no sectoral or occupational wage series for the US or UK is in the catalogue — the BLS publishes average hourly earnings by sector free of charge, and until that is ingested every wage claim on this site rests on somebody else''s survey of advertisements.',
 'An advertised salary is not a paid salary, and the difference between the two is exactly where a skills premium would be inflated: employers hiring for scarce skills post wide ranges and fill at the bottom of them. Both PwC figures are cross-sections of postings with no control for seniority, firm size or location beyond a sector split, so a premium there can be entirely composition — AI-skilled roles concentrate in better-paying firms and cities. Only the IMF figure controls for those, and it is between a third and a seventh of the size. The one official wage series here is a different country from all three studies.',
 'If AI complements skilled labour, the people who work with it should be paid more, and the premium should be visible before any effect on employment is. If it substitutes, the premium should be for supervising it rather than for doing the work, and should compress as the skill diffuses. The size of the premium and its direction over time is the single most informative labour-market number about which of the two is happening — which is why it is worth being explicit that this project cannot yet measure it.',
 'Survey findings and official statistics are shown as what they are, with the survey figures carrying their own note about population and method. The most carefully controlled of the three estimates is quoted alongside the largest, because the distance between them is the useful information.',
 'insufficient', NULL, 'labour', 7, FALSE),


-- Figures read 2026-08-30:
--   World unemployment (%, ILO modelled): 6.11 (2000), 5.59 (2019),
--     6.59 (2020), 5.23 (2022), 4.85 (2023), 4.79 (2025, series low)
--                                          (wb.SL.UEM.TOTL.ZS, WLD)
--   US non-farm payrolls (thousands, annual means): 150,905 (2019),
--     142,162 (2020), 157,694 (2024), 158,725 (2026 Jan-Jul)  (fred.PAYEMS)
--   Japan employed persons (tens of thousands): 6,749 (2019), 6,842
--     (2026 Jan-Jul) — 67.5m to 68.4m       (dbn.STATJP.MIm.M.EP.B.TTP.SA)
--   US youth unemployment 16-24 (%): 8.39 (2019), 7.93 (2023), 9.95 (2025),
--     9.07 (2026 Jan-Jul)                              (fred.LNS14024887)
--
-- CHECK BEFORE ACTIVATING: that the World Bank series still ends in 2025 with
-- 48 economies reporting. It is an ILO model estimate and it is revised; the
-- 4.79 being a series low is the whole headline and it is one revision away
-- from not being one.
('aggregate-unemployment', 'aggregate-unemployment',
 'Has unemployment risen anywhere?',
 'The broadest measure, and why it would be the last to move',
 'No. World unemployment, as the International Labour Organization models it, was 5.59 per cent in 2019, 6.59 in 2020, and 4.79 per cent in 2025 — the lowest reading in a series that starts in 2000 at 6.11. US non-farm payrolls are at a record 158.7 million over the first seven months of 2026. Japanese employment is at a record 68.4 million on the same seven-month basis. The one number on this page that has risen is US youth unemployment, from 8.4 per cent averaged over 2019 to 9.1 per cent averaged over the first seven months of 2026, and even that is below its 2015 level of 11.6. Read as single months rather than as an average the same series stood at 8.5 per cent in July 2026, which is the figure the entry-level page quotes; the difference between the two is the convention, not the data. This is the weakest possible test and the technology has not failed it — but the reason it is weak is the reason this page exists.',
 'World Bank harmonised unemployment for the world aggregate, US non-farm payrolls, Japanese employed persons and US youth unemployment, on four charts because they are two rates and two counts on incompatible scales. The world figure is an ILO model estimate that harmonises labour force surveys of very different quality across countries and is published annually — a resolution far coarser than the effect being looked for, and one that lags by design. The page is constructed as a null result and should be read as one: it establishes that nothing large enough to move a global annual unemployment rate has happened, which is a much smaller statement than "nothing has happened".',
 'The unemployment rate is close to the worst available instrument for this question and would be the last place an effect appeared. A person who stops looking for work is not unemployed; a person whose hours are cut is not unemployed; and a job that is never created generates no unemployment at all, which is precisely the mechanism most of the AI displacement literature actually proposes. Displacement through slower hiring shows up in the vacancy rate, in the hiring rate, and in the entry-level share years before it shows up here, if it shows up here at all.',
 'Every specific claim about AI and employment is a claim about a slice — an occupation, a cohort, a sector. Those slices are where this dashboard spends most of its labour lens, and they are also where a finding is easiest to manufacture by choosing the slice. The aggregate is the discipline on that: if something large is happening to labour demand, it eventually has to appear in the total, and stating plainly that it has not is what makes the narrower findings elsewhere on this site readable as evidence rather than as selection.',
 'The broadest measure available is used deliberately and its weakness is the point rather than a caveat. Records are stated as records against the full history of each series, not against a recent window.',
 'consistent', NULL, 'labour', 8, FALSE),


-- ─────────────────────────────────────────────────────────────────────────────
-- PRICES & MARKETS
-- ─────────────────────────────────────────────────────────────────────────────

-- Figures read 2026-08-30, annual means of the monthly series:
--   PPI semiconductors & related devices (Index Dec 1998=100):
--     153.4 (Jan 1990), 101.7 (1998), 76.8 (2003), 47.2 (2010), 37.7 (2015),
--     30.0 (2021), 31.0 (2022), 31.7 (2023), 31.1 (2024), 29.9 (2025),
--     29.9 (2026 to Jul)                            (fred.PCU334413334413)
--   PPI semiconductor machinery (Index Dec 2003=100): 86.0 (2015), 89.9 (2021),
--     93.4 (2022), 98.5 (2023), 103.5 (2024), 106.4 (2025), 107.5 (2026 to Jul)
--                                                   (fred.PCU333242333242)
--   Japan export price index, semiconductor-making equipment (2020=100):
--     100.0 (2020), 100.3 (2021), 104.3 (2022), 107.9 (2023),
--     112.2 (2024 to May, series ends)             (dbn.BOJ.CGPI.2300440015)
--
-- CHECK BEFORE ACTIVATING: whether the flattening survives deflation. The claim
-- is that a thirty-year price decline stopped in 2021; 2021-2023 was also the
-- largest general inflation in forty years, and a nominal index that merely
-- stops falling through it has still fallen in real terms. The page has no
-- deflator. Decide whether to say the real decline continued, or to ingest a
-- general PPI and find out.
('chip-prices', 'chip-prices',
 'Have chips stopped getting cheaper?',
 'Thirty years of falling semiconductor prices, and the last five',
 'They have stopped falling, and the machines that make them have started rising. The US producer price index for semiconductors and related devices was 153 in January 1990 and 30 by 2021 — a fall of about eighty per cent over three decades, and the single price movement that everything else in this dashboard rests on. Since 2021 it has read 30.0, 31.0, 31.7, 31.1, 29.9, 29.9 — annual means, the last of them over the first seven months of 2026 rather than a full year. Five years without a fall, after thirty years of nothing else. Over the same five years the producer price for semiconductor manufacturing machinery rose from 89.9 in 2021 to 107.5 over the first seven months of 2026, and Japan''s export price index for the same equipment rose twelve per cent between 2020 and May 2024, where that series stops. The tools got dearer while the chips stopped getting cheaper.',
 'Two US producer price indices and one Japanese export price index, on three charts. The two American series are not put on one axis despite both being indices, because their base periods are five years apart — one is December 1998 = 100 and the other December 2003 = 100 — and a shared axis would invite a reader to compare a 30 against a 108 as though the levels meant anything against each other. The Japanese series is included because it is constructed by a different statistical office under a different methodology and reaches the same conclusion about equipment up to its last reading in May 2024, which is worth more than a second American series would be — though it is two years shorter than the American ones and the chart shows that. Quality adjustment is the methodological centre of this page: a chip twice as fast at the same price ought to register as a price fall, and how much of that gets captured depends on matched-model choices the published index does not expose.',
 'Between 2021 and 2023 the United States had its largest general inflation in forty years, and a nominal price index that merely stops falling through it has still fallen against everything else. This page has no deflator and cannot say by how much, which means "chips stopped getting cheaper" is a statement about the dollar price and not necessarily about the real one. The semiconductor index also covers memory, analogue, discrete and logic devices together, and the AI-relevant part of that basket is a minority of it with a very different price history. And the Japanese line is not current: that index stops in May 2024, two years short of the two American series, so it corroborates the equipment story up to 2024 and says nothing about what has happened since.',
 'The falling price of computation is the engine underneath every claim in this dashboard. It is why capital keeps flowing in, why adoption spreads, and why the substitution argument against labour has any force at all. If that decline has genuinely stalled, the economics of the entire build-out change: the returns have to come from using compute better rather than from buying more of it for less, and every projection built on continued price falls is projecting something that stopped.',
 'Two independent constructions of the equipment price, one American and one Japanese, so a methodological artefact in either does not carry the finding. Indices with different base periods are kept on separate axes rather than being drawn together and left for the reader to notice.',
 'suggestive', NULL, 'prices', 5, FALSE),


-- Figures read 2026-08-30, annual means:
--   US PPI, data processing & hosting (Index Dec 2000=100): 100.0 (Dec 2000),
--     110.8 (2019), 115.2 (2021), 118.1 (2023), 123.5 (2025),
--     123.6 (2026 to Jul)                          (fred.PCU518210518210)
--   Japan SPPI, internet data centres (2015=100): 100.0 (2015), 96.1 (2018),
--     98.0 (2021), 96.9 (2023), 97.6 (2024 to Apr) (dbn.BOJ.SPPI.5201450003)
--   Japan SPPI, entrusted computing / cloud application (2015=100):
--     100.0 (2015), 94.9 (2021), 92.8 (2022), 95.0 (2024 to Apr)
--                                                  (dbn.BOJ.SPPI.5201350004)
--   Japan SPPI, software development (2015=100): 100.0 (2015), 107.7 (2021),
--     110.2 (2023), 113.2 (2024 to Apr)            (dbn.BOJ.SPPI.5201330001)
--
-- CHECK BEFORE ACTIVATING: all three Japanese series end 2024-04-01. The US
-- series runs to 2026-07-01. Two thirds of the divergence being described may
-- simply be the two years Japan is missing. If the BOJ series can be
-- re-ingested to the present, do that before publishing this page at all.
('compute-price-abroad', 'compute-price-abroad',
 'Is compute getting dearer everywhere, or only in America?',
 'The US hosting price index against Japan''s',
 'Only in America, on the evidence available — and the evidence stops two years short. The US producer price index for data processing, hosting and related services rose 11.5 per cent between 2019 and the first seven months of 2026, which is as much as it rose across the whole nineteen years before that. Japan''s producer price index for internet data centres was 100.0 in 2015 and 97.6 in early 2024; its index for entrusted cloud application services was 95.0. Neither has risen at all in nine years. What has risen sharply in Japan is the price of writing software: 113.2 by early 2024. So the Japanese data show the cost of people going up and the cost of machines going nowhere, and the American data show both going up — but the Japanese series end in April 2024 and cannot see the period in which the American index moved most.',
 'One US producer price index against three Japanese services producer price indices. The three Japanese series share a base year and a unit and sit on one axis, which is the comparison that matters — data centres, cloud applications and software development priced by the same office on the same base. The US index takes its own chart because its base is December 2000. The comparison between countries is between percentage changes over matched windows rather than between levels, since the bases are eleven years apart. Two things limit what the chart itself can show. The Japanese series all sit between 92 and 113 on an axis that starts at zero, so the shared chart shows the gap between the three lines clearly and their individual movements barely at all — read the percentages in the text, not the slopes. And the Japanese series end in April 2024, so any statement about 2024 to 2026 is American only.',
 'The Japanese indices are domestic transaction prices in yen over a period when the yen fell heavily against the dollar. That does not affect a domestic price index directly, but it changes what a Japanese firm pays for compute bought from an American provider without moving these numbers at all — so a flat Japanese index is consistent with Japanese buyers facing sharply higher effective prices. And a producer price index for hosting prices a contract, not a unit of computation: a customer paying the same money for twice the capacity registers here as no change whatsoever.',
 'If the price of compute is rising because AI demand exceeds supply, it should rise wherever that demand is — the market for data centre capacity is international and the hardware inside is bought from the same handful of suppliers everywhere. A price rise confined to one country points instead at something local: electricity, land, labour, or the market power of three American providers in their home market. Which of those it is determines whether the cost is temporary.',
 'Series from one statistical office on one base year are grouped together so that the comparison between Japanese data centres, Japanese cloud and Japanese software is exact. The cross-country comparison is made in percentage changes over matched windows and the window where they do not match is named.',
 'suggestive', NULL, 'prices', 6, FALSE),


-- Figures read 2026-08-30, both Eurostat, EUR per kWh excluding taxes and
-- levies, semiannual:
--   Band IG, 150,000 MWh/yr and over:  0.0381 (2007 H1), 0.0462 (2020 H1),
--     0.0574 (2021 H1), 0.1549 (2022 H1), 0.1876 (2022 H2), 0.0975 (2024 H1),
--     0.1022 (2025 H1, latest)
--            (dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR…)
--   Band IE, 20,000-69,999 MWh/yr:     0.0620 (2007 H1), 0.0607 (2020 H1),
--     0.0673 (2021 H1), 0.1484 (2022 H1), 0.1857 (2022 H2), 0.1219 (2024 H1),
--     0.1200 (2025 H1, latest)
--            (dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR…)
--   Implied discount for the largest band: 38.5% (2007 H1), 23.9% (2020 H1),
--     -4.4% (2022 H1, inverted), 14.8% (2025 H1)
--
-- CHECK BEFORE ACTIVATING: that both series are still published on the same
-- band definitions. Eurostat revised its consumption bands in 2017 and the
-- discount computed across that boundary would be a definitional change rather
-- than a market one if the bands moved.
('bulk-discount', 'bulk-discount',
 'Do the biggest power buyers still get a discount?',
 'What the largest industrial electricity consumers in Europe pay',
 'Much less of one than they used to. In the first half of 2007 the very largest industrial electricity consumers in the EU — those taking 150 gigawatt-hours a year or more — paid €0.0381 a kilowatt-hour excluding taxes, against €0.0620 for consumers taking twenty to seventy gigawatt-hours. A discount of 39 per cent. By the first half of 2025 the two were €0.1022 and €0.1200: a discount of 15 per cent. In the first half of 2022, at the height of the European gas crisis, the largest buyers paid more than the smaller ones — €0.1549 against €0.1484. The bulk discount for very large electricity users has been narrowing for eighteen years and briefly disappeared.',
 'Two Eurostat electricity price bands, same publication, same currency, same exclusion of taxes and levies, same semiannual periodicity, on one axis — which is the only arrangement in which the question can be asked at all, because the question is entirely about the gap between two levels. The US industrial electricity price and the Henry Hub natural gas price sit on separate charts as context, the second specifically because it explains the 2021 to 2023 shape of both European lines better than anything about electricity does. Consumption bands are the method''s limitation: they are defined by how much a customer takes, not by what the customer is, so this page cannot isolate data centres inside the top band and does not claim to.',
 'The top band contains aluminium smelters, steel mills, chemical plants and data centres indiscriminately, and its average price is whatever mix of those the EU happens to contain. The 2022 inversion is the gas crisis rather than any change in bargaining power: the largest consumers are the ones most likely to buy on wholesale-linked terms, so they took the shock first and hardest, which is a fact about contract structure. Prices exclude taxes and levies, which differ enough between member states to change where power is actually cheapest for a firm choosing a site.',
 'The economics of a data centre are the economics of electricity, and the industry''s answer to that has always been scale: buy enough power and you buy it cheaply. That is a testable proposition about the price schedule facing very large consumers, and Europe publishes it twice a year by consumption band. If the bulk discount is disappearing, the cost advantage of concentrating compute in enormous single sites erodes with it, and the siting logic of the whole build-out changes.',
 'One publication, one unit, one tax treatment, both bands on one axis, because a gap between two levels cannot be read from two charts. The gas price is included as the confounder rather than left for the reader to supply.',
 'suggestive', NULL, 'prices', 7, FALSE),


-- Figures read 2026-08-30, annual means:
--   US unit labour costs (index 2017=100): 103.6 (2019), 109.4 (2021),
--     115.0 (2022), 123.8 (2026 H1) — +19.5% on 2019          (fred.ULCNFB)
--   US output per hour (index 2017=100): 103.6 (2019), 119.8 (2026 H1)
--     — +15.6% on 2019                                        (fred.OPHNFB)
--   US PPI data processing & hosting: 110.8 (2019), 123.6 (2026 to Jul)
--     — +11.5% on 2019                                (fred.PCU518210518210)
--   US PPI semiconductors: 32.5 (2019), 29.9 (2026 to Jul) — -8.0% on 2019
--                                                    (fred.PCU334413334413)
--
-- CHECK BEFORE ACTIVATING: whether unit labour costs is the right series at
-- all. It is compensation per unit of output, so it already nets out
-- productivity; if the question is the price of an hour of labour rather than
-- the cost of a unit of output, average hourly earnings is the series and it is
-- not in this catalogue. That choice changes the answer's size, not its sign.
('labour-vs-compute', 'labour-vs-compute',
 'What got more expensive: an hour of work, or an hour of compute?',
 'The relative price that has to move before substitution makes sense',
 'Work, but by less than the substitution story usually assumes. US unit labour costs — what an hour of output costs in wages and benefits — rose 19.5 per cent between 2019 and the first half of 2026. The producer price for data processing and hosting rose 11.5 per cent over the same years. Semiconductors got eight per cent cheaper. So the relative price did move in favour of compute, which is the precondition for substituting one for the other, but a gap of about eight percentage points over seven years is not the collapse in the price of computation that the argument normally rests on. On these series, compute became cheaper than labour at roughly one per cent a year.',
 'US unit labour costs and output per hour share a unit and a base year and sit on one axis, because the relationship between them is what determines whether rising compensation is expensive: unit labour costs rise only when pay outruns productivity. The producer price index for data processing and hosting and the semiconductor index take separate charts, both because their bases differ from the labour series and from each other and because they measure different things — the price of buying compute as a service and the price of the hardware that provides it. The weakest link is stated plainly: the hosting index prices contracts, not computation, and makes no allowance for a dollar of cloud spending in 2026 buying far more work than it did in 2019. The quantity the substitution argument needs is price per unit of computation delivered, and no free index measures it.',
 'The hosting index is the wrong measure for the right question and there is no better one available for public redisplay. It cannot see the quality improvement that is the entire point — if a dollar buys three times the compute it did in 2019, the effective price fell by two thirds while this index rose eleven per cent, and both statements are true of different quantities. Unit labour costs are also economy-wide, whereas the labour AI plausibly substitutes for is a specific and relatively expensive slice of the workforce, and its price could be moving quite differently.',
 'A firm substitutes machines for people when the relative price makes it worth doing, not when the technology becomes possible. The economic history of automation is a history of relative prices: mechanised weaving waited on cheap iron and cheap coal more than on the loom. So the question of whether AI displaces labour is, at the margin, a question about two price series — and if the relative price has barely moved, then the technology has to be delivering much more per dollar for substitution to make sense, which is a claim about capability rather than about cost.',
 'The two labour series share an axis so that the relationship between pay and productivity is visible rather than asserted. The compute prices are kept separate and their inadequacy for the job is stated in the method rather than left implicit in a caveat.',
 'suggestive', NULL, 'prices', 8, FALSE),


-- ─────────────────────────────────────────────────────────────────────────────
-- POLICY & REGULATION
-- ─────────────────────────────────────────────────────────────────────────────

-- Figures read 2026-08-30, calendar-year sums of the monthly series:
--   AI-related Federal Register documents: 1 (1996), 3 (1998), 1 (2004),
--     3 (2009), 6 (2011), 21 (2012), 28 (2013), 22 (2014), 19 (2015),
--     43 (2016), 25 (2017), 57 (2018), 63 (2019), 89 (2020), 75 (2021),
--     84 (2022), 120 (2023), 243 (2024), 207 (2025), 248 (2026 to August)
--                                        (derived.ai_regulation_volume)
--   No year between 1996 and 2011 exceeds 6.
--     select date_trunc('year', period_start)::date yr, sum(value)
--       from observations where indicator_id = '…' group by 1 order by 1;
--
-- CHECK BEFORE ACTIVATING: which of the six search terms produces the 2012
-- step. If it is "machine learning" entering agency vocabulary, the finding is
-- about language and should be stated that way. If the step is spread across
-- several terms it is more likely to be about attention. This is one query
-- against the underlying Federal Register documents and it decides what the
-- page is allowed to say.
('when-noticed', 'when-noticed',
 'When did the state start paying attention?',
 'Thirty years of Federal Register documents, and where the break is',
 '2012, not 2022. Between 1996 and 2011 the US Federal Register published between one and six AI-related documents a year, and in most of those years fewer than three. In 2012 it published twenty-one, and it has published at least nineteen every year since: 63 in 2019, 84 in 2022, 120 in 2023, 243 in 2024, and 248 in the first eight months of 2026. The break in this series is a decade before the public one, which is worth sitting with — whichever way it is explained. It could be the state noticing a research result years before anyone else did. It could equally be the moment the phrase entered federal vocabulary, which is a fact about language rather than about policy, and these counts cannot separate the two.',
 'Federal Register documents matched on the project''s six AI search terms, counted monthly, deduplicated on the government''s document number, back to 1996. The total sits on its own chart; proposed rules and rules in force share a second, since they share a unit and a comparable scale. The share of large US companies mentioning AI in their annual report sits on a third as the private-sector counterpart. The method is a keyword match and everything about the reading follows from that: it detects when six phrases entered federal writing, which is a lower bound on when the subject entered federal attention and an unreliable one. A document regulating an automated system without using any of the six words is invisible; a document mentioning AI once in a footnote weighs the same as one about nothing else.',
 'A count of documents is a count of documents. The 1996 to 2011 baseline of one to three a year is low enough that the series is essentially detecting the arrival of vocabulary, and a single agency adopting a phrase in its standard boilerplate would produce a step of this size. The 2026 figure covers eight months — the series ends on 1 August 2026 — so it is not a year and must never be compared with one as though it were. And this is United States federal only: it cannot see state legislatures, where a large share of binding American AI law has actually been written.',
 'Almost every account of AI policy starts in November 2022 and treats everything before it as prehistory. If that is wrong — if the state was already writing about this a decade earlier — then the institutional response was not a scramble, and the standard complaint that regulators were caught unprepared needs revising. The Federal Register is the one place where the answer is a matter of record rather than of recollection, going back thirty years without a gap.',
 'The full available history is used rather than a recent window, because the entire question is where the break is and a short window guarantees finding it at the start. The three document types are grouped by unit and scale rather than by narrative.',
 'suggestive', NULL, 'regulation', 10, FALSE),


-- Figures read 2026-08-30:
--   AI regulatory volume by calendar year: 84 (2022), 120 (2023), 243 (2024),
--     207 (2025), 248 (2026 to August)     (derived.ai_regulation_volume)
--   OECD firms 10+ using AI (%): 8.06 (2022), 8.73 (2023), 14.28 (2024),
--     20.30 (2025)
--                (dbn.OECD.DSD_ICT_B_DF_BUSINESSES.OECD.A.G14_B.PT_ENT._T…)
--   Same, information & communication: 25.30 (2022), 28.65 (2023),
--     45.76 (2024), 57.51 (2025)
--   SEC AI mention rate: 14.84% (2022) → 60.87% (2026 Q1)
--                                        (derived.sec_ai_mention_rate)
--
-- CHECK BEFORE ACTIVATING: the same 2023→2024 doubling appears in the
-- regulation series AND in both adoption series. If both breaks are artefacts —
-- a search-term shift on one side, a questionnaire revision on the other — the
-- page is comparing two measurement changes. That is worth knowing before it
-- goes anywhere near a reader.
('rules-vs-adoption', 'rules-vs-adoption',
 'Is the rulebook keeping up with the technology?',
 'Regulatory volume against how many firms actually use it',
 'They moved in the same year, which is the least useful thing the data could have done. AI-related US Federal Register documents roughly doubled between 2023 and 2024, from 120 to 243. The share of OECD firms with ten or more employees using AI also roughly doubled in that year, from 8.7 per cent to 14.3. Inside the information and communication sector it went from 28.7 per cent to 45.8. Regulation and adoption stepped up together, and with one step each there is no lead, no lag and nothing to test. What can be said is narrower and still worth saying: there is no year in this data where the rulebook ran ahead, and none where adoption ran away from it for long enough to be visible.',
 'US Federal Register document volume against two OECD enterprise adoption series and the share of US filings mentioning AI. The two adoption series share a unit and sit on one axis; the document count and the filings rate take their own charts. The comparison is between annual step changes, and the fundamental problem is that both sides have exactly one step in the period of interest — a single simultaneous move in two annual series carries almost no information about direction. The populations also do not match: US federal rulemaking against firms across the whole OECD, which means even a clean lead would not establish that one responded to the other. The filings series is the only one of the four that is genuinely American on both sides of the comparison.',
 'Two annual series that each step once in the same year cannot be ordered, and the temptation to order them anyway is the specific error this page exists to refuse. Both steps are also the kind that a measurement change would produce — six search terms on one side, a survey question whose wording may have been revised on the other — and if either is an artefact, the coincidence being described is an artefact of two administrative decisions rather than a fact about the world.',
 'The standard claim about technology regulation is that the rules always lag, because firms move at the speed of capital and states move at the speed of consultation. If that is right the gap should be visible and widening: adoption climbing while regulatory activity trails behind it. A gap that never opens would mean something different — either that the state moved unusually fast this time, or that regulatory activity is responding to attention rather than to deployment, which is not the same thing and has quite different implications for what the rules will actually contain.',
 'Adoption series that share a unit and a survey are grouped; series that share neither are not. The page compares step changes rather than levels, and states that one step on each side is not enough to establish an ordering.',
 'insufficient', NULL, 'regulation', 11, FALSE),


-- Figures read 2026-08-30:
--   US AI rules in force, calendar-year sums: 6 (2019), 15 (2021), 12 (2022),
--     16 (2023), 57 (2024), 33 (2025), 44 (2026 to August)
--                                            (derived.ai_binding_rules)
--   US PPI data processing & hosting, annual means: 110.8 (2019),
--     115.2 (2021), 116.4 (2022), 118.1 (2023), 119.6 (2024), 123.5 (2025),
--     123.6 (2026 to Jul)                     (fred.PCU518210518210)
--   Two-year changes: 2019→2021 +4.0%, 2023→2025 +4.5%
--
-- CHECK BEFORE ACTIVATING: the 2024 rules figure of 57 is the same spike 024
-- flags for `executive-action` and `rule-conversion` — it may be one agency
-- publishing a batch. All three pages lean on it. Resolve it once, against the
-- underlying documents by agency, and then fix all three.
('cost-of-compliance', 'cost-of-compliance',
 'Does regulation cost anything you can see?',
 'Rules in force against the price of the thing being regulated',
 'Not in any price this project can reach. If AI rules imposed a cost on the firms selling AI services, the most likely place for it to appear is the producer price for the activity being regulated. US AI rules in force went from 16 in 2023 to 57 in 2024 and 33 in 2025. The producer price index for data processing, hosting and related services rose 4.5 per cent across those two years — against 4.0 per cent over 2019 to 2021, when there were a third as many rules. A difference of half a percentage point over two years is not evidence of anything. Either the rules cost little, or the cost lands somewhere a producer price index does not look, or the index is too blunt to see it. Nothing here separates the three, and the third is the most likely.',
 'Federal Register rules in force and total AI document volume against the US producer price index for data processing, hosting and related services, with the broad US share price index as the market''s own view. Four charts, four units. The one thing this page has that most of the regulation lens does not is a matched jurisdiction: US federal rules against a US producer price index for the industry those rules mostly apply to. The method''s honest limit is that a producer price index moves for every reason at once — electricity, hardware, wages, market structure — and there is no way here to hold those constant. What the page can rule out is a large, sharp, visible compliance shock. What it cannot do is put a number on a small one.',
 'Compliance cost does not have to appear as a price. A firm can absorb it in margin, delay a product, decline to enter a market, or route the activity through a jurisdiction with fewer rules — and none of those appear in any series on this page. The producer price index also covers the whole data processing and hosting industry, most of which is not doing anything an AI rule touches. And the 2024 rules figure of 57 is high enough relative to its neighbours that it may be a single agency publishing a batch of related rules, which would make the largest movement on the page meaningless.',
 'The argument against regulating AI is almost always an argument about cost: that compliance is a tax on the technology and will be paid by the people who buy it. That is an empirical claim with a testable implication — a real compliance burden should raise the producer price of the regulated service, because in a competitive industry costs are passed through. Testing it badly and saying so is more useful than repeating the claim, because it establishes an upper bound on how large the effect could be and still be invisible.',
 'The jurisdiction is matched on both sides, which is unusual in this lens and is the reason the page is worth having. The comparison is between two-year changes in equal windows rather than between endpoints, and the confounders that also moved in the later window are named rather than assumed away.',
 'insufficient', NULL, 'regulation', 12, FALSE)


-- `is_active` and `last_reviewed` are deliberately NOT taken from EXCLUDED, for
-- the reason 024 sets out: re-running this seed after a question has been
-- checked and activated must not silently retire it or reset its review date.
-- The prose IS overwritten, so a question rewritten in the database and not
-- here loses the rewrite on the next seed run.
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
-- Plain inserts. Nothing is moved and no existing caption is touched:
-- `question_indicators` keys on (question_id, indicator_id), so an indicator
-- carries a different role, group and caption on every question it appears on.
--
-- On `chart_group`, and it is not the rule 024 was written against. /api/series
-- now rebases on AXIS SHARE rather than on unit strings: if any series in a
-- group would occupy under a tenth of the axis, every series in the group is
-- indexed to 100 at their first shared period — UNLESS every series in the
-- group is a rate, index, change or score, in which case levels are treated as
-- comparable and nothing is rebased. Two consequences run through the groupings
-- below:
--
--   * Two currency series of similar magnitude can now share an axis safely.
--     `us-capital-composition` does exactly that with software against
--     computers, and the ratio between the two lines is the finding.
--
--   * Two INDEX series with different base years will NOT be rebased, because
--     both are indices and the rebase is suppressed. They would be drawn raw,
--     and a 30 against a 108 invites a comparison that means nothing. So
--     indices with different bases are kept on separate charts here —
--     `chip-prices` is the case, and the comment above it says so.

-- Two placements from an earlier revision of this file pointed at indicators
-- 007 had deactivated, which /api/series filters out — the chart would simply
-- not render. They were replaced by live equivalents above. Seeds insert and
-- update but never delete, so without these two lines a database that ran the
-- earlier revision keeps the dead rows and diverges from a fresh `db:reset`.
DELETE FROM question_indicators
 WHERE (question_id, indicator_id) IN (
   ('diffusion-speed',    'dbn.Eurostat.isoc_eb_ai.A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.EU27_2020'),
   ('software-not-steel', 'dbn.BEA.NIPA-T50605.B985RC-A'));

INSERT INTO question_indicators
  (question_id, indicator_id, role, sort_order, chart_group, country_iso3,
   caption_plain, caption_expert) VALUES

-- ── total-factor-productivity ───────────────────────────────────────────────
-- Four units, four charts. The two TFP series have different bases and the
-- rebase is suppressed for indices, so they are kept apart deliberately.
('total-factor-productivity', 'fred.RTFPNAUSA632NRUG', 'hero', 1, NULL, 'USA',
 'US total factor productivity — the part of growth that is not explained by more workers or more machines. It rose three per cent between 2019 and 2023, and the series stops there.',
 'Penn World Table total factor productivity at constant national prices, index 2021 = 1, annual to 2023. A residual rather than a measurement: it is whatever growth the measured inputs fail to explain, so every error in the capital stock enters it with the opposite sign.'),

('total-factor-productivity', 'dbn.AMECO.ZVGDF.GBR.3.0.0.0.ZVGDF', 'supporting', 2, NULL, 'GBR',
 'The same idea for the UK, where it has gone nowhere for six years — 95.7 in 2019 against 96.0 in 2025. The dashed tail, 2026 and 2027, is forecast rather than measurement.',
 'AMECO total factor productivity, total economy, index 2020 = 100. The European Commission publishes projections in the same series as outturns and DBnomics returns no release vintage, so the boundary between the two can only be fixed where the calendar fixes it: 2026 and 2027 have not happened and are marked projected; whether 2025 is an outturn or a forecast cannot be established from what the source publishes. The 2020 base year is itself a pandemic year, which is a poor choice of base for any series affected by composition.'),

('total-factor-productivity', 'fred.OPHNFB', 'supporting', 3, NULL, 'USA',
 'US output per hour over the same period, rising much faster than the residual above. That gap is what buying more capital per worker looks like.',
 'BLS nonfarm business output per hour, index 2017 = 100, quarterly. Included as the contrast: labour productivity rises with capital deepening, total factor productivity does not, and separating the two is the entire purpose of this page.'),

('total-factor-productivity', 'dbn.OECD.DSD_PDB_DF_PDB_LV.USA.A.GDPHRS._T.USD_PPP_H.Q._Z._Z._Z', 'context', 4, NULL, 'USA',
 'The level rather than the index: what an hour of American work actually produces, in PPP-converted dollars.',
 'OECD Productivity Database, GDP per hour worked, constant prices, PPP converted, annual to 2023. Present so the index series above have a level to be anchored against.'),

-- ── computer-dividend ───────────────────────────────────────────────────────
-- The two contributions divide by different things — one by labour productivity
-- growth, one by total capital growth — so they never share an axis.
('computer-dividend', 'dbn.OECD.DSD_PDB_DF_PDB_GR.USA.A.ICTHRS_PCCONLP._T.PD.V.GOY._Z._Z', 'hero', 1, NULL, 'USA',
 'How much of US labour productivity growth came from ICT capital, in percentage points a year. It peaked at 1.02 in 1999 and was 0.31 in 2022 — a third of the peak.',
 'OECD Productivity Database growth accounting, annual 1985 to 2022. The contribution of ICT capital deepening to labour productivity growth, computed under an assumed production function from a measured ICT capital stock. Ends in 2022 and therefore sees no part of the generative-AI period.'),

('computer-dividend', 'dbn.OECD.DSD_PDB_DF_PDB_GR.USA.A.SOFT_PCCONK._T.PD.V.GOY._Z._Z', 'supporting', 2, NULL, 'USA',
 'How much of the growth in the US capital stock came from software. In 2022 it was 1.49 percentage points, matching its 1999 peak — the money is going in at dot-com rates.',
 'Same publication, different denominator: percentage points of total capital growth rather than of labour productivity growth, which is why it is on its own chart. If software capital is overstated this number is overstated and the one above is understated, by construction.'),

('computer-dividend', 'fred.B985RC1Q027SBEA', 'supporting', 3, NULL, 'USA',
 'The raw flow the line above decomposes: US investment in software, quarterly.',
 'BEA nonresidential intellectual property products, software, nominal, SAAR. Included so the decomposition can be read against the underlying spending rather than taken on trust.'),

('computer-dividend', 'fred.OPHNFB', 'context', 4, NULL, 'USA',
 'Total US labour productivity, of which the hero line is one contribution.',
 'The dependent quantity in the decomposition above. Shown so the size of the ICT contribution can be judged against the total it is a part of.'),

-- ── diffusion-speed ─────────────────────────────────────────────────────────
-- The three enterprise adoption series share a unit and are all rates, so
-- levels are comparable and nothing is rebased. Internet penetration is a
-- different population and stays on its own chart.
('diffusion-speed', 'wb.IT.NET.USER.ZS', 'hero', 1, NULL, 'WLD',
 'The last general-purpose technology to diffuse: the share of people worldwide using the internet. It went from 15.6 per cent in 2005 to 28.4 in 2010, and 73.6 by 2025.',
 'World Bank / ITU, individuals using the internet, world aggregate, annual. A different population from every other series on this page — people, not firms — which is why it takes its own chart and why the comparison is between five-year gains rather than between levels.'),

('diffusion-speed', 'dbn.OECD.DSD_ICT_B_DF_BUSINESSES.OECD.A.G14_B.PT_ENT._T.S_GE10', 'supporting', 2, 'enterprise-ai', NULL,
 'AI use among OECD firms with ten or more employees: 5.6 per cent in 2020, 20.3 in 2025. Fourteen and a half points in five years.',
 'OECD ICT access and use by businesses, all sectors, enterprises with 10+ employees. Self-reported and binary: one team using a chatbot and a firm rebuilt around the technology are the same data point.'),

('diffusion-speed', 'dbn.OECD.DSD_ICT_B_DF_BUSINESSES.OECD.A.G14_B.PT_ENT.J.S_GE10', 'supporting', 3, 'enterprise-ai', NULL,
 'The same measure inside information and communication, where it went from 14.4 per cent to 57.5. This is the number people have in mind when they say AI is spreading unusually fast.',
 'Same survey, NACE J only. Shares an axis with the all-sector line because they share a unit, a frame and a survey; the ratio between the two is the sectoral concentration of adoption.'),

('diffusion-speed', 'dbn.OECD.DSD_ICT_B_DF_BUSINESSES.EU27.A.G14_B.PT_ENT._T.S_GE10', 'supporting', 4, 'enterprise-ai', NULL,
 'Europe alone, which turns out to sit almost exactly on the OECD average: 6.0 per cent in 2020, 20.0 in 2025.',
 'OECD ICT access and use by businesses, EU27 aggregate, 10+ employees. The Eurostat publication of the same statistic is deactivated as a duplicate by 007 and carries one year fewer; this is the copy to use.'),

('diffusion-speed', 'dbn.Eurostat.isoc_eb_ain2.manufacturing', 'supporting', 5, 'enterprise-ai', NULL,
 'And European factories, which are years behind: 6.9 per cent in 2021, 17.3 in 2025 — roughly where the software sector was in 2020.',
 'Eurostat ICT usage in enterprises, NACE C manufacturing, EU27, 10+ employees. On the same axis as the other three because it is the same measure on a different population, and the spread between manufacturing and software is what a diffusion curve looks like part-way through.'),

('diffusion-speed', 'dbn.Eurostat.isoc_cicce_use.A.GE10.C10-S951_X_K.E_CC1_PANY.PC_ENT.EU27_202', 'context', 6, NULL, NULL,
 'The enterprise technology that diffused just before this one: buying cloud services, now past half of EU firms.',
 'Eurostat, enterprises purchasing paid cloud computing services, EU27, 10+ employees. On its own chart: the level is far higher because the technology is older, and grouping it would compress everything above.'),

-- ── china-mirror ────────────────────────────────────────────────────────────
-- Four units, four charts, and three of the four are denominated in tens of
-- thousands. The prose converts all of them; the captions state the raw unit.
('china-mirror', 'dbn.NBS.A_A0G11.A0G1101', 'hero', 1, NULL, 'CHN',
 'Revenue of China''s software and IT services industry: ¥4.8 trillion in 2016, ¥15.5 trillion in 2025.',
 'NBS main indicators on software and IT services, annual, denominated in tens of thousands of yuan — the published figure of 1,548,310,000 for 2025 is ¥15.48tn. Nominal, undeflated.'),

('china-mirror', 'dbn.NBS.A_A0406.A040608', 'supporting', 2, NULL, 'CHN',
 'People employed in the sector in urban units: 3.64 million in 2016, 5.53 million in 2024.',
 'NBS employed persons in urban units, information transmission, software and IT services, annual, in tens of thousands of persons. Urban units cover formally registered employers, so the smaller and informal end of the sector is outside the frame. 2025 is null.'),

('china-mirror', 'dbn.NBS.A_A040I.A040I08', 'supporting', 3, NULL, 'CHN',
 'Average pay in the sector: ¥122,478 a year in 2016, ¥238,966 in 2024. The only sectoral wage series in this database, and there is nothing here to compare it against.',
 'NBS average wage in urban units, same sector, annual, nominal yuan. No deflator and no comparator sector, so the 95 per cent rise cannot be read as outperformance of the rest of the Chinese economy. 2025 is null.'),

('china-mirror', 'dbn.NBS.A_A0E0H.A0E0H28', 'context', 4, NULL, 'CHN',
 'Integrated circuits made in China: 132 billion units in 2016, 484 billion in 2025.',
 'NBS output of integrated circuits, annual, in tens of thousands of units. A unit count says nothing about what kind of chip, and the composition matters more here than the total.'),

-- ── the-buildings ───────────────────────────────────────────────────────────
-- Nothing shares an axis: two dollar series on different frequencies and
-- different basis conventions, plus a megawatt stock.
('the-buildings', 'dbn.BEA.NIPA-T50405.LA001282-A', 'hero', 1, NULL, 'USA',
 'US private investment in data centre structures: $9.2bn in 2020, $31.1bn in 2024. The most direct dollar measure of the build-out in the national accounts — and it has five observations and stops in 2024.',
 'BEA NIPA table 5.4.5, annual, millions of current dollars. Structures only: the servers inside are capitalised as equipment elsewhere and are the larger number. Includes every corporate server room, not only hyperscale sites.'),

('the-buildings', 'fred.TLMFGCONS', 'supporting', 2, NULL, 'USA',
 'The other construction boom, and it has already turned: $82bn in 2021, $244bn in 2024, $178bn through the first half of 2026.',
 'Census total construction spending, manufacturing, monthly at a seasonally adjusted annual rate — so a part-year mean is an annualised rate comparable with a full prior year. Much of the 2022 to 2024 rise coincides with CHIPS Act subsidies, which makes it a policy response rather than a market one.'),

('the-buildings', 'derived.datacentre_capacity_mw', 'supporting', 3, NULL, 'USA',
 'Documented US data centre capacity in megawatts, as the physical counterpart to the dollars: 214 in 2022, 1,946 in 2025.',
 'A cumulative stock aggregated from documented sites, not a flow. Rises when disclosure improves as well as when capacity is built, so it is a lower bound that tightens over time.'),

('the-buildings', 'fred.A679RC1Q027SBEA', 'context', 4, NULL, 'USA',
 'Total US investment in information processing equipment and software, so the buildings can be read against everything else being bought.',
 'BEA fixed investment, nominal, SAAR. Two orders of magnitude above the structures series, which is the proportion worth noticing: the shell is a small part of the capital.'),

-- ── orders-and-output ───────────────────────────────────────────────────────
('orders-and-output', 'fred.IPG334S', 'hero', 1, 'us-industrial-production', 'USA',
 'US production of computers and electronic products. Up roughly a quarter since 2021, to the highest level in the series.',
 'Federal Reserve G.17 industrial production, NAICS 334, index 2017 = 100, monthly. Constructed from a mix of physical output and deflated value, so in an industry whose product improves faster than its price the index depends heavily on quality adjustment.'),

('orders-and-output', 'fred.INDPRO', 'supporting', 2, 'us-industrial-production', 'USA',
 'All US industrial production on the same base, up three per cent over the same five years. The gap between these two lines is the point of the chart.',
 'Same publication, same base year, same seasonal adjustment, so the difference between the two is not a splice or a methodological artefact.'),

('orders-and-output', 'fred.A34SNO', 'supporting', 3, NULL, 'USA',
 'New orders for the same industry, in dollars: $29.6bn a month in the first half of 2026, against $36.3bn a month in 2000. Nominal, twenty-six years apart.',
 'Census manufacturers'' new orders, computers and electronic products, monthly, millions of current dollars, undeflated. Read as a within-series comparison; the 2000 comparison survives only because it runs in the direction the missing deflator would widen.'),

('orders-and-output', 'fred.PCU334413334413', 'context', 4, NULL, 'USA',
 'What those chips cost, as the price counterpart to the volume above.',
 'PPI for semiconductor and related device manufacturing. Included so a rise in dollar orders is not read as a rise in quantity, or the reverse.'),

-- ── software-not-steel ──────────────────────────────────────────────────────
-- Grouped on one axis on purpose: same publication, same unit, same frequency,
-- and one is a component of the other, so the ratio between the lines is a
-- share and reads as one.
('software-not-steel', 'fred.B985RC1Q027SBEA', 'hero', 1, 'us-information-capital', 'USA',
 'US investment in software: $65bn in 1995, $693bn in 2024, $806bn in the first half of 2026. It fell three per cent in the dot-com bust and then carried on.',
 'BEA nonresidential intellectual property products, software, nominal, SAAR, quarterly. A large share is own-account software, which BEA estimates from the compensation of the programmers who wrote it — so rising programmer pay raises this line directly.'),

('software-not-steel', 'fred.A679RC1Q027SBEA', 'supporting', 2, 'us-information-capital', 'USA',
 'All information-processing investment on the same axis, of which the line below is now about half. This one fell 14 per cent after 2000 and took five years to recover.',
 'BEA fixed investment in information-processing equipment and software, nominal, SAAR. The software series is a component of it, so the gap between the two lines is hardware and everything else — which is the composition the page is about.'),

('software-not-steel', 'dbn.BEA.NIPA-T50505.B935RC-A', 'supporting', 3, NULL, 'USA',
 'Investment in computers and peripheral equipment: $179bn in 2024, and four years to recover from 2000. This is what a capital good looks like in a bust.',
 'BEA NIPA table 5.5.5, annual, millions of current dollars, back to 1959. Kept off the quarterly axis above because a frequency mismatch is not something a rebase fixes — it misrepresents the timing of a peak, not just its height.'),

('software-not-steel', 'dbn.OECD.DSD_PDB_DF_PDB_GR.USA.A.SOFT_PCCONK._T.PD.V.GOY._Z._Z', 'context', 4, NULL, 'USA',
 'The same shift seen from the capital stock: software''s contribution to the growth of US capital, back at its 1999 level.',
 'OECD growth accounting, percentage points of total capital growth, annual to 2022. On its own chart and in its own unit; included so the composition claim has a second construction behind it.'),

-- ── is-europe-in-this ───────────────────────────────────────────────────────
-- The two EU capital series share a base year and a construction. The two R&D
-- series are in different currencies and stay apart.
('is-europe-in-this', 'dbn.Eurostat.nama_10_an6.ict_equipment', 'hero', 1, 'eu-capital-index', NULL,
 'EU investment in ICT equipment, up twelve per cent between 2019 and 2024. This is a real volume index, and the American series it is usually compared with is not.',
 'Eurostat national accounts, gross fixed capital formation in ICT equipment, chain-linked volumes, index 2015 = 100, annual. Being a volume index is the point: it cannot be differenced against a nominal dollar series, and the page declines to.'),

('is-europe-in-this', 'dbn.Eurostat.nama_10_an6.A.CLV_I15.N117G.EU27_2020', 'supporting', 2, 'eu-capital-index', NULL,
 'EU investment in intellectual property products on the same base. Treat the 2019 spike with suspicion — it jumps 22 per cent in a year and gives most of it back.',
 'Eurostat, gross fixed capital formation in intellectual property products, chain-linked volumes, index 2015 = 100. The 2018 to 2019 jump has the signature of intangible assets relocating between member states rather than of investment.'),

('is-europe-in-this', 'dbn.Eurostat.rd_e_berdfundr2.A.TOTAL.G-U_ICT.MIO_EUR.EU27_2020', 'supporting', 3, NULL, NULL,
 'European business research spending in ICT services: €24.7bn in 2019, €35.1bn in 2023. Up 42 per cent.',
 'Eurostat business enterprise R&D expenditure, ICT services, million current euro, annual. Nominal and undeflated, which is why it is compared with the American series in growth rates and not in levels.'),

('is-europe-in-this', 'dbn.OECD.DSD_ANBERD_DF_ANBERDi4.USA.A.MA.J62_63.USD_PPP.V.B', 'supporting', 4, NULL, 'USA',
 'The American equivalent: $53.6bn in 2019, $79.8bn in 2023. Up 49 per cent — close enough to Europe that the gap is not where the story says it is.',
 'OECD ANBERD, ISIC J62-63, current USD PPP-converted, annual to 2023. Different currency and different classification from the European series, so only the growth rates are compared, and both are nominal in their own economy.'),

('is-europe-in-this', 'fred.A679RC1Q027SBEA', 'context', 5, NULL, 'USA',
 'American investment in information processing equipment and software, up 40 per cent between 2019 and 2024 — in nominal dollars, which is why it cannot be set against the European index above.',
 'BEA fixed investment, nominal, SAAR. Present specifically to make the comparison the page refuses to make visible, so the reader can see what is being declined and why.'),

-- ── frontier-compute ────────────────────────────────────────────────────────
('frontier-compute', 'epoch.training_compute_frontier', 'hero', 1, NULL, NULL,
 'The largest known AI training run, in floating-point operations. Note the axis: this is logarithmic, and each gridline is ten times the one below it.',
 'Epoch AI, irregular dates, estimated rather than disclosed. A sequence of record-holders, so a gap means either that nothing larger was trained or that nothing larger was announced. The last observation is July 2025.'),

('frontier-compute', 'epoch.gpu_cluster_count', 'supporting', 2, NULL, 'USA',
 'Documented large GPU clusters in the United States. Read the most recent year with care — clusters get documented late, so the last point is always the most incomplete.',
 'Epoch AI, count of publicly documented clusters. The 2025 figure of five against 31 in 2024 is far more likely reporting lag than a collapse in building.'),

('frontier-compute', 'derived.datacentre_capacity_mw', 'supporting', 3, NULL, 'USA',
 'The power behind those clusters, in megawatts, as a cumulative stock.',
 'Aggregated from documented sites. Included as the physical constraint: training compute is bounded by power delivered to a site, and megawatts is the unit that binds.'),

('frontier-compute', 'fred.PCU518210518210', 'context', 4, NULL, 'USA',
 'What renting compute costs, as the price side of the same trade.',
 'PPI for data processing, hosting and related services. A contract price rather than a price per unit of computation, which is exactly the wrong denominator for this page and the only one available.'),

-- ── sector-jobs ─────────────────────────────────────────────────────────────
('sector-jobs', 'fred.USINFO', 'hero', 1, NULL, 'USA',
 'US information-sector employment. It peaked at 3.72 million in March 2001, was 3.06 million in 2022, and averaged 2.79 million over the first seven months of 2026.',
 'BLS establishment survey, NAICS Information, thousands of persons, monthly. Read as annual means so seasonal movement is not mistaken for trend. The sector includes publishing, film, broadcasting and telecoms, all of which have been shedding jobs since 2001.'),

('sector-jobs', 'fred.RVAI', 'supporting', 2, NULL, 'USA',
 'What the same sector produced: $1,496bn in 2022, $1,963bn by early 2026. Output up by a third while headcount fell by nine per cent.',
 'BEA real value added by industry, chained 2017 dollars, quarterly. Real value added rises when output deflators change as well as when more is produced, and software deflators are among the least settled in the accounts.'),

('sector-jobs', 'derived.information_employment_share', 'supporting', 3, NULL, 'USA',
 'The sector''s share of all US employment: 1.75 per cent, the lowest in a series that starts in 1990 and peaked at 2.80 per cent in 2001.',
 'Information-sector payrolls over total non-farm payrolls, monthly. On its own chart because it is a percentage; included so the headcount fall is read against an economy that has grown.'),

('sector-jobs', 'fred.PAYEMS', 'context', 4, NULL, 'USA',
 'Total US employment, the denominator of the line above, at a record.',
 'BLS total non-farm payrolls, thousands, monthly. Present so that "the sector is shrinking" is visibly a statement about a share as well as a level.'),

-- ── skills-shortage ─────────────────────────────────────────────────────────
-- Four quantities, four charts. Two of them are shares of firms but on
-- different sampling frames and different questions, so they are not grouped.
('skills-shortage', 'dbn.Eurostat.jvs_q_nace2.Q.NSA.J.TOTAL.JVR.EU27_2020', 'hero', 1, NULL, NULL,
 'The share of posts standing vacant in the EU''s information and communication sector: 4.3 per cent at the 2022 peak, 2.2 per cent in the third quarter of 2025 — the lowest since 2013.',
 'Eurostat quarterly job vacancy statistics, NACE J, EU27, NOT seasonally adjusted. Third quarters run low in this series, so the 2.2 should be read as part of a trend across years rather than as a level.'),

('skills-shortage', 'dbn.Eurostat.isoc_ske_itrcrn2.A.GE10.C10-S951_X_K.E_ITSPVAC2.PC_ENT.EU27_2', 'supporting', 2, NULL, NULL,
 'The share of EU firms that tried to hire a technology specialist and could not. It peaked in 2022 and has eased since.',
 'Eurostat ICT skills survey, enterprises with 10+ employees reporting hard-to-fill vacancies for ICT specialists. Biennial in places — 2013, 2021 and 2023 are missing — so the shape between points is not observed.'),

('skills-shortage', 'dbn.Eurostat.isoc_sks_itspt.A.PC_EMP.EU27_2020', 'supporting', 3, NULL, NULL,
 'The stock rather than the flow: technology specialists as a share of everyone employed in the EU. Still rising, every year, through the whole period above.',
 'Eurostat, employed ICT specialists as a percentage of total employment, EU27, annual from the labour force survey. A stock responds to a hiring freeze over several years, which is why it moves against the vacancy series rather than with it.'),

('skills-shortage', 'dbn.OECD.DSD_ICT_B_DF_BUSINESSES.OECD.A.H1_B.PT_ENT._T.S_GE10', 'context', 4, NULL, NULL,
 'The share of OECD firms that employ any technology specialist at all — flat at about a fifth for a decade.',
 'OECD ICT access and use by businesses, 10+ employees. A different frame and a different question from the Eurostat hard-to-fill series, so it is kept on its own chart rather than grouped with it.'),

-- ── ai-wages ────────────────────────────────────────────────────────────────
-- Unit labour costs and output per hour share a unit and a base year, and the
-- relationship between them is what makes either meaningful.
('ai-wages', 'fred.ULCNFB', 'hero', 1, 'us-labour-cost', 'USA',
 'What an hour of US output costs in pay: up 19.5 per cent between 2019 and the first half of 2026.',
 'BLS nonfarm business unit labour costs, index 2017 = 100, quarterly. Compensation per unit of output, so it already nets out productivity — if the question were the price of an hour of labour, average hourly earnings would be the series, and it is not in this catalogue.'),

('ai-wages', 'fred.OPHNFB', 'supporting', 2, 'us-labour-cost', 'USA',
 'Output per hour on the same axis and the same base. Unit labour costs rise only when pay outruns this line, and since 2019 it has.',
 'Same publication, same base year, same frequency. Grouped deliberately: the gap between the two is the entire content of the hero series and should be visible rather than inferred.'),

('ai-wages', 'dbn.NBS.A_A040I.A040I08', 'supporting', 3, NULL, 'CHN',
 'The only sectoral wage series in this database: average pay in China''s IT sector, ¥122,478 in 2016 and ¥238,966 in 2024. There is nothing here to compare it against.',
 'NBS average wage in urban units, information transmission, software and IT services, nominal yuan, annual to 2024. Included because its absence elsewhere is the finding: no US or UK sectoral wage series has been ingested, and until one is, every wage claim on this site rests on surveys of job advertisements.'),

('ai-wages', 'dbn.RBA.H4.GNFULCYP', 'context', 4, NULL, 'AUS',
 'Australian unit labour cost growth, as a second economy''s version of the same measure.',
 'RBA table H4, year-ended growth in non-farm unit labour costs, quarterly, including forecast quarters at the end of the series. A growth rate rather than an index, so it takes its own chart.'),

-- ── aggregate-unemployment ──────────────────────────────────────────────────
('aggregate-unemployment', 'wb.SL.UEM.TOTL.ZS', 'hero', 1, NULL, 'WLD',
 'World unemployment: 5.59 per cent in 2019, 4.79 in 2025 — the lowest in a series that starts in 2000. This is the weakest test in the dashboard and the technology has not failed it.',
 'World Bank harmonised unemployment, ILO modelled estimate, world aggregate, annual. Harmonises labour force surveys of very different quality across countries, is revised, and is published once a year — a resolution far coarser than the effect being looked for.'),

('aggregate-unemployment', 'fred.PAYEMS', 'supporting', 2, NULL, 'USA',
 'US employment at a record 158.7 million over the first seven months of 2026.',
 'BLS total non-farm payrolls, monthly, thousands. On its own chart: a count on a completely different scale from the rates around it.'),

('aggregate-unemployment', 'dbn.STATJP.MIm.M.EP.B.TTP.SA', 'supporting', 3, NULL, 'JPN',
 'Japanese employment, also at a record, in an economy with a shrinking working-age population.',
 'Statistics Bureau of Japan labour force survey, employed persons, seasonally adjusted, monthly, in tens of thousands. Japan is the clearest case where labour scarcity means AI substitutes for workers who do not exist rather than for workers who do.'),

('aggregate-unemployment', 'fred.LNS14024887', 'context', 4, NULL, 'USA',
 'US youth unemployment, the one number on this page that has risen — and it is still below its 2015 level.',
 'BLS unemployment rate, 16 to 24, monthly. The narrowest measure here and the one where a hiring effect would appear first, which is why it is the exception worth showing.'),

-- ── chip-prices ─────────────────────────────────────────────────────────────
-- Both American series are indices, so the rebase is suppressed and they would
-- be drawn raw. Their bases are five years apart, so they are kept apart: a 30
-- against a 108 is not a comparison.
('chip-prices', 'fred.PCU334413334413', 'hero', 1, NULL, 'USA',
 'US producer prices for semiconductors: 153 in January 1990, 30 by 2021, and 29.9 over the first seven months of 2026. Thirty years of falling, then five years of nothing.',
 'PPI for semiconductor and related device manufacturing, index December 1998 = 100, monthly. Covers memory, logic, analogue and discrete devices together. Quality adjustment is unusually consequential here and the method choices behind it are not exposed by the published series.'),

('chip-prices', 'fred.PCU333242333242', 'supporting', 2, NULL, 'USA',
 'The machines that make the chips, going the other way: 89.9 in 2021 to 107.5 over the first seven months of 2026.',
 'PPI for semiconductor machinery manufacturing, index December 2003 = 100. Kept off the axis above because the base periods are five years apart and both series are indices, which means nothing would be rebased and the levels would invite a comparison that has no meaning.'),

('chip-prices', 'dbn.BOJ.CGPI.2300440015', 'supporting', 3, NULL, 'JPN',
 'A second country''s view of the same equipment: Japan''s export price index for semiconductor-making machinery, up twelve per cent between 2020 and May 2024.',
 'Bank of Japan corporate goods price index, export prices in contract currency, index 2020 = 100. An independent construction by a different statistical office reaching the same conclusion, which is worth more than a second American series would be. Ends May 2024.'),

('chip-prices', 'fred.IPG334S', 'context', 4, NULL, 'USA',
 'How much is being made, as the quantity counterpart to the prices above.',
 'Federal Reserve industrial production for computer and electronic products. Present so that flat prices are read against rising volume rather than in isolation.'),

-- ── compute-price-abroad ────────────────────────────────────────────────────
-- The three Japanese series share an office, a unit and a base year, which is
-- exactly the case for one axis. The US index has its own because its base is
-- eleven years earlier.
('compute-price-abroad', 'fred.PCU518210518210', 'hero', 1, NULL, 'USA',
 'The US price of data processing and hosting. It rose 11.5 per cent between 2019 and the first seven months of 2026 — as much as in the whole nineteen years before that.',
 'PPI for data processing, hosting and related services, index December 2000 = 100, monthly. Prices a contract rather than a unit of computation: a customer paying the same for twice the capacity registers as no change.'),

('compute-price-abroad', 'dbn.BOJ.SPPI.5201450003', 'supporting', 2, 'japan-compute-prices', 'JPN',
 'Japan''s price for internet data centres: 100.0 in 2015, 97.6 in early 2024. It has not risen at all.',
 'Bank of Japan services producer price index, index 2015 = 100, monthly to April 2024. Domestic transaction prices in yen — a flat index is consistent with Japanese buyers facing much higher effective prices for compute bought abroad, given the yen over this period.'),

('compute-price-abroad', 'dbn.BOJ.SPPI.5201350004', 'supporting', 3, 'japan-compute-prices', 'JPN',
 'Japanese cloud application services on the same axis, and actually cheaper than in 2015.',
 'Same publication, same base, same frequency, so the three Japanese lines are directly comparable with each other. Ends April 2024.'),

('compute-price-abroad', 'dbn.BOJ.SPPI.5201330001', 'supporting', 4, 'japan-compute-prices', 'JPN',
 'And the price of writing software, up thirteen per cent. In Japan the people got dearer and the machines did not.',
 'Same publication and base. The contrast between this line and the two below it is the most useful thing on the page and is only readable because all three share an axis.'),

-- ── bulk-discount ───────────────────────────────────────────────────────────
-- One axis is compulsory here: the question is the gap between two levels in
-- the same unit, and two charts cannot show a gap.
('bulk-discount', 'dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR.EU27_2020', 'hero', 1, 'eu-electricity-bands', NULL,
 'What the very largest EU industrial electricity buyers pay — those taking 150 gigawatt-hours a year or more. €0.0381 a kilowatt-hour in early 2007, €0.1022 in early 2025.',
 'Eurostat electricity prices for non-household consumers, band IG, excluding taxes and levies, EUR per kWh, semiannual. Bands are defined by consumption volume, not by industry, so smelters, chemical plants and data centres sit in this line together.'),

('bulk-discount', 'dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR.EU27_2020', 'supporting', 2, 'eu-electricity-bands', NULL,
 'What merely large buyers pay — 20 to 70 gigawatt-hours a year. The gap between these two lines is the bulk discount, and it has narrowed from 39 per cent to 15.',
 'Same publication, same unit, same tax treatment, same periodicity, band IE. On one axis because the question is entirely about the distance between the two levels, which cannot be read from two charts.'),

('bulk-discount', 'fred.DHHNGSP', 'supporting', 3, NULL, 'USA',
 'Natural gas, which explains the shape of both lines above between 2021 and 2023 better than anything about electricity does.',
 'Henry Hub spot price, daily, USD per million BTU. An American benchmark standing in for a European gas shock, which is a real mismatch — included because the confounder should be visible rather than described.'),

('bulk-discount', 'dbn.EIA.ELEC.PRICE.US-IND.M', 'context', 4, NULL, 'USA',
 'The American industrial electricity price over the same years, for scale.',
 'EIA average retail price of electricity, industrial sector, cents per kWh, monthly. A different currency and a different unit, so it takes its own chart and is read as a trend rather than as a level against the European lines.'),

-- ── labour-vs-compute ───────────────────────────────────────────────────────
('labour-vs-compute', 'fred.ULCNFB', 'hero', 1, 'us-labour-index', 'USA',
 'What an hour of American output costs in pay: up 19.5 per cent between 2019 and the first half of 2026.',
 'BLS nonfarm business unit labour costs, index 2017 = 100, quarterly. Economy-wide, while the labour AI plausibly substitutes for is a specific and relatively expensive slice — so this is the wrong slice, measured well.'),

('labour-vs-compute', 'fred.OPHNFB', 'supporting', 2, 'us-labour-index', 'USA',
 'Output per hour on the same axis and base. Unit labour costs rise only when pay outruns this, and over these seven years it did.',
 'Same publication, same base year. Grouped so the relationship between pay and productivity is visible; the hero series is a ratio of the two underlying quantities and is uninterpretable without it.'),

('labour-vs-compute', 'fred.PCU518210518210', 'supporting', 3, NULL, 'USA',
 'The price of renting compute, up 11.5 per cent over the same period — eight points less than labour.',
 'PPI for data processing, hosting and related services, index December 2000 = 100. The weakest series on the page for the job it is doing: it prices contracts and makes no allowance for a dollar buying far more computation than it did in 2019.'),

('labour-vs-compute', 'fred.PCU334413334413', 'context', 4, NULL, 'USA',
 'The hardware underneath it, eight per cent cheaper than in 2019.',
 'PPI for semiconductor and related device manufacturing. The one price on this page that actually fell, and the reason the substitution argument has any force at all.'),

-- ── when-noticed ────────────────────────────────────────────────────────────
('when-noticed', 'derived.ai_regulation_volume', 'hero', 1, NULL, 'USA',
 'Every AI-related document the US Federal Register published each month since 1996. Between one and six a year until 2011; twenty-one in 2012; 248 in the first eight months of 2026.',
 'Six-term keyword match, deduplicated on the government''s document number. Detects when six phrases entered federal writing, which is a lower bound on when the subject entered federal attention. The 2026 figure covers eight months — the series ends 1 August 2026.'),

('when-noticed', 'derived.ai_proposed_rules', 'supporting', 2, 'us-rules', 'USA',
 'The proposals inside that total. Two before 2011, forty-four in the first eight months of 2026.',
 'Notices of proposed rulemaking on the same match and the same monthly basis. Shares an axis with rules in force: same unit, comparable scale.'),

('when-noticed', 'derived.ai_binding_rules', 'supporting', 3, 'us-rules', 'USA',
 'And the rules actually in force. Neither line existed in any meaningful sense before 2011.',
 'Final rules, same match and basis. The 2024 total of 57 is high enough relative to its neighbours that a single agency batch should be ruled out before it is interpreted — the same check that `executive-action` and `rule-conversion` both need.'),

('when-noticed', 'derived.sec_ai_mention_rate', 'context', 4, NULL, 'USA',
 'When companies started telling their investors, for comparison: one in two hundred in 2015, three in five now.',
 'Share of 10-K filings matching "artificial intelligence". A private-sector counterpart on the same kind of keyword logic, and subject to the same objection — it counts language, not exposure.'),

-- ── rules-vs-adoption ───────────────────────────────────────────────────────
('rules-vs-adoption', 'derived.ai_regulation_volume', 'hero', 1, NULL, 'USA',
 'US AI regulatory documents: 120 in 2023, 243 in 2024. A doubling in one year.',
 'Six-term keyword match, monthly, deduplicated. US federal only, against adoption series covering the whole OECD — the populations do not match, which is stated in the caveat rather than smoothed over.'),

('rules-vs-adoption', 'dbn.OECD.DSD_ICT_B_DF_BUSINESSES.OECD.A.G14_B.PT_ENT._T.S_GE10', 'supporting', 2, 'oecd-ai-adoption', NULL,
 'The share of OECD firms using AI, which doubled in the same year: 8.7 per cent in 2023, 14.3 in 2024.',
 'OECD ICT access and use by businesses, all sectors, 10+ employees, annual. A step of this size in an annual survey is also what a revised question wording produces.'),

('rules-vs-adoption', 'dbn.OECD.DSD_ICT_B_DF_BUSINESSES.OECD.A.G14_B.PT_ENT.J.S_GE10', 'supporting', 3, 'oecd-ai-adoption', NULL,
 'And inside information and communication, from 28.7 per cent to 45.8 across the same twelve months.',
 'Same survey, NACE J. Shares an axis with the all-sector line; the two are the same measure on different populations.'),

('rules-vs-adoption', 'derived.sec_ai_mention_rate', 'context', 4, NULL, 'USA',
 'The only series here that is American on both sides of the comparison: what US firms tell their own regulator.',
 'Share of 10-K filings mentioning AI, quarterly. Included because it is the closest available match in jurisdiction to the rulemaking series, which the OECD adoption panels are not.'),

-- ── cost-of-compliance ──────────────────────────────────────────────────────
('cost-of-compliance', 'derived.ai_binding_rules', 'hero', 1, NULL, 'USA',
 'US AI rules in force: 16 in 2023, 57 in 2024, 33 in 2025. These are the ones that create an obligation somebody has to pay for.',
 'Final rules matched on six AI terms, monthly. The 2024 figure may be one agency publishing a batch of related rules, which would make the largest movement on this page meaningless — check before interpreting.'),

('cost-of-compliance', 'fred.PCU518210518210', 'supporting', 2, NULL, 'USA',
 'The producer price for the industry those rules mostly land on. It rose 4.5 per cent across 2023 to 2025, against 4.0 per cent across 2019 to 2021.',
 'PPI for data processing, hosting and related services, monthly. Matched in jurisdiction to the rules series, which is unusual in this lens; but it moves for electricity, hardware, wages and market structure as well, and none of those can be held constant here.'),

('cost-of-compliance', 'derived.ai_regulation_volume', 'supporting', 3, NULL, 'USA',
 'All AI documents, not only the binding ones, since guidance and notices impose cost too.',
 'The superset. On its own chart so it is not read as a total of the rules line above; notices, requests for information and guidance make up the difference.'),

('cost-of-compliance', 'fred.SPASTT01USM661N', 'context', 4, NULL, 'USA',
 'What the market made of all of it, which is nothing detectable.',
 'OECD share price index for the United States, index 2015 = 100, monthly. A whole-market index that responds to everything at once and cannot be decomposed — present as the honest upper bound on what an equity series can contribute here.')

ON CONFLICT (question_id, indicator_id) DO UPDATE SET
  role = EXCLUDED.role, sort_order = EXCLUDED.sort_order,
  chart_group = EXCLUDED.chart_group, country_iso3 = EXCLUDED.country_iso3,
  caption_plain = EXCLUDED.caption_plain, caption_expert = EXCLUDED.caption_expert;


-- ── One reversal of 007_corrections.sql, with the reasoning ─────────────────
--
-- 007 deactivated the EU electricity price series for consumption band IE
-- (20,000-69,999 MWh a year) under the heading "Duplicate: two electricity
-- price bands, one question", keeping band IG (150,000 MWh and over) on the
-- grounds that IG is the hyperscale band and IE is a large factory.
--
-- Both halves of that are true and the conclusion does not follow. IE and IG
-- are not two publications of one statistic — they are the prices paid by two
-- different populations, and the DIFFERENCE between them is a quantity neither
-- one contains. That difference is the bulk discount for buying power at
-- data-centre scale, and on these two series it has narrowed from 39 per cent
-- in 2007 to 15 per cent in 2025, inverting entirely in the first half of 2022.
-- There is no other way to compute it from anything in this catalogue.
--
-- So the audit was right that IG is the series to use when you want one line,
-- and wrong that IE is redundant. It is reactivated here for exactly one page.
-- Reactivating also puts it back in the ingestion runner, which is correct: it
-- is the same Eurostat dataset, on the same schedule, as the band already
-- being fetched.
--
-- TO PUT IT BACK AS 007 LEFT IT:
--   UPDATE indicators SET is_active = FALSE
--    WHERE id = 'dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR.EU27_2020';
--   -- and then `bulk-discount` has to be deleted, because without both bands
--   -- the question it asks cannot be answered at all.

UPDATE indicators
   SET is_active = TRUE, updated_at = now()
 WHERE id = 'dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR.EU27_2020';


-- ── Three report figures move from the labour lens onto `ai-wages` ───────────
--
-- These are the only three figures in the whole extracted set that measure a
-- wage. They sit at lens level, which is where a figure goes when no question
-- is a better home for it — and `ai-wages` now is. `report_figures` allows
-- exactly one parent (`report_figures_one_parent` checks
-- num_nonnulls(question_id, lens_id) = 1), so acquiring a question means
-- releasing the lens.
--
-- THE COST OF DOING THIS, STATED PLAINLY. `ai-wages` is inactive. Until it is
-- activated these three charts are not reachable by any reader: they leave the
-- Labour Markets lens page immediately and arrive nowhere. Five figures remain
-- on the lens. If that trade is not wanted, delete this block — nothing else in
-- the file depends on it, though `ai-wages` would then quote three figures that
-- are not on its own page.
--
-- Seeds run in filename order inside one transaction, so this runs after 023
-- has restored `lens_id = 'labour'` and wins. Editing 023 instead would put the
-- placement in the file that owns the figure, which is the tidier home for it
-- once this has been reviewed — 023 belongs to the figure-verification work and
-- is deliberately not touched here.
--
-- TO REVERT:
--   UPDATE report_figures SET question_id = NULL, lens_id = 'labour'
--    WHERE id IN ('pwc-ai-skill-wage-premium-by-sector',
--                 'pwc-wage-growth-by-ai-exposure',
--                 'imf-skills-wage-premium-four-plus-new-skills');

UPDATE report_figures
   SET question_id = 'ai-wages', lens_id = NULL
 WHERE id IN ('pwc-ai-skill-wage-premium-by-sector',
              'pwc-wage-growth-by-ai-exposure',
              'imf-skills-wage-premium-four-plus-new-skills');

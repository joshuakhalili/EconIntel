-- ============================================================================
-- 009_questions.sql — the editorial layer, populated
--
-- Before this file, four indicators out of eighty-five appeared as a chart. The
-- rest existed only as table rows with an axis-less sparkline. An indicator
-- that is ingested but never surfaced is, from outside, indistinguishable from
-- one that was never collected.
--
-- Every populated indicator is assigned below. The `orphaned_indicators` view
-- exists to keep it that way.
--
-- ON THE TWO TEXT VARIANTS
-- `answer_plain` and `caption_plain` are for a reader who follows the economy
-- but is not an economist: terms defined in passing, no assumed vocabulary.
-- `answer_expert` and `caption_expert` assume the vocabulary and spend the room
-- saved on method, base years and known limitations. Neither is a dumbed-down
-- version of the other — the expert text is not the plain text plus jargon, it
-- answers a different question, which is usually "how was this measured and
-- where does it mislead".
--
-- CORRECTIONS, 2026-09-03 — every figure re-derived against the database
--
--   money       "the fastest-growing line in the national accounts" was a
--               ranking nothing here can support. NIPA runs to hundreds of
--               lines; this database holds six (dbn.BEA.NIPA-%), two of them
--               on this page, so the comparison class does not exist. It also
--               read as present tense from a series whose last observation is
--               2024. Replaced with the five values that exist on
--               dbn.BEA.NIPA-T50405.LA001282-A: 9,231 (2020) to 31,141
--               (2024), millions of current USD, a 3.37x rise.
--
--   jobs        said the information-sector share "has been falling since
--               2023, having risen for most of the decade before". Backwards.
--               Annual means peak at 2.750 in 2000 and fall to 1.898 by 2019;
--               the only sustained rise is 2019-2022 (to 2.008); 2026 to July
--               averages 1.757. See 019 for the full note — the same sentence
--               appeared in five files.
--
--   productivity  "AMECO and RBA series mix official forecasts into history
--               past 2025 and are marked accordingly" was wrong twice for the
--               RBA: its six future-dated rows on GNFPROSQI and GNFULCYP are
--               all NULL placeholders, not forecasts, and nothing is drawn
--               from them. The real contamination is AMECO's 2026 point, which
--               029's "dated after today" rule cannot catch and which is drawn
--               solid. Caveat now names AMECO only and says which points.
--
--   building    "roughly 2,600 MW worldwide" — the register sums to 2,536.74
--               across 28 countries, so 2,500 is the nearer round number. The
--               same figure was duplicated at 010:263 and is fixed there too.
--
--   policy      "mostly proposing rather than enacting" is false on every cut:
--               binding rules 241 against 223 proposals all-time, 189/183 from
--               2020, 152/126 from 2023. And "roughly a hundred months of
--               rules" was the ROW COUNT (101 months) phrased so a reader
--               takes 100 to be the number of rules. Both fixed, and the
--               caveat now states the counting method and disowns the
--               pre-2012 tail. The same sentence on the regulation lens page
--               (012:74) is fixed in the same pass.
-- ============================================================================

INSERT INTO questions (id, slug, question, subtitle, answer_plain, answer_expert, caveat, sort_order, icon) VALUES

('adoption', 'adoption', 'Is AI actually being used?',
 'Measured adoption, not announcements',
 'Yes, and faster than almost any previous technology. Three in five US public companies now mention AI in their annual report, up from one in two hundred a decade ago. In Europe, one firm in five uses it — but that average hides an enormous spread: two thirds of software companies, one in six factories.',
 'Adoption is measured three independent ways here: self-reported enterprise use (Eurostat/OECD ICT surveys, 10+ employee firms), disclosure incidence in SEC 10-K filings, and cloud services uptake as an infrastructure precondition. The survey and disclosure measures agree on direction and disagree on level, which is expected — the first asks firms what they do, the second observes what they tell a regulator under liability. Sectoral dispersion is larger than the cross-country dispersion.',
 'Self-reported adoption counts firms that use AI at all, not how much or how well. A company running one chatbot and one running its operations on models are the same data point. None of these series measures intensity, and no free source does.',
 1, 'trending-up'),

('money', 'money', 'Where is the money going?',
 'Investment, capital spending and research',
 'Into computers, software and the buildings that house them. US investment in information-processing equipment and software runs at over $1.6 trillion a year. The narrower measure — money spent on data-centre buildings specifically — is small by comparison and grew fast for as long as it was reported: $9.2bn in 2020 to $31.1bn in 2024, more than a tripling in four years, with 2024 the last year the series covers.',
 'Capital formation is shown at three levels of aggregation: BEA NIPA fixed investment in information-processing equipment and software (quarterly, SAAR), the data-centre structures line from NIPA table 5.4.5, and business R&D in programming and IT services from OECD ANBERD. Note the deflator problem — nominal series overstate real capital deepening where quality-adjusted prices are falling as fast as they are in semiconductors. The national accounts run to hundreds of lines and this dashboard holds six of them, two of which are on this page, so nothing here can rank the data-centre line against the rest of NIPA and this page does not try to.',
 'Investment data is nominal and revised, often substantially. The data-centre structures series began only in 2020 and last reports 2024 — five annual observations in all — so it has neither a pre-AI baseline to compare against nor coverage of the two most recent years of the build-out. Private company spending is invisible except where it reaches a public filing.',
 2, 'banknote'),

('jobs', 'jobs', 'Is it changing work?',
 'Employment, vacancies and pay',
 'There are early signs, and they are small. The share of US jobs in the information sector — the part of the economy most exposed to AI — peaked at 2.75% of non-farm payrolls in 2000 and has fallen since, apart from a rise between 2019 and 2022; every month of 2026 so far is the lowest reading in a series that starts in 1990. UK technology vacancies are below where they were in 2001. Neither is proof, and the fall long predates AI, but both are the sort of thing you would expect to see first.',
 'The identification strategy is comparison, not level: an AI-exposed group against a control that shares its macro shocks. Information-sector employment as a share of total non-farm payrolls cancels the business cycle affecting both. Vacancy series lead employment series because hiring intent adjusts before headcount. The confound is that the information sector was already consolidating post-2022 for reasons unrelated to AI, principally interest rates.',
 'Nothing here isolates AI as a cause. The absence of occupation-level data is the largest gap in this dashboard: one series covers US clerical work and nothing else does. Youth and graduate employment, where substitution of entry-level tasks would appear first, is not yet held.',
 3, 'users'),

('productivity', 'productivity', 'Is it making us more productive?',
 'The question everything else is asked in service of',
 'Not yet, and that is the expected answer rather than a disappointing one. US and UK productivity have been broadly flat through the entire AI investment boom. Historically, general-purpose technologies take a decade or more to show up in these statistics — electricity took roughly forty years — so a flat line here in 2026 tells you very little either way.',
 'Output per hour, multifactor productivity and unit labour costs, for the US, UK, EU27 and Australia. The J-curve literature predicts an initial productivity DECLINE during heavy intangible investment, since the investment is expensed while the complementary reorganisation is unmeasured, so a flat or falling series is consistent with large future gains as well as with none. ICT capital deepening contribution decomposes how much measured growth is attributable to IT capital at all.',
 'This is the weakest causal link in the dashboard and it is presented last for that reason. Aggregate productivity is affected by everything at once; attributing any part of it to AI in 2026 is not currently possible with public data. One forecast on this page is drawn as though it were a measurement: AMECO is the European Commission''s macroeconomic database, and the later years of its UK total-factor-productivity series are the Commission''s own projections. The 2027 point is marked as projected and drawn dashed; the 2026 point is not, because the marking rule only catches periods dated after today and 1 January 2026 has passed — yet 2026 is an annual figure for a year that has not ended, so it cannot be an outturn either. Read the last two UK points as forecast. The Australian RBA series carry no forecasts at all: that source publishes empty quarters ahead of its data, out to March 2027, and an empty period is never drawn.',
 4, 'activity'),

('building', 'building', 'What is being built?',
 'The physical infrastructure behind the software',
 'A great deal, very quickly. Publicly known US data-centre capacity went from under 400 megawatts in 2023 to nearly 2,000 in 2025 — roughly a fivefold rise in two years. That is real concrete, real transformers and real electricity, and unlike survey data it is hard to exaggerate.',
 'Physical build-out is tracked through Epoch AI''s cluster register (capacity in MW, cumulative, a documented lower bound), semiconductor and computer manufacturing output indices, new orders, manufacturing construction spending, and electricity generation and industrial sales. Chinese integrated-circuit output is included as the supply-side counterpart. The MW figures cover disclosed clusters only and systematically understate total capacity.',
 'The capacity figures are a floor, not a total. Epoch documents publicly known clusters; many are undisclosed, and the register carries roughly 2,500 MW worldwide, which is certainly less than what exists. Treat the trend as informative and the level as a minimum, and note that the register itself last reports 2025. The Japanese data-centre price index alongside is not current either: the Bank of Japan last published it for April 2024, so it describes 2024 and says nothing about the two years since.',
 5, 'server'),

('policy', 'policy', 'What are governments doing?',
 'Regulation, proposals and executive action',
 'More is binding than is pending. The Federal Register has published 241 AI-related rules — documents that are law when they appear — against 223 proposals, which may or may not become law. Rules outnumber proposals on every window: 189 to 183 counting from 2020, 152 to 126 counting from 2023. Fifty presidential documents sit alongside them; executive orders move fastest, days rather than years, and are the easiest for a successor to undo. The counts reach back to the 1990s, and the earliest of them should not be read as AI policy — the caveat says why.',
 'Federal Register documents matched on six AI-related search terms, deduplicated on the government''s own document number, split by document type. The distinction is load-bearing: a Rule is enforceable, a Proposed Rule carries a comment period and leads a Rule by 12–24 months where it converts at all, and a Presidential Document is unilateral and reversible. The gap between proposals and rules measures conversion of intent into obligation — and on these counts it has closed, with rules ahead of proposals on every cut of the data.',
 'These are counts of documents whose text matches one of six search terms — "artificial intelligence", "machine learning", "automated decision", "algorithmic", "foundation model", "generative AI" — deduplicated on the government''s own document number. A document counts because it contains one of those phrases, not because anyone has read it, so false positives are possible throughout and are certainly present in the early tail: the proposed-rules count begins in May 1996 and the binding-rules count in November 1998, years in which AI regulation did not exist. Treat the 6 proposals and 9 rules dated before 2012 as term collisions rather than as AI policy. This is also United States only. No comparable machine-readable register exists free for the EU, UK or China, so the policy picture here is not global and should not be read as one. Stance classification — whether a document is permissive or restrictive — requires document-level analysis that is not yet implemented.',
 6, 'landmark'),

('markets', 'markets', 'What is it doing to prices?',
 'The cost of compute, chips and power',
 'Compute is getting cheaper and the things that make it are getting more expensive. Semiconductor prices have fallen to under a third of their 1998 level, which is the quiet foundation everything else rests on. But electricity for large industrial users, and the machines that make chips, have gone the other way.',
 'Producer price indices for semiconductor manufacturing, semiconductor machinery, and data processing and hosting services — the closest available proxy for a cloud price index. Different base years (Dec 1998, Dec 2003, Dec 2000) mean these must be re-indexed to a common period before appearing on a shared axis. Industrial electricity tariffs are included for the US and EU because power is the binding constraint on where capacity is built.',
 'There is no true commodity coverage yet — no copper, oil or gas — and no equity or sector index, because most free market-data providers forbid public redisplay. Price indices are not prices; they measure change from a base year, not level.',
 7, 'coins')

ON CONFLICT (id) DO UPDATE SET
  question = EXCLUDED.question, subtitle = EXCLUDED.subtitle,
  answer_plain = EXCLUDED.answer_plain, answer_expert = EXCLUDED.answer_expert,
  caveat = EXCLUDED.caveat, sort_order = EXCLUDED.sort_order,
  icon = EXCLUDED.icon, is_active = TRUE, updated_at = now();

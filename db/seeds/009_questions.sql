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
 'Into computers, software and the buildings that house them. US investment in information-processing equipment and software runs at over $1.6 trillion a year. The narrower measure — money spent on data-centre buildings specifically — is small by comparison but is the fastest-growing line in the national accounts.',
 'Capital formation is shown at three levels of aggregation: BEA NIPA fixed investment in information-processing equipment and software (quarterly, SAAR), the data-centre structures line from NIPA table 5.4.5, and business R&D in programming and IT services from OECD ANBERD. Note the deflator problem — nominal series overstate real capital deepening where quality-adjusted prices are falling as fast as they are in semiconductors.',
 'Investment data is nominal and revised, often substantially. The data-centre structures series began only in 2020, so it has no pre-AI baseline to compare against. Private company spending is invisible except where it reaches a public filing.',
 2, 'banknote'),

('jobs', 'jobs', 'Is it changing work?',
 'Employment, vacancies and pay',
 'There are early signs, and they are small. The share of US jobs in the information sector — the part of the economy most exposed to AI — has been falling since 2023, having risen for most of the decade before. UK technology vacancies are below where they were in 2001. Neither is proof, but both are the sort of thing you would expect to see first.',
 'The identification strategy is comparison, not level: an AI-exposed group against a control that shares its macro shocks. Information-sector employment as a share of total non-farm payrolls cancels the business cycle affecting both. Vacancy series lead employment series because hiring intent adjusts before headcount. The confound is that the information sector was already consolidating post-2022 for reasons unrelated to AI, principally interest rates.',
 'Nothing here isolates AI as a cause. The absence of occupation-level data is the largest gap in this dashboard: one series covers US clerical work and nothing else does. Youth and graduate employment, where substitution of entry-level tasks would appear first, is not yet held.',
 3, 'users'),

('productivity', 'productivity', 'Is it making us more productive?',
 'The question everything else is asked in service of',
 'Not yet, and that is the expected answer rather than a disappointing one. US and UK productivity have been broadly flat through the entire AI investment boom. Historically, general-purpose technologies take a decade or more to show up in these statistics — electricity took roughly forty years — so a flat line here in 2026 tells you very little either way.',
 'Output per hour, multifactor productivity and unit labour costs, for the US, UK, EU27 and Australia. The J-curve literature predicts an initial productivity DECLINE during heavy intangible investment, since the investment is expensed while the complementary reorganisation is unmeasured, so a flat or falling series is consistent with large future gains as well as with none. ICT capital deepening contribution decomposes how much measured growth is attributable to IT capital at all.',
 'This is the weakest causal link in the dashboard and it is presented last for that reason. Aggregate productivity is affected by everything at once; attributing any part of it to AI in 2026 is not currently possible with public data. AMECO and RBA series mix official forecasts into history past 2025 and are marked accordingly.',
 4, 'activity'),

('building', 'building', 'What is being built?',
 'The physical infrastructure behind the software',
 'A great deal, very quickly. Publicly known US data-centre capacity went from under 400 megawatts in 2023 to nearly 2,000 in 2025 — roughly a fivefold rise in two years. That is real concrete, real transformers and real electricity, and unlike survey data it is hard to exaggerate.',
 'Physical build-out is tracked through Epoch AI''s cluster register (capacity in MW, cumulative, a documented lower bound), semiconductor and computer manufacturing output indices, new orders, manufacturing construction spending, and electricity generation and industrial sales. Chinese integrated-circuit output is included as the supply-side counterpart. The MW figures cover disclosed clusters only and systematically understate total capacity.',
 'The capacity figures are a floor, not a total. Epoch documents publicly known clusters; many are undisclosed, and the register carries roughly 2,600 MW worldwide, which is certainly less than what exists. Treat the trend as informative and the level as a minimum.',
 5, 'server'),

('policy', 'policy', 'What are governments doing?',
 'Regulation, proposals and executive action',
 'Mostly proposing rather than enacting. US federal agencies have published roughly a hundred months of AI-related rules that are actually in force, and a similar number of proposals that may or may not become law. Executive orders move fastest — days rather than years — and are the easiest for a successor to undo.',
 'Federal Register documents matched on six AI-related search terms, deduplicated on the government''s own document number, split by document type. The distinction is load-bearing: a Rule is enforceable, a Proposed Rule carries a comment period and leads a Rule by 12–24 months where it converts at all, and a Presidential Document is unilateral and reversible. The gap between proposals and rules measures conversion of intent into obligation.',
 'This is United States only. No comparable machine-readable register exists free for the EU, UK or China, so the policy picture here is not global and should not be read as one. Stance classification — whether a document is permissive or restrictive — requires document-level analysis that is not yet implemented.',
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

-- ============================================================================
-- 012_lenses.sql — five lenses, and the tickers that belong on each
--
-- WHY THESE FIVE
--
-- The first set — Adoption, Money, Work, Infrastructure, Policy — mixed two
-- different kinds of category. Money, Work and Policy are subfields every
-- economy has. Adoption and Infrastructure are AI-specific phenomena that only
-- exist as categories because AI does. Navigating by a mix of the two means a
-- reader cannot tell whether a lens is a branch of economics or a feature of
-- this particular technology, and there was nowhere for prices to live.
--
-- So the lenses are now classical subfields, and the AI-specific material sits
-- inside them as evidence rather than as top-level structure:
--
--   Investment & Capital   ← the old Money, plus Infrastructure as the
--                            physical form that capital takes
--   Growth & Productivity  ← the old Adoption, which is the leading indicator
--                            for the productivity question rather than an end
--                            in itself
--   Labour Markets         ← the old Work
--   Prices & Markets       ← new; commodity, compute and equity prices had no
--                            home and were scattered across two lenses
--   Policy & Regulation    ← the old Policy
--
-- Lens ids deliberately do NOT reuse `adoption`, `money` or `policy`. Each of
-- those strings is simultaneously a lens id, a QUESTION id, and (for two of
-- them) a value of the `pillar` enum on indicators. Three namespaces sharing
-- three words is a trap for any future find-and-replace across db/, so the new
-- ids collide with nothing.
--
-- Ticker placement is the point of the second half of this file. A page that is
-- only a price strip answers no question. The same copper price beside
-- data-centre construction is an argument about build-out; beside a commodity
-- index it is an argument about input costs. Hence a `why` per placement, not
-- per series.
-- ============================================================================

-- `news_query` is websearch syntax, run against documents.search_tsv. Written
-- in the vocabulary REPORTERS use, not the vocabulary the statistics use: no
-- headline says "gross fixed capital formation", it says "invests $10bn".
INSERT INTO lenses (id, slug, name, subtitle, thesis_plain, thesis_expert, sort_order, icon, news_query) VALUES

('investment', 'investment', 'Investment & Capital',
 'What is being spent, and what it buys',
 'Enormous sums are going into computers, software and the buildings that hold them — over $1.6 trillion a year in the US alone. Some of that spending is visible as concrete and transformers: publicly known US data-centre capacity went from under 400 megawatts in 2023 to nearly 2,000 in 2025. Unlike survey data this is hard to exaggerate. The transformers either exist or they do not.',
 'Capital formation at three levels: BEA NIPA fixed investment in information-processing equipment and software, the data-centre structures line from table 5.4.5, and business R&D in programming and IT services from OECD ANBERD. Physical build-out is tracked separately via Epoch AI''s cluster register (cumulative MW, a documented lower bound covering disclosed clusters only). The metals and energy prices here are placed as input costs to that build-out, not as market colour — the same series read as market signal sit on Prices & Markets. Note the deflator problem: nominal series understate real capital deepening where quality-adjusted prices fall as fast as they do in semiconductors.',
 1, 'banknote',
 'investment OR investing OR funding OR capex OR valuation OR IPO OR "venture capital" OR acquisition OR acquires OR "capital spending" OR fundraising OR "data centre" OR "data center" OR megawatt'),

('growth', 'growth', 'Growth & Productivity',
 'Whether any of it shows up in output',
 'AI has spread faster than almost any technology before it, but very unevenly — three in five US public companies now mention it in their annual report, while among European firms only one in five actually uses it. Spread is not the same as effect. The harder question, and the one this lens exists for, is whether all that adoption has yet moved the thing it is supposed to move: output per hour worked.',
 'Adoption is measured three independent ways: self-reported enterprise use (Eurostat/OECD ICT surveys, 10+ employee firms), disclosure incidence in SEC 10-K filings, and cloud uptake as an infrastructure precondition. Survey and disclosure measures agree on direction and disagree on level, which is expected — one asks firms what they do, the other observes what they tell a regulator under liability. Adoption sits on this lens rather than standing alone because it is the leading indicator for the productivity question, not a finding in itself. The measurement problem is Solow''s and remains unresolved: aggregate productivity statistics are too noisy and too lagged to detect an effect this size this early, so an absence of signal here is weak evidence of an absence of effect.',
 2, 'trending-up',
 'productivity OR "economic growth" OR GDP OR efficiency OR output OR adoption OR adopting OR deploying OR rollout OR "generative AI" OR copilot OR "AI tools" OR uptake'),

('labour', 'labour', 'Labour Markets',
 'Jobs, pay and who gets hired',
 'The early signs are small but real. The share of US jobs in the information sector peaked in 2000 and has fallen since, apart from a rise between 2019 and 2022; it is now the lowest in a series that starts in 1990. UK tech vacancies are below their 2001 level. Young people are the place to watch: if AI takes the bottom rung of a career ladder, it shows there first.',
 'Identification is by comparison, not level: an AI-exposed group against a control sharing its macro shocks. Information-sector employment as a share of total non-farm payrolls cancels the cycle affecting both. Vacancy series lead employment because hiring intent adjusts before headcount. The youth panel is OECD-harmonised across eight countries. Principal confound: the information sector was consolidating post-2022 for reasons unrelated to AI, chiefly interest rates.',
 3, 'users',
 'jobs OR hiring OR layoffs OR redundancies OR employment OR unemployment OR graduates OR wages OR salaries OR recruitment OR "job cuts" OR workforce'),

('prices', 'prices', 'Prices & Markets',
 'What it costs, and what markets think',
 'Compute has been getting relentlessly cheaper — semiconductors now cost under a third of their 1998 price — while the physical inputs that make it possible have not. That divergence is the economics of this whole story in one line: the thinking gets cheap, the electricity and the copper do not.',
 'Three distinct price stories share this lens and should not be conflated. Semiconductor and cloud-service PPIs measure the falling cost of compute itself, and are the closest available proxy for whether adoption can keep spreading on cost grounds. Commodity and energy prices measure the rising cost of the physical complement — the same series appear on Investment & Capital, where they are read as input costs to build-out rather than as market signals. Equity prices are included only where licensing permits public redisplay, which is why the OECD share index via FRED appears and most market data does not. None of these establishes causation with respect to AI; they are the price environment the rest of the dashboard has to be read against.',
 4, 'chart-line',
 'prices OR inflation OR "cost of" OR shares OR stocks OR markets OR selloff OR rally OR commodity OR copper OR electricity OR "power prices" OR chips OR semiconductor'),

('regulation', 'regulation', 'Policy & Regulation',
 'What governments are actually doing',
 'More is binding than is pending. The Federal Register has published 241 AI-related rules, which are law when they appear, against 223 proposals that may never become law — and rules lead proposals on every window: 189 to 183 from 2020, 152 to 126 from 2023. Executive orders move in days and can be undone just as fast.',
 'Federal Register documents matched on six AI search terms, deduplicated on document_number, split by type. The distinction is load-bearing: a Rule is enforceable, a Proposed Rule carries a comment period and leads a Rule by 12-24 months where it converts, and a Presidential Document is unilateral and reversible. A document counts because its text matches a term, not because anyone read it, so the counts before about 2012 are term collisions rather than AI policy. United States only — no comparable machine-readable register exists free for the EU, UK or China, which makes this lens the most geographically incomplete of the five.',
 5, 'landmark',
 'regulation OR regulator OR law OR legislation OR government OR ministers OR antitrust OR lawsuit OR court OR ban OR investigation OR copyright')

ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name, subtitle = EXCLUDED.subtitle,
  thesis_plain = EXCLUDED.thesis_plain, thesis_expert = EXCLUDED.thesis_expert,
  sort_order = EXCLUDED.sort_order, icon = EXCLUDED.icon,
  -- news_query MUST be listed here. An earlier seed corrected a value in the
  -- VALUES block, re-ran clean, and changed nothing, because the column was
  -- missing from this list. An ON CONFLICT list is a silent filter on which
  -- of your edits actually apply.
  news_query = EXCLUDED.news_query,
  is_active = TRUE, updated_at = now();


-- ── Re-parent the questions ─────────────────────────────────────────────────
-- All seven keep a parent; nothing is orphaned. `adoption` moves under Growth &
-- Productivity because adoption is the leading indicator for the productivity
-- question, and `building` under Investment & Capital because a data centre is
-- what capital expenditure physically looks like.
--
-- This runs BEFORE the old lens rows are deleted. questions.lens_id is
-- ON DELETE SET NULL, so deleting first would null every parent and leave the
-- questions invisible to getLens and to the nav.
UPDATE questions SET lens_id = 'investment' WHERE id IN ('money', 'building');
UPDATE questions SET lens_id = 'growth'     WHERE id IN ('productivity', 'adoption');
UPDATE questions SET lens_id = 'labour'     WHERE id = 'jobs';
UPDATE questions SET lens_id = 'prices'     WHERE id = 'markets';
UPDATE questions SET lens_id = 'regulation' WHERE id = 'policy';


-- ---------------------------------------------------------------------------
-- Ticker placements.
--
-- Each `why` says what the number is doing on that page. Read them together and
-- the strip becomes an argument about the AI supply chain rather than a price
-- feed: silicon is made from sand and electricity, wired with copper and
-- silver, cooled with aluminium, backed up by lithium and uranium, and run on
-- gas.
--
-- Re-authored rather than moved. A `why` written for "Money" does not answer
-- the question "Investment & Capital" asks, and the per-placement rationale is
-- the entire reason this table exists rather than a lens_id column on
-- indicators.
-- ---------------------------------------------------------------------------
INSERT INTO lens_tickers (lens_id, indicator_id, sort_order, label, why) VALUES

-- ── INVESTMENT & CAPITAL: what the build-out physically costs ───────────────
('investment', 'fred.PCOPPUSDM', 1, 'Copper',
 'A large data centre needs thousands of tonnes of copper for wiring, busbars and transformers. When capacity is being built at scale this is one of the first prices to move, which makes it a check on whether announced investment is actually being spent.'),
('investment', 'fred.PALUMUSDM', 2, 'Aluminium',
 'Server racks, chassis and heat sinks. Cheaper and lighter than copper, used wherever conductivity is not the binding requirement.'),
('investment', 'fred.PNICKUSDM', 3, 'Nickel',
 'In the batteries that carry a site through a power cut, and in the stainless steel of its cooling. A second-order input, included because it moves before capacity is announced rather than after.'),
('investment', 'dbn.IMF.PCPS.lithium', 4, 'Lithium',
 'Backup power storage. The only free source stops at June 2025 — the trend to that point is real, the last year is missing.'),
('investment', 'dbn.IMF.PCPS.uranium', 5, 'Uranium',
 'Several of the largest AI companies have signed nuclear agreements, so fuel price is now part of the capital case for a site. Also stale after June 2025.'),
('investment', 'dbn.EIA.ELEC.PRICE.US-IND.M', 6, 'US power',
 'What American industry pays per kilowatt-hour. Power availability, not chips, is now the usual constraint on where capacity gets built — which makes this closer to a siting decision than a cost line.'),

-- ── GROWTH & PRODUCTIVITY: how far it has actually spread ───────────────────
('growth', 'derived.sec_ai_mention_rate', 1, 'US filings w/ AI',
 'The share of large US companies mentioning AI in their annual report to regulators, where a false claim carries legal liability. The upper bound on adoption: saying it is not doing it.'),
('growth', 'dbn.OECD.DSD_ICT_B_DF_BUSINESSES.EU27.A.G14_B.PT_ENT._T.S_GE10', 2, 'EU firms using AI',
 'One in five European firms now uses AI, up from one in seventeen in 2020. Asked of firms directly, so it measures use rather than mention — and sits far below the filing rate above.'),
('growth', 'dbn.OECD.ict_business.KOR.ai_adoption', 3, 'Korea firms using AI',
 'A third of Korean firms — roughly 13 points above the OECD average and the highest national rate available free anywhere. If adoption produces a measurable productivity effect, Korea is where it should appear first.'),

-- ── LABOUR MARKETS: what labour costs, and who is not being hired ───────────
('labour', 'fred.LNS14024887', 1, 'US youth unemp.',
 'Young Americans looking for work and not finding it. If AI substitutes entry-level tasks first, this moves before any aggregate does.'),
('labour', 'fred.LRHU24TTKRM156S', 2, 'Korea youth unemp.',
 'Korea has the highest measured enterprise AI adoption anywhere, which makes its youth labour market the single most informative case available.'),
('labour', 'fred.CGBD2534', 3, 'US grad unemp.',
 'Unemployment among young American graduates — the credential that was supposed to protect against automation.'),
('labour', 'fred.ULCNFB', 4, 'Unit labour cost',
 'What it costs an employer to produce a unit of output. Falls when output per worker rises faster than pay, which is what an AI productivity gain would look like from the employer''s side.'),
('labour', 'derived.information_employment_share', 5, 'Info-sector share',
 'The most AI-exposed part of the US economy as a share of all jobs. Falling since 2023.'),

-- ── PRICES & MARKETS: the falling cost of thinking, the rising cost of power ─
('prices', 'fred.PCU334413334413', 1, 'Chip prices',
 'Semiconductors have fallen to under a third of their 1998 price. That decades-long deflation is the quiet foundation everything else here rests on — and the reason adoption can keep spreading without anyone deciding it should.'),
('prices', 'fred.PCU518210518210', 2, 'Cloud prices',
 'The closest thing America publishes to a cloud price index. What renting compute costs sets how cheaply adoption can spread, which makes this the price that matters most on this page.'),
('prices', 'fred.PALLFNFINDEXM', 3, 'All commodities',
 'Every major traded commodity in one index, so a move in copper or silver can be read against raw materials generally rather than mistaken for something specific to AI.'),
('prices', 'lbma.silver', 4, 'Silver',
 'The most electrically conductive metal in commercial use, and in every circuit board and connector. Priced here as a traded commodity; its role as a build-out input sits on Investment & Capital.'),
('prices', 'lbma.gold', 5, 'Gold',
 'Used in chip bonding wire, but on this page it is the standard gauge of investor nerves — which is what you want beside an index of shares in the middle of an investment boom.'),
('prices', 'fred.DHHNGSP', 6, 'Nat gas',
 'Gas generates most of the marginal electricity a new American data centre draws, so this is close to the fuel cost of compute itself.'),
('prices', 'fred.SPASTT01USM661N', 7, 'US shares',
 'The broad US share price index. Included because the OECD publishes it through FRED under a licence that permits public redisplay — most market data does not, which is why this page is thinner on equities than it should be.'),

-- ── POLICY & REGULATION: what is enforceable, and what is only proposed ─────
('regulation', 'derived.ai_binding_rules', 1, 'Rules in force',
 'Regulation that is already law. The only one of these counts that obliges anyone to do anything.'),
('regulation', 'derived.ai_proposed_rules', 2, 'Rules proposed',
 'Intentions with a comment period. Leads binding rules by 12 to 24 months, where it converts at all.'),
('regulation', 'derived.ai_presidential_documents', 3, 'Executive actions',
 'Move in days rather than years, and a successor can undo them just as fast. A measure of attention, not of durable policy.'),
('regulation', 'derived.ai_regulation_volume', 4, 'All AI documents',
 'Every AI-related federal document regardless of type — the total the three counts above decompose.')

ON CONFLICT (lens_id, indicator_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order, label = EXCLUDED.label, why = EXCLUDED.why;


-- ── Retire the previous taxonomy ────────────────────────────────────────────
-- Last, and only after every question has been re-parented above. Deleting a
-- lens cascades to its lens_tickers, so the old placements go with it; the new
-- ones were inserted under new ids and are unaffected.
DELETE FROM lenses WHERE id IN ('adoption', 'money', 'work', 'infrastructure', 'policy');

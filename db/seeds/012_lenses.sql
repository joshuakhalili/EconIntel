-- ============================================================================
-- 012_lenses.sql — five lenses, and the tickers that belong on each
--
-- Ticker placement is the point of this file. A "Finance" page that is only a
-- price strip answers no question. The same copper price sitting beside data
-- centre construction spending and the news from that month is an argument
-- about input costs — and beside GPU cluster counts it is an argument about
-- physical build-out. Hence a `why` per placement, not per series.
-- ============================================================================

INSERT INTO lenses (id, slug, name, subtitle, thesis_plain, thesis_expert, sort_order, icon) VALUES

('adoption', 'adoption', 'Adoption',
 'Who is actually using it',
 'AI has spread faster than almost any technology before it, but very unevenly. Three in five US public companies now mention it in their annual report; among European firms, one in five uses it — two thirds of software companies, one in six factories.',
 'Adoption is measured three independent ways: self-reported enterprise use (Eurostat/OECD ICT surveys, 10+ employee firms), disclosure incidence in SEC 10-K filings, and cloud uptake as an infrastructure precondition. Survey and disclosure measures agree on direction and disagree on level, which is expected — one asks firms what they do, the other observes what they tell a regulator under liability. Sectoral dispersion exceeds cross-country dispersion.',
 1, 'trending-up'),

('money', 'money', 'Money',
 'Investment, capital and what it costs',
 'Enormous sums are going into computers, software and the buildings that hold them — over $1.6 trillion a year in the US alone. The prices of the metals and energy that make it possible are the floor underneath all of it, which is why they sit on this page rather than in a markets section.',
 'Capital formation at three levels: BEA NIPA fixed investment in information-processing equipment and software, the data-centre structures line from table 5.4.5, and business R&D in programming and IT services from OECD ANBERD. Commodity prices are placed here as input costs, not as market colour. Note the deflator problem: nominal series understate real capital deepening where quality-adjusted prices fall as fast as they do in semiconductors.',
 2, 'banknote'),

('work', 'work', 'Work',
 'Jobs, pay and who gets hired',
 'The early signs are small but real. The share of US jobs in the information sector has been falling since 2023 after a decade of rising. UK tech vacancies are below their 2001 level. Young people are the place to watch: if AI takes the bottom rung of a career ladder, it shows there first.',
 'Identification is by comparison, not level: an AI-exposed group against a control sharing its macro shocks. Information-sector employment as a share of total non-farm payrolls cancels the cycle affecting both. Vacancy series lead employment because hiring intent adjusts before headcount. The youth panel is OECD-harmonised across ten countries. Principal confound: the information sector was consolidating post-2022 for reasons unrelated to AI, chiefly interest rates.',
 3, 'users'),

('infrastructure', 'infrastructure', 'Infrastructure',
 'The physical machine underneath',
 'Software needs concrete, copper and electricity. Publicly known US data-centre capacity went from under 400 megawatts in 2023 to nearly 2,000 in 2025. Unlike survey data this is hard to exaggerate — the transformers either exist or they do not.',
 'Physical build-out via Epoch AI''s cluster register (cumulative MW, a documented lower bound), semiconductor and computer manufacturing output, new orders, manufacturing construction, and electricity generation and industrial sales. Chinese integrated-circuit output is the supply-side counterpart. Capacity figures cover disclosed clusters only and systematically understate the total.',
 4, 'server'),

('policy', 'policy', 'Policy',
 'What governments are actually doing',
 'Mostly proposing rather than enacting. US agencies have published roughly a hundred months of AI rules that are genuinely in force, and a similar number of proposals that may never become law. Executive orders move in days and can be undone just as fast.',
 'Federal Register documents matched on six AI search terms, deduplicated on document_number, split by type. The distinction is load-bearing: a Rule is enforceable, a Proposed Rule carries a comment period and leads a Rule by 12-24 months where it converts, and a Presidential Document is unilateral and reversible. United States only — no comparable machine-readable register exists free for the EU, UK or China.',
 5, 'landmark')

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, subtitle = EXCLUDED.subtitle,
  thesis_plain = EXCLUDED.thesis_plain, thesis_expert = EXCLUDED.thesis_expert,
  sort_order = EXCLUDED.sort_order, icon = EXCLUDED.icon,
  is_active = TRUE, updated_at = now();


-- ── Assign the existing questions to lenses ─────────────────────────────────
-- Nothing built is discarded; the seven question pages simply acquire a parent.
UPDATE questions SET lens_id = 'adoption'       WHERE id = 'adoption';
UPDATE questions SET lens_id = 'money'          WHERE id = 'money';
UPDATE questions SET lens_id = 'money'          WHERE id = 'markets';
UPDATE questions SET lens_id = 'work'           WHERE id = 'jobs';
UPDATE questions SET lens_id = 'work'           WHERE id = 'productivity';
UPDATE questions SET lens_id = 'infrastructure' WHERE id = 'building';
UPDATE questions SET lens_id = 'policy'         WHERE id = 'policy';


-- ---------------------------------------------------------------------------
-- Ticker placements.
--
-- Each `why` says what the number is doing on that page. Read them together and
-- the strip becomes an argument about the AI supply chain rather than a price
-- feed: silicon is made from sand and electricity, wired with copper and
-- silver, cooled with aluminium, backed up by lithium and cobalt, and run on
-- gas and uranium.
-- ---------------------------------------------------------------------------
INSERT INTO lens_tickers (lens_id, indicator_id, sort_order, label, why) VALUES

-- ── MONEY: the cost of the inputs to capital formation ──────────────────────
('money', 'fred.PCOPPUSDM', 1, 'Copper',
 'A large data centre needs thousands of tonnes of copper for wiring, busbars and transformers. When capacity is being built at scale, this is one of the first prices to move.'),
('money', 'lbma.silver', 2, 'Silver',
 'The most electrically conductive metal in commercial use, and in every circuit board and connector. A direct input cost to anything that computes.'),
('money', 'lbma.gold', 3, 'Gold',
 'Used in chip bonding wire, and the standard gauge of investor nerves — which is exactly what you want beside a chart of an investment boom.'),
('money', 'fred.DHHNGSP', 4, 'Nat gas',
 'Gas generates most of the marginal electricity a new American data centre draws, so this is close to the fuel cost of compute itself.'),
('money', 'fred.SPASTT01USM661N', 5, 'US shares',
 'The broad US share price index. Included because the OECD publishes it through FRED under a licence that permits public redisplay — most market data does not.'),
('money', 'fred.PALLFNFINDEXM', 6, 'All commodities',
 'Every major traded commodity in one index, so a move in copper or silver can be read against raw materials generally rather than mistaken for something specific to AI.'),

-- ── INFRASTRUCTURE: the physical bill of materials ──────────────────────────
('infrastructure', 'fred.PCOPPUSDM', 1, 'Copper',
 'Physically what a data centre is wired with. The same price as on the Money lens, asked a different question: not what it costs, but whether enough of it is being bought.'),
('infrastructure', 'fred.PALUMUSDM', 2, 'Aluminium',
 'Server racks, chassis and heat sinks. Cheaper and lighter than copper, used wherever conductivity is not the binding requirement.'),
('infrastructure', 'fred.PNICKUSDM', 3, 'Nickel',
 'In the batteries that carry a site through a power cut, and in the stainless steel of its cooling.'),
('infrastructure', 'dbn.IMF.PCPS.lithium', 4, 'Lithium',
 'Backup power storage. The only free source stops at June 2025 — the trend to that point is real, the last year is missing.'),
('infrastructure', 'dbn.IMF.PCPS.uranium', 5, 'Uranium',
 'Several of the largest AI companies have signed nuclear agreements, so fuel price is now part of the cost of compute. Also stale after June 2025.'),
('infrastructure', 'dbn.EIA.ELEC.PRICE.US-IND.M', 6, 'US power',
 'What American industry pays per kilowatt-hour. Power availability, not chips, is now the usual constraint on where capacity gets built.'),
('infrastructure', 'fred.PCU334413334413', 7, 'Chip prices',
 'Semiconductors have fallen to under a third of their 1998 price. That decades-long deflation is the quiet foundation everything else here rests on.'),

-- ── WORK: what labour costs, and who is not being hired ─────────────────────
('work', 'fred.LNS14024887', 1, 'US youth unemp.',
 'Young Americans looking for work and not finding it. If AI substitutes entry-level tasks first, this moves before any aggregate does.'),
('work', 'fred.LRHU24TTKRM156S', 2, 'Korea youth unemp.',
 'Korea has the highest measured enterprise AI adoption anywhere, which makes its youth labour market the single most informative case available.'),
('work', 'fred.CGBD2534', 3, 'US grad unemp.',
 'Unemployment among young American graduates — the credential that was supposed to protect against automation.'),
('work', 'fred.ULCNFB', 4, 'Unit labour cost',
 'What it costs an employer to produce a unit of output. Falls when output per worker rises faster than pay, which is what an AI productivity gain would look like from the employer''s side.'),
('work', 'derived.information_employment_share', 5, 'Info-sector share',
 'The most AI-exposed part of the US economy as a share of all jobs. Falling since 2023.'),

-- ── ADOPTION: how fast, and how unevenly ────────────────────────────────────
('adoption', 'derived.sec_ai_mention_rate', 1, 'US filings w/ AI',
 'The share of large US companies mentioning AI in their annual report to regulators, where a false claim carries legal liability.'),
('adoption', 'dbn.OECD.DSD_ICT_B_DF_BUSINESSES.EU27.A.G14_B.PT_ENT._T.S_GE10', 2, 'EU firms using AI',
 'One in five European firms now uses AI, up from one in seventeen in 2020.'),
('adoption', 'dbn.OECD.ict_business.KOR.ai_adoption', 3, 'Korea firms using AI',
 'A third of Korean firms — roughly 13 points above the OECD average and the highest national rate available free anywhere.'),
('adoption', 'fred.PCU518210518210', 4, 'Cloud prices',
 'The closest thing America publishes to a cloud price index. What renting compute costs sets how cheaply adoption can spread.'),

-- ── POLICY: what is enforceable, and what is only proposed ──────────────────
('policy', 'derived.ai_binding_rules', 1, 'Rules in force',
 'Regulation that is already law. The only one of these counts that obliges anyone to do anything.'),
('policy', 'derived.ai_proposed_rules', 2, 'Rules proposed',
 'Intentions with a comment period. Leads binding rules by 12 to 24 months, where it converts at all.'),
('policy', 'derived.ai_presidential_documents', 3, 'Executive actions',
 'Move in days rather than years, and a successor can undo them just as fast. A measure of attention, not of durable policy.'),
('policy', 'derived.ai_regulation_volume', 4, 'All AI documents',
 'Every AI-related federal document regardless of type — the total the three counts above decompose.')

ON CONFLICT (lens_id, indicator_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order, label = EXCLUDED.label, why = EXCLUDED.why;

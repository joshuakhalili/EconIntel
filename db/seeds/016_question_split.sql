-- ============================================================================
-- 016_question_split.sql — four narrower questions out of two overloaded ones
--
-- WHY
--
-- `jobs` carried 24 indicators and `markets` 21, while `policy` carried 4. All
-- of it was reachable, and none of it was findable: a reader met a wall of
-- charts on one page and a thin page next door. The imbalance, not the volume,
-- was the problem.
--
-- The splits follow lines the data already draws rather than lines invented to
-- make the counts even:
--
--   jobs     → sector composition (what the exposed sector is doing)
--            + entry-level (whether the bottom rung is thinning)
--            + vacancies (whether hiring intent moved before headcount)
--   markets  → the price of compute
--            + the price of power
--            + the price of the materials
--
-- Placements are MOVED rather than rewritten, so the caption explaining why
-- each series is on a page survives the split — that text is the most valuable
-- editorial content in the schema and re-authoring 45 captions to reorganise
-- pages would be a good way to lose it.
--
-- Figures quoted below are read from the series, with their indicator ids:
--   UK ICT vacancies      39.0k Jun 2026, first 50.0k May 2001, peak 78.0k
--                         May 2022                    (dbn.ONS.UNEM.JP9P.M)
--   US youth unemployment 8.5% Jul 2026, peak 27.5% Apr 2020 (fred.LNS14024887)
--   US graduate unemp.    3.8% Jul 2026                     (fred.CGBD2534)
--   US industrial power   8.6c/kWh Mar 2026, 4.7c Jan 2001
--                                       (dbn.EIA.ELEC.PRICE.US-IND.M)
--   Copper                $13,543/t Jul 2026, at the top of its range
--                                                        (fred.PCOPPUSDM)
--   Data-processing PPI   124.2 Jul 2026 on Dec 2000 = 100
--                                                (fred.PCU518210518210)
-- ============================================================================

INSERT INTO questions (id, slug, question, subtitle, answer_plain, answer_expert,
                       caveat, theory, method, strength, last_reviewed,
                       lens_id, sort_order, is_active) VALUES

('entry-level', 'entry-level',
 'Is the bottom rung disappearing?',
 'Youth and graduate employment, across ten countries',
 'Not yet, on this evidence. US youth unemployment is 8.5% and unemployment among graduates aged 25 to 34 is 3.8% — both well below their 2020 peaks and not obviously breaking trend. This is the place an early substitution effect should appear first, which is exactly why a quiet reading here is worth publishing rather than filing away.',
 'The youth panel is OECD-harmonised across ten countries and read as a panel, not as ten separate series: a national labour-market reform moves one line, a technology shock should bend several. Graduate unemployment is the sharper test, because a degree was the thing supposed to protect against automation. Neither series isolates AI, and neither is currently far enough from trend to demand an explanation.',
 'Youth unemployment responds to the business cycle far more strongly than to anything structural, so a recession would swamp any AI effect entirely and a tight labour market can hide one. These series also cannot see the counterfactual: hiring that never happened does not appear anywhere in an unemployment rate, which measures people actively looking.',
 'If AI substitutes for tasks rather than for whole jobs, the first jobs affected are the ones that are mostly those tasks — entry-level work. That predicts the bottom rung of a career ladder thins before any aggregate employment number moves, and predicts it should be visible in the young and the newly qualified before anyone else.',
 'A cross-country panel rather than a single national series, so a domestic policy change shows up as one line moving rather than as the finding. Graduate unemployment is tracked separately from youth unemployment because they answer different questions: one asks whether young people can find work, the other whether the credential still buys entry.',
 'insufficient', DATE '2026-08-28', 'labour', 2, TRUE),

('vacancies', 'vacancies',
 'Has hiring intent already turned?',
 'Vacancies in the most exposed sector',
 'This is where the clearest signal is. UK vacancies in information and communication stand at 39,000 — below their May 2001 level of 50,000, and roughly half the May 2022 peak of 78,000. Vacancies lead employment because a firm stops advertising before it stops employing, so this moves first whatever the cause.',
 'Vacancy series are the leading indicator in this lens: hiring intent adjusts within a quarter while headcount adjusts over years, through attrition rather than dismissal. The UK ICT series is the longest available and the sharpest. Australia''s vacancies-to-labour-force ratio and Japan''s openings-to-applicants ratio are included as independent constructions of the same idea from different statistical traditions.',
 'The confound here is large and unresolved: the information sector was consolidating from 2022 for reasons that have nothing to do with AI, principally interest rates ending a decade of cheap capital. The 2022 peak was itself a post-pandemic bubble. A fall from an anomalous high back through the long-run level is not evidence of a new cause.',
 'A firm facing a cheaper substitute stops hiring before it starts cutting, because not replacing leavers is cheaper and less visible than redundancy. Vacancies should therefore turn first, and by more, than employment.',
 'Three independent vacancy constructions — a count (UK), a rate against the labour force (Australia), and a ratio against applicants (Japan) — so a definitional artefact in one does not carry the finding. Read against the sector''s own history rather than against the whole economy.',
 'suggestive', DATE '2026-08-28', 'labour', 3, TRUE),

('power', 'power',
 'What is it doing to the price of power?',
 'Electricity, gas and oil',
 'US industrial electricity costs 8.6 cents a kilowatt-hour, against 4.7 cents in 2001. That is the binding constraint on this build-out: chips can be manufactured to order, and a gigawatt of firm supply in the right place cannot. Where a data centre gets built is now largely a question about the grid.',
 'Industrial retail electricity price is the relevant series rather than wholesale, because it is what a large consumer actually pays including transmission. The European comparison uses the Eurostat non-household band above 150,000 MWh, the closest available equivalent for very large consumers. Gas and oil are included because gas sets the marginal price of US electricity in most hours, so a gas move propagates into the power price with a lag.',
 'None of this movement is attributable to AI. Industrial power prices are driven by fuel costs, grid investment and regulation, and data centres remain a small share of total load in every country here. This page shows the cost environment a build-out faces, not an effect it has caused.',
 'Computation converts electricity into output. If demand for computation rises faster than firm generation can be added — and generation is slow, capital-intensive and locally contested — then power price and availability, rather than chip supply, becomes what limits the build-out.',
 'Industrial retail prices from EIA and Eurostat, which include transmission and are what a large buyer faces, read alongside the fuels that set the marginal price. Prices are nominal.',
 'consistent', DATE '2026-08-28', 'prices', 2, TRUE),

('materials', 'materials',
 'What is it doing to the price of the materials?',
 'The metals a data centre is built from',
 'Copper is around $13,500 a tonne, at the top of its historical range. A large data centre needs thousands of tonnes of it for wiring, busbars and transformers, alongside aluminium for racks and heat sinks and nickel for cooling and backup power. These are the physical inputs, and unlike chips they are extracted rather than manufactured, so supply responds in years rather than quarters.',
 'Base metals are grouped on one axis because they share a unit and a supply logic. Precious metals sit apart: gold and silver are genuine electronic inputs, but their prices are dominated by monetary demand, so they read as a sentiment gauge more than an input cost. Lithium, cobalt and uranium cover backup storage and the nuclear agreements several large operators have signed. The all-commodity index on the Prices lens is the control — a copper move that the whole complex shares is not about AI.',
 'Attribution here is weak and should be treated as such. Data-centre construction is a small share of global copper demand next to construction and the electrical grid generally, and these prices respond to Chinese industrial activity, mine supply and the dollar far more than to anything in this dashboard. Lithium and uranium are also stale after June 2025 — the only free source stops there.',
 'A build-out of this scale has a bill of materials, and if it is large enough to matter economically it should be visible in the price of what it consumes. Metals are the test because they are extracted, so supply cannot expand quickly and demand shows up as price.',
 'Grouped by shared unit and shared supply logic rather than by name, and read against a broad commodity index so a general move is not mistaken for a specific one. Prices are nominal and in USD.',
 'insufficient', DATE '2026-08-28', 'prices', 3, TRUE)

ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug, question = EXCLUDED.question, subtitle = EXCLUDED.subtitle,
  answer_plain = EXCLUDED.answer_plain, answer_expert = EXCLUDED.answer_expert,
  caveat = EXCLUDED.caveat, theory = EXCLUDED.theory, method = EXCLUDED.method,
  strength = EXCLUDED.strength, last_reviewed = EXCLUDED.last_reviewed,
  lens_id = EXCLUDED.lens_id, sort_order = EXCLUDED.sort_order,
  is_active = TRUE, updated_at = now();


-- ── Move the placements ─────────────────────────────────────────────────────
-- INSERT ... SELECT before DELETE, so the caption travels with the indicator.
-- Re-running is safe: the second time, the source rows are already gone, the
-- SELECT returns nothing and the DELETE matches nothing.

-- jobs → entry-level: the youth panel and the graduate series.
INSERT INTO question_indicators (question_id, indicator_id, role, sort_order,
                                 caption_plain, caption_expert, country_iso3, chart_group)
SELECT 'entry-level', indicator_id,
       -- The youth panel is the hero here; it was supporting evidence on the
       -- broader page it came from.
       CASE WHEN chart_group = 'youth-unemployment' THEN 'hero'::indicator_role
            ELSE 'supporting'::indicator_role END,
       sort_order, caption_plain, caption_expert, country_iso3, chart_group
  FROM question_indicators
 WHERE question_id = 'jobs'
   AND (chart_group = 'youth-unemployment' OR indicator_id = 'fred.CGBD2534')
ON CONFLICT (question_id, indicator_id) DO NOTHING;

DELETE FROM question_indicators
 WHERE question_id = 'jobs'
   AND (chart_group = 'youth-unemployment' OR indicator_id = 'fred.CGBD2534');

-- jobs → vacancies
INSERT INTO question_indicators (question_id, indicator_id, role, sort_order,
                                 caption_plain, caption_expert, country_iso3, chart_group)
SELECT 'vacancies', indicator_id,
       CASE WHEN indicator_id = 'dbn.ONS.UNEM.JP9P.M' THEN 'hero'::indicator_role
            WHEN indicator_id = 'fred.ULCNFB'        THEN 'context'::indicator_role
            ELSE 'supporting'::indicator_role END,
       sort_order, caption_plain, caption_expert, country_iso3, chart_group
  FROM question_indicators
 WHERE question_id = 'jobs'
   AND indicator_id IN ('dbn.ONS.UNEM.JP9P.M',
                        'dbn.Eurostat.jvs_q_nace2.Q.NSA.J.TOTAL.JVR.EU27_2020',
                        'dbn.RBA.H5.GLFOSVTLF',
                        'dbn.JILPT.e0208.M.1.1',
                        'fred.ULCNFB')
ON CONFLICT (question_id, indicator_id) DO NOTHING;

DELETE FROM question_indicators
 WHERE question_id = 'jobs'
   AND indicator_id IN ('dbn.ONS.UNEM.JP9P.M',
                        'dbn.Eurostat.jvs_q_nace2.Q.NSA.J.TOTAL.JVR.EU27_2020',
                        'dbn.RBA.H5.GLFOSVTLF',
                        'dbn.JILPT.e0208.M.1.1',
                        'fred.ULCNFB');

-- markets → power
INSERT INTO question_indicators (question_id, indicator_id, role, sort_order,
                                 caption_plain, caption_expert, country_iso3, chart_group)
SELECT 'power', indicator_id,
       CASE WHEN indicator_id = 'dbn.EIA.ELEC.PRICE.US-IND.M' THEN 'hero'::indicator_role
            ELSE 'supporting'::indicator_role END,
       sort_order, caption_plain, caption_expert, country_iso3, chart_group
  FROM question_indicators
 WHERE question_id = 'markets'
   AND indicator_id IN ('dbn.EIA.ELEC.PRICE.US-IND.M',
                        'dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR.EU27_2020',
                        'fred.DCOILWTICO',
                        'fred.DHHNGSP')
ON CONFLICT (question_id, indicator_id) DO NOTHING;

DELETE FROM question_indicators
 WHERE question_id = 'markets'
   AND indicator_id IN ('dbn.EIA.ELEC.PRICE.US-IND.M',
                        'dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR.EU27_2020',
                        'fred.DCOILWTICO',
                        'fred.DHHNGSP');

-- markets → materials
INSERT INTO question_indicators (question_id, indicator_id, role, sort_order,
                                 caption_plain, caption_expert, country_iso3, chart_group)
SELECT 'materials', indicator_id,
       CASE WHEN chart_group = 'base-metals' THEN 'hero'::indicator_role
            ELSE 'supporting'::indicator_role END,
       sort_order, caption_plain, caption_expert, country_iso3, chart_group
  FROM question_indicators
 WHERE question_id = 'markets'
   AND (chart_group IN ('base-metals', 'precious-metals')
        OR indicator_id IN ('dbn.IMF.PCPS.lithium', 'dbn.IMF.PCPS.cobalt',
                            'dbn.IMF.PCPS.uranium', 'fred.IQ12260'))
ON CONFLICT (question_id, indicator_id) DO NOTHING;

DELETE FROM question_indicators
 WHERE question_id = 'markets'
   AND (chart_group IN ('base-metals', 'precious-metals')
        OR indicator_id IN ('dbn.IMF.PCPS.lithium', 'dbn.IMF.PCPS.cobalt',
                            'dbn.IMF.PCPS.uranium', 'fred.IQ12260'));


-- ── Retitle the two that were split ─────────────────────────────────────────
-- Both now answer a narrower question than their old title promised, and a
-- title that over-claims is the same fault as prose that over-claims.

UPDATE questions SET
  question = 'Is the exposed sector shrinking?',
  subtitle = 'Employment in information and communication',
  answer_plain = 'The share of US jobs in the information sector — the part of the economy most exposed to AI — has been falling since 2023, after rising for most of the decade before. It is a small move in a small sector, and it is the clearest compositional signal available.',
  strength = 'suggestive',
  -- Leads its lens: composition is the broad picture the other two narrow.
  sort_order = 1
WHERE id = 'jobs';

UPDATE questions SET
  question = 'What is it doing to the price of compute?',
  subtitle = 'Chips, hosting and the cost of thinking',
  answer_plain = 'Chips have collapsed in price and the services built on them have not. Semiconductors cost under a third of their 1998 level. Data processing and hosting, by contrast, sits at 124 against a Dec 2000 base of 100 — renting compute has become more expensive, not less, because that price includes the power, buildings and staff that chips alone do not.',
  strength = 'consistent',
  sort_order = 1
WHERE id = 'markets';

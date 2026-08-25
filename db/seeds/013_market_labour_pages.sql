-- ============================================================================
-- 013_market_labour_pages.sql — put the new series on pages, not just in tickers
--
-- The 22 commodity and labour indicators seeded in 011 were given ticker
-- placements but no chart, which the `orphaned_indicators` view immediately
-- caught. A ticker shows a number and a direction; it cannot show a decade of
-- shape. Both are needed, and they answer different questions.
-- ============================================================================

INSERT INTO question_indicators
  (question_id, indicator_id, role, sort_order, chart_group, country_iso3, caption_plain, caption_expert) VALUES

-- ── MARKETS: the metals, grouped by what they cost per tonne ────────────────
-- Copper, aluminium and nickel share a unit and an order of magnitude, so one
-- axis is honest. Precious metals are per ounce and thousands of times dearer,
-- so they get their own chart rather than being flattened onto the same scale.
('markets', 'fred.PCOPPUSDM', 'supporting', 10, 'base-metals', NULL,
 'Copper — the wiring, busbars and transformers of a data centre.',
 'IMF global price via FRED, USD/tonne, nominal. Grouped with aluminium and nickel: same unit, same order of magnitude.'),

('markets', 'fred.PALUMUSDM', 'supporting', 11, 'base-metals', NULL,
 'Aluminium — racks, chassis and heat sinks.',
 'USD/tonne. Roughly a third of copper''s price, which is why it is used wherever conductivity is not the binding requirement.'),

('markets', 'fred.PNICKUSDM', 'supporting', 12, 'base-metals', NULL,
 'Nickel — backup batteries and the stainless steel of cooling systems.',
 'USD/tonne. The most volatile of the three; the 2022 LME squeeze is visible and is a market event, not a demand signal.'),

('markets', 'lbma.gold', 'supporting', 13, 'precious-metals', NULL,
 'Gold — used in chip bonding, and the standard measure of how nervous investors are.',
 'LBMA afternoon fix, USD/troy ounce, daily since 1968. Charted apart from the base metals: per ounce rather than per tonne, and thousands of times the price.'),

('markets', 'lbma.silver', 'supporting', 14, 'precious-metals', NULL,
 'Silver — the most conductive metal there is, and in every circuit board.',
 'LBMA daily fix, USD/troy ounce. Shares gold''s unit and scale, so the two sit on one axis legitimately.'),

('markets', 'fred.DCOILWTICO', 'supporting', 15, NULL, 'USA',
 'Crude oil, daily. The broadest gauge of what energy costs.',
 'WTI spot. Not an AI indicator on its own — included because it sets the floor under the cost of running anything, and because a move in gas or power should be read against it.'),

('markets', 'fred.DHHNGSP', 'supporting', 16, NULL, 'USA',
 'Natural gas. This generates most of the extra electricity a new American data centre draws.',
 'Henry Hub spot, daily. The closest available proxy for the marginal fuel cost of US compute.'),

('markets', 'dbn.IMF.PCPS.lithium', 'supporting', 17, NULL, NULL,
 'Lithium, for backup power. Note this chart stops in June 2025 — the only free source has not updated since.',
 'IMF PCPS via DBnomics. The mirror is fourteen months stale across every series; the pre-2025 trend is real and the recent collapse in lithium prices is not visible here.'),

('markets', 'dbn.IMF.PCPS.cobalt', 'supporting', 18, NULL, NULL,
 'Cobalt — the other battery metal, and among the most supply-constrained commodities there is. Also stops in June 2025.',
 'IMF PCPS. Same staleness caveat.'),

('markets', 'dbn.IMF.PCPS.uranium', 'supporting', 19, NULL, NULL,
 'Uranium. Several large AI companies have signed nuclear agreements, so this is now part of the cost of compute. Stops June 2025.',
 'IMF PCPS. Same staleness caveat.'),

('markets', 'fred.PALLFNFINDEXM', 'context', 20, NULL, NULL,
 'Every major commodity in one index, so a move in copper can be read against raw materials generally.',
 'IMF all-commodity index, 2016=100. The control: if everything rose together it is a macro story, not an AI one.'),

('markets', 'fred.SPASTT01USM661N', 'context', 21, NULL, 'USA',
 'US share prices, for backdrop.',
 'OECD share price index via FRED — included partly because its licence permits public redisplay, which most market data does not.'),

-- ── JOBS: the youth panel, one axis, ten definitions made comparable ────────
-- OECD-harmonised, so these are genuinely the same measurement in each country
-- rather than ten national definitions placed side by side.
('jobs', 'fred.LNS14024887', 'supporting', 20, 'youth-unemployment', 'USA',
 'Young Americans looking for work and not finding it. If AI removes entry-level tasks, this moves first.',
 'CPS 16-24, seasonally adjusted. NOTE: the US band is 16-24 where every other country here is 15-24 — FRED carries no US 15-24 series in the harmonised family, so this line is not strictly like-for-like.'),

('jobs', 'fred.LRHU24TTKRM156S', 'supporting', 21, 'youth-unemployment', 'KOR',
 'South Korea — the country with the highest business AI adoption anywhere measured.',
 'OECD harmonised 15-24, seasonally adjusted. The most informative single case in this panel, precisely because adoption there is furthest along.'),

('jobs', 'fred.LRHU24TTGBM156S', 'supporting', 22, 'youth-unemployment', 'GBR',
 'The United Kingdom.',
 'OECD harmonised 15-24. Publishes about two months behind the US series, so the line ends earlier — that is release timing, not missing data.'),

('jobs', 'fred.LRHU24TTDEM156S', 'supporting', 23, 'youth-unemployment', 'DEU',
 'Germany, where the apprenticeship system usually keeps this among Europe''s lowest.',
 'OECD harmonised 15-24.'),

('jobs', 'fred.LRHU24TTFRM156S', 'supporting', 24, 'youth-unemployment', 'FRA',
 'France, persistently high for decades — a reminder this series moves for many reasons besides technology.',
 'OECD harmonised 15-24. The structural level here is the reason a cross-country panel needs a caveat: differences BETWEEN countries are mostly institutional, differences WITHIN a country over time are what to read.'),

('jobs', 'fred.LRHU24TTJPM156S', 'supporting', 25, 'youth-unemployment', 'JPN',
 'Japan, where a shrinking workforce means employers compete for young workers rather than the reverse.',
 'OECD harmonised 15-24. The natural control for a substitution story: labour scarcity should blunt any displacement effect.'),

('jobs', 'fred.LRHU24TTCAM156S', 'supporting', 26, 'youth-unemployment', 'CAN',
 'Canada.',
 'OECD harmonised 15-24.'),

('jobs', 'fred.LRHU24TTAUM156S', 'supporting', 27, 'youth-unemployment', 'AUS',
 'Australia.',
 'OECD harmonised 15-24.'),

('jobs', 'fred.CGBD2534', 'supporting', 28, NULL, 'USA',
 'Unemployment among young American graduates — the credential that was supposed to protect against automation.',
 'BLS, bachelor''s degree holders aged 25-34, NOT seasonally adjusted. Read the 12-month change rather than month-on-month.'),

('jobs', 'fred.LNU02032207', 'supporting', 29, NULL, 'USA',
 'Americans in office and administrative work — the largest group of jobs directly exposed to language models.',
 'CPS occupation series, not seasonally adjusted, monthly. Far more timely than the annual ILO occupation data, which is the only other occupational breakdown held.')

ON CONFLICT (question_id, indicator_id) DO UPDATE SET
  role = EXCLUDED.role, sort_order = EXCLUDED.sort_order,
  chart_group = EXCLUDED.chart_group, country_iso3 = EXCLUDED.country_iso3,
  caption_plain = EXCLUDED.caption_plain, caption_expert = EXCLUDED.caption_expert;

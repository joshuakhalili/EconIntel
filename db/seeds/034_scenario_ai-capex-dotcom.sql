-- ============================================================================
-- 034_scenario_ai-capex-dotcom.sql — the first scenario, and the countries it
-- is honest about
--
-- 0023 built the simulation tables and nothing was ever put in them, so
-- /simulate/:slug answered 404 in production for its entire life. This file is
-- the rows. `0024_published_scenarios_offer_a_country.sql` is the constraint
-- that stops the half-published version of the same mistake, and the route
-- coverage check in `scripts/check-data.js` is what would have caught the
-- empty table in the first place.
--
-- ---------------------------------------------------------------------------
-- WHY FOUR COUNTRIES AND NOT SEVEN
--
-- The G7 was the intended list. It is not the shipped list, and the reason is
-- the research rather than the effort. Two rounds of source work are on disk —
-- `docs/research/simulation-coefficients-2026-08-31.md` and
-- `docs/research/simulation-phillips-2026-09-02.md` — and the second one's
-- verdict is blunt: no G7 country has a defensible published value for all
-- four Phillips-curve coefficients, and only `price_phillips_slope` is
-- genuinely per-country across all seven.
--
-- So the shipped list is the countries whose price Phillips slope is
-- published, correctly signed and significant. That is USA, FRA, ITA and JPN.
--
--   GBR is excluded because two independent teams, twenty years apart, both
--   estimate a WRONG-SIGNED and insignificant price Phillips curve for the
--   United Kingdom — OECD WP 1579 Table 1 gives −0.30 under a convention where
--   positive is normal, Blanchard–Cerutti–Summers Table 6 gives +0.04 under a
--   convention where negative is normal, and both are the perverse sign. The
--   OECD then refused to run its own non-linear specification on the UK at all
--   (footnote 18: "the difficulty of getting a correctly-signed unemployment
--   gap term"). The engine would refuse the number anyway — PARAM_SIGNS
--   requires this coefficient positive — but it would be excluded even if it
--   did not. Publishing a UK slope of either sign would be inventing one.
--
--   DEU is excluded because the two sources flatly contradict each other on
--   Germany specifically: OECD 0.87*** against BCS 0.11, not significant, with
--   BCS naming Germany as one of four countries where the coefficient is dead
--   in both their specifications. The OECD's own robustness runs collapse it
--   to 0.13 and insignificant on the European Commission's gap series. Both
--   papers are defensible; they cannot both be used, and picking the one that
--   gives a working model is picking a result.
--
--   CAN is excluded because the OECD estimate (0.18) is not significant.
--   BCS get 0.32*** and so the two sources disagree about whether there is
--   anything there at all.
--
-- Those three are not seeded at all rather than seeded and withheld.
-- `getScenario()` returns every parameter row for a scenario and the page
-- lists them under its citations, so a partial German set would show a reader
-- coefficients for a country the picker does not offer.
--
-- ---------------------------------------------------------------------------
-- WHAT IS ACTUALLY PER-COUNTRY, STATED HERE BECAUSE THE UI CANNOT
--
-- A country picker implies a country model. This one is thinner than that:
--
--   per-country   gdp_usd_bn, okun_coefficient, unemployment_baseline,
--                 inflation_anchor, price_phillips_slope
--   panel         the five multiplier years, wage_phillips_slope,
--                 wage_persistence, wage_price_passthrough
--
-- Every panel row carries that fact in its own `notes`, which is the column
-- 0023 added for exactly this ("Where no country-specific estimate exists,
-- using a neighbour's is defensible; doing it silently is not").
--
-- The differentiation that remains is real and large: Okun's coefficient runs
-- from −0.563 in the United States to −0.151 in Japan, so the same output gap
-- moves American unemployment nearly four times as far as Japanese
-- unemployment. That is one published table, not a modelling choice.
--
-- ---------------------------------------------------------------------------
-- THE ONE PAIRING RULE THAT DECIDED THE WAGE BLOCK
--
-- `wage_phillips_slope` and `wage_persistence` are taken from the SAME
-- regression, and that constraint is why they are panel numbers rather than
-- the per-country values that exist for France and Italy. The 2 Sep round
-- makes the case concretely: Bank of Canada SDP 2019-8 estimates a slope of
-- 0.36 with no persistence term and 0.13 with a persistence term of 0.65, and
-- those are the same long-run response (0.13 / (1 − 0.65) = 0.371). Taking
-- each coefficient from whichever paper publishes the biggest version of it —
-- 0.36 alongside 0.65 — roughly triples the long-run wage response to slack
-- while every individual number stays perfectly citable.
--
-- The alternative was DNB WP 587's per-country pairs, which are internally
-- consistent for Germany, France and Italy. They are not used because they
-- cannot cover the United States or Japan, and mixing a French coefficient
-- estimated on year-over-year negotiated wages 1999–2016 with an American one
-- estimated on quarterly average hourly earnings 1988–2018 would put two
-- numbers side by side in a table that are not measuring the same thing.
-- ============================================================================

INSERT INTO simulation_scenarios
  (id, slug, name, subtitle, thesis_plain, thesis_expert, caveat,
   horizon_years, model_key, countries, status, sort_order)
VALUES (
  'ai-capex-dotcom',
  'ai-capex-dotcom',
  'AI capex today, read through the lens of the dot-com bubble',
  'What a capital-spending wave does to output, jobs and prices — for as long as the research runs',

  'Two investment waves a quarter of a century apart, and the same question about both: how much of a build-out this large turns into output, jobs and prices, and how quickly. The charts underneath are measured. Semiconductor prices and information-sector employment run through both booms, which is what makes the comparison possible at all. The projection above them is not measured. It is what published research implies if that research holds and nothing else in the economy moves — a narrower question than what will happen, and the only one this can honestly answer. Countries differ here because their published coefficients differ, not because the model knows anything particular about any of them.',

  'A five-year impulse response, not a forecast. A capital-spending shock enters as a share of GDP, propagates through the published annual investment-multiplier profile (Abiad, Furceri & Topalova, IMF WP/15/95, Table 1 column 1, k = 0 to 4), then through Okun''s law, a wage Phillips curve with persistence, and a price equation carrying both a direct slack term and wage pass-through. Every coefficient is a cell from a named table; none is fitted here, and that now includes the SHAPE of the multiplier — the model previously decayed it geometrically from a fitted rate that no source publishes, and in the wrong direction, since both IMF sources have the investment multiplier rising over this horizon. Differentiation between countries is narrower than the picker implies: GDP, the Okun coefficient, baseline unemployment, the inflation target and the price Phillips slope are per-country; the multiplier profile, the wage block and wage-price pass-through are advanced-economy panel estimates carried across all four, and every such row says so in its notes. Germany, the United Kingdom and Canada are absent for a stated reason rather than for lack of searching — see docs/research/simulation-phillips-2026-09-02.md.',

  'This is arithmetic on published coefficients, not a forecast, and its most important limits are structural rather than statistical. The model is linear. It has no capacity constraint, no monetary policy reaction, no expectations, and no feedback from prices back to output — so it will keep multiplying whatever shock you hand it, and nothing in it says the central bank raises rates, that firms run out of workers to hire, or that higher prices choke off the spending that caused them. That breaks in plain sight rather than subtly: push the slider to $500bn, which is 21% of Italy''s annual output, and by year five the equations put Italian unemployment at −0.51%, which cannot happen. Read the direction and the relative sizes, not the levels. And read nothing at all past year five — the multiplier profile underneath is published only to that horizon, and the model refuses to run further rather than extending a line the paper does not draw.',

  5,
  'investment_shock_v1',
  '{USA,FRA,ITA,JPN}',
  'published',
  1
)
ON CONFLICT (id) DO UPDATE SET
  slug          = EXCLUDED.slug,
  name          = EXCLUDED.name,
  subtitle      = EXCLUDED.subtitle,
  thesis_plain  = EXCLUDED.thesis_plain,
  thesis_expert = EXCLUDED.thesis_expert,
  caveat        = EXCLUDED.caveat,
  horizon_years = EXCLUDED.horizon_years,
  model_key     = EXCLUDED.model_key,
  countries     = EXCLUDED.countries,
  status        = EXCLUDED.status,
  sort_order    = EXCLUDED.sort_order,
  updated_at    = now();


-- ---------------------------------------------------------------------------
-- The two levers.
--
-- `shock_usd_bn` is deliberately allowed to reach a figure that breaks the
-- model. The alternative — capping it somewhere the arithmetic still looks
-- plausible — would hide the linearity failure rather than fix it, and would
-- hide it differently in each country, since $500bn is 1.7% of American output
-- and 21% of Italian. The caveat names the breakage instead.
--
-- `sustained` is 0 or 1 and renders as a two-position slider, which is not
-- elegant, but the question it asks is the one that changes the answer most: a
-- capex cycle is an annual commitment rather than a single cheque, and under
-- superposition year five of a sustained programme carries the sum of all five
-- published multiplier years rather than the fifth alone.
-- ---------------------------------------------------------------------------
INSERT INTO simulation_inputs
  (scenario_id, key, label, unit, unit_symbol,
   min_value, max_value, default_value, step, help_text, sort_order)
VALUES
  ('ai-capex-dotcom', 'shock_usd_bn',
   'New capital spending', 'usd_bn', '$bn',
   0, 1000, 100, 10,
   'How much new capital spending enters the economy, in billions of US dollars. The model converts it to a share of that country''s GDP before anything else happens, so the same figure is a far larger shock to Italy than to the United States. The slider starts at a round $100bn; nothing here treats any position on it as an observed figure.',
   1),

  ('ai-capex-dotcom', 'sustained',
   'Repeat the injection every year', 'flag', NULL,
   0, 1, 0, 1,
   'Nought treats the spending as one year''s cheque and lets the published multiplier profile carry it forward. One repeats it every year of the horizon, which is closer to how a capex cycle actually runs, and stacks each year''s response on top of the last. The slider has only those two positions.',
   2)
ON CONFLICT (scenario_id, key) DO UPDATE SET
  label         = EXCLUDED.label,
  unit          = EXCLUDED.unit,
  unit_symbol   = EXCLUDED.unit_symbol,
  min_value     = EXCLUDED.min_value,
  max_value     = EXCLUDED.max_value,
  default_value = EXCLUDED.default_value,
  step          = EXCLUDED.step,
  help_text     = EXCLUDED.help_text,
  sort_order    = EXCLUDED.sort_order;


-- ---------------------------------------------------------------------------
-- The panel coefficients — identical for every country, and labelled as such.
--
-- Written as a cross join rather than as thirty-two hand-copied rows because
-- the sameness IS the fact worth seeing. Four copies of a citation drift the
-- moment one of them is corrected, and a reader scrolling the provenance panel
-- should be able to tell at a glance that these numbers do not vary by country
-- while the ones below them do.
--
-- Every value here is `modelled` tier: a published econometric estimate, which
-- is a different kind of fact from a statistical agency's print.
-- ---------------------------------------------------------------------------
INSERT INTO simulation_parameters
  (scenario_id, country_iso3, param_key, value, value_low, value_high,
   confidence_tier, citation_text, citation_url, as_of_year, notes)
SELECT 'ai-capex-dotcom', c.iso3, p.param_key, p.value, p.value_low, p.value_high,
       'modelled', p.citation_text, p.citation_url, p.as_of_year, p.notes
  FROM (VALUES ('USA'), ('FRA'), ('ITA'), ('JPN')) AS c(iso3)
 CROSS JOIN (VALUES

  -- The multiplier profile. Five cells, one per year of the horizon, from one
  -- table in one paper — which is the point. The parameter this replaced was a
  -- single fitted decay rate that no source anywhere publishes.
  ('fiscal_multiplier_y1', 0.457, 0.310, 0.604,
   'Abiad, Furceri & Topalova (2015), "The Macroeconomic Effects of Public Investment: Evidence from Advanced Economies", IMF Working Paper WP/15/95, Table 1 column (1) "Baseline", row k = 0, p. 17. Output response to an unanticipated 1pp-of-GDP public investment shock; 17 OECD economies, 1985–2013, annual, country and year fixed effects. SE 0.147.',
   'https://infrastructuregovern.imf.org/content/dam/PIMA/Knowledge-Hub/Publications/pubdocuments/The%20Macroeconomic%20Effects%20of%20Public%20Investment%20Evidence%20from%20Advanced%20Economies.pdf',
   2015,
   'Panel of 17 advanced economies, not a country estimate. The interval is the point estimate plus and minus one published standard error (0.147) — arithmetic on the paper''s cells, not a range the paper prints. For this year the paper does give a published range: leave-one-country-out estimates run 0.4 to 0.57 (p. 18).'),

  ('fiscal_multiplier_y2', 0.755, 0.517, 0.993,
   'Abiad, Furceri & Topalova (2015), IMF WP/15/95, Table 1 column (1) "Baseline", row k = 1, p. 17. SE 0.238.',
   'https://infrastructuregovern.imf.org/content/dam/PIMA/Knowledge-Hub/Publications/pubdocuments/The%20Macroeconomic%20Effects%20of%20Public%20Investment%20Evidence%20from%20Advanced%20Economies.pdf',
   2015,
   'Panel of 17 advanced economies, not a country estimate. Interval is the point estimate plus and minus one published standard error (0.238) — arithmetic on the paper''s cells, not a range it prints.'),

  ('fiscal_multiplier_y3', 1.035, 0.713, 1.357,
   'Abiad, Furceri & Topalova (2015), IMF WP/15/95, Table 1 column (1) "Baseline", row k = 2, p. 17. SE 0.322.',
   'https://infrastructuregovern.imf.org/content/dam/PIMA/Knowledge-Hub/Publications/pubdocuments/The%20Macroeconomic%20Effects%20of%20Public%20Investment%20Evidence%20from%20Advanced%20Economies.pdf',
   2015,
   'Panel of 17 advanced economies, not a country estimate. Interval is the point estimate plus and minus one published standard error (0.322) — arithmetic on the paper''s cells, not a range it prints.'),

  ('fiscal_multiplier_y4', 1.389, 0.995, 1.783,
   'Abiad, Furceri & Topalova (2015), IMF WP/15/95, Table 1 column (1) "Baseline", row k = 3, p. 17. SE 0.394.',
   'https://infrastructuregovern.imf.org/content/dam/PIMA/Knowledge-Hub/Publications/pubdocuments/The%20Macroeconomic%20Effects%20of%20Public%20Investment%20Evidence%20from%20Advanced%20Economies.pdf',
   2015,
   'Panel of 17 advanced economies, not a country estimate. Interval is the point estimate plus and minus one published standard error (0.394) — arithmetic on the paper''s cells, not a range it prints.'),

  ('fiscal_multiplier_y5', 1.539, 1.098, 1.980,
   'Abiad, Furceri & Topalova (2015), IMF WP/15/95, Table 1 column (1) "Baseline", row k = 4, p. 17. SE 0.441. Paper text p. 11: "Four years after an unanticipated shock … the level of real output is 1.5 percent higher, which corresponds to a medium-term fiscal multiplier of about 1.4."',
   'https://infrastructuregovern.imf.org/content/dam/PIMA/Knowledge-Hub/Publications/pubdocuments/The%20Macroeconomic%20Effects%20of%20Public%20Investment%20Evidence%20from%20Advanced%20Economies.pdf',
   2015,
   'Panel of 17 advanced economies, not a country estimate. The last horizon the paper publishes: there is no k = 5, which is why the scenario''s horizon stops at five years rather than holding this value flat or continuing its trend. Interval is the point estimate plus and minus one published standard error (0.441).'),

  -- The wage block. Both cells from the same column of the same table, for the
  -- reason set out in the header: a slope taken from one paper and a
  -- persistence taken from another compound into a long-run response neither
  -- author estimated.
  ('wage_phillips_slope', 0.13, 0.09, 0.17,
   'Cunningham, Rai & Hess (2019), "Exploring Wage Phillips Curves in Advanced Economies", Bank of Canada Staff Discussion Paper 2019-8, Table A-5 column (3), row "UR gap"; Arellano–Bond, 10 advanced economies, 1992Q1–2018Q2. Published as −0.13 (SE 0.04) on the unemployment gap; the magnitude is used because the model multiplies by negated slack.',
   'https://www.bankofcanada.ca/wp-content/uploads/2019/08/sdp2019-8.pdf',
   2019,
   'Panel of 10 advanced economies, not a country estimate. Paired deliberately with wage_persistence from the SAME column: the paper''s more-cited 0.36 comes from a specification with no lagged wage term at all, and 0.13 / (1 − 0.65) = 0.371 reproduces it. Using 0.36 next to 0.65 would roughly triple the long-run response. Sign flipped from the published negative — see the citation. Frequency caveat: quarterly data with a year-over-year dependent variable, used here in an annual step.'),

  ('wage_persistence', 0.65, 0.63, 0.67,
   'Cunningham, Rai & Hess (2019), Bank of Canada Staff Discussion Paper 2019-8, Table A-5 column (3), row "Nominal wages = L,"; Arellano–Bond, 10 advanced economies, 1992Q1–2018Q2. Coefficient 0.65, SE 0.02. Text p. 15: "The lagged wage growth variable has a large, positive coefficient of about 0.65, indicating wage growth is quite smooth."',
   'https://www.bankofcanada.ca/wp-content/uploads/2019/08/sdp2019-8.pdf',
   2019,
   'Panel of 10 advanced economies, not a country estimate. Same regression as wage_phillips_slope above; the two must not be sourced separately. Frequency caveat, and it is the binding one: the data are quarterly and the dependent variable is a year-over-year growth rate, so this is carry-over from one QUARTER earlier, applied here to an annual step. No annual-frequency estimate exists in the literature for any country. This overstates persistence, and it cannot be corrected by raising it to the fourth power — the overlapping-window structure of a year-over-year series breaks that identity.'),

  -- Wage-price pass-through. The weakest of the four and the only one whose
  -- honest range spans a factor of three, all of it published.
  ('wage_price_passthrough', 0.33, 0.11, 0.33,
   'Boranova, Huidrom, Nowak, Topalova, Tulin & Varghese (2019), "Wage Growth and Inflation in Europe: A Puzzle?", IMF Working Paper WP/19/280, Section III.A p. 13 and Figure 3 panel 3: "The passthrough from wages to prices at the end of 3 years is about one-third." Regime range from the same paper: about 11% in a low-inflation regime (Section IV.A), under 20% post-2008 (Section III.B).',
   'https://www.imf.org/-/media/files/publications/wp/2019/wpiea2019280-print-pdf.pdf',
   2019,
   'Europe (EU15+3 and newer member states), not a country estimate, and used here for the United States, France and Italy as a stand-in. Two further caveats the source states itself: it is a CUMULATIVE three-year ratio of impulse responses being used in a one-year step, and it is not published as a point estimate with a standard error. The low end of the interval is the paper''s own low-inflation-regime figure. Japan overrides this row with a per-country published finding — see its own entry.')

 ) AS p(param_key, value, value_low, value_high, citation_text, citation_url, as_of_year, notes)
 -- Japan's wage-price pass-through is not a stand-in; it is a published
 -- country result, and it disagrees with the European figure. See below.
 WHERE NOT (c.iso3 = 'JPN' AND p.param_key = 'wage_price_passthrough')
ON CONFLICT (scenario_id, country_iso3, param_key) DO UPDATE SET
  value           = EXCLUDED.value,
  value_low       = EXCLUDED.value_low,
  value_high      = EXCLUDED.value_high,
  confidence_tier = EXCLUDED.confidence_tier,
  citation_text   = EXCLUDED.citation_text,
  citation_url    = EXCLUDED.citation_url,
  as_of_year      = EXCLUDED.as_of_year,
  notes           = EXCLUDED.notes;


-- ---------------------------------------------------------------------------
-- The measured inputs — GDP and baseline unemployment.
--
-- `official` tier, not `modelled`: these are statistical-agency prints rather
-- than econometric estimates, and the enum exists to keep that distinction
-- visible next to the coefficients they sit beside on the page.
-- ---------------------------------------------------------------------------
INSERT INTO simulation_parameters
  (scenario_id, country_iso3, param_key, value, confidence_tier, source_id,
   citation_text, citation_url, as_of_year, notes)
VALUES
  ('ai-capex-dotcom', 'USA', 'gdp_usd_bn', 29298.0, 'official', 'worldbank',
   'World Bank, World Development Indicators, series NY.GDP.MKTP.CD (GDP, current US$), 2024. $29.298 trillion.',
   'https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=US', 2024,
   'The denominator that turns an absolute shock into a share of output. Held constant across the horizon: the model does not grow the baseline, so a five-year projection is expressed against 2024 output throughout.'),
  ('ai-capex-dotcom', 'FRA', 'gdp_usd_bn', 3160.4, 'official', 'worldbank',
   'World Bank, World Development Indicators, series NY.GDP.MKTP.CD (GDP, current US$), 2024. $3.1604 trillion.',
   'https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=FR', 2024,
   'Held constant across the horizon — see the note on the United States row.'),
  ('ai-capex-dotcom', 'ITA', 'gdp_usd_bn', 2383.4, 'official', 'worldbank',
   'World Bank, World Development Indicators, series NY.GDP.MKTP.CD (GDP, current US$), 2024. $2.3834 trillion.',
   'https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=IT', 2024,
   'The smallest economy in this scenario, which is why it is the one that breaks first: a shock the United States absorbs at under 2% of output is over 20% of Italy''s. The caveat names that case.'),
  ('ai-capex-dotcom', 'JPN', 'gdp_usd_bn', 4190.0, 'official', 'worldbank',
   'World Bank, World Development Indicators, series NY.GDP.MKTP.CD (GDP, current US$), 2024. $4.190 trillion.',
   'https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=JP', 2024,
   'Held constant across the horizon — see the note on the United States row.'),

  ('ai-capex-dotcom', 'USA', 'unemployment_baseline', 4.02, 'official', 'worldbank',
   'World Bank, World Development Indicators, series SL.UEM.TOTL.ZS (unemployment, total, % of total labour force, ILO modelled estimate), 2024.',
   'https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS?locations=US', 2024,
   'Where unemployment sits absent the shock. Held flat on purpose rather than projected: it is a published trend, not a forecast, and the model claims nothing about where it would drift on its own.'),
  ('ai-capex-dotcom', 'FRA', 'unemployment_baseline', 7.40, 'official', 'worldbank',
   'World Bank, World Development Indicators, series SL.UEM.TOTL.ZS (unemployment, total, % of total labour force, ILO modelled estimate), 2024.',
   'https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS?locations=FR', 2024,
   'Held flat on purpose — see the note on the United States row.'),
  ('ai-capex-dotcom', 'ITA', 'unemployment_baseline', 6.50, 'official', 'worldbank',
   'World Bank, World Development Indicators, series SL.UEM.TOTL.ZS (unemployment, total, % of total labour force, ILO modelled estimate), 2024.',
   'https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS?locations=IT', 2024,
   'Held flat on purpose — see the note on the United States row.'),
  ('ai-capex-dotcom', 'JPN', 'unemployment_baseline', 2.50, 'official', 'worldbank',
   'World Bank, World Development Indicators, series SL.UEM.TOTL.ZS (unemployment, total, % of total labour force, ILO modelled estimate), 2024.',
   'https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS?locations=JP', 2024,
   'The lowest baseline here, and the one that leaves least room before the model''s missing floor under unemployment starts to matter.')
ON CONFLICT (scenario_id, country_iso3, param_key) DO UPDATE SET
  value           = EXCLUDED.value,
  confidence_tier = EXCLUDED.confidence_tier,
  source_id       = EXCLUDED.source_id,
  citation_text   = EXCLUDED.citation_text,
  citation_url    = EXCLUDED.citation_url,
  as_of_year      = EXCLUDED.as_of_year,
  notes           = EXCLUDED.notes;


-- ---------------------------------------------------------------------------
-- The inflation anchors.
--
-- All four are 2.0, and the temptation is to write one row saying "central
-- banks target two percent". That would be a claim about central banking
-- rather than a citation, so each row names the specific statement its number
-- comes from — and they are genuinely different statements, adopted decades
-- apart, defined against three different price indices (PCE, HICP, CPI).
--
-- `official` tier: a central bank stating its own target is a published fact
-- about policy, not an estimate of anything.
-- ---------------------------------------------------------------------------
INSERT INTO simulation_parameters
  (scenario_id, country_iso3, param_key, value, confidence_tier,
   citation_text, citation_url, as_of_year, notes)
VALUES
  ('ai-capex-dotcom', 'USA', 'inflation_anchor', 2.0, 'official',
   'Federal Open Market Committee, "Statement on Longer-Run Goals and Monetary Policy Strategy", adopted 24 January 2012 and reaffirmed annually: "The Committee judges that inflation at the rate of 2 percent, as measured by the annual change in the price index for personal consumption expenditures, is most consistent with the Federal Reserve''s statutory mandate."',
   'https://www.federalreserve.gov/monetarypolicy/files/FOMC_LongerRunGoals.pdf', 2012,
   'Defined on the PCE price index, not the CPI. Used as the level the model''s inflation deviations are added to; the model has no mechanism by which policy defends it.'),

  ('ai-capex-dotcom', 'FRA', 'inflation_anchor', 2.0, 'official',
   'European Central Bank, "ECB''s Governing Council approves its new monetary policy strategy", 8 July 2021: "The Governing Council considers that price stability is best maintained by aiming for a 2% inflation target over the medium term." Symmetric, measured on the HICP; this replaced the earlier "below, but close to, 2%" formulation.',
   'https://www.ecb.europa.eu/press/pr/date/2021/html/ecb.pr210708~dc78cc4b0d.en.html', 2021,
   'A euro-area target, not a French one. France has no national inflation target and the ECB sets policy for the currency area as a whole, so this is the correct object rather than a stand-in — but it is an area-wide anchor sitting under a country-specific Phillips slope, which is a mismatch worth knowing about.'),

  ('ai-capex-dotcom', 'ITA', 'inflation_anchor', 2.0, 'official',
   'European Central Bank, "ECB''s Governing Council approves its new monetary policy strategy", 8 July 2021: "The Governing Council considers that price stability is best maintained by aiming for a 2% inflation target over the medium term." Symmetric, measured on the HICP.',
   'https://www.ecb.europa.eu/press/pr/date/2021/html/ecb.pr210708~dc78cc4b0d.en.html', 2021,
   'A euro-area target, not an Italian one — see the note on the France row.'),

  ('ai-capex-dotcom', 'JPN', 'inflation_anchor', 2.0, 'official',
   'Bank of Japan, "The ''Price Stability Target'' under the Framework for the Conduct of Monetary Policy", 22 January 2013, paragraph 3: "the Bank sets the ''price stability target'' at 2 percent in terms of the year-on-year rate of change in the consumer price index (CPI) -- a main price index."',
   'https://www.boj.or.jp/en/mopo/mpmdeci/mpr_2013/k130122b.pdf', 2013,
   'Defined on the headline CPI. The same number as the other three and a materially different history behind it: this target was introduced in 2013 after two decades in which Japanese inflation ran below it, which is context the model cannot represent — it treats the anchor as a level, not as a thing that has to be reached.')
ON CONFLICT (scenario_id, country_iso3, param_key) DO UPDATE SET
  value           = EXCLUDED.value,
  confidence_tier = EXCLUDED.confidence_tier,
  citation_text   = EXCLUDED.citation_text,
  citation_url    = EXCLUDED.citation_url,
  as_of_year      = EXCLUDED.as_of_year,
  notes           = EXCLUDED.notes;


-- ---------------------------------------------------------------------------
-- Okun's coefficients — the per-country number that carries most of the
-- differentiation in this scenario.
--
-- Stored NEGATIVE, exactly as published: Ball, Leigh and Loungani estimate
-- U − U* = β(Y − Y*), so β is below zero and output above trend puts
-- unemployment below it. No sign is flipped anywhere between this table and
-- the chart, which means the number a reader sees in the citation panel is the
-- number in the source's table. The engine refuses a positive value outright,
-- because a minus sign lost in transcription would invert the entire labour
-- channel and still draw a confident line.
-- ---------------------------------------------------------------------------
INSERT INTO simulation_parameters
  (scenario_id, country_iso3, param_key, value, confidence_tier,
   citation_text, citation_url, as_of_year, notes)
VALUES
  ('ai-capex-dotcom', 'USA', 'okun_coefficient', -0.563, 'modelled',
   'Ball, Leigh & Loungani (2017), "Okun''s Law: Fit at 50?", Journal of Money, Credit and Banking 49(7): 1413–1441, Table 7, United States. Published negative, as the specification U − U* = β(Y − Y*) requires.',
   'https://doi.org/10.1111/jmcb.12420', 2017,
   'The steepest coefficient in this scenario: an output gap moves American unemployment nearly four times as far as Japanese. That contrast is a published result, not a modelling choice, and it is most of what distinguishes the four countries here.'),
  ('ai-capex-dotcom', 'FRA', 'okun_coefficient', -0.370, 'modelled',
   'Ball, Leigh & Loungani (2017), "Okun''s Law: Fit at 50?", Journal of Money, Credit and Banking 49(7): 1413–1441, Table 7, France. Published negative.',
   'https://doi.org/10.1111/jmcb.12420', 2017, NULL),
  ('ai-capex-dotcom', 'ITA', 'okun_coefficient', -0.217, 'modelled',
   'Ball, Leigh & Loungani (2017), "Okun''s Law: Fit at 50?", Journal of Money, Credit and Banking 49(7): 1413–1441, Table 7, Italy. Published negative.',
   'https://doi.org/10.1111/jmcb.12420', 2017, NULL),
  ('ai-capex-dotcom', 'JPN', 'okun_coefficient', -0.151, 'modelled',
   'Ball, Leigh & Loungani (2017), "Okun''s Law: Fit at 50?", Journal of Money, Credit and Banking 49(7): 1413–1441, Table 7, Japan. Published negative.',
   'https://doi.org/10.1111/jmcb.12420', 2017,
   'The flattest coefficient here, and consistent with Japan''s well-documented labour hoarding: output falls without unemployment rising much. It also means a Japanese shock shows up in this model as output and prices far more than as jobs.')
ON CONFLICT (scenario_id, country_iso3, param_key) DO UPDATE SET
  value           = EXCLUDED.value,
  confidence_tier = EXCLUDED.confidence_tier,
  citation_text   = EXCLUDED.citation_text,
  citation_url    = EXCLUDED.citation_url,
  as_of_year      = EXCLUDED.as_of_year,
  notes           = EXCLUDED.notes;


-- ---------------------------------------------------------------------------
-- Price Phillips slopes — the only coefficient with genuine per-country
-- coverage, and the one that decided which countries ship at all.
--
-- SIGN CONVENTION, WHICH IS THE THING TO GET RIGHT HERE. The OECD estimates
-- its slope on (U* − U), so a POSITIVE published number already means
-- "inflation rises when unemployment falls" and needs no flip — the opposite
-- of the Blanchard–Cerutti–Summers convention, where the same economics is
-- published as a negative number. Two papers, two signs, one direction. The
-- OECD states its convention explicitly in ECO/WKP(2019)49 footnote 3, p. 7,
-- and the values below are used exactly as published.
--
-- All four are taken from the SAME table of the SAME paper, deliberately.
-- Mixing an OECD slope for one country with a BCS slope for another would put
-- two different inflation measures, samples and treatments of expectations
-- side by side under one column heading.
-- ---------------------------------------------------------------------------
INSERT INTO simulation_parameters
  (scenario_id, country_iso3, param_key, value, value_low, value_high,
   confidence_tier, citation_text, citation_url, as_of_year, notes)
VALUES
  ('ai-capex-dotcom', 'USA', 'price_phillips_slope', 0.11, 0.10, 0.15, 'modelled',
   'Turner, Chalaux, Guillemette & Rusticelli (2019), "Insights from OECD Phillips Curve Equations on Recent Inflation Outcomes", OECD Economics Department Working Paper No. 1579 (ECO/WKP(2019)49), Table 1, "Long-run GAPUNR coefficient", OECD unemployment-gap column, p. 9. United States 0.11, significant at 1%, adj. R² 0.50. Sample 1998Q1–2019Q1, quarterly, core PCE.',
   'https://one.oecd.org/document/ECO/WKP(2019)49/en/pdf', 2019,
   'Published on (U* − U), so positive already means inflation rises as unemployment falls; used unflipped. The interval is the paper''s own robustness runs on the IMF and European Commission gap series (0.11 / 0.15 / 0.10) — stable. Blanchard, Cerutti & Summers (NBER WP 21726, Table 6) get a magnitude of 0.29 for the US on 1990–2014 headline CPI, so the two sources agree on direction and significance and are a factor of about 2.6 apart on size.'),

  ('ai-capex-dotcom', 'FRA', 'price_phillips_slope', 1.00, 0.39, 1.00, 'modelled',
   'Turner, Chalaux, Guillemette & Rusticelli (2019), OECD Economics Department Working Paper No. 1579 (ECO/WKP(2019)49), Table 1, "Long-run GAPUNR coefficient", OECD unemployment-gap column, p. 9. France 1.00, significant at 10%, adj. R² 0.33. Sample 1998Q1–2019Q1, harmonised core.',
   'https://one.oecd.org/document/ECO/WKP(2019)49/en/pdf', 2019,
   'The weakest of the four, and read the interval before the point estimate. Significant only at 10%, and the paper''s own robustness runs on the IMF and European Commission gap series give 0.88 and 0.39, neither significant — so the headline value survives only on the OECD''s own gap measure. Blanchard, Cerutti & Summers get 0.49, significant at 1%, on a different sample. The steepest slope in this scenario sits on the least stable estimate; treat France''s inflation path as the most fragile number on the page.'),

  ('ai-capex-dotcom', 'ITA', 'price_phillips_slope', 0.37, 0.37, 0.49, 'modelled',
   'Turner, Chalaux, Guillemette & Rusticelli (2019), OECD Economics Department Working Paper No. 1579 (ECO/WKP(2019)49), Table 1, "Long-run GAPUNR coefficient", OECD unemployment-gap column, p. 9. Italy 0.37, significant at 1%, adj. R² 0.66. Sample 1998Q1–2019Q1, harmonised core.',
   'https://one.oecd.org/document/ECO/WKP(2019)49/en/pdf', 2019,
   'Interval from the paper''s robustness runs (0.37 / 0.49 / 0.43) — stable. Blanchard, Cerutti & Summers agree on direction with a smaller magnitude (0.12, not significant, in one specification; 0.15, significant at 1%, in the other).'),

  ('ai-capex-dotcom', 'JPN', 'price_phillips_slope', 0.69, 0.67, 0.69, 'modelled',
   'Turner, Chalaux, Guillemette & Rusticelli (2019), OECD Economics Department Working Paper No. 1579 (ECO/WKP(2019)49), Table 1, "Long-run GAPUNR coefficient", OECD unemployment-gap column, p. 9. Japan 0.69, significant at 1%, adj. R² 0.68. Sample 1998Q1–2019Q1, core CPI.',
   'https://one.oecd.org/document/ECO/WKP(2019)49/en/pdf', 2019,
   'The best-corroborated number in this set: Japan is the steepest G7 price Phillips curve in both independent sources, at 0.69 here and a magnitude of 1.09 in Blanchard, Cerutti & Summers Table 6, both significant at 1%. Interval from the paper''s IMF-gap robustness run (0.67); the European Commission gap is not available for Japan.')
ON CONFLICT (scenario_id, country_iso3, param_key) DO UPDATE SET
  value           = EXCLUDED.value,
  value_low       = EXCLUDED.value_low,
  value_high      = EXCLUDED.value_high,
  confidence_tier = EXCLUDED.confidence_tier,
  citation_text   = EXCLUDED.citation_text,
  citation_url    = EXCLUDED.citation_url,
  as_of_year      = EXCLUDED.as_of_year,
  notes           = EXCLUDED.notes;


-- ---------------------------------------------------------------------------
-- Japan's wage-price pass-through: zero, and zero is the finding.
--
-- This is the one place a country overrides the panel stand-in, and it does so
-- because a per-country published result exists and contradicts the European
-- figure outright. Hoshi and Kashyap's paper is titled "The Great Disconnect"
-- for this: before 1998 a wage shock moved Japanese prices substantially,
-- after 1998 it moved them not at all, and Granger causality from wages to
-- prices fails outright over the modern sample.
--
-- Inserting 0.33 here instead would have been the tidier file and the wrong
-- number — a European average asserted over a country whose own literature
-- says the channel is closed. A zero that is sourced is a stronger statement
-- than a stand-in that is plausible, and the consequence is visible on the
-- page: Japanese inflation in this model moves only through the direct slack
-- term, which is exactly what the paper describes.
-- ---------------------------------------------------------------------------
INSERT INTO simulation_parameters
  (scenario_id, country_iso3, param_key, value, confidence_tier,
   citation_text, citation_url, as_of_year, notes)
VALUES
  ('ai-capex-dotcom', 'JPN', 'wage_price_passthrough', 0, 'modelled',
   'Hoshi & Kashyap (2020), "The Great Disconnect: The Decoupling of Wage and Price Inflation in Japan", NBER Working Paper 27332, Section 5, pp. 12–13, and Table 7 Panel A. On 1998–2018: "An increase in wages or bonuses does not have any visible impact on core-core inflation … at the eight quarter horizon, wage and bonus inflation explain less than 5% of the core-core inflation variation." Granger causality from wages to prices fails over that sample. Conclusion p. 13: "Before 1998, both wages and bonuses had significant and sizable impacts on prices. After 1998, those linkages between wages and prices were lost."',
   'https://www.nber.org/system/files/working_papers/w27332/w27332.pdf', 2020,
   'A per-country finding that replaces the European panel stand-in used for the other three countries, not a missing value defaulted to zero. It is period-specific: the same paper estimates a meaningful pass-through before 1998, so this coefficient describes the modern regime and would be wrong for a scenario set earlier. No standard error is carried because the result is published as a failed causality test and a variance decomposition rather than as a point estimate.')
ON CONFLICT (scenario_id, country_iso3, param_key) DO UPDATE SET
  value           = EXCLUDED.value,
  confidence_tier = EXCLUDED.confidence_tier,
  citation_text   = EXCLUDED.citation_text,
  citation_url    = EXCLUDED.citation_url,
  as_of_year      = EXCLUDED.as_of_year,
  notes           = EXCLUDED.notes;

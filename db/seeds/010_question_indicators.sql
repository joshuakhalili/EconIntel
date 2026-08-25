-- ============================================================================
-- 010_question_indicators.sql — every populated indicator, placed
--
-- `chart_group` puts series on ONE chart and therefore ONE axis, so grouped
-- series must share a unit. Where they do not — the three US producer price
-- indices have base years of Dec 1998, Dec 2003 and Dec 2000 — they are left
-- ungrouped rather than forced together, because a shared axis across
-- incompatible bases invites a comparison the numbers do not support.
--
-- `country_iso3` is set wherever an indicator carries several countries.
-- Without it the chart draws every country interleaved on one line, which
-- produces a plausible sawtooth rather than an obvious error.
-- ============================================================================

INSERT INTO question_indicators
  (question_id, indicator_id, role, sort_order, chart_group, country_iso3, caption_plain, caption_expert) VALUES

-- ─────────────────────────────────────────────────────────────────────────────
-- ADOPTION
-- ─────────────────────────────────────────────────────────────────────────────
('adoption', 'derived.sec_ai_mention_rate', 'hero', 1, NULL, 'USA',
 'The share of large US companies that mention AI in their annual report to regulators. Because a false claim in that document carries legal liability, this is a harder test than a press release.',
 'Numerator: 10-K filings matching "artificial intelligence" in EDGAR full-text search. Denominator: total 10-K filings from the quarterly form index, NOT from full-text search, which caps its reported total at 10,000. Total filings were flat over the period (6,923 to 6,878), so the rise is not a denominator artefact.'),

('adoption', 'dbn.OECD.DSD_ICT_B_DF_BUSINESSES.OECD.A.G14_B.PT_ENT._T.S_GE10', 'supporting', 2, 'enterprise-ai', NULL,
 'The share of firms across the developed world using AI in some form.',
 'OECD ICT Access and Usage by Businesses, all sectors, enterprises with 10+ employees. Harmonised across members but survey frames differ; 2022 is missing from the panel.'),

('adoption', 'dbn.OECD.DSD_ICT_B_DF_BUSINESSES.EU27.A.G14_B.PT_ENT._T.S_GE10', 'supporting', 3, 'enterprise-ai', NULL,
 'The same question asked across the European Union.',
 'EU27 aggregate. Preferred over the Eurostat original, which reports the same figures to three decimals but carries one fewer year.'),

('adoption', 'dbn.OECD.ict_business.KOR.ai_adoption', 'supporting', 4, 'enterprise-ai', 'KOR',
 'South Korea, where adoption is higher than anywhere else measured — a third of firms.',
 'The highest national rate available from any free source, roughly 13 points above the OECD mean. The closest thing to a natural experiment in what widespread enterprise AI use does to an economy.'),

('adoption', 'dbn.OECD.DSD_ICT_B_DF_BUSINESSES.OECD.A.G14_B.PT_ENT.J.S_GE10', 'supporting', 5, 'enterprise-ai', NULL,
 'Software and telecoms firms specifically — the sector that adopts first.',
 'NACE section J. The leading edge of the diffusion curve; useful as an upper bound on what saturation looks like.'),

('adoption', 'dbn.Eurostat.isoc_eb_ain2.A.GE10.J62_J63.E_AI_TANY.PC_ENT.EU27_2020', 'supporting', 6, 'sector-spread', NULL,
 'Two thirds of Europe''s programming and IT consultancy firms now use AI.',
 'NACE J62_J63. Charted against manufacturing to show dispersion rather than a single average.'),

('adoption', 'dbn.Eurostat.isoc_eb_ain2.manufacturing', 'supporting', 7, 'sector-spread', NULL,
 'European factories, by contrast — about one in six. Roughly four years behind software firms.',
 'NACE section C. The lagging-sector counterpart; the gap between the two is the diffusion story that a national average conceals.'),

('adoption', 'dbn.Eurostat.isoc_eb_ai.A.GE10.C10-S951_X_K.E_AI_TNLG.PC_ENT.EU27_2020', 'supporting', 8, NULL, NULL,
 'Firms using AI that writes text, speech or code — the closest official statistic to "companies using ChatGPT".',
 'Eurostat AI technology type: natural language generation. Quadrupled after 2023, which is the clearest survey-visible signature of the large language model wave.'),

('adoption', 'dbn.Eurostat.isoc_cicce_use.A.GE10.C10-S951_X_K.E_CC1_PANY.PC_ENT.EU27_202', 'supporting', 9, NULL, NULL,
 'Firms buying cloud computing. Almost all business AI is delivered this way, so it caps how fast AI can spread.',
 'Biennial, three observations only — rendered as bars rather than a line, since three points do not describe a trajectory.'),

('adoption', 'dbn.OECD.DSD_ICT_B_DF_BUSINESSES.OECD.A.H1_B.PT_ENT._T.S_GE10', 'supporting', 10, NULL, NULL,
 'Firms that employ technical specialists at all — a measure of whether a company can absorb this technology.',
 'Absorptive capacity proxy. Adoption without in-house capability tends to mean procurement rather than integration.'),

('adoption', 'dbn.Eurostat.isoc_ske_itrcrn2.A.GE10.C10-S951_X_K.E_ITSPVAC2.PC_ENT.EU27_2', 'context', 11, NULL, NULL,
 'Firms that could not fill a technical vacancy. This peaked in 2022 and has eased since.',
 'One reading is that AI tools are relieving demand for scarce developers; another is the post-2022 tech contraction. The series cannot distinguish them.'),

('adoption', 'wb.IT.NET.USER.ZS', 'context', 12, NULL, 'USA',
 'Internet use, for scale. This is what the last general-purpose technology''s adoption curve looked like.',
 'World Bank, 48 countries. Included as a historical reference curve, not as an AI indicator.'),

-- ─────────────────────────────────────────────────────────────────────────────
-- MONEY
-- ─────────────────────────────────────────────────────────────────────────────
('money', 'fred.A679RC1Q027SBEA', 'hero', 1, 'us-investment-bn', 'USA',
 'What American business spends each year on computers, communications equipment and software. Over $1.6 trillion and climbing.',
 'BEA NIPA private fixed investment, information-processing equipment and software, nominal, SAAR. The broadest national-accounts measure of the capital deepening AI would require.'),

('money', 'fred.B985RC1Q027SBEA', 'supporting', 2, 'us-investment-bn', 'USA',
 'The software half of that spending, separated out.',
 'Nonresidential intellectual property products, software. Charted with the equipment series to show whether the boom is chip-led or code-led.'),

('money', 'dbn.BEA.NIPA-T50405.LA001282-A', 'supporting', 3, 'usd-millions', 'USA',
 'Money spent specifically on data-centre buildings. Small next to total investment, but the fastest-growing line in the accounts.',
 'NIPA table 5.4.5, line LA001282-A. Begins 2020, so there is no pre-AI baseline. Structures only — excludes the servers inside.'),

('money', 'dbn.BEA.NIPA-T50505.B935RC-A', 'supporting', 4, 'usd-millions', 'USA',
 'Spending on the computers themselves, going back to 1959.',
 'NIPA 5.5.5, computers and peripheral equipment. Nominal; note that quality-adjusted deflation means real capital deepening exceeds the nominal path substantially.'),

('money', 'dbn.WTO.ITS_CS_AX6.840.SI221.000.A', 'supporting', 5, 'usd-millions', 'USA',
 'What America earns selling cloud and data-storage services abroad.',
 'WTO trade in services, US exports, cloud computing and data storage. A revenue-side counterpart to the capex series.'),

('money', 'dbn.WTO.ITS_CS_AX6.000.SI2.000.A', 'supporting', 6, 'usd-millions', NULL,
 'The size of the world market for computer services.',
 'WTO world exports of computer services. Denominator for national shares.'),

('money', 'fred.TLMFGCONS', 'supporting', 7, NULL, 'USA',
 'Money going into building factories — driven since 2022 by semiconductor plants.',
 'Census construction spending, manufacturing. The CHIPS Act response is visible from 2022; not AI-specific but largely AI-driven at the margin.'),

('money', 'dbn.OECD.DSD_VC_DF_VC_INV.USA.VC_INV_MKT.LATER.USD_EXC.A', 'supporting', 8, NULL, 'USA',
 'Late-stage venture capital — where the large private AI companies raise money.',
 'OECD venture capital, later stage. The only capital-flows series held; private rounds are otherwise invisible.'),

('money', 'dbn.Eurostat.nama_10_an6.A.CLV_I15.N117G.EU27_2020', 'supporting', 9, 'eu-investment', NULL,
 'European investment in software and databases.',
 'Chain-linked volumes, 2015=100. Intellectual property products, so it captures the intangible half of digital capital.'),

('money', 'dbn.Eurostat.nama_10_an6.ict_equipment', 'supporting', 10, 'eu-investment', NULL,
 'European investment in the hardware, on the same scale.',
 'ICT equipment, chain-linked, 2015=100. Same base and cadence as the IP series, so the two share an axis legitimately.'),

('money', 'dbn.Eurostat.rd_e_berdfundr2.A.TOTAL.G-U_ICT.MIO_EUR.EU27_2020', 'supporting', 11, NULL, NULL,
 'European business research spending on digital services — four times its 2005 level.',
 'BERD in ICT services, EUR million, nominal.'),

('money', 'dbn.OECD.DSD_ANBERD_DF_ANBERDi4.USA.A.MA.J62_63.USD_PPP.V.B', 'supporting', 12, NULL, 'USA',
 'The American equivalent: research spending by software and IT firms.',
 'OECD ANBERD, ISIC J62-63, USD PPP. Comparable in principle to the Eurostat series, though funding-source definitions differ.'),

('money', 'dbn.NBS.A_A0G11.A0G1101', 'supporting', 13, NULL, 'CHN',
 'Revenue of China''s software and IT services industry.',
 'NBS annual, 10,000 yuan. Ten-year rolling window — the provider drops the earliest year each release, so ingestion must upsert rather than replace.'),

('money', 'wb.GB.XPD.RSDV.GD.ZS', 'context', 14, NULL, 'USA',
 'Total research spending as a share of the economy, for context.',
 'World Bank, 48 countries. Whole-economy R&D intensity; too broad to attribute to AI but the denominator for sector shares.'),

('money', 'dbn.OECD.DSD_PDB_DF_PDB_GR.USA.A.SOFT_PCCONK._T.PD.V.GOY._Z._Z', 'context', 15, NULL, 'USA',
 'How much of America''s growth in business equipment is now software rather than machinery.',
 'OECD productivity database: contribution of software and databases to total capital growth, percentage points.'),

-- ─────────────────────────────────────────────────────────────────────────────
-- JOBS
-- ─────────────────────────────────────────────────────────────────────────────
('jobs', 'derived.information_employment_share', 'hero', 1, NULL, 'USA',
 'Jobs in America''s information sector as a share of all jobs. It rose for most of the last decade and has been falling since 2023.',
 'USINFO divided by PAYEMS. The ratio is the point: both series absorb the same macro shocks, so the divergence between them is attributable to something specific to information work rather than to the cycle. Not causal identification, but closer than either series alone.'),

('jobs', 'fred.USINFO', 'supporting', 2, NULL, 'USA',
 'The raw count of information-sector jobs.',
 'CES, seasonally adjusted, thousands. Shown separately from PAYEMS because the two differ by roughly 50x and would not share an axis usefully.'),

('jobs', 'fred.PAYEMS', 'context', 3, NULL, 'USA',
 'Total US employment — the control group against which everything else is read.',
 'Total nonfarm payrolls, CES. The denominator of the hero series.'),

('jobs', 'dbn.ONS.UNEM.JP9P.M', 'supporting', 4, NULL, 'GBR',
 'Job openings in UK technology and communications. Now below their 2001 level.',
 'ONS vacancies, SIC section J, monthly. Vacancy series lead employment because hiring intent adjusts before headcount. Contains "NA" sentinel strings that must be filtered numerically, not treated as null.'),

('jobs', 'dbn.Eurostat.jvs_q_nace2.Q.NSA.J.TOTAL.JVR.EU27_2020', 'supporting', 5, NULL, NULL,
 'The same measure for the European Union.',
 'Job vacancy rate, NACE J, unadjusted — expect visible seasonality; EU27 is published without seasonal adjustment at this level.'),

('jobs', 'dbn.RBA.H5.GLFOSVTLF', 'supporting', 6, NULL, 'AUS',
 'Australian job vacancies relative to the size of the workforce.',
 'RBA table H5. Tagged monthly by the provider but actually quarterly, and padded with future nulls to 2026-10; truncate at the last numeric point.'),

('jobs', 'dbn.JILPT.e0208.M.1.1', 'supporting', 7, NULL, 'JPN',
 'Japanese job openings per applicant — above one means more jobs than people seeking them.',
 'JILPT active openings-to-applicants ratio, excluding new graduates. Japan''s tight labour market is a useful contrast case: substitution pressure looks different where labour is scarce.'),

('jobs', 'dbn.ILO.EMP_TEMP_SEX_OCU_NB.USA.BA_453.OCU_ISCO08_4.SEX_T.A', 'supporting', 8, NULL, 'USA',
 'Americans employed in clerical and administrative work — the occupation most exposed to language models.',
 'ILO ISCO-08 major group 4. The only occupation-level series in this dashboard. ILO source codes are not country-swappable: the second dimension is a survey identifier, so USA BA_453 has no equivalent form for other countries.'),

('jobs', 'dbn.Eurostat.isoc_sks_itspt.A.PC_EMP.EU27_2020', 'supporting', 9, NULL, NULL,
 'Technical specialists as a share of all European employment. Still rising.',
 'If AI were displacing technical workers this would bend down after 2023. It has not.'),

('jobs', 'dbn.STATJP.MIm.M.EP.B.TTP.SA', 'supporting', 10, NULL, 'JPN',
 'Japanese employment, running back to 1953 — the longest series in this dashboard.',
 'Statistics Japan monthly labour force survey, seasonally adjusted, ten thousand persons. Long enough to place the current period against several complete technology cycles.'),

('jobs', 'dbn.NBS.A_A0406.A040608', 'supporting', 11, NULL, 'CHN',
 'Chinese employment in IT and software.',
 'NBS urban units, information transmission and software. Urban units only — excludes private and informal employment, so the level understates substantially.'),

('jobs', 'dbn.NBS.A_A040I.A040I08', 'supporting', 12, NULL, 'CHN',
 'What those Chinese technology jobs pay.',
 'NBS average wage, urban units, yuan per year, nominal.'),

('jobs', 'wb.SL.UEM.TOTL.ZS', 'context', 13, NULL, 'USA',
 'Overall unemployment, for context. Whole-economy unemployment is far too broad to show an AI effect.',
 'World Bank modelled ILO estimate, 48 countries. Included so a reader can see the aggregate is unmoved while sector-level series shift.'),

('jobs', 'fred.ULCNFB', 'context', 14, NULL, 'USA',
 'What it costs employers to produce a unit of output. Falls when output per worker rises faster than pay.',
 'Unit labour costs, nonfarm business, index 2017=100.'),

-- ─────────────────────────────────────────────────────────────────────────────
-- PRODUCTIVITY
-- ─────────────────────────────────────────────────────────────────────────────
('productivity', 'fred.OPHNFB', 'hero', 1, 'us-productivity', 'USA',
 'American output per hour worked — the headline productivity measure. Broadly flat through the entire AI investment boom.',
 'BLS nonfarm business output per hour, index 2017=100. The J-curve literature predicts an initial DECLINE during heavy intangible investment, since the spending is expensed while complementary reorganisation goes unmeasured — so a flat series is consistent both with large future gains and with none.'),

('productivity', 'fred.OPHMFG', 'supporting', 2, 'us-productivity', 'USA',
 'The same measure for manufacturing alone.',
 'Manufacturing sector output per hour, same base. Charted against nonfarm to expose differential effects, which appear before aggregate ones.'),

('productivity', 'fred.INDPRO', 'supporting', 3, 'us-productivity', 'USA',
 'How much American industry physically produces.',
 'Industrial production index, 2017=100. Shares the base year with the productivity series, so a common axis is legitimate.'),

('productivity', 'derived.productivity_gap_mfg_vs_total', 'supporting', 4, NULL, 'USA',
 'Manufacturing productivity divided by the whole economy''s. Above 100 means factories are pulling ahead.',
 'OPHMFG/OPHNFB indexed to 100 at the first shared quarter. A ratio isolates differential movement from the common component.'),

('productivity', 'dbn.ONS.PRDY.GYY7.Q', 'supporting', 5, 'uk-productivity', 'GBR',
 'British productivity across the whole market economy. Flat for over a decade.',
 'ONS output per hour, market sector, index 2023=100, seasonally adjusted. Contains "NA" sentinels; 130 numeric points of 268 periods.'),

('productivity', 'dbn.ONS.PRDY.DJR5.Q', 'supporting', 6, 'uk-productivity', 'GBR',
 'And for the UK information and communications sector specifically.',
 'Same base year, same cadence, same source as the market-sector series — the cleanest ready-made two-line comparison in this dataset. Eurostat stopped covering UK industry detail after Brexit, making ONS the only route to it.'),

('productivity', 'fred.RTFPNAUSA632NRUG', 'supporting', 7, NULL, 'USA',
 'Total factor productivity: how efficiently the whole economy converts labour and capital into output.',
 'Penn World Table via FRED, index 2017=1. Annual and ends 2023, so it lags the AI period badly. This is where a genuine general-purpose technology effect would eventually appear.'),

('productivity', 'dbn.AMECO.ZVGDF.GBR.3.0.0.0.ZVGDF', 'supporting', 8, NULL, 'GBR',
 'The same for the United Kingdom, back to 1960.',
 'AMECO total factor productivity, index 2020=100. WARNING: AMECO mixes European Commission forecasts into the same array as history — 2025 onward are projections and must be rendered distinctly or the chart asserts something false.'),

('productivity', 'dbn.RBA.H4.GNFPROSQI', 'supporting', 9, NULL, 'AUS',
 'Australian productivity per hour.',
 'RBA table H4. Tagged daily by the provider, actually quarterly — cadence is inferred from observation spacing rather than metadata for this reason.'),

('productivity', 'dbn.RBA.H4.GNFULCYP', 'supporting', 10, NULL, 'AUS',
 'Australian labour costs, year on year.',
 'Year-ended non-farm unit labour cost growth, percent.'),

('productivity', 'dbn.Eurostat.nama_10_lp_a21.A.I15.J.RLPR_HW.EU27_2020', 'supporting', 11, NULL, NULL,
 'European productivity in the information sector — thirty years of trend for AI to beat.',
 'Real labour productivity per hour, NACE J, index 2015=100. The pre-AI trend is the counterfactual any claimed acceleration must exceed.'),

('productivity', 'dbn.OECD.DSD_PDB_DF_PDB_LV.USA.A.GDPHRS._T.USD_PPP_H.Q._Z._Z._Z', 'supporting', 12, NULL, 'USA',
 'American output per hour in dollars, comparable across countries.',
 'OECD GDP per hour worked, PPP-converted level. Level rather than index, so cross-country comparison is meaningful.'),

('productivity', 'dbn.OECD.DSD_PDB_DF_PDB_GR.USA.A.ICTHRS_PCCONLP._T.PD.V.GOY._Z._Z', 'supporting', 13, NULL, 'USA',
 'How much of America''s productivity growth comes from computing equipment.',
 'ICT capital deepening contribution, percentage points of labour productivity growth. Decomposes what part of measured growth is attributable to IT capital at all — the direct test of the AI-productivity claim.'),

('productivity', 'fred.GDPC1', 'context', 14, NULL, 'USA',
 'The size of the American economy, for scale.',
 'Real GDP, chained 2017 dollars.'),

('productivity', 'fred.RVAI', 'context', 15, 'us-value-added', 'USA',
 'Output of the information industry.',
 'Real value added by industry, chained 2017 dollars.'),

('productivity', 'fred.RVASPI', 'context', 16, 'us-value-added', 'USA',
 'Output of all private service industries, for comparison.',
 'Same units and cadence, so the two share an axis; the information sector is roughly a ninth of the total.'),

-- ─────────────────────────────────────────────────────────────────────────────
-- BUILDING
-- ─────────────────────────────────────────────────────────────────────────────
('building', 'derived.datacentre_capacity_mw', 'hero', 1, NULL, 'USA',
 'Publicly known data-centre capacity in the United States, in megawatts. Under 400 in 2023, nearly 2,000 by 2025.',
 'Cumulative installed capacity from Epoch AI''s cluster register, summed by first operational date. Cumulative rather than annual additions because capacity is a stock. A documented LOWER BOUND — the register covers disclosed clusters only, roughly 2,600 MW worldwide, certainly less than exists.'),

('building', 'epoch.gpu_cluster_count', 'supporting', 2, NULL, 'USA',
 'The number of large computing clusters known publicly.',
 'A count rather than a capacity estimate: clusters differ by two orders of magnitude, so counting them answers a different question than the megawatt series and both are shown.'),

('building', 'epoch.training_compute_frontier', 'supporting', 3, NULL, NULL,
 'The computing power behind the largest AI model trained to date — the frontier, not the average.',
 'Running maximum of training compute in FLOP across notable models. A frontier series rather than a scatter: the record is what drives infrastructure demand, individual model sizes are noise around it. Log scale is appropriate.'),

('building', 'fred.IPG334S', 'supporting', 4, NULL, 'USA',
 'How much computer and electronic equipment America physically makes.',
 'Industrial production, computer and electronic products, index 2017=100. Distinct from the narrower semiconductor index.'),

('building', 'fred.A34SNO', 'supporting', 5, NULL, 'USA',
 'New orders for computers and electronics — what has been ordered but not yet delivered.',
 'Census manufacturers'' new orders, millions of dollars. Leads shipments and therefore output.'),

('building', 'dbn.NBS.A_A0E0H.A0E0H28', 'supporting', 6, NULL, 'CHN',
 'China''s output of integrated circuits — 3.7 times its 2016 level.',
 'NBS annual, 10,000 pieces. Unit count, not value or capability, so it does not distinguish leading-edge from legacy nodes.'),

('building', 'dbn.NBS.M_A02092Q.A02092Q01', 'supporting', 7, NULL, 'CHN',
 'The same, month by month.',
 'NBS monthly, 100 million units. Short history; began 2025-02.'),

('building', 'dbn.EIA.ELEC.GEN.ALL-US-99.M', 'supporting', 8, NULL, 'USA',
 'Total American electricity generation. Data centres are now large enough to move this.',
 'EIA all sectors, thousand MWh, monthly.'),

('building', 'dbn.EIA.ELEC.SALES.US-IND.M', 'supporting', 9, 'us-electricity-sales', 'USA',
 'Electricity sold to industry.',
 'EIA retail sales, industrial sector, million kWh. Same unit as the commercial series, so both share an axis.'),

('building', 'dbn.EIA.ELEC.SALES.US-COM.M', 'supporting', 10, 'us-electricity-sales', 'USA',
 'Electricity sold to commercial customers — the category most data centres fall into.',
 'EIA retail sales, commercial sector. The commercial/industrial split matters: hyperscale sites are usually classified commercial.'),

('building', 'dbn.NBS.A_A0711.A071107', 'supporting', 11, NULL, 'CHN',
 'China''s electricity output.',
 'NBS annual, 100 million kWh.'),

('building', 'dbn.BOJ.SPPI.5201450003', 'supporting', 12, NULL, 'JPN',
 'What Japanese data centres charge — a rare direct price for compute capacity.',
 'Bank of Japan services producer price index, internet data centres, 2015=100. Ends 2024-04.'),

-- ─────────────────────────────────────────────────────────────────────────────
-- POLICY
-- ─────────────────────────────────────────────────────────────────────────────
('policy', 'derived.ai_regulation_volume', 'hero', 1, NULL, 'USA',
 'How many AI-related documents the US federal government publishes each month, across all types.',
 'Federal Register documents matched on six AI search terms, deduplicated on the government''s own document_number. A lower bound where the per-term page cap binds.'),

('policy', 'derived.ai_binding_rules', 'supporting', 2, 'us-policy-type', 'USA',
 'Rules that are actually law and enforceable — the only one of these three that obliges anyone to do anything.',
 'Federal Register type "Rule".'),

('policy', 'derived.ai_proposed_rules', 'supporting', 3, 'us-policy-type', 'USA',
 'Rules that have been proposed. These carry a comment period and typically precede a real rule by one to two years, if they convert at all.',
 'Type "Proposed Rule". The gap between this and the rules series measures conversion of announced intent into obligation.'),

('policy', 'derived.ai_presidential_documents', 'supporting', 4, 'us-policy-type', 'USA',
 'Executive orders. These move in days rather than years, and a successor can undo them just as fast.',
 'Type "Presidential Document". A measure of political attention rather than durable policy.'),

-- ─────────────────────────────────────────────────────────────────────────────
-- MARKETS
-- ─────────────────────────────────────────────────────────────────────────────
('markets', 'fred.PCU518210518210', 'hero', 1, NULL, 'USA',
 'What it costs to rent computing power — the closest thing America publishes to a cloud price index.',
 'PPI by industry: data processing, hosting and related services, base Dec 2000=100. The nearest available proxy for the price of compute as a service.'),

('markets', 'fred.PCU334413334413', 'supporting', 2, NULL, 'USA',
 'Semiconductor prices, now under a third of their 1998 level. This decades-long fall is the foundation everything else rests on.',
 'PPI semiconductor and related device manufacturing, base Dec 1998=100. Quality-adjusted, hence the magnitude of the decline. Different base year to the hosting index, so the two are NOT put on a shared axis.'),

('markets', 'fred.PCU333242333242', 'supporting', 3, NULL, 'USA',
 'The price of the machines that make chips — moving the other way.',
 'PPI semiconductor machinery manufacturing, base Dec 2003=100. Capital equipment must be bought before any chip exists, so this leads capacity.'),

('markets', 'dbn.EIA.ELEC.PRICE.US-IND.M', 'supporting', 4, NULL, 'USA',
 'What American industry pays for electricity.',
 'EIA industrial retail price, cents per kWh, nominal.'),

('markets', 'dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR.EU27_2020', 'supporting', 5, NULL, NULL,
 'European power prices for the very largest users — nearly tripled since 2007, which is part of why capacity gets built elsewhere.',
 'Eurostat band IG, 150,000+ MWh/year, roughly 17 MW drawn continuously and therefore the hyperscale tariff band. EUR/kWh excluding taxes, half-yearly.'),

('markets', 'fred.IQ12260', 'supporting', 6, NULL, 'USA',
 'The gold price, as a general risk gauge.',
 'Export price index, nonmonetary gold, base Dec 2024=100. Used because the IMF gold series available free has not updated since mid-2025.'),

('markets', 'dbn.BOJ.SPPI.5201330001', 'supporting', 7, 'japan-tech-prices', 'JPN',
 'What Japanese software development costs.',
 'BOJ services PPI, software development, 2015=100.'),

('markets', 'dbn.BOJ.SPPI.5201350004', 'supporting', 8, 'japan-tech-prices', 'JPN',
 'And Japanese cloud services — falling while software development rises.',
 'BOJ services PPI, cloud applications, same base and cadence, so a shared axis is legitimate. The divergence between the two is the automation story in miniature.'),

('markets', 'dbn.BOJ.CGPI.2300440015', 'supporting', 9, NULL, 'JPN',
 'The export price of Japanese chip-making equipment.',
 'BOJ corporate goods price index, semiconductor-making equipment, contract currency, 2020=100.'),

-- ─────────────────────────────────────────────────────────────────────────────
-- Whole-economy macro series.
--
-- Placed as `context` rather than left unassigned. These are NOT evidence about
-- AI — GDP growth would look identical if AI had never been invented — and
-- presenting them as though they were is precisely the failure this editorial
-- layer exists to prevent. But leaving them off every page is worse: an
-- indicator with data that appears nowhere is indistinguishable from one never
-- collected, and a reader is entitled to see the aggregate backdrop against
-- which the narrower series are being read.
--
-- The `context` role renders them smaller, later, and captioned as background.
-- ─────────────────────────────────────────────────────────────────────────────
('productivity', 'wb.NY.GDP.MKTP.KD.ZG', 'context', 17, 'macro-backdrop', 'USA',
 'Economic growth, for backdrop. This would look much the same whether or not AI existed.',
 'World Bank annual GDP growth, 48 countries. Whole-economy aggregates cannot isolate a technology effect; included so the scale of any claimed AI contribution can be judged against it.'),

('productivity', 'wb.NY.GDP.PCAP.KD', 'context', 18, NULL, 'USA',
 'Output per person — the long-run measure of whether a country is getting richer.',
 'World Bank GDP per capita, constant 2015 USD. The variable a general-purpose technology would ultimately have to move; also the slowest to respond.'),

('money', 'wb.TX.VAL.TECH.MF.ZS', 'context', 16, NULL, 'USA',
 'High-technology goods as a share of what a country exports.',
 'World Bank, share of manufactured exports. A weak AI proxy — the classification predates modern computing and captures pharmaceuticals and aerospace alongside electronics.')

ON CONFLICT (question_id, indicator_id) DO UPDATE SET
  role = EXCLUDED.role, sort_order = EXCLUDED.sort_order,
  chart_group = EXCLUDED.chart_group, country_iso3 = EXCLUDED.country_iso3,
  caption_plain = EXCLUDED.caption_plain, caption_expert = EXCLUDED.caption_expert;

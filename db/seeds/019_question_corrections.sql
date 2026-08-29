-- Four pages brought back into line with what is actually on them.
--
-- TWO SEPARATE PROBLEMS, FIXED TOGETHER
--
-- 1. `jobs` and `markets` describe charts that are no longer on them.
--    016_question_split.sql narrowed both pages and moved series away — the
--    youth panel off `jobs`, the commodity and energy series off `markets` —
--    but its UPDATE set only question, subtitle, answer_plain, strength and
--    sort_order. So `jobs` still explained why "the youth and graduate series
--    are here rather than the headline rate" on a page that no longer holds
--    them, `markets` still said "industrial electricity tariffs are included
--    for the US and EU" when they are on `power`, and `jobs`'s caveat still
--    claimed youth employment "is not yet held" when it is the hero of
--    `entry-level`. All four pages meanwhile displayed "prose last checked
--    against the data on 28 August 2026", which is the dating rule failing in
--    the one way it exists to prevent: asserting freshness while stale.
--
-- 2. The literature added in 018 disagrees with three of them. `entry-level`,
--    `jobs` and `vacancies` move to `contested` — the evidence_strength value
--    0012 defined, argued was "the honest state for most of this subject right
--    now", and which nothing has used until now.
--
-- ON entry-level SPECIFICALLY
--
-- The disagreement there is probably not about facts. This page measures
-- aggregate youth unemployment across eight economies; Stanford HAI and the
-- IMF measure early-career employment inside AI-exposed occupations. A 20%
-- fall in one occupation does not move a national youth unemployment rate —
-- it is a rounding error against the whole cohort. So the page was answering
-- "not yet" on an instrument that could not have seen it either way, which is
-- a stronger criticism of the page than being wrong would be. The answer now
-- says that.
--
-- Also corrects "ten countries" to eight, in three places. The youth panel has
-- eight: the US, UK, Germany, France, Japan, Korea, Canada and Australia.
--
-- Every figure below was read off the series on the page on 2026-08-29:
--   US youth unemployment (16-24)          8.5   2026-07  fred.LNS14024887
--   US graduate unemployment (25-34)       3.8   2026-07
--   UK ICT vacancies                     39k     2026-06  dbn.ONS.UNEM.JP9P.M
--     against 50k (2001-05) and 78k (2022-05), both verified in the series
--   US information-sector share of payrolls 1.75 2026-07
--   PPI data processing and hosting       124.2  2026-07
--   PPI semiconductors                     29.0  2026-07

-- ---------------------------------------------------------------------------
-- jobs — narrowed to sector composition, and now contested
-- ---------------------------------------------------------------------------

UPDATE questions SET
  strength = 'contested',

  answer_plain =
    'The share of US jobs in the information sector — the part of the economy most exposed to AI — has been falling since 2023, after rising for most of the decade before. It is a small move in a small sector, and it is the clearest compositional signal available. Whether AI is the cause is genuinely contested: firm-level panels find headcount growing fastest at the most AI-exposed companies, while local-labour-market studies find employment falling in exposed occupations. Both are cited below.',

  answer_expert =
    'The identification strategy is comparison, not level: an AI-exposed group against a control that shares its macro shocks. Information-sector employment as a share of total non-farm payrolls cancels the business cycle affecting both. The confound is that the information sector was already consolidating post-2022 for reasons unrelated to AI, principally interest rates ending a decade of cheap capital. The published evidence splits along method rather than along data: firm-level panels conditioned on survivorship find employment growth at exposed firms, while shift-share designs on local labour markets find losses in exposed occupations. Those are not the same estimand, and neither settles the other.',

  caveat =
    'Nothing here isolates AI as a cause. A sector is a coarse proxy for exposure: the information sector contains jobs AI cannot touch and excludes exposed work done everywhere else in the economy, so this measure would miss a task-level effect spread thinly across many industries. Occupation-level coverage remains the largest gap in this dashboard — two series cover US clerical and administrative work and almost nothing else does.',

  theory =
    'If AI substitutes for tasks rather than for whole jobs, the effect should show up first as composition rather than as level: the industries whose output is mostly the affected tasks stop growing relative to everything else, well before any aggregate employment number moves. That predicts a falling employment share in the exposed sector while total employment carries on rising — which is a different and weaker claim than jobs being destroyed.',

  method =
    'Comparison, not level: an exposed group against a control that shares its macro shocks. Information-sector employment as a share of total non-farm payrolls cancels the business cycle affecting both, which a headcount series cannot do. Clerical and office-administrative employment sit underneath as the closest available occupation-level measures, and Japanese and Chinese sector employment as independent national constructions of the same idea. Read as a share against its own history, never as a count.',

  last_reviewed = DATE '2026-08-29'
 WHERE id = 'jobs';

-- ---------------------------------------------------------------------------
-- entry-level — contested, and honest about its own resolution
-- ---------------------------------------------------------------------------

UPDATE questions SET
  strength = 'contested',

  subtitle = 'Youth and graduate employment, across eight countries',

  answer_plain =
    'These series say not yet. US youth unemployment is 8.5% and unemployment among graduates aged 25 to 34 is 3.8% — both well below their 2020 peaks and not obviously breaking trend. But several studies measuring at a finer grain say otherwise, and they are cited below: US employment for software developers aged 22 to 25 has fallen close to 20% from its 2022 peak, and employment for that age group in the most AI-exposed occupations has fallen roughly 16% relative to the least exposed. The likeliest reconciliation is that both are right and this page is asking at the wrong resolution.',

  answer_expert =
    'The youth panel is OECD-harmonised across eight countries and read as a panel, not as eight separate series: a national labour-market reform moves one line, a technology shock should bend several. Graduate unemployment is the sharper test, because a degree was the thing supposed to protect against automation. Neither is far enough from trend to demand an explanation. The occupation-level literature finds effects an aggregate rate cannot resolve — a 20% fall in one occupation is a rounding error against a national youth cohort — so the disagreement is about measurement grain, not about facts. That is a criticism of this page rather than of those findings.',

  caveat =
    'The measure is too coarse for the question. A national youth unemployment rate aggregates every occupation a young person might enter, so an effect concentrated in a few exposed ones is averaged away long before it reaches this number. Youth unemployment also responds to the business cycle far more strongly than to anything structural, so a recession would swamp an AI effect entirely and a tight labour market can hide one. And none of it sees the counterfactual: hiring that never happened does not appear in a rate that counts people actively looking.',

  theory =
    'If AI substitutes for tasks rather than for whole jobs, the first jobs affected are the ones that are mostly those tasks — entry-level work. That predicts the bottom rung of a career ladder thins before any aggregate employment number moves, and predicts it is visible in the young and the newly qualified before anyone else. It also predicts, less conveniently, that the effect is concentrated enough to hide inside an average.',

  method =
    'A cross-country panel rather than a single national series, so a domestic policy change shows up as one line moving rather than as the finding. Graduate unemployment is tracked separately from youth unemployment because they answer different questions: one asks whether young people can find work, the other whether the credential still buys entry. The panel''s weakness is stated in the caveat and is not incidental — occupation-by-age employment series, which is what this question actually needs, are not yet held.',

  last_reviewed = DATE '2026-08-29'
 WHERE id = 'entry-level';

-- ---------------------------------------------------------------------------
-- vacancies — contested; the OECD finds the opposite outside the US
-- ---------------------------------------------------------------------------

UPDATE questions SET
  strength = 'contested',

  answer_plain =
    'This is where the clearest signal is. UK vacancies in information and communication stand at 39,000 — below their May 2001 level of 50,000, and roughly half the May 2022 peak of 78,000. Vacancies lead employment because a firm stops advertising before it stops employing, so this moves first whatever the cause. The OECD, looking across its members, finds the opposite: vacancies in AI-exposed industries rose faster than in other sectors over the year to April 2026 in most economies with data — with the United States a named exception.',

  answer_expert =
    'Vacancy series are the leading indicator in this lens: hiring intent adjusts within a quarter while headcount adjusts over years, through attrition rather than dismissal. The UK ICT series is the longest available and the sharpest. Australia''s vacancies-to-labour-force ratio and Japan''s openings-to-applicants ratio are independent constructions of the same idea from different statistical traditions. The OECD result cuts against all three, and its exposure measure is a sector proxy rather than a task-level one — the same weakness this page has. Neither side of the disagreement is measuring occupations.',

  caveat =
    'The confound here is large and unresolved: the information sector was consolidating from 2022 for reasons that have nothing to do with AI, principally interest rates ending a decade of cheap capital. The 2022 peak was itself a post-pandemic bubble, and a fall from an anomalous high back through the long-run level is not evidence of a new cause. The cross-country evidence adds a second problem: if AI-exposed vacancies are rising almost everywhere and falling in the anglophone economies this page happens to cover, the sample is doing work the argument is being credited for.',

  last_reviewed = DATE '2026-08-29'
 WHERE id = 'vacancies';

-- ---------------------------------------------------------------------------
-- markets — narrowed to the price of compute. Strength unchanged.
-- ---------------------------------------------------------------------------

UPDATE questions SET
  answer_expert =
    'Producer price indices for semiconductor manufacturing, semiconductor machinery, and data processing and hosting services — the closest available proxy for a cloud price index. Different base years (Dec 1998, Dec 2003, Dec 2000) mean these must be re-indexed to a common period before they can share an axis, which is done here rather than left to the eye. Japan''s services producer price indices for software and entrusted development are included as independent national constructions of the same measurement, built on a different statistical tradition and disagreeing usefully in level.',

  caveat =
    'Price indices are not prices: they measure change from a base year, not level, so two series can cross without the underlying costs ever having been equal. Hosting PPI is also the weakest link in the argument — it covers a whole industry of which AI compute is a small and recent part, so it is a proxy for the price of renting compute rather than a measure of it. Energy and metals, the other half of what compute costs, are deliberately not on this page; they have their own.',

  theory =
    'Computation gets cheaper roughly without limit, because it is a manufactured good subject to learning effects and to competition among a few very large producers. The services built on it need not, because their price carries the power, the buildings and the staff that a chip does not. If the second falls with the first, compute is genuinely getting cheaper to use; if it does not, the saving is being absorbed somewhere between the chip and the customer, and that gap is where the economics of diffusion actually sits.',

  method =
    'Producer price indices, re-indexed to a common base so they can be read against each other. Semiconductors and semiconductor machinery measure the manufactured input; data processing and hosting measures the service sold. Japanese SPPI series provide an independent construction from a different agency. None of this establishes causation with respect to AI — these industries long predate it — and the series are US and Japanese, so nothing here should be read as a world price.',

  last_reviewed = DATE '2026-08-29'
 WHERE id = 'markets';

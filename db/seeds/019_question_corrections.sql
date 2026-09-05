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
-- 2. The literature added in 018 disagrees with three of them. `jobs` and
--    `vacancies` move to `contested` — the evidence_strength value 0012
--    defined, argued was "the honest state for most of this subject right
--    now", and which nothing has used until now. `entry-level` moved with
--    them originally and was moved back on 2026-09-03; see note D below.
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
--
-- ═══════════════════════════════════════════════════════════════════════════
-- SECOND PASS, 2026-09-03. Five things this file got wrong the first time.
-- Every figure below was re-derived against the live database on that date;
-- none of it was carried over from the earlier note.
--
-- A. `jobs` said the information-sector share "has been falling since 2023,
--    after rising for most of the decade before". The series does the
--    opposite, and the chart under the sentence shows it, because QuestionPage
--    passes no window and the reader sees all of 1990-2026. Annual means:
--    1990 2.454, 2000 2.750 (the peak), 2013 1.984, 2019 1.898 (the trough),
--    2022 2.008, 2023 1.929, 2026 1.757 over seven months. So: a long fall
--    from 2000, a rise only across 2019-2022, and a resumed fall since. Every
--    2026 month (1.743-1.775) is below the pre-2026 minimum of 1.794, so the
--    series is at its lowest ever while the old prose called it a three-year
--    dip in a decade of growth. The same sentence was duplicated in four other
--    places and all five are now consistent: 009:40, 010:136, 012:60, 016:190.
--
-- B. `entry-level` quoted "8.5%" with no convention attached, while
--    `aggregate-unemployment` quotes 9.1% for the SAME series as a partial-year
--    mean. Both are right — latest month 8.5 (2026-07), 2026 mean to July 9.07
--    over seven rows — and neither said which it was. This page is the hero's
--    home, so it names the month and points at the other convention rather
--    than restating it.
--
-- C. `entry-level` cited 16% from the Stanford HAI takeaway while the IMF
--    takeaway on the SAME page gives 13% for what it describes as the same
--    comparison, quoting Brynjolfsson, Chandar and Chen (2025). The prose
--    picked 16 silently. Both now appear, with the one specification either
--    takeaway actually states — HAI's "after controlling for firm-type
--    effects" — named. Neither takeaway is altered; only the prose that was
--    hiding the range.
--
-- D. `entry-level` was labelled `contested` while its own answer_expert says
--    "the disagreement is about measurement grain, not about facts" — which is
--    the definition of `insufficient`, not of `contested`. An instrument too
--    coarse to resolve the effect is not two credible sources disagreeing.
--    Moved to `insufficient` so the label keeps meaning something on the three
--    pages that earn it.
--
-- E. `markets` presented three Bank of Japan series in the present tense as
--    live corroboration. They are not live: both SPPI series last publish
--    2024-04 and the CGPI export price index 2024-05, so the Japanese
--    agreement is about 2024. Stated in the answer and in the caveat.
-- ═══════════════════════════════════════════════════════════════════════════
-- THIRD PASS, 2026-09-04. `entry-level` again, because 051 moved the ground.
--
-- The second pass fixed the wrong half of the problem. It made the prose show
-- both secondary figures — 16% from the Stanford HAI takeaway, 13% from the
-- IMF's — and name the one specification either of them states, then told the
-- reader to "read the effect as somewhere between 13% and 16%".
--
-- 051_research_promotions.sql then put the primary paper itself on this page's
-- reading list at sort_order 0, above both summaries. Read it and the range
-- stops being a range: Brynjolfsson, Chandar and Chen's own current figure is
-- 19%, on ADP payroll records through June 2026, and the paper records that
-- 13% and 16% were firm-fixed-effects headlines on July 2025 and September
-- 2025 data respectively. So the page was about to tell a reader to hold two
-- superseded numbers as bounds, immediately above the paper that supersedes
-- them.
--
-- The master brief offered two ways out — name the specification, or cite the
-- primary paper directly with one figure and its specification stated. The
-- second is now available and is the better one, so the prose takes it: one
-- number, 19%, with what it is a comparison against, which vintage of the
-- paper it comes from, and the authors' own words that it is descriptive
-- rather than causal. The 16% and the 13% are then explained as what they are
-- rather than presented as competing estimates, and both takeaways stay
-- exactly as they are — nothing has been quietly dropped to make the page
-- tidier.
--
-- Every figure in the rewritten answer comes from a row, not from memory:
--   8.5 (2026-07) and 3.8 (2026-07), and the 2020 peaks 27.5 and 10.6, read
--   off fred.LNS14024887 and fred.CGBD2534 on 2026-09-04.
--   19%, the June 2026 vintage, the 13%/16% firm-fixed-effects vintages and
--   "early, descriptive indicators" — all from the takeaway 051 writes, which
--   its own header records as taken from the downloaded PDF.
--   The software-developer 20% — from the Stanford HAI takeaway in 018.
--
-- `last_reviewed` moves to 2026-09-04 for this page and stays 2026-09-03 for
-- the other three, because that is when each was actually last checked.
-- ═══════════════════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------------------
-- jobs — narrowed to sector composition, and now contested
-- ---------------------------------------------------------------------------

UPDATE questions SET
  strength = 'contested',

  answer_plain =
    'The share of US jobs in the information sector — the part of the economy most exposed to AI — has been shrinking for a quarter of a century. It peaked at 2.75% of non-farm payrolls in 2000, fell to 1.90% by 2019, recovered to 2.01% by 2022 in the post-pandemic hiring boom, and has fallen every year since, to 1.76% across the first seven months of 2026. Every month of 2026 is the lowest this series has been since it starts in 1990. That is the difficulty as much as the finding: the recent fall resumes a trend that long predates AI rather than starting one. It is a small move in a small sector, and it is still the clearest compositional signal available. Whether AI is doing any of it is genuinely contested: firm-level panels find headcount growing fastest at the most AI-exposed companies, while local-labour-market studies find employment falling in exposed occupations. Both are cited below.',

  answer_expert =
    'The identification strategy is comparison, not level: an AI-exposed group against a control that shares its macro shocks. Information-sector employment as a share of total non-farm payrolls cancels the business cycle affecting both. The confound is that the information sector was already consolidating post-2022 for reasons unrelated to AI, principally interest rates ending a decade of cheap capital. The published evidence splits along method rather than along data: firm-level panels conditioned on survivorship find employment growth at exposed firms, while shift-share designs on local labour markets find losses in exposed occupations. Those are not the same estimand, and neither settles the other.',

  caveat =
    'Nothing here isolates AI as a cause. A sector is a coarse proxy for exposure: the information sector contains jobs AI cannot touch and excludes exposed work done everywhere else in the economy, so this measure would miss a task-level effect spread thinly across many industries. Occupation-level coverage remains the largest gap in this dashboard — two series cover US clerical and administrative work and almost nothing else does.',

  theory =
    'If AI substitutes for tasks rather than for whole jobs, the effect should show up first as composition rather than as level: the industries whose output is mostly the affected tasks stop growing relative to everything else, well before any aggregate employment number moves. That predicts a falling employment share in the exposed sector while total employment carries on rising — which is a different and weaker claim than jobs being destroyed.',

  method =
    'Comparison, not level: an exposed group against a control that shares its macro shocks. Information-sector employment as a share of total non-farm payrolls cancels the business cycle affecting both, which a headcount series cannot do. Clerical and office-administrative employment sit underneath as the closest available occupation-level measures, and Japanese and Chinese sector employment as independent national constructions of the same idea. Read as a share against its own history, never as a count.',

  last_reviewed = DATE '2026-09-03'
 WHERE id = 'jobs';

-- ---------------------------------------------------------------------------
-- entry-level — insufficient, and honest about its own resolution
--
-- `contested` means two credible sources disagree about the same thing. This
-- page's own expert text says the opposite: "the disagreement is about
-- measurement grain, not about facts". An instrument too coarse to see the
-- effect is exactly what `insufficient` is for, and using `contested` here
-- weakens it on `clerical`, `jobs` and `vacancies`, where it is doing work.
-- ---------------------------------------------------------------------------

UPDATE questions SET
  strength = 'insufficient',

  subtitle = 'Youth and graduate employment, across eight countries',

  answer_plain =
    'These series say not yet. US youth unemployment was 8.5% in July 2026 and unemployment among graduates aged 25 to 34 was 3.8% in the same month — both far below their 2020 peaks of 27.5% and 10.6%, and neither obviously breaking trend. Those are single monthly readings; the aggregate unemployment page reads the same youth series as an average across 2026 so far, which runs higher, and the difference between the two figures is the convention rather than the data. The study that measures at a finer grain says otherwise, and it is now cited first-hand at the top of the reading list rather than through other people''s summaries of it. Brynjolfsson, Chandar and Chen, working from ADP payroll records covering millions of US workers through June 2026, find employment of 22 to 25 year olds in AI-exposed occupations 19% below where it would have been had it kept pace with their less-exposed peers — with no comparable gap for experienced workers, and the shortfall running through hiring that did not happen rather than through redundancies. That is one figure with its specification attached: a descriptive comparison against a less-exposed group, from the version of the paper revised in August 2026, offered by its authors as an early indicator and not as a causal estimate. The 16% this page used to quote from Stanford HAI and the 13% the IMF quotes are the same paper at earlier vintages and under a different specification — its authors record firm-fixed-effects estimates of 13% on July 2025 data and 16% on September 2025 data. Both summaries are still on the reading list and neither has been quietly dropped, and Stanford HAI''s separate finding that US employment for software developers aged 22 to 25 fell close to 20% from its 2022 peak by September 2025 stands on its own. The likeliest reconciliation with the national rate above is that all of it is right and this page is asking at the wrong resolution.',

  answer_expert =
    'The youth panel is OECD-harmonised across eight countries and read as a panel, not as eight separate series: a national labour-market reform moves one line, a technology shock should bend several. Graduate unemployment is the sharper test, because a degree was the thing supposed to protect against automation. Neither is far enough from trend to demand an explanation. The occupation-level literature finds effects an aggregate rate cannot resolve — a 20% fall in one occupation is a rounding error against a national youth cohort — so the disagreement is about measurement grain, not about facts. That is a criticism of this page rather than of those findings, and it is why this page is marked insufficient rather than contested: the instrument is too coarse to have seen the effect either way.',

  caveat =
    'The measure is too coarse for the question. A national youth unemployment rate aggregates every occupation a young person might enter, so an effect concentrated in a few exposed ones is averaged away long before it reaches this number. Youth unemployment also responds to the business cycle far more strongly than to anything structural, so a recession would swamp an AI effect entirely and a tight labour market can hide one. And none of it sees the counterfactual: hiring that never happened does not appear in a rate that counts people actively looking. The headline figures here are single months of a series that moves a point either way month to month — 8.5% in July 2026 against 9.5% in April — so read the shape of the line and not the last reading.',

  theory =
    'If AI substitutes for tasks rather than for whole jobs, the first jobs affected are the ones that are mostly those tasks — entry-level work. That predicts the bottom rung of a career ladder thins before any aggregate employment number moves, and predicts it is visible in the young and the newly qualified before anyone else. It also predicts, less conveniently, that the effect is concentrated enough to hide inside an average.',

  method =
    'A cross-country panel rather than a single national series, so a domestic policy change shows up as one line moving rather than as the finding. Graduate unemployment is tracked separately from youth unemployment because they answer different questions: one asks whether young people can find work, the other whether the credential still buys entry. The panel''s weakness is stated in the caveat and is not incidental — occupation-by-age employment series, which is what this question actually needs, are not yet held.',

  last_reviewed = DATE '2026-09-04'
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
    'Producer price indices for semiconductor manufacturing, semiconductor machinery, and data processing and hosting services — the closest available proxy for a cloud price index. Different base years (Dec 1998, Dec 2003, Dec 2000) mean these must be re-indexed to a common period before they can share an axis, which is done here rather than left to the eye. Japan''s services producer price indices for software and entrusted development were included as independent national constructions of the same measurement, built on a different statistical tradition and disagreeing usefully in level. They are not a running check: the Bank of Japan''s last published month for both is April 2024, and for its semiconductor-equipment export price index May 2024, so the Japanese corroboration is about the period up to 2024 and says nothing about the two years since.',

  caveat =
    'Price indices are not prices: they measure change from a base year, not level, so two series can cross without the underlying costs ever having been equal. Hosting PPI is also the weakest link in the argument — it covers a whole industry of which AI compute is a small and recent part, so it is a proxy for the price of renting compute rather than a measure of it. Energy and metals, the other half of what compute costs, are deliberately not on this page; they have their own. The three Japanese lines are also out of date, and because they sit on their own charts the gap is easy to miss: the two BOJ services indices end at April 2024 and the semiconductor-equipment export price index at May 2024, while every US producer price series here runs to July 2026. The Japanese agreement is about 2024, and whether the Bank still publishes these series has not been re-established.',

  theory =
    'Computation gets cheaper roughly without limit, because it is a manufactured good subject to learning effects and to competition among a few very large producers. The services built on it need not, because their price carries the power, the buildings and the staff that a chip does not. If the second falls with the first, compute is genuinely getting cheaper to use; if it does not, the saving is being absorbed somewhere between the chip and the customer, and that gap is where the economics of diffusion actually sits.',

  method =
    'Producer price indices, re-indexed to a common base so they can be read against each other. Semiconductors and semiconductor machinery measure the manufactured input; data processing and hosting measures the service sold. Japanese SPPI series provided an independent construction from a different agency up to April 2024, after which they stop. None of this establishes causation with respect to AI — these industries long predate it — and the series are US and Japanese, so nothing here should be read as a world price.',

  last_reviewed = DATE '2026-09-03'
 WHERE id = 'markets';

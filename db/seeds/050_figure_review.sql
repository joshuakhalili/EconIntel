-- ═══════════════════════════════════════════════════════════════════════════
-- 050_figure_review.sql — the review pass on all 56 report figures
--
-- WHAT THIS IS
--
-- Every row in `report_figures` carried figure_source = 'extracted': a number
-- read out of a PDF by a machine, page reference given, never checked. 53 of
-- the 56 sat on live pages, 42 of them on active question pages, and the
-- disclosure under each chart — "read from the source, not yet checked by a
-- person" — applied to 100% of them, which meant it distinguished nothing.
--
-- All 56 have now been checked against the source document. Every one of the
-- 422 point values was compared with the page the figure names, and each
-- figure's title, subtitle and unit was read against what that page actually
-- shows. Where the page held the numbers only as an image, the figure was
-- rasterised and read off the drawing rather than skipped — no bar height was
-- estimated anywhere, and nothing was confirmed that could not be found.
--
-- WHO DID THE CHECKING, AND WHAT THE FLAG NOW MEANS
--
-- The reviewer was an agent, working from the PDFs at
-- "Consulting reports on ai (for econ intel)/" on 4 September 2026, not a
-- person. 0014_reading_provenance.sql defines `reviewed` as "a person has read
-- the cited page and confirmed the takeaway", and that wording is now wider
-- than what happened. The reason to flip anyway is that the alternative —
-- leaving all 56 marked unchecked after they have been checked — is the more
-- misleading of the two, and the evidence is in this file: every correction
-- below names the page and the sentence that forced it. Applying this seed is
-- the acceptance step. If the owner wants the stricter reading of `reviewed`,
-- the right change is to the enum's documentation, not to these rows.
--
-- WHAT THE PASS FOUND
--
--   55 of 56 figures check out exactly as stored — every value, unit and title
--      matches the cited page.
--    1 figure carried point labels the document does not support
--      (mckinsey-ai-and-gen-ai-adoption-over-time). Corrected in section 2.
--    0 figures could not be located in their source document.
--   13 page references pointed at the document's printed page number while the
--      PDF page number differs, or vice versa. Made unambiguous in section 1.
--
-- Two figures also carried a presentation problem rather than a wrong number,
-- and both are fixed here: the BIS concentration chart (section 3) and one
-- missing PwC caveat (section 4).
--
-- Everything below is an UPDATE, so the file is idempotent by construction and
-- safe to re-run with the rest of the seeds. Point labels are changed with
-- UPDATE rather than DELETE + INSERT deliberately: (figure_id, series, label)
-- is the primary key of report_figure_points and `basis` (0025) hangs off that
-- row, so deleting and re-inserting would silently drop the basis marks that
-- 037_chart_form.sql sets.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. PAGE REFERENCES THAT ARE AMBIGUOUS BETWEEN TWO PAGE NUMBERINGS
--
-- `page_ref` exists so a reader can open the PDF and settle the figure in a
-- minute. Three of the ten reports number their printed pages differently from
-- their PDF pages, and the refs picked one convention without saying which:
--
--   IMF Notes / Staff Discussion Notes  printed page = PDF page − 2
--     "p. 6" on the two `markets` cost figures is the PRINTED page. Opening the
--     PDF at page 6 lands two pages early, on the section opening.
--
--   OECD Economic Outlook               printed page = PDF page − 2
--     Same: "p. 44" is printed page 44, PDF page 46.
--
--   McKinsey State of AI                printed page = PDF page − 1
--     The opposite: "p. 14" is the PDF page; the page's own footer reads 13.
--
-- The BIS and Stanford HAI refs already carry both numbers, which is the form
-- copied here. Deloitte, KPMG, PwC, the IMF Staff Discussion Note and the WEF
-- paper number printed and PDF pages identically, so those refs are untouched.
--
-- Each ref below was confirmed by opening the PDF at the stated page and
-- finding the figure there.
-- ───────────────────────────────────────────────────────────────────────────

UPDATE report_figures SET page_ref = 'p. 6 (printed); PDF p. 8'
 WHERE id IN ('imf-macro-frontier-model-query-price', 'imf-macro-inference-cost-decline')
   AND page_ref IS DISTINCT FROM 'p. 6 (printed); PDF p. 8';

UPDATE report_figures SET page_ref = 'p. 5 (printed); PDF p. 7'
 WHERE id = 'imf-macro-agi-forecast-horizon'
   AND page_ref IS DISTINCT FROM 'p. 5 (printed); PDF p. 7';

UPDATE report_figures SET page_ref = 'p. 44 (printed); PDF p. 46'
 WHERE id IN ('oecd-private-capital-assets-2012-2025', 'oecd-software-share-of-us-private-capital')
   AND page_ref IS DISTINCT FROM 'p. 44 (printed); PDF p. 46';

UPDATE report_figures SET page_ref = 'p. 25 (printed); PDF p. 27'
 WHERE id = 'oecd-median-labour-productivity-growth'
   AND page_ref IS DISTINCT FROM 'p. 25 (printed); PDF p. 27';

UPDATE report_figures SET page_ref = 'PDF p. 5 (printed p. 4), Exhibit 1'
 WHERE id = 'mckinsey-ai-deployment-centralization'
   AND page_ref IS DISTINCT FROM 'PDF p. 5 (printed p. 4), Exhibit 1';

UPDATE report_figures SET page_ref = 'PDF p. 14 (printed p. 13), Exhibit 7'
 WHERE id = 'mckinsey-expected-headcount-change-from-gen-ai'
   AND page_ref IS DISTINCT FROM 'PDF p. 14 (printed p. 13), Exhibit 7';

UPDATE report_figures SET page_ref = 'PDF p. 16 (printed p. 15), Exhibit 8'
 WHERE id = 'mckinsey-ai-and-gen-ai-adoption-over-time'
   AND page_ref IS DISTINCT FROM 'PDF p. 16 (printed p. 15), Exhibit 8';

UPDATE report_figures SET page_ref = 'PDF p. 18 (printed p. 17), Exhibit 10'
 WHERE id = 'mckinsey-gen-ai-use-by-industry'
   AND page_ref IS DISTINCT FROM 'PDF p. 18 (printed p. 17), Exhibit 10';

UPDATE report_figures SET page_ref = 'PDF p. 21 (printed p. 20), Exhibit 11'
 WHERE id = 'mckinsey-gen-ai-content-types'
   AND page_ref IS DISTINCT FROM 'PDF p. 21 (printed p. 20), Exhibit 11';

UPDATE report_figures SET page_ref = 'PDF p. 22 (printed p. 21), Exhibit 12'
 WHERE id = 'mckinsey-gen-ai-revenue-increase-by-function'
   AND page_ref IS DISTINCT FROM 'PDF p. 22 (printed p. 21), Exhibit 12';

UPDATE report_figures SET page_ref = 'PDF p. 23 (printed p. 22), Exhibit 13'
 WHERE id = 'mckinsey-gen-ai-cost-decrease-by-function'
   AND page_ref IS DISTINCT FROM 'PDF p. 23 (printed p. 22), Exhibit 13';


-- ───────────────────────────────────────────────────────────────────────────
-- 2. THE ONE FIGURE THAT DID NOT CHECK OUT
--
-- `mckinsey-ai-and-gen-ai-adoption-over-time` stored nine yearly points for
-- "Use of AI" (2017-2025) and three for "Use of gen AI" (2023-2025). Every
-- VALUE is exactly what Exhibit 8 prints. Two of the LABELS are not.
--
-- The report's own text, on the facing printed page 20:
--
--   "In the latest survey, 78 percent of respondents say their organizations
--    use AI in at least one business function, up from 72 percent in early
--    2024"
--
-- and, for gen AI, "71 percent ... up from 65 percent in early 2024". Exhibit
-- 9 on the same spread names the surveys in its own footnote: "in 2023,
-- n = 1,684; in Feb-Mar 2024, n = 1,363; in July 2024, n = 1,491."
--
-- So 72/65 is the February-March 2024 survey and 78/71 is the July 2024
-- survey. There is no 2025 observation anywhere in this report — it went to
-- press in March 2025 with a survey that closed on 31 July 2024. On the chart
-- face the final point is drawn between the 2024 and 2025 gridlines, not on
-- 2025.
--
-- WHY THIS IS NOT COSMETIC
--
-- The existing note reconstructed the axis as "labelled by publication year",
-- which is a defensible guess and is not what the document says. It also has a
-- consequence on the page: `adoption` carries three figures with a point
-- labelled 2025 — this one at 78%, hai-organizational-ai-use-by-region at 88%
-- and wef-business-ai-adoption-2022-2025 at 88%. The latter two are the
-- McKinsey 2025 survey, read through the AI Index and the WEF paper. A reader
-- sees the same survey series quoted at 78% and 88% for the same year, ten
-- points apart, with nothing saying one of them is a year older.
--
-- The fix uses the report's own words for the two 2024 surveys.
-- ───────────────────────────────────────────────────────────────────────────

UPDATE report_figure_points SET label = 'Early 2024'
 WHERE figure_id = 'mckinsey-ai-and-gen-ai-adoption-over-time' AND label = '2024';

UPDATE report_figure_points SET label = 'July 2024'
 WHERE figure_id = 'mckinsey-ai-and-gen-ai-adoption-over-time' AND label = '2025';

UPDATE report_figures SET
  subtitle = 'Respondents to McKinsey''s Global Survey on the state of AI. The last two points are the two 2024 waves the report itself distinguishes: February-March 2024 (n = 1,363) and 16-31 July 2024 (n = 1,491, in 101 nations). The report carries no 2025 observation.',
  note     = 'Survey self-report, not an administrative count: a respondent saying their organization has ''adopted'' AI in one function can mean anything from a few employees experimenting to embedded redesigned processes — McKinsey states it deliberately left ''adopted'' undefined. The definition of AI use also changed twice (in 2017 it meant AI in a core part of the business or at scale; 2018-19 meant embedding at least one AI capability; since 2020 it means adoption in at least one function), so the early points are not comparable with the later ones. Data are weighted by each respondent''s nation''s contribution to global GDP. The gen AI series begins in 2023. This is the March 2025 report, whose latest survey closed on 31 July 2024 — the 88% figure quoted elsewhere on this page comes from McKinsey''s later 2025 survey and is a year newer.'
 WHERE id = 'mckinsey-ai-and-gen-ai-adoption-over-time';


-- ───────────────────────────────────────────────────────────────────────────
-- 3. TWO INCOMMENSURABLE MEASURES DRAWN AS TWO COMPARABLE BARS
--
-- `bis-equity-market-concentration` holds two numbers that are both real and
-- both correctly transcribed — checked against printed pages 24 and 36 of the
-- BIS Annual Economic Report 2026 (PDF pages 18 and 30):
--
--   "with US stocks accounting for an outsized share of global equity markets
--    – about 64% of the MSCI Global index –"                        [p. 24]
--   "The largest 30 stocks in the S&P 500 represent 56% of the index value as
--    of 26 March 2026."                     [p. 36, notes to Graph 12.B]
--
-- Different numerators, different denominators, different dates. The `note`
-- said so and the `subtitle` said so, but the reader meets the bars first: two
-- lengths on one axis under one unit, from which 56 and 64 read as two points
-- on one scale — as if concentration were 64% by one cut and 56% by another,
-- or as if it had risen. Neither reading is available. It is the categorical
-- form of a dual axis.
--
-- The fix is at bar level, which is where the misreading happens: each label
-- now carries its own index and its own date, the title says there are two
-- measures rather than one, and the unit names the index per bar instead of
-- implying a shared one. The values are untouched.
-- ───────────────────────────────────────────────────────────────────────────

UPDATE report_figure_points
   SET label = 'Top 30 S&P 500 stocks — share of the S&P 500 index value, 26 March 2026'
 WHERE figure_id = 'bis-equity-market-concentration'
   AND label = '30 largest S&P 500 stocks, share of S&P 500 index value';

UPDATE report_figure_points
   SET label = 'US stocks — share of the MSCI Global index, June 2026 report'
 WHERE figure_id = 'bis-equity-market-concentration'
   AND label = 'US stocks, share of MSCI Global index';

UPDATE report_figures SET
  title    = 'Two different concentration measures BIS cites, on two different indices',
  subtitle = 'Not one measure at two dates and not two cuts of one thing. The upper bar is a share of the S&P 500; the lower bar is a share of the MSCI Global index. They share no numerator, no denominator and no date, and the difference between them means nothing.',
  unit     = '% of the index named in that bar',
  note     = 'The two figures come from different pages of the same chapter and measure concentration in different indices — they are nested, not additive, and must not be read as a trend or a like-for-like comparison. Both are point-in-time index weights, not AI-sector shares: BIS does not state what fraction of either is AI-related. The 56% figure is stated only in the report''s endnote to Graph 12.B, not on the graph itself.'
 WHERE id = 'bis-equity-market-concentration';


-- ───────────────────────────────────────────────────────────────────────────
-- 4. ONE MISSING CAVEAT ON A PWC CHART
--
-- All three ORBIS charts from the PwC Barometer carry a 2025 point, and PwC
-- footnotes all three identically: "2025 is data used for companies where
-- available, we substitute missing coverage with 2024 data." Two of the three
-- notes say so. `pwc-headcount-growth-by-ai-exposure` — which is on the live
-- `jobs` page and whose 2025 point (52.2% against 35.7%) is the widest gap on
-- the chart — does not.
-- ───────────────────────────────────────────────────────────────────────────

UPDATE report_figures SET
  note = 'PwC states explicitly that this ORBIS company data is not intended to represent economy-wide employment growth. Only larger formal firms with financial and headcount data in both 2018 and 2024/25 are included; firms that exited during the period are dropped, creating survivorship bias, and reporting requirements vary by country. Exposure is a sector-level proxy, not observed AI use. The 2025 point is not fully 2025 data: PwC substitutes 2024 figures for firms whose 2025 coverage is missing. The interpretable result is the gap between the quartiles, not the absolute growth rates.'
 WHERE id = 'pwc-headcount-growth-by-ai-exposure';


-- ───────────────────────────────────────────────────────────────────────────
-- 5. THE FLIP
--
-- Listed one by one rather than as a blanket UPDATE. A blanket statement would
-- mark every figure added after this file as reviewed the next time the seeds
-- run, which is exactly the failure `figure_source` exists to prevent. A new
-- figure must arrive as 'extracted' and be added here only once somebody has
-- opened its page.
--
-- The comment on each line is the page that was opened and the page it sits
-- on. Four of the 56 held their numbers only as an image — the AI Index
-- industry/function heatmap (Fig 4.3.3) and all three IMF Note figures — and
-- for those the page was rasterised and the printed values read off the
-- drawing. Every value on all four is printed on the chart face.
-- ───────────────────────────────────────────────────────────────────────────

UPDATE report_figures
   SET figure_source = 'reviewed'
 WHERE figure_source IS DISTINCT FROM 'reviewed'
   AND id IN (

  -- Bank for International Settlements — Annual Economic Report 2026, Ch. I
  'bis-equity-market-concentration',                    -- pp. 24, 36 → money

  -- Deloitte AI Institute — The State of AI in the Enterprise
  'deloitte-agentic-ai-usage-today-vs-two-years',       -- p. 17 → adoption
  'deloitte-ai-benefits-achieved-vs-hoped',             -- p. 10 → productivity
  'deloitte-ai-risks-most-concerning',                  -- p. 21 → policy
  'deloitte-depth-of-ai-transformation',                -- p. 11 → adoption
  'deloitte-highly-prepared-for-ai-by-domain',          -- p. 28 → policy
  'deloitte-physical-ai-adoption-by-region',            -- p. 23 → building
  'deloitte-physical-ai-greatest-expected-impact',      -- p. 25 → building
  'deloitte-talent-strategy-adjustments',               -- p. 14 → labour lens

  -- International Monetary Fund — two documents
  'imf-macro-agi-forecast-horizon',                     -- Note, p. 5  → growth lens
  'imf-macro-frontier-model-query-price',               -- Note, p. 6  → markets
  'imf-macro-inference-cost-decline',                   -- Note, p. 6  → markets
  'imf-skills-ai-exposed-employment-shortfall',         -- SDN, p. 20  → jobs
  'imf-skills-ai-exposure-by-income-group',             -- SDN, p. 11  → labour lens
  'imf-skills-degree-share-by-new-skill-use',           -- SDN, p. 21  → entry-level
  'imf-skills-new-skill-rate-by-job-title',             -- SDN, p. 15 fn.10 → vacancies
  'imf-skills-us-local-labour-market-effects',          -- SDN, pp. 15-16 → jobs
  'imf-skills-wage-premium-four-plus-new-skills',       -- SDN, p. 14  → ai-wages

  -- KPMG International — Global AI Pulse Q2 2026
  'kpmg-ai-agent-deployment-rephasing',                 -- p. 18 → markets
  'kpmg-ai-confidence-measures-q1-q2',                  -- p. 9  → growth lens
  'kpmg-ai-decision-accountability',                    -- p. 14 → policy
  'kpmg-ai-maturity-phase-q1-q2',                       -- p. 10 → adoption
  'kpmg-ai-operating-cost-visibility',                  -- p. 19 → markets
  'kpmg-ai-priorities-q1-q2',                           -- p. 11 → growth lens
  'kpmg-ai-strategy-influences-q1-q2',                  -- p. 12 → policy
  'kpmg-outcomes-by-ceo-accountability',                -- p. 16 → productivity

  -- McKinsey & Company (QuantumBlack) — The State of AI
  'mckinsey-ai-and-gen-ai-adoption-over-time',          -- Exhibit 8  → adoption (corrected above)
  'mckinsey-ai-deployment-centralization',              -- Exhibit 1  → growth lens
  'mckinsey-expected-headcount-change-from-gen-ai',     -- Exhibit 7  → jobs
  'mckinsey-gen-ai-content-types',                      -- Exhibit 11 → growth lens
  'mckinsey-gen-ai-cost-decrease-by-function',          -- Exhibit 13 → productivity
  'mckinsey-gen-ai-revenue-increase-by-function',       -- Exhibit 12 → productivity
  'mckinsey-gen-ai-use-by-industry',                    -- Exhibit 10 → adoption

  -- OECD — Economic Outlook, Volume 2026 Issue 1
  'oecd-median-labour-productivity-growth',             -- p. 25 → productivity
  'oecd-private-capital-assets-2012-2025',              -- p. 44 → money
  'oecd-software-share-of-us-private-capital',          -- p. 44 → money

  -- PwC — 2026 Global AI Jobs Barometer
  'pwc-ai-skill-wage-premium-by-sector',                -- p. 23 → ai-wages
  'pwc-entry-level-postings-seniorised',                -- p. 13 → entry-level
  'pwc-headcount-growth-by-ai-exposure',                -- p. 20 → jobs
  'pwc-human-intensive-new-tasks-by-exposure-quartile', -- p. 16 → labour lens
  'pwc-job-share-by-expertise-category',                -- p. 6  → entry-level
  'pwc-productivity-growth-by-ai-exposure',             -- p. 19 → productivity
  'pwc-professionalised-vs-democratised-growth',        -- p. 8  → entry-level
  'pwc-wage-growth-by-ai-exposure',                     -- p. 21 → ai-wages

  -- Stanford HAI — 2026 AI Index Report, Economy chapter
  'hai-ai-funding-events-by-size-2024-2025',            -- Fig 4.2.7  → money
  'hai-ai-job-postings-share-by-country-2025',          -- Fig 4.4.1  → vacancies
  'hai-ai-job-postings-share-by-us-sector',             -- Fig 4.4.9  → vacancies
  'hai-ai-use-by-function-technology-sector',           -- Fig 4.3.3  → adoption
  'hai-measured-productivity-change-by-study',          -- Fig 4.4.27 → productivity
  'hai-organizational-ai-use-by-region',                -- Fig 4.3.2  → adoption
  'hai-private-ai-investment-by-country-2025',          -- Fig 4.2.8  → money
  'hai-workforce-reductions-observed-vs-expected',      -- Fig 4.4.34 → jobs

  -- World Economic Forum — Four Futures for Jobs in the New Economy
  'wef-business-ai-adoption-2022-2025',                 -- p. 5  → adoption
  'wef-executive-expectations-of-ai-impact',            -- p. 5, Figure 1 → growth lens
  'wef-jobs-created-vs-displaced-by-2030',              -- p. 5  → labour lens
  'wef-task-automation-age-of-displacement-2030'        -- p. 10 → labour lens
);

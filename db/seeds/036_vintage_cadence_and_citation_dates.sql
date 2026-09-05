-- ═══════════════════════════════════════════════════════════════════════════
-- Three corrections that could not be made where the rows were defined.
--
--   1. AMECO's forecast years, where 029's date rule could not reach them.
--   2. Declared cadence on a series defined in seed 006.
--   3. Publication dates for the consulting and academic citations.
--
-- Written 2026-09-03. Everything here is an UPDATE, so it is idempotent by
-- construction and safe to re-run with the rest of the seeds.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. AMECO: the forecast years the calendar can prove
--
-- THE PROBLEM 029 LEFT OPEN, AND WHY IT WAS RIGHT TO LEAVE IT
--
-- Seed 029 marks a value 'projected' when `period_start > current_date`. Run
-- against AMECO's UK total factor productivity that catches exactly one row —
-- 2027 — and its own comment says why that is not enough: the 2026 value is
-- equally a Commission forecast and escapes the rule because 1 January 2026 is
-- in the past. It declined to go further without a release vintage, and it was
-- right to: guessing which years of a forecast database are outturns is not a
-- thing to do by feel.
--
-- Since then the chart layer was finished (LineChart splits the projected tail
-- and SeriesChart prints a dated note), which turned a quiet database gap into
-- a statement on two live pages: the dashed 2027 point now tells a reader that
-- 2026 is measured. It is not.
--
-- WHAT CAN BE ESTABLISHED, AND WHAT CANNOT
--
-- Established, and needing no vintage at all: an annual figure for a calendar
-- year that has not ended cannot be an outturn. On 2026-09-03, AMECO's 2026
-- and 2027 values are both for unfinished years. Both are forecasts. That is
-- arithmetic on the calendar, not a judgement about the source.
--
-- NOT established: whether the 2025 value is an outturn or a forecast. That
-- depends on which AMECO release this came from — the Commission publishes
-- twice a year alongside its Spring and Autumn forecasts, and the boundary
-- between history and projection moves with the release. The vintage is not
-- stored (`observations` has no vintage column) and the source does not return
-- one. Checked directly on 2026-09-03:
--
--   curl -s 'https://api.db.nomics.world/v22/series/AMECO/ZVGDF/GBR.3.0.0.0.ZVGDF?observations=0'
--
-- returns dataset and series metadata carrying `indexed_at`
-- "2026-05-22T01:32:00.338Z", `dir_hash`, dimension codes and names — and no
-- release, edition or vintage field of any kind. `indexed_at` bounds when
-- DBnomics last harvested the dataset; it does not say which Commission
-- release it harvested, and inferring "Spring 2026, therefore 2025 is history"
-- from a harvest date would be exactly the guess 029 refused to make.
--
-- So this marks the two years the calendar settles and stops. The prose in
-- seed 025 was changed in the same edit to say the same thing: 2026 and 2027
-- are projections, and the status of 2025 is unknown. It previously said the
-- last three values were projections, which asserted more than anyone here can
-- support.
--
-- WHY THIS IS SCOPED TO AMECO AND NOT WRITTEN AS A GENERAL RULE
--
-- Because "the period has not finished" does not mean "this is a forecast" for
-- any other source in this database. The same predicate over all observations
-- on 2026-09-03 also catches September 2026 on derived.ai_binding_rules,
-- derived.ai_proposed_rules and derived.ai_regulation_volume, and 2026 on
-- derived.sec_ai_mention_rate. Those are counts and rates measured so far in a
-- period still running — incomplete measurements, not predictions — and
-- marking them 'projected' would be a new lie in place of the old one.
--
-- AMECO is different in kind: it is the European Commission's forecast
-- database and it publishes projections in the same column as outturns. For
-- this source, and stated as a fact about this source, an unfinished period is
-- necessarily a forecast.
--
--   select to_char(period_start,'YYYY'), value, value_status from observations
--    where indicator_id = 'dbn.AMECO.ZVGDF.GBR.3.0.0.0.ZVGDF'
--      and period_start >= '2024-01-01' order by 1;
--   → 2024 96.10408 null · 2025 95.96237 null
--     2026 96.29235 projected · 2027 96.76907 projected
-- ───────────────────────────────────────────────────────────────────────────

UPDATE observations o
   SET value_status = 'projected'
  FROM indicators i
 WHERE i.id = o.indicator_id
   AND i.source_series_code LIKE 'AMECO/%'
   AND o.value IS NOT NULL
   AND o.period_end > current_date
   AND o.value_status IS DISTINCT FROM 'projected';


-- ───────────────────────────────────────────────────────────────────────────
-- 2. Declared cadence against the cadence the data actually has
--
-- `indicators.cadence` is what the catalogue, the indicator page and the API
-- report. It had drifted from the data on five active series. Three are
-- defined in seed 004 and are fixed there, at the definition, with a note
-- each. The fourth is defined in seed 006 and is fixed here.
--
-- The measurement is the MODAL gap between consecutive non-null observations,
-- partitioned by country, industry and company so a panel is not read as one
-- interleaved series. Modal rather than mean or median because a missing
-- period only ever adds a LARGER gap: derived.ai_presidential_documents has a
-- median gap of 60 days and a modal gap of 31, and it is a monthly series with
-- empty months, correctly declared. The mode is the publication interval; the
-- tail is the holes.
--
--   dbn.RBA.H5.GLFOSVTLF   declared monthly, modal gap 92 days over 183 gaps.
--
-- Its own indicator NAME ends "(quarterly)", so the row has been contradicting
-- itself since it was written. It is on the `vacancies` page.
--
-- scripts/check-data.js now runs this comparison as a gate.
-- ───────────────────────────────────────────────────────────────────────────

UPDATE indicators SET cadence = 'quarterly', updated_at = now()
 WHERE id = 'dbn.RBA.H5.GLFOSVTLF' AND cadence <> 'quarterly';


-- ── The two that cannot be corrected here, stated rather than left silent ──
--
-- Both Eurostat electricity price bands —
--   dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR.EU27_2020
--   dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR.EU27_2020
-- are declared 'annual' and publish twice a year: modal gap 184 days over 36
-- gaps each. Eurostat's nrg_pc_205 is a semiannual collection, `bulk-discount`
-- quotes first-half figures, and that page's own answer_expert says "the same
-- semiannual periodicity". Everything except the metadata already knows.
--
-- They are not corrected because there is nothing correct to set them to. The
-- `cadence` enum is (daily, weekly, monthly, quarterly, annual, irregular) —
-- there is no 'semiannual', and 'irregular' would be a second false statement
-- rather than a fix, since these are perfectly regular. Adding an enum value
-- needs a migration, and `ALTER TYPE … ADD VALUE` cannot be used in the same
-- transaction that adds it, which is the transaction every seed runs in.
--
-- So the fix is a migration adding 'semiannual' (and, on the same evidence,
-- 'biennial' — the OECD ai_any survey series and Eurostat isoc_cicce_use are
-- declared annual and run at 730-day gaps), followed by an UPDATE here. Until
-- then the cadence check in scripts/check-data.js classifies a modal gap it
-- has no enum value for as unclassifiable and does not fault the metadata for
-- failing to express something the schema cannot hold. That exemption is a
-- statement about the schema, not about these two series.


-- ───────────────────────────────────────────────────────────────────────────
-- 3. Publication dates for the report figures and the reading list
--
-- WHY AN UNDATED CITATION IS A BROKEN ONE HERE SPECIFICALLY
--
-- This project's contested-vs-settled rule is a recency rule: later evidence
-- supersedes earlier evidence, and a reader is asked to weigh two findings by
-- when they were made. A citation with no date cannot be put on that axis by
-- the reader or by the site. Sixteen report figures and thirteen reading-list
-- rows carried `published IS NULL`, several of them on live pages and two of
-- them on `contested` questions.
--
-- HOW THESE TWO DATES WERE ESTABLISHED — from the publishers, not the PDFs
--
-- PwC, "2026 Global AI Jobs Barometer" → 2026-06-15.
--   PwC's own press release announcing the report,
--   https://www.pwc.com/gx/en/news-room/press-releases/2026/pwc-2026-ai-jobs-barometer.html
--   (title: "AI reshapes global labour market into two distinct paths,
--   rewarding human skills: PwC 2026 Global AI Jobs Barometer"), carries
--   `pwcReleaseDate = "2026-06-15T05:23:00.000+01:00"` in the page source and
--   renders "June 15, 2026". Fetched and read on 2026-09-03.
--
-- Stanford HAI, "The 2026 AI Index Report" → 2026-04-13.
--   The chapter page itself carries no date. HAI's own launch article,
--   https://hai.stanford.edu/news/inside-the-ai-index-12-takeaways-from-the-2026-report
--   ("Inside the AI Index: 12 Takeaways from the 2026 Report"), is dated
--   "April 13, 2026" in its article metadata. Corroborated independently by
--   the ai4lam list thread "Just Released: The 2026 AI Index Report", dated
--   Apr 13, 2026. Both fetched and read on 2026-09-03.
--
-- WHAT IS DELIBERATELY STILL NULL
--
-- Accenture, "Pulse of Change: Business and Technology Trends 2026"
-- (question_reading id 10, on the `growth` lens) stays NULL. Accenture's own
-- page gives two different answers: the visible hero publish-date element
-- reads "July 26, 2026" while the page's JSON-LD `datePublished` reads
-- "2026-01-15", and the CMS `publishDate` in the same markup is
-- 2026-08-18 — three dates for one evergreen hub page. A date that the
-- publisher contradicts on its own page is not established, and a guess here
-- would be worse than the NULL, because the NULL is at least visible.
--
-- Keyed on publisher and title rather than on row ids, so a figure added later
-- from the same report is dated by re-running this file.
-- ───────────────────────────────────────────────────────────────────────────

UPDATE report_figures
   SET published = DATE '2026-06-15'
 WHERE publisher = 'PwC'
   AND source_title = '2026 Global AI Jobs Barometer'
   AND published IS DISTINCT FROM DATE '2026-06-15';

UPDATE report_figures
   SET published = DATE '2026-04-13'
 WHERE publisher = 'Stanford HAI'
   AND source_title LIKE 'The 2026 AI Index Report%'
   AND published IS DISTINCT FROM DATE '2026-04-13';

UPDATE question_reading
   SET published = DATE '2026-06-15'
 WHERE publisher = 'PwC'
   AND title = '2026 Global AI Jobs Barometer'
   AND published IS DISTINCT FROM DATE '2026-06-15';

UPDATE question_reading
   SET published = DATE '2026-04-13'
 WHERE publisher = 'Stanford HAI'
   AND title LIKE 'The 2026 AI Index Report%'
   AND published IS DISTINCT FROM DATE '2026-04-13';

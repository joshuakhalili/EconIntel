-- ═══════════════════════════════════════════════════════════════════════════
-- Mark future-dated values as projections.
--
-- Found on 2026-08-30 by the new provenance page, which reported DBnomics as
-- holding data to 2027-03-31 — seven months into the future.
--
-- TWO DIFFERENT THINGS WERE BEHIND THAT, AND ONLY ONE IS A PROBLEM.
--
-- 1. Empty placeholder periods. The RBA's quarterly tables publish rows out to
--    2027-03-31 with a NULL value — the period exists, the measurement has not
--    happened. Nothing is ever drawn from a null, so no chart was wrong; what
--    was wrong was `max(period_start)`, which counted them and made the
--    catalogue claim coverage the data does not have. Fixed in the queries
--    themselves (`FILTER (WHERE value IS NOT NULL)`), not here.
--
-- 2. A real forecast presented as a measurement. AMECO is the European
--    Commission's macroeconomic database and its later years are the
--    Commission's own FORECAST, not an observation. UK total factor
--    productivity carries 96.29 for 2026 and 96.77 for 2027. Those are real
--    numbers, they are drawn on charts, and nothing on the page says they are
--    projections.
--
-- On a site whose first rule is that every figure traces to a measurement, a
-- forecast rendered identically to an observation is the exact failure the
-- rule exists to prevent.
--
-- WHAT THIS DOES, AND WHAT IT DELIBERATELY DOES NOT
--
-- It records the fact in the database. `observations.value_status` has existed
-- since 0003, documented as 'provisional' | 'revised' | 'estimated' |
-- 'suppressed', and has been NULL on all 74,041 rows — a column nobody ever
-- filled in. 'projected' joins that set.
--
-- It does NOT change how anything is drawn. `/api/series` does not select
-- `value_status` and `SeriesChart` has no notion of it, so marking these
-- changes nothing a reader sees today. That is the honest state of it: the
-- database now knows, the charts do not yet. Wiring it through — most likely
-- as the dashed treatment `SeriesChart` already uses for series that could not
-- be rebased — is a chart-layer change and it is written up in STATUS.md
-- rather than half-done here.
--
-- Keyed on the period rather than a list of ids, so a re-ingest that extends
-- the forecast marks the new years too.
--
-- WHAT THIS RULE CANNOT CATCH, STATED PLAINLY
--
-- "Dated after today" is a sufficient test, not a complete one. Run on
-- 2026-08-30 it marks exactly ONE row — AMECO's 2027 value. The 2026 value,
-- 96.29, is equally a Commission forecast and is not marked, because 1 January
-- 2026 is in the past.
--
-- Doing better needs the vintage: which release this came from, and therefore
-- where that release's outturn ended and its forecast began. That is not
-- stored — `observations` has no vintage column and DBnomics does not return
-- one in the series payload — so inferring it would mean deciding by hand,
-- per series, which years are projections. That is editorial work on real
-- numbers and it is not something to guess at.
--
-- So: this marks what can be established from the data alone. Anything more
-- is a judgement about a source and belongs to a person.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE observations o
   SET value_status = 'projected'
  FROM indicators i
 WHERE i.id = o.indicator_id
   AND o.value IS NOT NULL
   AND o.period_start > current_date
   AND o.value_status IS DISTINCT FROM 'projected';

-- Source-backed agent adjudication, 10–11 September 2026. No human review.
-- Exact sources/versions/locators and original bindings live in the granular ledger.

-- HAI's 0% shorthand is not an estimated exact zero. The original investigators
-- report a small, nonsignificant speedup (Jan 29 2026, Results). Preserve the
-- finding, not the false numerical precision or the secondary citation year.
UPDATE report_figure_points SET value=NULL,
  label='Software engineers (Shen and Tamkin, 2026)',
  value_note='Small speedup; not statistically significant. No exact zero effect established.'
WHERE figure_id='hai-measured-productivity-change-by-study'
  AND label IN ('Software engineers (Shen and Tamkin, 2025)','Software engineers (Shen and Tamkin, 2026)');
UPDATE report_figures SET note=note || ' Source correction: HAI labels Shen and Tamkin as 2025 and uses 0% for a nonsignificant speed change. The investigators published their summary on 29 January 2026 and report a small, statistically insignificant speedup, not an exact zero effect. Original: https://www.anthropic.com/research/AI-assistance-coding-skills (Results and Study design; accessed 10 September 2026).'
WHERE id='hai-measured-productivity-change-by-study'
  AND note NOT LIKE '%Source correction: HAI labels Shen%';

-- WEF's source text says 2022, but the underlying McKinsey series and HAI's
-- 2023–25 reproduction both identify 55% as 2023 (2022 was 50%). Retain the
-- original quotation as documentary evidence while correcting the plotted year.
UPDATE report_figure_points SET label='2023', value_note='Year corrected against the underlying McKinsey series; WEF text says 2022.'
WHERE figure_id='wef-business-ai-adoption-2022-2025' AND label IN ('2022','2023');
UPDATE report_figures SET
  title='Reported AI use in at least one function — corrected baseline year',
  subtitle='Survey respondents, 2023 to 2025. WEF misdates its 55% baseline as 2022; McKinsey and HAI place it in 2023.',
  unit='% of survey respondents reporting organisational AI use',
  note=note || ' The original WEF quotation below is retained verbatim, including its year error. McKinsey March 2025 Exhibit 8 (PDF p16) reports 2022=50% and 2023=55%; HAI 2026 Figure 4.3.2 (printed p194, PDF p24) confirms 2023=55% and 2025=88%. The corrected chart is not a census of world firms.'
WHERE id='wef-business-ai-adoption-2022-2025' AND title <> 'Reported AI use in at least one function — corrected baseline year';

-- Page10 supplies narrative thresholds, not point estimates. Keep both rows,
-- but remove precise numeric bars that the source does not actually support.
UPDATE report_figure_points SET value=NULL, basis='scenario',
 value_note=CASE label WHEN 'All sectors' THEN 'More than 50% of tasks — illustrative scenario, not an exact estimate.'
 ELSE 'Approaching 90% of tasks — illustrative scenario, not an exact estimate.' END
WHERE figure_id='wef-task-automation-age-of-displacement-2030';

-- Independent source/interpretation pass, 10 September 2026.
-- See docs/research/report-review-2026-09-10.md for all 32 inherited takeaways
-- and all 56 figure dispositions. No blanket promotion of legacy review flags.
-- Exact question/publisher pairs target the inherited report notes; IDs vary
-- across database rebuilds. New primary citations make discrepancies inspectable.

WITH corrections(question_id, publisher, takeaway, takeaway_ref) AS (VALUES
('building', 'Stanford HAI',
 'The chapter documents substantial hyperscaler infrastructure investment, but its statement that Google spent more than $150 billion in 2025 conflicts with Alphabet''s 2025 Form 10-K, which reports $91.4 billion in capital expenditure. Figure 4.2.21 also labels both 2025 and 2026 as estimates. Use the company filing for realised spending; the chart and announced multiyear projects must not be presented as booked 2025 AI-only investment.',
 'Printed p. 191 (chapter PDF p. 21), including the figure subtitle; cross-checked against Alphabet 2025 Form 10-K, Financial Results and Capital Expenditures, 10 September 2026.'),
('adoption', 'Stanford HAI',
 'The chapter reproduces Microsoft''s H2 2025 estimates: AI use reaches 64.0% in the United Arab Emirates, 60.9% in Singapore and 28.3% in the United States. The denominator in Microsoft''s original is the working-age population, not all residents or businesses. These are telemetry-based usage estimates, not measures of productive workplace deployment; differences in coverage and adoption patterns limit cross-country interpretation.',
 'Printed pp. 200-201 (chapter PDF pp. 30-31); denominator checked against Microsoft, Global AI Adoption in 2025, 10 September 2026.'),
('adoption', 'International Monetary Fund',
 'The IMF reports AI skills in fewer than 1% of US job postings before 2015 and almost 5% by 2025, and AI-related skills account for nearly a third of new IT skills. These are advertised skill requirements, not firm adoption rates. The note''s discussion of occupational structure on p. 23 concerns estimated potential demand for all new skills; it does not establish how much of the observed cross-country AI-skill gap is caused by occupational composition.',
 'Printed pp. 9, 11 and 23; source text and scope independently checked 10 September 2026.'),
('markets', 'International Monetary Fund',
 'The workshop note links uneven diffusion to institutional and organisational frictions despite falling advertised model-query prices. Figure 2 does name models and dates: GPT-4 in March 2023 and endpoints including GPT-5 Nano in August 2025 and Grok 4 in September 2025. Its over-99% annotations compare different capability-cost frontiers, not the same model at constant quality, and are not a measure of all-in business deployment costs.',
 'Printed pp. 5-6 (PDF pp. 7-8), Figure 2; image rendered and labels checked 10 September 2026.'),
('productivity', 'PwC',
 'PwC reports turnover-per-employee growth from a 2018 baseline of 33.5% for the most AI-exposed sector quartile and 24.0% for the least exposed at its 2025 endpoint. That endpoint substitutes 2024 values where 2025 data are unavailable. Sector exposure is not observed AI use, turnover is not real value added, and the large surviving-firm sample is selective. The comparison is descriptive rather than an estimate that AI caused the difference.',
 'Printed pp. 19-20; PDF p. 19 chart and notes rendered and checked 10 September 2026.'),
('jobs', 'PwC',
 'In PwC''s selected ORBIS sample, average headcount growth from 2018 is 52.2% for the most AI-exposed sector quartile and 35.7% for the least exposed at the 2024/25 endpoint. The report substitutes 2024 data where 2025 coverage is missing. Only larger firms with financial and headcount observations at both endpoints are included, and firms that exited are excluded. This neither measures economy-wide employment growth nor identifies the causal employment effect of AI.',
 'Printed p. 20, chart and sample footnote; source checked 10 September 2026.'),
('entry-level', 'PwC',
 'The pooled Canada, Singapore, UK and US series shows entry-level postings flattening in the highest AI-exposure quartile; roughly 73% of postings come from the US. This is not four independent national findings, and the report explicitly warns against attributing the pattern to AI alone. Separately, its CEO survey records expectations of reduced junior hiring. Its US comparison reports 35% growth for seniorised entry-level roles and a 10% decline for other roles between 2019 and 2025; postings are not realised hires.',
 'Printed pp. 11-13, especially p. 11 sample and causal caveats; source checked 10 September 2026.'),
('entry-level', 'International Monetary Fund',
 'The note describes young workers'' concentration in occupations with high AI exposure and low complementarity, particularly among college graduates. Its 13% relative employment decline for ages 22-25 is a citation to the 2025 vintage of Brynjolfsson, Chandar and Chen, not an IMF estimate or a current-vintage measure. Keep that historical result separate from later revisions and from vacancy measures.',
 'Printed pp. 18-19; historical citation wording checked 10 September 2026.'),
('entry-level', 'Stanford HAI',
 'The chapter summarises a 2025 vintage of US payroll research: young software-developer employment declined from its 2022 peak, and employment in highly AI-exposed occupations fell roughly 16% relative to less-exposed occupations for ages 22-25. This is a historical, subgroup-specific comparison, not a current estimate of economy-wide displacement. The report''s firm-effect controls do not by themselves establish that every remaining difference is caused by AI.',
 'Printed pp. 221-222 (chapter PDF pp. 51-52); historical estimate and scope checked 10 September 2026.')
)
UPDATE question_reading r SET takeaway = c.takeaway, takeaway_ref = c.takeaway_ref,
  review_actor = 'agent'
FROM corrections c
WHERE r.question_id = c.question_id AND r.publisher = c.publisher;

INSERT INTO question_reading
 (question_id, title, publisher, published, url, kind, stance, takeaway,
  takeaway_source, takeaway_ref, review_actor, sort_order)
VALUES
 ('building', 'Alphabet 2025 Form 10-K: capital expenditure', 'Alphabet / US SEC', NULL,
  'https://www.sec.gov/Archives/edgar/data/1652044/000165204426000018/goog-20251231.htm',
  'official', 'complicates',
  'Alphabet reports $91.4 billion of capital expenditure for 2025. This is company-wide spending, primarily technical infrastructure, rather than a separately measured AI-only total. It is the primary filing used to correct the larger 2025 figure reproduced in the AI Index chapter.',
  'extracted', '2025 Form 10-K, Financial Results and Capital Expenditures; source checked by an agent 10 September 2026.', 'agent', -5),
 ('adoption', 'Global AI Adoption in 2025', 'Microsoft AI Economy Institute', NULL,
  'https://www.microsoft.com/en-us/corporate-responsibility/topics/ai-economy-institute/reports/global-ai-adoption-2025/',
  'industry', 'background',
  'The original H2 2025 diffusion report defines its population denominator as working-age people. The UAE, Singapore and US figures describe use of AI tools, not the share of firms integrating AI into production.',
  'extracted', 'H2 2025 country ranking and methodology; source accessed by an agent 10 September 2026.', 'agent', -5)
ON CONFLICT (question_id, lens_id, url) DO UPDATE SET
  title=EXCLUDED.title, publisher=EXCLUDED.publisher, published=EXCLUDED.published,
  kind=EXCLUDED.kind, stance=EXCLUDED.stance, takeaway=EXCLUDED.takeaway,
  takeaway_ref=EXCLUDED.takeaway_ref, review_actor=EXCLUDED.review_actor,
  sort_order=EXCLUDED.sort_order;

-- Source-fidelity checks do not make heterogeneous estimands comparable.
UPDATE report_figures SET
 title = 'Reported task-outcome effects in selected AI studies',
 subtitle = 'Source-reported percentage changes in different outcomes; not a common productivity scale',
 note = 'These studies measure different outcomes and populations, so the bars cannot rank AI effectiveness. The AI Index reports the METR result as -19%; METR''s original states that tasks took 19% longer, which is not the same as a 19% decline in output per hour. The negative sign here preserves the AI Index convention, not a converted productivity rate. METR''s later update describes selection problems in estimating a reliable contemporary effect, not a clean finding that the original result was false. Other rows concern output volume, pull requests or issues resolved. The customer-support estimate is a range and remains omitted rather than selecting an endpoint.'
WHERE id='hai-measured-productivity-change-by-study';

UPDATE report_figures SET
 note = 'The values reproduce Figure 2''s percentage annotations, not independently recomputed changes. The annotations do not exactly reconcile with the displayed endpoint prices; they must not be treated as precise calculated ratios. Each frontier ends at a different model and performance level, so this is not a constant-quality price index or an estimate of enterprise deployment costs. The source is a third-party illustration reproduced in the IMF workshop note, with model dates from March 2023 to August-September 2025.'
WHERE id='imf-macro-inference-cost-decline';

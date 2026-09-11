-- Structured extraction from explicitly consulted source passages only.
-- No human-review event is added; content changes intentionally stale old reviews.
UPDATE research_evidence SET
  sample='5,172 customer-support agents',
  exposure='Access to a generative-AI conversational assistant introduced in a staggered rollout',
  outcome='Customer issues resolved per hour',
  estimate=15, estimate_unit='percent change in issues resolved per hour',
  uncertainty='{"kind":"not_reported","note":"The v2 abstract reports no confidence interval or standard error; full-paper identification has not been reviewed."}'::jsonb,
  identification='Staggered introduction described in the abstract; not classified as random assignment by this audit',
  geography_studied=NULL, study_period=NULL
WHERE source_url='https://arxiv.org/abs/2304.11771v2';

INSERT INTO research_evidence
(id,claim_id,source_url,source_title,source_version,locator,finding,method,limitations,relationship,relevance,access_basis,publication_stage,sample,exposure,outcome,estimate,estimate_unit,uncertainty,identification,geography_studied,study_period)
VALUES
('editorial-20260911-workplace-metr-structured','editorial-20260910-atomic-workplace-complementarity',
'https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/',
'Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity',
'Investigator summary, 10 July 2025; accessed 11 September 2026',
'Methodology, Core Result, Table 2 and FAQ',
'Allowing AI increased completion time by 19% in the selected experienced-developer setting; the finding does not establish that AI slows most developers.',
'Issues were randomly assigned to allow or disallow AI; developers worked on real issues in familiar repositories and reported implementation time.',
'Selected 16 developers and 246 issues; investigator summary reviewed, not independent re-estimation. Later tools and settings may differ; the February 2026 follow-up reports serious selection and timing limitations.',
'mixed','Contrasts with customer-support gains without pooling different tasks, outcomes or populations. Positive workplace findings cannot be generalised to all settings.',
'full_text','report','16 experienced open-source developers and 246 real repository issues',
'Issue-level permission to use AI tools, primarily Cursor with Claude 3.5/3.7 Sonnet, versus no generative-AI assistance',
'Implementation time to complete a repository issue',
19,'percent change in completion time; positive means slower',
'{"kind":"not_reported","note":"Original investigator page calls the slowdown significant but the numeric interval is not extracted here; no precision is invented."}'::jsonb,
'Randomised issue-level AI permission in a selected developer sample',NULL,'Early 2025')
ON CONFLICT (id) DO UPDATE SET
sample=EXCLUDED.sample,exposure=EXCLUDED.exposure,outcome=EXCLUDED.outcome,
estimate=EXCLUDED.estimate,estimate_unit=EXCLUDED.estimate_unit,uncertainty=EXCLUDED.uncertainty,
identification=EXCLUDED.identification,geography_studied=EXCLUDED.geography_studied,study_period=EXCLUDED.study_period;

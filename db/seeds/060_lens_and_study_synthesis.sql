-- Agent-authored source comparison. No human certification or question activation.
-- These studies measure different outcomes; textual findings preserve their
-- numbers without placing incomparable magnitudes on one common bar scale.
UPDATE report_figure_points SET value=NULL, value_note=CASE
 WHEN label LIKE 'Accountants%' THEN 'Reported 55% more weekly client support among AI adopters; observational accounting evidence, not an economy-wide productivity effect.'
 WHEN label LIKE 'Authors%' THEN 'Monthly book releases tripled (+200%) over the study window; market output quantity, not productivity per author or quality-adjusted welfare.'
 WHEN label LIKE 'Developers%' THEN 'Early-2025 trial: tasks took 19% longer with AI (reported confidence interval +2% to +39%). Time and output-per-hour changes are not the same percentage.'
 WHEN label LIKE 'Marketing teams%' THEN 'Version 3 (February 2026): 50% more ads per worker in the experiment, with mixed text/image quality and greater output similarity.'
 WHEN label LIKE 'Software developers%' THEN 'Published February 2026: 26.08% more completed tasks (standard error 10.3%) across three company experiments; HAI rounds this to 26%.'
 ELSE value_note END
WHERE figure_id='hai-measured-productivity-change-by-study';
UPDATE report_figures SET
 title='Study-specific AI work outcomes — not a common productivity scale',
 subtitle='Different populations, tasks, designs and versions. Reported numbers are preserved in text; comparing their magnitudes as equivalent productivity effects would be misleading.',
 unit='Study-specific outcomes; no pooled effect or common numeric scale'
WHERE id='hai-measured-productivity-change-by-study';

UPDATE lenses SET thesis_plain='Reported AI use is spreading, but reach is not intensity or economic impact. Enterprise surveys, public-company disclosures and cloud uptake measure different populations and activities. Workplace studies show that benefits depend on tasks and implementation; the aggregate charts do not identify an AI contribution to output per hour.',
 thesis_expert='Eurostat enterprise-use statistics describe their defined survey population; SEC mentions are disclosures, and cloud services can be used without AI. Their levels cannot rank national adoption or historical diffusion speed. Task-based economics links aggregate gains to affected tasks and cost savings, while the productivity J-curve describes one conditional role for complementary investment. Neither proves that a weak aggregate signal hides a positive effect: a causal estimate needs an explicit counterfactual, and a detectability claim needs a stated power analysis.'
WHERE id='growth';
UPDATE lenses SET thesis_plain='Computing equipment, software and data-centre structures show different parts of the investment cycle. Broad ICT spending is not an audited AI total, and a publicly listed facility may still be planned. Compare spending, productive capacity and actual operation separately before judging the scale or return of the build-out.',
 thesis_expert='BEA investment flows differ from productive stocks and capital services. A falling matched asset price can make real investment grow faster than nominal spending; capital deepening also depends on depreciation and labour input. Epoch is a selective public register whose additions may reflect discovery or planned systems, not completed construction. BIS historical boom comparisons raise a financing-risk hypothesis, not proof that the current cycle must end in the same way. Commodity prices provide input-cost context, not an identified AI-demand share.'
WHERE id='investment';
UPDATE lenses SET thesis_plain='Sector employment, vacancies and youth outcomes describe different margins of adjustment. None alone identifies AI displacement. Firms can expand while particular occupations or local labour markets lose opportunities, so the evidence must be compared on matched populations and periods.',
 thesis_expert='A sector employment share normalises size but does not cancel business-cycle or sector-specific shocks. PwC surviving-firm headcount comparisons, IMF local skill-exposure estimates and workplace task experiments have different estimands and selection assumptions. Hiring, employment, unemployment and pay should not be interchanged. Interest rates and earlier restructuring are rival explanations to investigate, not an identified single cause; youth is not itself a validated measure of AI exposure.'
WHERE id='labour';
UPDATE lenses SET thesis_plain='Chip prices, hosting contracts, electricity tariffs and commodity prices describe different parts of the cost environment. They do not jointly measure the cost of completing an equivalent AI task. Quality, contracts and geography matter before a price difference can explain adoption or economic returns.',
 thesis_expert='BLS research distinguishes published semiconductor and hosting baskets from performance-adjusted computation. Rebasing does not harmonise products, and a historical microprocessor study cannot supply current GPU prices. IEA analysis identifies local electricity and connection constraints, but national tariffs cannot attribute price changes to AI. Commodity and equity prices respond to many non-AI factors; the dashboard supplies context, not a causal decomposition or valuation premium.'
WHERE id='prices';
UPDATE lenses SET thesis_plain='US federal publication counts measure documents matching AI-related terms, not laws currently in force or compliance costs. Rules, proposals and presidential documents have different functions. Establishing what is binding requires reading the action, effective date and subsequent legal history.',
 thesis_expert='The Federal Register tutorial distinguishes publication from effectiveness and explains the proposal and rulemaking process. Annual rule/proposal counts are unlinked flows, not conversion cohorts or a measure of net obligations. Keyword matches can include irrelevant records and changing terminology; their prevalence needs sampled validation. These US data do not establish comparative international regulation, a universal implementation lag, or the absence of usable registers elsewhere.'
WHERE id='regulation';

-- Narrow the inherited historical analogy to a paraphrase and an attributed
-- risk argument; the report does not forecast an inevitable recession.
UPDATE question_reading SET takeaway='BIS compares the current investment cycle with earlier technology booms and highlights opaque financing links. The analogy motivates scrutiny of expected returns, leverage and collateral; it is not an identified forecast of a recession or evidence that announced investment is already operating.',
 takeaway_source='extracted',takeaway_ref='BIS 2026 Chapter I, printed pp.22–23,25; agent checked source passages; historical analogy not independently re-estimated.',review_actor='agent'
WHERE lens_id='investment' AND publisher='Bank for International Settlements';

INSERT INTO question_reading(lens_id,title,publisher,url,kind,stance,takeaway,takeaway_source,takeaway_ref,sort_order,review_actor)
VALUES
('growth','The Simple Macroeconomics of AI','Daron Acemoglu / Economic Policy','https://economics.mit.edu/sites/default/files/2024-10/The%20Simple%20Macroeconomics%20of%20AI.pdf','academic','complicates','The task framework makes aggregate effects depend on the tasks affected and their cost savings. It disciplines extrapolation from workplace gains; calibrated forecasts are not observed national AI effects.','extracted','Author-hosted 2024 published PDF, summary and introduction pp.1,3–6; accessed10September2026.',8,'agent'),
('investment','Measuring Infrastructure in the BEA National Economic Accounts','Bureau of Economic Analysis','https://www.bea.gov/sites/default/files/papers/BEA-WP2020-12.pdf','official','background','Real investment uses an appropriate price adjustment; accumulated capital additionally depends on depreciation. Nominal spending growth is not itself capital deepening per worker.','extracted','Working paper2020-12,p11; accessed10September2026.',8,'agent'),
('labour','Generative AI at Work','Brynjolfsson, Li and Raymond','https://arxiv.org/abs/2304.11771v2','academic','complicates','The version2 abstract reports gains in a customer-support rollout with variation by experience. This tests performance among existing workers, not whether employers create more entry-level jobs.','extracted','arXivv2,6November2024; abstract-only access10September2026. Full identification assessment not claimed.',8,'agent'),
('prices','A new approach for quality-adjusting PPI microprocessors','Bureau of Labor Statistics','https://www.bls.gov/opub/mlr/2018/article/a-new-approach-for-quality-adjusting-ppi-microprocessors.htm','official','complicates','Historical matched-model and hedonic price measures can differ when quality and pricing practices change. This is a reason to inspect the basket, not an updated GPU or AI-task price estimate.','extracted','Monthly Labor Review,December2018; introduction and data/methods accessed10September2026.',8,'agent'),
('regulation','Federal Register Tutorial','National Archives and Records Administration','https://www.archives.gov/federal-register/tutorial/online-html.html','official','background','Publication, effective dates and stages of rulemaking differ. A keyword-matched document count cannot establish current legal obligations, policy restrictiveness or proposal conversion.','extracted','Overview of Rulemaking,Proposed Rules,Rules and Regulations,Effective date; accessed10September2026.',8,'agent')
ON CONFLICT(question_id,lens_id,url) DO UPDATE SET takeaway=EXCLUDED.takeaway,takeaway_source=EXCLUDED.takeaway_source,takeaway_ref=EXCLUDED.takeaway_ref,review_actor=EXCLUDED.review_actor;

-- Complete the inherited lens reading layer with source-specific interpretation,
-- rather than leaving titles to imply that a report proves the lens thesis.
UPDATE question_reading SET takeaway='Survey responses describe organisational use and perceived outcomes, not a causal national productivity estimate. July 2024 fieldwork and changing historical definitions prevent treating the full adoption line as one unchanged measure.',
 takeaway_source='extracted',takeaway_ref='March2025 report, PDF pp16,22–23,25; agent checked selected figures and methodology.',review_actor='agent'
WHERE lens_id='growth' AND publisher='McKinsey & Company (QuantumBlack)';
UPDATE question_reading SET takeaway='The surveyed organisations already use AI daily. Reported benefits and future plans therefore describe selected adopters, not all firms. This helps explain why apparent adoption and value differ from broader enterprise surveys.',
 takeaway_source='extracted',takeaway_ref='State of AI2026, pp10,17,40; August–September2025 fieldwork; agent checked selected passages.',review_actor='agent'
WHERE lens_id='growth' AND publisher='Deloitte AI Institute';
UPDATE question_reading SET takeaway='Leaders report confidence and deployment stages, but strong agreement, agreement and established ROI are different response measures. Governance associations are not evidence that assigning CEO responsibility causes better financial returns.',
 takeaway_source='extracted',takeaway_ref='Global AI Pulse Q2 2026, pp9–10,16,22; fieldwork28April–25May2026; agent checked.',review_actor='agent'
WHERE lens_id='growth' AND publisher='KPMG International';
UPDATE question_reading SET published='2026-07-26',takeaway='The July 2026 release surveys leaders and employees at large organisations separately. Perceived productivity benefits and widespread business value are different outcomes; these self-reports are not independently measured output or a causal effect of AI.',
 takeaway_source='extracted',takeaway_ref='Primary web release26July2026, results and methodology; accessed11September2026. Two surveys of3000 each, April–June2026; organisations above$500m revenue.',review_actor='agent'
WHERE lens_id='growth' AND publisher='Accenture';
UPDATE question_reading SET takeaway='The chapter combines survey adoption, financing data and studies with different task outcomes. Its study percentages do not share a productivity estimand. Primary-source checks also reveal version and date differences that must be preserved rather than pooled.',
 takeaway_source='extracted',takeaway_ref='AI Index2026 economy chapter, printed pp181–182,194–195,204,209,219–220,225; agent checked source figures, not vendor microdata.',review_actor='agent'
WHERE lens_id='growth' AND publisher='Stanford HAI';
UPDATE question_reading SET takeaway='The reported recovery in median output per worker is aggregate context, not an identified AI effect. The country-specific capital-deepening interpretation and broader financing risks are conditional explanations, not a universal growth forecast.',
 takeaway_source='extracted',takeaway_ref='Economic Outlook June2026, printed pp25,44,291; agent checked selected passages.',review_actor='agent'
WHERE lens_id='growth' AND publisher='OECD';
UPDATE question_reading SET takeaway='The workshop note discusses task gains, organisational frictions and physical bottlenecks. Its reproduced forecast and price-frontier charts are not current measurements; their model/date labels and inconsistent percentage annotations require explicit qualification.',
 takeaway_source='extracted',takeaway_ref='IMF Note2026/002, printed pp5–6/PDF7–8; rendered figures and surrounding text checked by agent.',review_actor='agent'
WHERE lens_id='growth' AND publisher='International Monetary Fund';
UPDATE question_reading SET published='2024-03-22',takeaway='EY describes capital-accumulation scenarios conditional on investment growing faster than a historical trend. This is a March 2024 scenario article, not a May 2026 realised-growth result. Its optimistic pathway and BIS financing risks concern different conditions, not mutually exclusive forecasts.',
 takeaway_source='extracted',takeaway_ref='Primary web article22March2024; article header and Supply perspective/Scenario analysis sections accessed11September2026. Model not independently replicated.',review_actor='agent'
WHERE lens_id='investment' AND publisher='EY';
UPDATE question_reading SET takeaway='Posting and firm-account comparisons use constructed exposure measures. Surviving larger firms and mixed 2024/25 endpoints limit the headcount results; turnover per worker and staffing costs are not real output per hour or hourly pay. These associations cannot alone establish AI job creation.',
 takeaway_source='extracted',takeaway_ref='Jobs Barometer2026, pp8,13,16,19–21,23; agent checked individual plotted values and source footnotes.',review_actor='agent'
WHERE lens_id='labour' AND publisher='PwC';
UPDATE question_reading SET takeaway='New-skill wage associations, local skill-diffusion estimates and high-exposure employment results use different samples and methods. Broad new skills are not AI-only skills. Local losses can coexist with firm growth; the IV and event-study assumptions must hold for a causal interpretation.',
 takeaway_source='extracted',takeaway_ref='IMF SDN2026/001, pp11,14–16,19–21; agent checked selected results and stated identification, not confidential microdata.',review_actor='agent'
WHERE lens_id='labour' AND publisher='International Monetary Fund';
UPDATE question_reading SET takeaway='The four futures are illustrative narratives, not probability-weighted forecasts. Job-creation and displacement totals cover all macrotrends, whereas executive responses are beliefs about AI. Scenario task thresholds do not supply exact measured percentages.',
 takeaway_source='extracted',takeaway_ref='Four Futures, January2026, pp5,10; source values, scenario wording and adoption-year conflict checked by agent.',review_actor='agent'
WHERE lens_id='labour' AND publisher='World Economic Forum';

-- What the cited reports actually say.
--
-- Twelve citations have sat with a NULL takeaway since 014_reading.sql, under
-- the rule stated in that file's header: a takeaway cannot be written from a
-- title. Ten of the twelve are now read — each document opened, the relevant
-- pages read, and the finding recorded with the page it came from. EY and
-- Accenture are not among them; no copy was held, so their takeaways stay NULL
-- rather than being guessed at from a landing page.
--
-- Every takeaway here is marked `extracted`, not `reviewed`. It was read out of
-- the document by a machine and no person has yet checked it against the page.
-- That distinction is carried in the data (0014_reading_provenance.sql) and
-- rendered to the reader, because a takeaway that looks checked when it is not
-- is the exact failure 014's header warned about. `takeaway_ref` gives the page
-- so anybody can settle it in a minute.
--
-- STRUCTURE CHANGE
--
-- All twelve rows were lens-scoped, so a report saying four different things
-- about four different questions appeared once, unattributed to any of them.
-- Findings are attached per question here, one row per (report, page) pair —
-- which is what `question_reading_unique_placement` was built for: "the same
-- report can sit on several pages, but not twice on one." The original
-- lens-level rows stay where the report speaks to the lens as a whole.
--
-- WHAT IS NOT HERE
--
-- Nothing for `regulation` / `policy`. All ten documents were searched and none
-- carries a finding about government rulemaking — the closest, KPMG's
-- governance chapter, is about internal corporate accountability, and
-- Deloitte's sovereign-AI section is about vendor selection. Attaching either
-- would misrepresent it. That lens stays empty until a source that actually
-- studies AI regulation is added.
--
-- Scenario material is excluded on principle. The WEF paper's four futures and
-- the IMF Note's diffusion scenarios are written in the past tense from inside
-- an imagined 2030 and read exactly like data. None of it is here.
--
-- Five citation dates and two titles were wrong, found by reading the covers.
-- Those are corrected in 014_reading.sql, which owns that metadata, rather
-- than patched over here.

-- ---------------------------------------------------------------------------
-- Takeaways on the existing lens-level rows, where the report speaks to the
-- whole lens rather than to one question.
-- ---------------------------------------------------------------------------

UPDATE question_reading SET
  stance = 'complicates',
  takeaway = 'Sets the AI capital-expenditure boom against the canal mania of the 1830s, the British railway mania of the 1840s, the electrification exuberance of the late 1920s and the dotcom boom, which "all shared one common trait: a genuine technological breakthrough that attracted capital in excess of what commercial returns could ultimately justify" and which "ended with an eventual reversal in investment, inducing economy-wide recessions". Also describes circular financing among chipmakers, hyperscalers and AI labs whose terms are "typically poorly disclosed, with risks of the same asset being pledged multiple times".',
  takeaway_source = 'extracted',
  takeaway_ref = 'pp. 22-23, 25 (printed)'
 WHERE url = 'https://www.bis.org/publ/arpdf/ar2026e1.htm' AND lens_id = 'investment';

-- ---------------------------------------------------------------------------
-- Question-level findings.
-- ---------------------------------------------------------------------------

INSERT INTO question_reading
  (question_id, title, publisher, published, url, kind, stance, takeaway,
   takeaway_source, takeaway_ref, sort_order) VALUES

-- === Investment & Capital ==================================================

('money', 'Annual Economic Report 2026, Chapter I: Progress and peril',
 'Bank for International Settlements', DATE '2026-06-01',
 'https://www.bis.org/publ/arpdf/ar2026e1.htm', 'official', 'complicates',
 'The five largest hyperscalers are set to spend over a trillion US dollars on AI-related capital expenditure across 2025 and 2026, commitments that outpace those firms'' earnings and free cash flow and have led some to issue debt to raise additional financing.',
 'extracted', 'pp. 22-23 (printed)', 1),

('money', 'The 2026 AI Index Report — Economy chapter', 'Stanford HAI', NULL,
 'https://hai.stanford.edu/ai-index/2026-ai-index-report/economy', 'academic', 'supports',
 'Global corporate AI investment reached $581.69 billion in 2025, a 129.9% increase on the previous year. Private investment was the largest component at $344.66 billion, up 127.5%, and mergers and acquisitions rose 132.6% year over year.',
 'extracted', 'p. 178 (printed)', 2),

('money', 'OECD Economic Outlook, Volume 2026 Issue 1', 'OECD', DATE '2026-06-01',
 'https://www.oecd.org/en/publications/2026/06/oecd-economic-outlook-volume-2026-issue-1_8be0dba6.html', 'official', 'complicates',
 'AI companies, "notably the Magnificent Seven", are running capital-expenditure programmes that "outstrip earnings growth and are projected to reach USD 1.1 trillion in 2027", financed increasingly through marketable debt and less transparent private capital. The OECD flags "widespread circular financing arrangements among AI firms, with AI firms acting as both borrowers and creditors to one another". The 2027 figure is a projection; the shift in financing mix is an observation.',
 'extracted', 'pp. 42-43 (printed)', 3),

('money', 'Global AI Pulse, Q2 2026', 'KPMG International', DATE '2026-06-01',
 'https://kpmg.com/xx/en/our-insights/ai-and-technology/ai-pulse.html', 'consulting', 'supports',
 'Planned AI investment reported by surveyed executives held at a weighted average of US$188 million over the next twelve months, effectively unchanged from Q1, and 79% said AI would remain a top investment priority even if a recession arrived within the year. This is reported intent from 2,145 senior leaders at firms above $50m revenue, not booked spend.',
 'extracted', 'pp. 5, 9, 11', 4),

('building', 'The 2026 AI Index Report — Economy chapter', 'Stanford HAI', NULL,
 'https://hai.stanford.edu/ai-index/2026-ai-index-report/economy', 'academic', 'supports',
 'Google and Amazon led total annual capital expenditure in 2025, with Google reporting more than $150 billion. Citi Research data in the same chapter shows hyperscaler annual capex has more than doubled since ChatGPT''s release, alongside the $100-500 billion Stargate Project and Google''s $40 billion commitment to Texas data centres.',
 'extracted', 'p. 191 (printed)', 1),

('building', 'OECD Economic Outlook, Volume 2026 Issue 1', 'OECD', DATE '2026-06-01',
 'https://www.oecd.org/en/publications/2026/06/oecd-economic-outlook-volume-2026-issue-1_8be0dba6.html', 'official', 'supports',
 'The value of private data-centre construction in the United States rose steadily through 2025 and equalled the value of office construction in December 2025.',
 'extracted', 'p. 42, footnote 5 (printed)', 2),

-- === Growth & Productivity =================================================

('adoption', 'The State of AI: How Organizations Are Rewiring to Capture Value',
 'McKinsey & Company (QuantumBlack)', DATE '2025-03-01',
 'https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai-how-organizations-are-rewiring-to-capture-value', 'consulting', 'complicates',
 '78% of surveyed respondents said their organisations use AI in at least one business function, up from 72% in early 2024 and 55% a year earlier. The report states it deliberately left "adopted" undefined, so its own measure "spans from early experimentation by a few employees to AI being embedded across multiple business units that have entirely redesigned their business processes".',
 'extracted', 'p. 14 and footnote 3 (printed)', 1),

('adoption', 'The State of AI in the Enterprise: The untapped edge', 'Deloitte AI Institute', DATE '2026-01-01',
 'https://www.deloitte.com/global/en/issues/generative-ai/state-of-ai-in-enterprise.html', 'consulting', 'complicates',
 'Among firms already using AI daily, workforce access to sanctioned AI tools grew by half in a year — from under 40% to under 60% of workers — but fewer than 60% of those with access use it in their daily workflow, "a pattern that remains largely unchanged from last year". Deloitte''s own conclusion is that "enterprise AI remains underutilized". The sample screens out non-adopters by design, so no rate here is an economy-wide rate.',
 'extracted', 'p. 8', 2),

('adoption', 'The 2026 AI Index Report — Economy chapter', 'Stanford HAI', NULL,
 'https://hai.stanford.edu/ai-index/2026-ai-index-report/economy', 'academic', 'complicates',
 'Microsoft telemetry puts second-half-2025 population-level AI diffusion at 64.0% in the United Arab Emirates and 60.9% in Singapore, while the United States ranks 24th of the top 30 economies at 28.3% despite leading in AI investment and model development. Adoption correlates strongly and significantly with GDP per capita.',
 'extracted', 'pp. 200-201 (printed)', 3),

('adoption', 'Bridging Skill Gaps for the Future: New Jobs Creation in the AI Age',
 'International Monetary Fund', DATE '2026-01-01',
 'https://www.imf.org/-/media/files/publications/sdn/2026/english/sdnea2026001.pdf', 'official', 'supports',
 'AI skills appeared in fewer than 1% of US job postings before 2015 but in almost 5% by mid-2025, and now account for nearly a third of all new IT skills. Prevalence is far lower outside the leading economies: Brazil and South Africa sit below 2%. The note is candid that much of that gap "largely reflects the differences in occupational structure" rather than adoption itself.',
 'extracted', 'pp. 9, 11, 23', 4),

('productivity', 'Annual Economic Report 2026, Chapter I: Progress and peril',
 'Bank for International Settlements', DATE '2026-06-01',
 'https://www.bis.org/publ/arpdf/ar2026e1.htm', 'official', 'complicates',
 'Task-level studies consistently report large efficiency gains from AI, "often to the tune of between 20 and 50% in time savings", but aggregate productivity growth estimates "tend to be more conservative at less than 1% over a long horizon, reflecting challenges in adopting the technology at scale and integrating it with production processes".',
 'extracted', 'p. 19 (printed)', 1),

('productivity', 'The 2026 AI Index Report — Economy chapter', 'Stanford HAI', NULL,
 'https://hai.stanford.edu/ai-index/2026-ai-index-report/economy', 'academic', 'complicates',
 'US productivity growth reached 2.7% in 2025, nearly double the 1.4% average of the previous decade, which Brynjolfsson (2026) reads as the early stage of a J-curve, and a study of 12,000 European firms found AI adoption raised labour productivity by 4%. Against that, the Penn Wharton Budget Model puts AI''s current contribution to total factor productivity at +0.01 percentage points, described as "negligible".',
 'extracted', 'p. 220 (printed)', 2),

('productivity', '2026 Global AI Jobs Barometer', 'PwC', NULL,
 'https://www.pwc.com/gx/en/issues/artificial-intelligence/job-barometer/2026/2026-global-ai-jobs-barometer-full-report.pdf', 'consulting', 'complicates',
 'Measuring productivity as turnover per employee against a 2018 baseline, the most AI-exposed quartile of firms grew 33.5% by 2025 against 24.0% for the least exposed. PwC sets this against its own CEO survey finding that only 8% of CEOs report AI generated more than a slight revenue increase in the past year, concluding many companies are still experimenting. The firm sample covers only businesses above $50m turnover that survived the whole period.',
 'extracted', 'pp. 19-20', 3),

('productivity', 'The State of AI in the Enterprise: The untapped edge', 'Deloitte AI Institute', DATE '2026-01-01',
 'https://www.deloitte.com/global/en/issues/generative-ai/state-of-ai-in-enterprise.html', 'consulting', 'complicates',
 '66% of surveyed firms said they are already improving efficiency and productivity, but only 20% said they are already increasing revenue, against 74% who hope to. Deloitte''s framing: "revenue growth largely remains an aspiration." No magnitude of productivity gain is measured anywhere in the report.',
 'extracted', 'p. 10', 4),

('productivity', 'OECD Economic Outlook, Volume 2026 Issue 1', 'OECD', DATE '2026-06-01',
 'https://www.oecd.org/en/publications/2026/06/oecd-economic-outlook-volume-2026-issue-1_8be0dba6.html', 'official', 'supports',
 'In its United States note, the OECD observes that "productivity growth has strengthened modestly above its historical average and well above its pre-pandemic average... likely driven by the capital deepening linked to AI-related investment", while treating the durability of the pickup as an upside risk rather than a settled result.',
 'extracted', 'p. 291 (printed)', 5),

-- === Labour Markets ========================================================

('jobs', 'Annual Economic Report 2026, Chapter I: Progress and peril',
 'Bank for International Settlements', DATE '2026-06-01',
 'https://www.bis.org/publ/arpdf/ar2026e1.htm', 'official', 'complicates',
 '"To date, such disruptive labour displacements have yet to occur at scale", but US sectors more exposed to AI "have also seen higher productivity gains, partly at the expense of lower employment growth relative to other sectors", and more firms are signalling automation intent in earnings calls.',
 'extracted', 'p. 21 (printed)', 1),

('jobs', 'Bridging Skill Gaps for the Future: New Jobs Creation in the AI Age',
 'International Monetary Fund', DATE '2026-01-01',
 'https://www.imf.org/-/media/files/publications/sdn/2026/english/sdnea2026001.pdf', 'official', 'supports',
 'Demand for AI-related skills "has so far not boosted overall employment in US local labor markets", in contrast to non-AI new skills, which are associated with significantly higher employment. Five years on, commuting zones with 1 percentage point higher AI-skill demand show employment 6.3% lower in occupations highly exposed to AI with limited scope for complementarity. The wage impact is "overall insignificant".',
 'extracted', 'pp. 19-20', 2),

('jobs', '2026 Global AI Jobs Barometer', 'PwC', NULL,
 'https://www.pwc.com/gx/en/issues/artificial-intelligence/job-barometer/2026/2026-global-ai-jobs-barometer-full-report.pdf', 'consulting', 'contradicts',
 'Greater AI exposure is associated with headcount growth, not decline: on a 2018 baseline, average headcount at the most AI-exposed quartile of firms grew 52.2% by 2025 against 35.7% at the least exposed, with the gap widening every year since 2022. PwC notes the sample is restricted to firms above $50m turnover that survived the whole period, so the relative difference rather than the absolute rate is the intended reading.',
 'extracted', 'p. 20', 3),

('jobs', 'The 2026 AI Index Report — Economy chapter', 'Stanford HAI', NULL,
 'https://hai.stanford.edu/ai-index/2026-ai-index-report/economy', 'academic', 'contradicts',
 'From 2022 to early 2025 unemployment rose across all occupation groups regardless of AI exposure, and rose less among the most exposed: the rate for the most AI-exposed quintile rose 0.30 percentage points against 0.94 for the least exposed. The chapter states "AI exposure alone does not seem to be driving recent unemployment trends."',
 'extracted', 'p. 223 (printed)', 4),

('entry-level', 'The 2026 AI Index Report — Economy chapter', 'Stanford HAI', NULL,
 'https://hai.stanford.edu/ai-index/2026-ai-index-report/economy', 'academic', 'contradicts',
 'By September 2025 US employment for software developers aged 22-25 had fallen close to 20% from its 2022 peak, while headcount for older age groups continued to grow. Across occupations, employment for 22-25 year olds in the most AI-exposed roles has fallen roughly 16% relative to the least exposed after controlling for firm-type effects, with the gap widening from mid-2024.',
 'extracted', 'pp. 221-222 (printed)', 1),

('entry-level', 'Bridging Skill Gaps for the Future: New Jobs Creation in the AI Age',
 'International Monetary Fund', DATE '2026-01-01',
 'https://www.imf.org/-/media/files/publications/sdn/2026/english/sdnea2026001.pdf', 'official', 'contradicts',
 'Young workers are concentrated in occupations with high exposure and low complementarity to AI — roles that "often serve as steppingstones for young people in the career ladder" — and more so for the college-educated. The note cites Brynjolfsson, Chandar and Chen (2025) finding a 13% relative decline in employment since ChatGPT''s release for workers aged 22-25 in the most exposed occupations, while employment held or grew for less exposed fields and for more experienced workers in the same occupations. The 13% is quoted from that study, not the IMF''s own estimate.',
 'extracted', 'pp. 18-19', 2),

('entry-level', '2026 Global AI Jobs Barometer', 'PwC', NULL,
 'https://www.pwc.com/gx/en/issues/artificial-intelligence/job-barometer/2026/2026-global-ai-jobs-barometer-full-report.pdf', 'consulting', 'complicates',
 'In the most AI-exposed quartile, entry-level job postings have flatlined — the only quartile where they have — across Canada, Singapore, the UK and the US. 49% of CEOs expect AI adoption to decrease junior hiring over the next three years against 12% for senior hiring. Within that quartile in the US, entry-level roles that added ten or more traditionally senior skills grew 35% between 2019 and 2025 while those that did not fell 10%.',
 'extracted', 'pp. 11-13', 3),

('entry-level', 'The State of AI in the Enterprise: The untapped edge', 'Deloitte AI Institute', DATE '2026-01-01',
 'https://www.deloitte.com/global/en/issues/generative-ai/state-of-ai-in-enterprise.html', 'consulting', 'complicates',
 '36% of surveyed companies expect at least 10% of their jobs to be fully automated within a year and 82% within three years, and leaders in Deloitte''s interviews said entry-level work — "data entry, reconciliation, and first-level customer support" — is being prioritised for automation. Against that, 84% say they have not yet redesigned jobs around AI. These are expectations and interview accounts, not observed headcount change.',
 'extracted', 'pp. 12-13', 4),

('vacancies', 'OECD Economic Outlook, Volume 2026 Issue 1', 'OECD', DATE '2026-06-01',
 'https://www.oecd.org/en/publications/2026/06/oecd-economic-outlook-volume-2026-issue-1_8be0dba6.html', 'official', 'contradicts',
 'The OECD finds "no signs of widespread labour displacement due to business adoption of AI technologies at the industry level": vacancies in the industries most exposed to AI "have increased more than other sectors over the year to April 2026 in most economies with available data, with the United States being a notable exception". Exposure here is a sector proxy, not a task-level measure.',
 'extracted', 'pp. 25-26 (printed), Figure 1.11 Panel B', 1),

('vacancies', 'Bridging Skill Gaps for the Future: New Jobs Creation in the AI Age',
 'International Monetary Fund', DATE '2026-01-01',
 'https://www.imf.org/-/media/files/publications/sdn/2026/english/sdnea2026001.pdf', 'official', 'supports',
 'Over 2019-23, a one-standard-deviation higher AI adoption at US commuting-zone level in 2019 — about 0.18 percentage points, "comparable to the gap between Boston, MA, and Portland, OR" — is associated with a 0.4 percentage point lower vacancy share and 2.5% lower growth in high-exposure, low-complementarity vacancies relative to high-complementarity ones.',
 'extracted', 'p. 19', 2),

('vacancies', 'The 2026 AI Index Report — Economy chapter', 'Stanford HAI', NULL,
 'https://hai.stanford.edu/ai-index/2026-ai-index-report/economy', 'academic', 'background',
 'AI-skill job postings reached new peaks as a share of all postings in 2025: Singapore 4.69%, Hong Kong 3.5%, Luxembourg 3.4%, Spain 3.3%, the United States 2.6% and the United Kingdom 1.9%.',
 'extracted', 'p. 204 (printed)', 3),

-- === Prices & Markets ======================================================

('markets', 'Global Economic and Financial Implications of Artificial Intelligence',
 'International Monetary Fund', DATE '2026-04-03',
 'https://www.imf.org/en/publications/imf-notes/issues/2026/04/03/global-economic-and-financial-implications-of-artificial-intelligence-lessons-from-a-574924', 'official', 'background',
 'Reports that AI access costs continue to fall, with inference prices for certain frontier models dropping by over 99%, but argues diffusion is limited "not just by infrastructure but largely by regulatory uncertainty, compliance burdens, organizational inertia, and trust issues" — so cheaper access has not produced even adoption. No time window or model names are given for the 99% figure.',
 'extracted', 'pp. 5-6', 1),

('markets', 'Global AI Pulse, Q2 2026', 'KPMG International', DATE '2026-06-01',
 'https://kpmg.com/xx/en/our-insights/ai-and-technology/ai-pulse.html', 'consulting', 'background',
 'Cost rather than capability is now shaping deployment: 49% of surveyed organisations said they had questioned, delayed or scaled back AI-agent deployments "because the expected costs began to outweigh the value generated", and only 35% said their AI operating costs are fully visible and actively monitored.',
 'extracted', 'pp. 5-6, 12, 17-19', 2),

('power', 'OECD Economic Outlook, Volume 2026 Issue 1', 'OECD', DATE '2026-06-01',
 'https://www.oecd.org/en/publications/2026/06/oecd-economic-outlook-volume-2026-issue-1_8be0dba6.html', 'official', 'supports',
 'Energy accounts for 60% of data-centre operating costs, "making AI service costs highly sensitive to electricity prices", and economies generating a high share of electricity from imported fossil fuels are correspondingly more exposed to an energy price shock.',
 'extracted', 'p. 41, Box 1.3 (printed)', 1),

('power', 'Annual Economic Report 2026, Chapter I: Progress and peril',
 'Bank for International Settlements', DATE '2026-06-01',
 'https://www.bis.org/publ/arpdf/ar2026e1.htm', 'official', 'supports',
 '"The AI build-out has recently been facing growing bottlenecks in electricity, advanced semiconductors and grid equipment. Fast-growing demand for computing power is already pressuring electricity prices and input costs, with potential spillovers to inflation." No magnitude is attached to the price pressure.',
 'extracted', 'p. 22 (printed)', 2)

ON CONFLICT (question_id, lens_id, url) DO UPDATE SET
  title           = EXCLUDED.title,
  publisher       = EXCLUDED.publisher,
  published       = EXCLUDED.published,
  kind            = EXCLUDED.kind,
  stance          = EXCLUDED.stance,
  takeaway        = EXCLUDED.takeaway,
  takeaway_source = EXCLUDED.takeaway_source,
  takeaway_ref    = EXCLUDED.takeaway_ref,
  sort_order      = EXCLUDED.sort_order;

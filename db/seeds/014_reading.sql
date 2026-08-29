-- ============================================================================
-- 014_reading.sql — the outside literature, cited not copied
--
-- Twelve institutional and consulting reports on AI's economic effects. Only
-- the citation and the link are stored. The documents themselves are not in
-- this repository and must not be: most are free to read and link but not to
-- redistribute, and this repository is public.
--
-- WHAT IS DELIBERATELY MISSING
--
-- `takeaway` and `stance` are null on every row. Both are claims about what a
-- source found and how it sits against our answer, and neither can be written
-- from a title. Filling them means reading the reports, which is a separate
-- job done with a person — the same rule that governs every other claim here.
-- A takeaway paraphrased from an abstract nobody opened is worse than none,
-- because it looks like it was checked.
--
-- `published` uses the first of the month where only the month is known, which
-- is the ordinary convention for month-precision citations, and is null where
-- the date was not established rather than guessed at.
-- ============================================================================

INSERT INTO question_reading (lens_id, title, publisher, published, url, kind, sort_order) VALUES

-- ── Investment & Capital ────────────────────────────────────────────────────
-- The BIS chapter is the closest thing published to an institutional analysis
-- of AI capex circular financing between hyperscalers and labs, which is the
-- subject this lens exists for.
('investment',
 'Annual Economic Report 2026, Chapter I: Progress and peril',
 'Bank for International Settlements',
 DATE '2026-06-01',
 'https://www.bis.org/publ/arpdf/ar2026e1.htm',
 'official', 1),

('investment',
 'Economic growth through capital investment in GenAI',
 'EY',
 DATE '2026-05-01',
 'https://www.ey.com/en_gl/insights/ai/economic-growth-through-capital-investment-in-gen-ai',
 'consulting', 2),

-- ── Growth & Productivity ───────────────────────────────────────────────────
-- Adoption and return-on-investment surveys. Note these are self-reported by
-- firms with an interest in the answer, which is exactly the kind of thing the
-- `kind` column exists to make visible next to an academic finding.
('growth',
 'The State of AI: How Organizations Are Rewiring to Capture Value',
 'McKinsey & Company (QuantumBlack)',
 -- Cover reads March 2025; the survey behind it was fielded 16-31 July 2024.
 DATE '2025-03-01',
 'https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai-how-organizations-are-rewiring-to-capture-value',
 'consulting', 1),

('growth',
 -- The document's own subtitle. It carries no edition number.
 'The State of AI in the Enterprise: The untapped edge',
 'Deloitte AI Institute',
 DATE '2026-01-01',
 'https://www.deloitte.com/global/en/issues/generative-ai/state-of-ai-in-enterprise.html',
 'consulting', 2),

('growth',
 'Global AI Pulse, Q2 2026',
 'KPMG International',
 -- Publication number 140558-G gives June; April opened the fielding window.
 DATE '2026-06-01',
 'https://kpmg.com/xx/en/our-insights/ai-and-technology/ai-pulse.html',
 'consulting', 3),

('growth',
 'Pulse of Change: Business and Technology Trends 2026',
 'Accenture',
 NULL,
 'https://www.accenture.com/us-en/insights/pulse-of-change',
 'consulting', 4),

('growth',
 'The 2026 AI Index Report — Economy chapter',
 'Stanford HAI',
 NULL,
 'https://hai.stanford.edu/ai-index/2026-ai-index-report/economy',
 'academic', 5),

('growth',
 'OECD Economic Outlook, Volume 2026 Issue 1',
 'OECD',
 DATE '2026-06-01',
 'https://www.oecd.org/en/publications/2026/06/oecd-economic-outlook-volume-2026-issue-1_8be0dba6.html',
 'official', 6),

('growth',
 'Global Economic and Financial Implications of Artificial Intelligence',
 'International Monetary Fund',
 DATE '2026-04-03',
 'https://www.imf.org/en/publications/imf-notes/issues/2026/04/03/global-economic-and-financial-implications-of-artificial-intelligence-lessons-from-a-574924',
 'official', 7),

-- ── Labour Markets ──────────────────────────────────────────────────────────
('labour',
 '2026 Global AI Jobs Barometer',
 'PwC',
 NULL,
 'https://www.pwc.com/gx/en/issues/artificial-intelligence/job-barometer/2026/2026-global-ai-jobs-barometer-full-report.pdf',
 'consulting', 1),

('labour',
 -- Full printed title; IMF Staff Discussion Note SDN/2026/001.
 'Bridging Skill Gaps for the Future: New Jobs Creation in the AI Age',
 'International Monetary Fund',
 DATE '2026-01-01',
 'https://www.imf.org/-/media/files/publications/sdn/2026/english/sdnea2026001.pdf',
 'official', 2),

('labour',
 'Four Futures for Jobs in the New Economy: AI and Talent in 2030',
 'World Economic Forum',
 -- Printed January 2026, despite the 2025 in the publisher's filename.
 DATE '2026-01-01',
 'https://www.weforum.org/publications/four-futures-for-jobs-in-the-new-economy-ai-and-talent-in-2030/',
 'think_tank', 3)

-- takeaway/stance/takeaway_source/takeaway_ref are deliberately absent from
-- this SET list. They are owned by 018_reading_takeaways.sql, which runs
-- later; listing them here would blank a takeaway on every re-seed, since the
-- VALUES block above does not supply one. An ON CONFLICT list is a silent
-- filter on which of your edits actually apply, in both directions.
ON CONFLICT (question_id, lens_id, url) DO UPDATE SET
  title      = EXCLUDED.title,
  publisher  = EXCLUDED.publisher,
  published  = EXCLUDED.published,
  kind       = EXCLUDED.kind,
  sort_order = EXCLUDED.sort_order;

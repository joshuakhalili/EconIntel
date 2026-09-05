-- ═══════════════════════════════════════════════════════════════════════════
-- 051_research_promotions.sql — the first primary papers on the reading list
--
-- REQUIRES 0027_research_triage.sql. Migrations run before seeds, so a normal
-- `npm run db:reset` is fine; a seed run against an un-migrated database will
-- fail on the first INSERT here, which is the correct failure.
--
-- WHAT THIS FIXES
--
-- The reading list across every live page was 42 items — consulting decks,
-- multilateral reports and one Stanford HAI chapter — with not one primary
-- econometric paper on it. Four active pages are labelled `contested` on the
-- strength of methodological disagreement in the literature, and `entry-level`
-- carried its central finding at second hand through two different summaries
-- that gave two different numbers (16% from the AI Index, 13% from the IMF).
-- Both are from the same underlying paper, and neither number is that paper's
-- current one.
--
-- Three of the four contested pages now cite a primary paper directly. The
-- fourth, `vacancies`, does not: no paper was found and read in this pass that
-- speaks to vacancy response specifically, and a citation added without one is
-- the failure this file exists to end.
--
-- HOW EACH CITATION WAS ESTABLISHED
--
-- Every paper below was checked to exist before anything was written about it,
-- and the check differed by what each one has:
--
--   Bonfiglioli/Crinò/Gancia/Papadakis, and Acemoglu/Restrepo — DOI resolved
--     at Crossref, then title, authors, journal, volume and pages compared
--     against what is stored here.
--   Brynjolfsson/Chandar/Chen — no DOI exists. The Stanford Digital Economy
--     Lab's own page for the paper was fetched, the title and authors
--     confirmed on it, and the PDF it links downloaded and read.
--   Humlum/Vestergaard — TWO DOIs are indexed for this paper and they carry
--     different titles, which is the whole difficulty. Both resolved at
--     Crossref on 2026-09-04:
--       10.2139/ssrn.5219933  SSRN posted-content, 2025 → "Large Language
--                             Models, Small Labor Market Effects" — the
--                             superseded title.
--       10.3386/w33777        NBER report, issued May 2025 → "Still Waters,
--                             Rapid Currents: Early Labor Market
--                             Transformation under Generative AI" — the
--                             current title, and the one stored below.
--     An earlier draft of this header said the SSRN DOI was the ONLY one
--     indexed for the paper. That was wrong: the NBER DOI exists and is against
--     the right title. The NBER working-paper page was fetched anyway, title,
--     authors and both dates confirmed on it, and the PDF downloaded and read.
--
-- Nothing here is written from a search result.
--
-- `takeaway_source` is honest per row rather than uniform:
--
--   'reviewed'  — the full paper was downloaded and the cited page read.
--                 Brynjolfsson/Chandar/Chen and Humlum/Vestergaard.
--   'extracted' — only the published abstract was read, because the full text
--                 is behind a paywall and the open-access copy is a dead link.
--                 Bonfiglioli and others. The takeaway says so in its own text,
--                 so a reader is not left to infer it from a badge.
--
-- WHY THE TRIAGE ROWS ARE KEYED ON URL AND NOT ON documents.id
--
-- `documents.id` is a BIGSERIAL assigned at ingestion. It is stable in a given
-- database and meaningless across a rebuild, so a seed hard-coding it would
-- attach a decision to whatever paper happened to land in that slot next time.
-- The INSERT ... SELECT below finds the document by the URL the OpenAlex
-- adapter stores, and quietly inserts nothing when the corpus has not been
-- ingested — which is the right behaviour for a seed that runs against a fresh
-- database where `documents` is empty.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. TRIAGE DECISIONS ON THE CORPUS
--
-- Three rows out of 934, and the ratio is the point: this is the mechanism and
-- the first day's work, not a swept corpus. The other 931 stay `unreviewed` by
-- having no row, and `untriaged_research` is the worklist.
--
-- A NOTE ON WHAT THE CORPUS TURNED OUT TO HOLD
--
-- The corpus was searched for the papers the four contested pages actually
-- rest on. It does not contain Brynjolfsson, Chandar and Chen, and it does not
-- contain Humlum and Vestergaard — both are institutional working papers
-- outside the journal and NBER-DOI slices the OpenAlex query pulled. Its
-- highest-cited AI-and-labour hits are largely tangential (a Delphi study of
-- Finnish software engineers, a review in a sports-science journal). So the
-- corpus is a starting point for this work and not a boundary on it:
-- `question_reading` has never required a candidate row, and two of the four
-- citations below have none.
-- ───────────────────────────────────────────────────────────────────────────

-- Bonfiglioli, Crinò, Gancia and Papadakis (2024/25) — promoted to `jobs`.
INSERT INTO research_triage
  (document_id, status, reason, reviewer, decided_on, promoted_to_question)
SELECT d.id,
       'promoted',
       'Directly answers the identification question the `jobs` page says is contested: a shift-share instrument over US commuting zones, 2000-2020, finding robust negative employment effects of AI exposure. Cited on `jobs` from its published abstract; the full text could not be read (see the citation''s own takeaway).',
       'agent review pass, 4 September 2026',
       DATE '2026-09-04',
       'jobs'
  FROM documents d
 WHERE d.source_id = 'openalex'
   AND d.url = 'https://doi.org/10.1093/epolic/eiae059'
ON CONFLICT (document_id) DO UPDATE SET
  status               = EXCLUDED.status,
  reason               = EXCLUDED.reason,
  reviewer             = EXCLUDED.reviewer,
  decided_on           = EXCLUDED.decided_on,
  promoted_to_question = EXCLUDED.promoted_to_question,
  promoted_to_lens     = EXCLUDED.promoted_to_lens;

-- Acemoglu and Restrepo (2020), JPE 128(6) — shortlisted, blocked on access.
--
-- This is the design the IMF Staff Discussion Note says it follows for its own
-- commuting-zone estimates, so it is the methodological anchor under a claim
-- already live on `jobs`. It is not cited because it could not be read: the
-- Journal of Political Economy text is paywalled, and the open NBER draft
-- (w23285, 2017) is a different version with different coefficients. Citing
-- the JPE article while reading the working paper would attach numbers to a
-- reference that does not carry them.
INSERT INTO research_triage
  (document_id, status, reason, reviewer, decided_on)
SELECT d.id,
       'shortlisted',
       'The identification design the IMF Staff Discussion Note follows for the commuting-zone estimates already cited on `jobs`. DOI 10.1086/705716 verified at Crossref (Journal of Political Economy 128(6), pp. 2188-2244). Not promoted: the published text is paywalled and the open 2017 NBER draft reports different coefficients, so no number from it can be quoted against this reference. Promote once a readable copy of the published version is available.',
       'agent review pass, 4 September 2026',
       DATE '2026-09-04'
  FROM documents d
 WHERE d.source_id = 'openalex'
   AND d.url = 'https://doi.org/10.1086/705716'
ON CONFLICT (document_id) DO UPDATE SET
  status               = EXCLUDED.status,
  reason               = EXCLUDED.reason,
  reviewer             = EXCLUDED.reviewer,
  decided_on           = EXCLUDED.decided_on,
  promoted_to_question = NULL,
  promoted_to_lens     = NULL;

-- The same paper's 2017 NBER draft — rejected as a duplicate, not on merit.
--
-- The corpus holds both versions as separate documents. Recording the
-- rejection stops the next reader spending twenty minutes deciding which of
-- two identically-titled rows to cite.
INSERT INTO research_triage
  (document_id, status, reason, reviewer, decided_on)
SELECT d.id,
       'rejected',
       'Superseded 2017 working-paper draft of the Journal of Political Economy article at DOI 10.1086/705716, which is the same authors and the same title and is separately in this corpus. Rejected as a duplicate rather than on merit — if this literature is cited, cite the published version.',
       'agent review pass, 4 September 2026',
       DATE '2026-09-04'
  FROM documents d
 WHERE d.source_id = 'openalex'
   AND d.url = 'https://doi.org/10.3386/w23285'
ON CONFLICT (document_id) DO UPDATE SET
  status               = EXCLUDED.status,
  reason               = EXCLUDED.reason,
  reviewer             = EXCLUDED.reviewer,
  decided_on           = EXCLUDED.decided_on,
  promoted_to_question = NULL,
  promoted_to_lens     = NULL;


-- ───────────────────────────────────────────────────────────────────────────
-- 2. THE CITATIONS
--
-- `sort_order` 0 on the two Brynjolfsson/Chandar/Chen rows puts the primary
-- source above the summaries of it that are already on those pages. That is
-- the ordering the pages should have had.
--
-- DATES
--
--   Brynjolfsson, Chandar and Chen — 2026-08-12. The Stanford Digital Economy
--     Lab page for the paper reads "Working Paper, Revised August 12 2026" and
--     the PDF cover reads "August 2026". First circulated August 2025, which
--     is why the secondary sources on `entry-level` cite it as (2025); the
--     version cited here is the current one and its numbers differ.
--
--   Humlum and Vestergaard — 2026-03-01. NBER working paper 33777, whose own
--     page reads "Issue Date May 2025 / Revision Date March 2026" and whose
--     cover matches, so the first of the month by the convention
--     014_reading.sql set. The paper previously circulated as "Large Language
--     Models, Small Labor Market Effects" and is still indexed under that title
--     at DOI 10.2139/ssrn.5219933; the title stored here is the current one,
--     carried by the NBER page and by DOI 10.3386/w33777.
--
--   Bonfiglioli, Crinò, Gancia and Papadakis — 2024-11-25, the Crossref
--     `issued` date for online publication. OpenAlex records 2024-11-22 for
--     the same article and the print issue is dated January 2025. The
--     publisher's own date is used.
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO question_reading
  (question_id, title, publisher, published, url, kind, stance, takeaway,
   takeaway_source, takeaway_ref, sort_order)
VALUES

-- ── entry-level ────────────────────────────────────────────────────────────
-- The page's own answer is "these series say not yet", qualified by studies at
-- a finer grain. This is that study, first-hand, and it disagrees with the
-- page's headline series — hence `contradicts`.
('entry-level',
 'Canaries in the Coal Mine? Six Facts about the Recent Employment Effects of Artificial Intelligence',
 'Stanford Digital Economy Lab',
 DATE '2026-08-12',
 'https://digitaleconomy.stanford.edu/publication/canaries-in-the-coal-mine-six-facts-about-the-recent-employment-effects-of-artificial-intelligence/',
 'academic', 'contradicts',
 'The primary source this page has been citing at second hand. ADP payroll records covering millions of US workers through June 2026 show no economy-wide displacement, but employment of 22-25 year olds in AI-exposed occupations "now stands 19% below where it would be had it kept pace with that of their less-exposed peers", with no comparable gap for experienced workers, and the gap runs through reduced hiring rather than separations. It also reconciles the two figures quoted elsewhere on this page: the authors write that earlier versions headlined firm-fixed-effects estimates of a 13% relative decline on July 2025 data and 16% on September 2025 data, and that the descriptive measure they now use was 15% at the July 2025 vintage and 19% as of June 2026. They call these "early, descriptive indicators" rather than causal estimates.',
 'reviewed', 'Abstract and p. 3 (working paper, revised 12 August 2026)', 0),

-- ── jobs ───────────────────────────────────────────────────────────────────
-- Same paper, different question. `jobs` asks whether the exposed sector is
-- shrinking; this finds no aggregate shrinkage and a sharp effect inside one
-- age group, which is neither support nor contradiction — hence `complicates`.
('jobs',
 'Canaries in the Coal Mine? Six Facts about the Recent Employment Effects of Artificial Intelligence',
 'Stanford Digital Economy Lab',
 DATE '2026-08-12',
 'https://digitaleconomy.stanford.edu/publication/canaries-in-the-coal-mine-six-facts-about-the-recent-employment-effects-of-artificial-intelligence/',
 'academic', 'complicates',
 'Administrative payroll data on millions of US workers through June 2026. The first of its six facts is "no evidence of widespread, economy-wide job displacement"; the second is that employment of 22-25 year olds in AI-exposed occupations stands 19% below where it would be had it kept pace with less-exposed peers. The split that matters is by kind of use rather than by sector: declines concentrate in occupations where AI substitutes for human tasks, and where it complements workers employment is flat or rising. Adjustment runs through headcount rather than base pay. Offered by its authors as descriptive indicators, not causal estimates.',
 'reviewed', 'Abstract, facts (1), (2), (5) and (6) (working paper, revised 12 August 2026)', 0),

-- The commuting-zone study on the other side of the disagreement this page
-- names. Promoted out of the OpenAlex corpus — see section 1.
('jobs',
 'Artificial intelligence and jobs: evidence from US commuting zones',
 'Economic Policy (Oxford University Press)',
 DATE '2024-11-25',
 'https://doi.org/10.1093/epolic/eiae059',
 'academic', 'supports',
 'Estimates AI''s effect on employment across US commuting zones over 2000-2020, measuring local exposure by job growth in AI-related professions and instrumenting it with a shift-share that combines industry-level AI adoption with local industry employment. It reports "robust negative effects of AI exposure on employment across CZs and time", working through services more than manufacturing, most negative for low-skill and production workers and turning positive at the top of the wage distribution and in STEM occupations. Read from the published abstract only: the journal text is paywalled and the accepted manuscript''s open-access copy is a dead link, so no coefficient from the paper is quoted here.',
 'extracted', 'Abstract (Economic Policy 40(121), pp. 145-194)', 5),

-- ── clerical ───────────────────────────────────────────────────────────────
-- This page had no reading list at all, which for a page labelled `contested`
-- is the plainest version of the problem. Its caveat says an occupational
-- headcount cannot see work leaving a job that still has one person in it.
-- This paper looked with data that can see it, and found the same answer the
-- page gives — hence `supports`.
('clerical',
 'Still Waters, Rapid Currents: Early Labor Market Transformation under Generative AI',
 'National Bureau of Economic Research',
 DATE '2026-03-01',
 'https://www.nber.org/papers/w33777',
 'academic', 'supports',
 'Links large-scale AI-chatbot adoption surveys to Danish administrative payroll records. Adoption across exposed occupations is widespread and workers report productivity benefits, but difference-in-differences estimates give "precise null effects on earnings and recorded hours at both the worker and workplace levels, ruling out effects larger than 2%" two years after ChatGPT launched. What moves instead is the composition of the work: employers absorb AI through task reorganisation, including new tasks in content generation, AI oversight and AI integration. That is exactly the substitution an occupational headcount cannot see, measured by a study that could see it.',
 'reviewed', 'Abstract and p. 23 (NBER working paper 33777, May 2025, revised March 2026)', 1)

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

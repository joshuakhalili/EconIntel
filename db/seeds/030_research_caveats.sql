-- ═══════════════════════════════════════════════════════════════════════════
-- External corroboration for seven caveats.
--
-- On 2026-08-30 eight questions the database could not settle from its own
-- series were sent out as research prompts. The answers came back and are
-- filed in docs/research/. This applies them.
--
-- WHY THIS APPENDS RATHER THAN REPLACES
--
-- The existing caveats already state most of these objections, and state them
-- well — `chip-prices` already says the flattening may be about the dollar,
-- `frontier-compute` already says developers have gone quiet, `sector-jobs`
-- already says the over-hiring reading is indistinguishable in these series.
-- The research did not overturn any of them. It CORROBORATED them, and gave
-- each one a primary source.
--
-- So each caveat keeps its text and gains a sentence or two naming the
-- literature. Replacing prose that was right, with prose that is right and
-- newer, would lose the original reasoning for nothing.
--
-- WHAT IS DELIBERATELY NOT COPIED ACROSS
--
-- Figures. The research is a language model's output and this project's first
-- rule is that no figure or claim here is written by a model. Its numbers are
-- numbers it read somewhere, and the somewhere is the citable thing — so these
-- additions state what the literature ESTABLISHES and cite where to check it,
-- and do not restate second-hand values that were never verified at source.
--
-- Where a number would have been useful and is absent, that is why. The
-- own-account software share is the sharpest case: the research reports it as
-- roughly a fifth, the underlying BEA table would confirm it, and until
-- someone opens that table the caveat says "a substantial minority" instead.
--
-- EVERY URL BELOW WAS FETCHED AND RETURNED 200 ON 2026-08-30
--
-- Fifteen were checked; fifteen resolved. A model's bibliography is the
-- classic place for a fabricated reference, and this project has already
-- rejected six financing deals for dead source URLs.
--
-- NONE OF THIS ACTIVATES ANYTHING. Six of these pages are switched off and
-- stay switched off; the activation statement is written out at the end of
-- docs/research/blocked-questions-2026-08-30-verdicts.md and deliberately not
-- run. An answered methodological objection and publishable prose are
-- different things.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── chip-prices ────────────────────────────────────────────────────────────
-- The caveat already says the page cannot tell a real fall from a nominal one.
-- The literature goes further: the PPI is documented to understate
-- quality-adjusted declines, and has been since about 2006.
UPDATE questions SET caveat = caveat || E'\n\nThere is a second, larger measurement problem, and it is documented rather than suspected. Work at the Federal Reserve on hedonic microprocessor pricing found that quality-adjusted chip prices kept falling rapidly through a period when the official PPI had already flattened, and BLS published a revised quality-adjustment method in 2018 that produces faster declines than its own previous practice. No such quality-adjusted index has been published for the years this page covers, so the gap cannot be quantified here — but the direction of the bias is known, and it runs against the headline. See federalreserve.gov/econres/feds/how-fast-are-semiconductor-prices-falling.htm and bls.gov/opub/mlr/2018/article/a-new-approach-for-quality-adjusting-ppi-microprocessors.htm.',
       updated_at = now()
 WHERE slug = 'chip-prices' AND caveat NOT LIKE '%hedonic microprocessor pricing%';

-- ── frontier-compute ───────────────────────────────────────────────────────
-- The caveat says developers have become less forthcoming. The specific fact
-- is stronger than that and changes how the last point should be read.
UPDATE questions SET caveat = caveat || E'\n\nHow far that has gone is worth stating exactly: Epoch''s public database carries no training-compute estimate at all for closed-weight frontier models released after July 2025. The last dated record on this chart is therefore the last one anybody published, not the last one that happened, and the flat stretch at the end of the series is an absence of disclosure rather than an absence of scaling. Epoch''s own trend work over the same period has open-weight models crossing thresholds on schedule. See epoch.ai/data-insights/open-models-threshold.',
       updated_at = now()
 WHERE slug = 'frontier-compute' AND caveat NOT LIKE '%no training-compute estimate at all%';

-- ── sector-jobs ────────────────────────────────────────────────────────────
-- The caveat says the two explanations are indistinguishable here. There IS a
-- dataset that labels the cause, it is not free of its own problems, and it
-- does not settle the question either.
UPDATE questions SET caveat = caveat || E'\n\nOne dataset does label the cause, and it is worth knowing what it says and what it cannot say. Challenger, Gray & Christmas began coding artificial intelligence as a distinct reason for announced job cuts in 2023, and by 2026 it was leading their monthly rankings — while cost-cutting and restructuring still accounted for more cuts in total. These are announcements classified by the reason an employer gave, not measured separations, and an employer''s stated reason is a choice about how to describe a decision. Challenger''s own analysts attribute the technology-sector wave to AI adoption and a decade of over-hiring together, which is the same answer this page reaches from the other direction. No published work separates the two. See challengergray.com.',
       updated_at = now()
 WHERE slug = 'sector-jobs' AND caveat NOT LIKE '%Challenger, Gray%';

-- ── software-not-steel ─────────────────────────────────────────────────────
-- The caveat already names the own-account problem. What it lacks is the
-- scale of the component and the fact that BEA's method makes the link
-- mechanical rather than incidental.
UPDATE questions SET caveat = caveat || E'\n\nThat is not a subtle effect at the edge of the series. Own-account is a substantial minority of BEA''s software investment — the split between prepackaged, custom and own-account is published in its own tables — and BEA does not observe it at all, because there is no transaction to observe. It is estimated as the compensation of the programmers and analysts doing in-house development, plus intermediate inputs and a margin. So the link to programmer pay is mechanical by construction: the measure rises with wages unless real productivity in software development rose to offset it, which nothing in these series establishes. See the private fixed investment chapter of BEA''s NIPA handbook, bea.gov/resources/methodologies/nipa-handbook/pdf/chapter-06.pdf.',
       updated_at = now()
 WHERE slug = 'software-not-steel' AND caveat NOT LIKE '%no transaction to observe%';

-- ── bulk-discount ──────────────────────────────────────────────────────────
-- This one is a RESOLVED doubt rather than a new one, and saying so is the
-- point: a reader should know the twenty-year comparison was checked.
UPDATE questions SET caveat = caveat || E'\n\nOne objection to this comparison can be ruled out. The consumption bands are not a Eurostat convention that could quietly have been redrawn mid-series: they are fixed by Regulation (EU) 2016/1952 and its implementing act, the top band has meant the same thing throughout, and the series runs on those definitions from 2007. A methodological transition around 2016 and 2017 changed the legal basis, the treatment of taxes and levies, and some national sampling — so readings either side of it are not perfectly like for like — but the band thresholds themselves did not move, and the long comparison this page makes is a real one. See eur-lex.europa.eu/eli/reg/2016/1952/oj.',
       updated_at = now()
 WHERE slug = 'bulk-discount' AND caveat NOT LIKE '%Regulation (EU) 2016/1952%';

-- ── when-noticed ───────────────────────────────────────────────────────────
-- The caveat says a count of documents is a count of documents. The missing
-- piece is that there is nothing external to check it against, which makes
-- the framing of the claim itself the thing that has to change.
UPDATE questions SET caveat = caveat || E'\n\nAnd there is nothing to check it against. No organisation publishes a year-by-year count of Federal Register documents mentioning AI reaching back to the 2000s: Stanford''s AI Index counts AI-related regulations and reports the recent surge, but that is a different quantity over a different period, and the live trackers that query the same API do not publish history. So this count is entirely this project''s own, produced by its own keyword matching, and no independent series exists that would confirm or contradict the break it finds. Read it as a measurement of when a phrase entered federal writing, which is what it is, and not as a measurement of when the state began to act. See hai.stanford.edu for the nearest published alternative.',
       updated_at = now()
 WHERE slug = 'when-noticed' AND caveat NOT LIKE '%nothing to check it against%';

-- ── adoption ───────────────────────────────────────────────────────────────
-- The only one of the seven that is LIVE, which makes it the most urgent: the
-- page has been showing a near-doubling without knowing whether the survey
-- question changed underneath it. It did not.
UPDATE questions SET caveat = caveat || E'\n\nThe sharp rise between the 2023 and 2024 waves was checked against the survey itself rather than assumed to be real. Eurostat''s model questionnaire asks whether a firm used at least one of a listed set of AI technologies, and that construction and its list are the same across the waves; Eurostat treats the increase as a change in behaviour rather than a break in series, and the OECD''s equivalent indicator is defined consistently over the same period. So the jump is diffusion, not a redefinition. What remains true is that the question is new — 2023 was the first harmonised wave — so national implementations are still settling, and minor local variation would not be visible in the harmonised European metadata. See ec.europa.eu/eurostat/statistics-explained under "Use of artificial intelligence in enterprises".',
       updated_at = now()
 WHERE slug = 'adoption' AND caveat NOT LIKE '%first harmonised wave%';

-- ── the-buildings ──────────────────────────────────────────────────────────
-- NOT updated. The research could not settle it: Census's experimental
-- subnational tables appear to carry a computer-and-electronic-products
-- category, but the sector code and series identifier are unconfirmed and no
-- FRED series exists. Adding a caveat that says "we looked and could not find
-- out" would be noise; the honest record is in the verdicts file, and the page
-- stays off until the series is actually ingested.

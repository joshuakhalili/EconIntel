-- ============================================================================
-- 015_question_reasoning.sql — the reasoning behind each answer
--
-- Fills the columns 0012_editorial.sql added: what mechanism is being claimed,
-- how this page measures it, how strong the evidence is, and when a person
-- last checked the prose against the data.
--
-- Kept separate from 009_questions.sql, which defines the questions
-- themselves, because these are a different kind of statement: 009 says what a
-- page IS, this says what it CLAIMS and how far the claim can be pushed. They
-- also change on different schedules — a question's title is settled, its
-- strength is not.
--
-- Every figure below is read from the series on the page. Where a number
-- appears in prose it is the value the chart shows, not a remembered one:
--   US fixed investment in information-processing equipment and software
--     $1,612.9bn, 2026 Q2 (fred.A679RC1Q027SBEA)
--   Data-centre structures                $31.1bn 2024, from $9.2bn 2020
--     (dbn.BEA.NIPA-T50405.LA001282-A)
--   Announced data-centre capacity        1,946 MW 2025, from 8 MW 2010
--     (derived.datacentre_capacity_mw)
--   US later-stage venture capital        $101.9bn 2025 (OECD)
-- ============================================================================

-- ── Investment & Capital ────────────────────────────────────────────────────

UPDATE questions SET
  theory = 'Capital spending is the earliest thing an AI boom makes visible. '
           'Before anything shows up in output or employment, somebody has to '
           'buy the equipment and pour the concrete — so investment leads any '
           'productivity effect by years, and its absence would be the '
           'strongest possible evidence against the whole story. That makes '
           'this the one lens where the data is not in dispute.',

  method = 'Three levels, deliberately, because each is wrong in a different '
           'direction. BEA fixed investment in information-processing '
           'equipment and software is the broad measure and includes a great '
           'deal that has nothing to do with AI. The data-centre structures '
           'line from NIPA table 5.4.5 is narrow enough to be specific and '
           'short enough to be fragile — it begins in 2020. Manufacturing '
           'construction and later-stage venture capital are cross-checks '
           'from different collectors, so agreement between them is worth '
           'more than any single series. Figures are nominal and quarterly at '
           'a seasonally adjusted annual rate.',

  strength = 'consistent',
  last_reviewed = DATE '2026-08-28'
WHERE id = 'money';

UPDATE questions SET
  theory = 'A model needs a building, a power connection and chips. That makes '
           'physical build-out the least exaggerable measure available here: '
           'a company can describe its AI strategy however it likes, but the '
           'transformers either exist or they do not, and the electricity '
           'either got generated or it did not.',

  method = 'Announced capacity comes from Epoch AI''s register of disclosed '
           'clusters, which is a documented LOWER BOUND — it counts what has '
           'been made public and nothing else. Electricity generation and '
           'industrial retail sales are the independent check: a data centre '
           'that exists draws power whether or not anyone announced it, so a '
           'build-out invisible in the register should still bend the load '
           'curve. Chip output and new orders sit upstream of both.',

  strength = 'suggestive',
  last_reviewed = DATE '2026-08-28'
WHERE id = 'building';

-- ── Growth & Productivity ───────────────────────────────────────────────────

UPDATE questions SET
  theory = 'Adoption has to precede effect. If AI raises output per hour, the '
           'firms using it must first exist in measurable numbers — so a wide '
           'adoption rate is a necessary condition for the productivity story, '
           'and not remotely a sufficient one.',

  method = 'Three independent measures that disagree on level and agree on '
           'direction, which is the expected result rather than a problem. '
           'Enterprise surveys ask firms what they do. SEC filing incidence '
           'observes what they tell a regulator under liability. Cloud uptake '
           'measures the precondition. The gap between the survey rate and '
           'the filing rate is itself informative: saying is not doing.',

  strength = 'consistent',
  last_reviewed = DATE '2026-08-28'
WHERE id = 'adoption';

UPDATE questions SET
  theory = 'This is Solow''s paradox restated for a new technology: if AI '
           'raises productivity, it should appear as output per hour rising '
           'faster than it otherwise would. The mechanism is not in doubt; '
           'whether it has happened yet, at a scale the national accounts can '
           'detect, is the whole question.',

  method = 'Labour productivity and unit labour costs, read against adoption '
           'rather than in isolation. The honest position is that these '
           'series cannot yet settle it: aggregate productivity is noisy, '
           'revised heavily, and lagged by quarters, so an effect of the size '
           'plausibly available this early would sit inside the error. An '
           'absence of signal here is therefore weak evidence of an absence '
           'of effect, and this page should not be read as finding one.',

  strength = 'insufficient',
  last_reviewed = DATE '2026-08-28'
WHERE id = 'productivity';

-- ── Labour Markets ──────────────────────────────────────────────────────────

UPDATE questions SET
  theory = 'If AI substitutes for tasks rather than for whole jobs, the first '
           'visible effect is on the jobs that are mostly those tasks — '
           'entry-level work in exposed sectors. That predicts the bottom rung '
           'of a career ladder thins before any aggregate employment number '
           'moves, which is why the youth and graduate series are here rather '
           'than the headline rate.',

  method = 'Comparison, not level: an exposed group against a control that '
           'shares its macro shocks. Information-sector employment as a share '
           'of total non-farm payrolls cancels the business cycle affecting '
           'both. Vacancies lead employment because hiring intent adjusts '
           'before headcount does. The youth panel is OECD-harmonised across '
           'ten countries, so a national quirk shows up as one line moving '
           'rather than the finding.',

  strength = 'suggestive',
  last_reviewed = DATE '2026-08-28'
WHERE id = 'jobs';

-- ── Prices & Markets ────────────────────────────────────────────────────────

UPDATE questions SET
  theory = 'Two prices move in opposite directions and the gap between them is '
           'the economics of this whole subject. Computation gets cheaper '
           'roughly without limit, because it is a manufactured good subject '
           'to learning effects. The electricity, copper and land it runs on '
           'do not, because they are extracted and built. Whether AI diffuses '
           'depends on which of those wins.',

  method = 'Producer price indices for semiconductors and for data-processing '
           'services measure the falling cost of compute. Commodity and '
           'energy prices measure the rising cost of the physical complement '
           '— the same series appear on Investment & Capital, read there as '
           'input costs to build-out rather than as market signals. None of '
           'this establishes causation with respect to AI; it is the price '
           'environment the rest of the dashboard has to be read against.',

  strength = 'consistent',
  last_reviewed = DATE '2026-08-28'
WHERE id = 'markets';

-- ── Policy & Regulation ─────────────────────────────────────────────────────

UPDATE questions SET
  theory = 'Regulation is a lagging indicator of perceived impact: governments '
           'legislate about technologies once those technologies have already '
           'changed something. The volume and, more importantly, the ENFORCE'
           'ABILITY of AI rulemaking is therefore a read on how seriously the '
           'state takes the change — not on whether the change is real.',

  method = 'Federal Register documents matched on six AI terms, deduplicated '
           'on document number, split by type. The split is the point: a Rule '
           'is enforceable, a Proposed Rule carries a comment period and leads '
           'a Rule by 12 to 24 months where it converts at all, and a '
           'Presidential Document is unilateral and reversible by the next '
           'administration. Counting them together would make attention look '
           'like law.',

  strength = 'insufficient',
  last_reviewed = DATE '2026-08-28'
WHERE id = 'policy';

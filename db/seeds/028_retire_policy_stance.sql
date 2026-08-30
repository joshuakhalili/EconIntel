-- ═══════════════════════════════════════════════════════════════════════════
-- Retire the two policy stance indicators.
--
-- `derived.policy_investment_stance` and `derived.policy_regulation_stance`
-- have been declared and empty since 004. They were never half-built: there is
-- no computation, no stub, no dead function. The `policy_classifications`
-- table and the `policy_stance` enum are fully specified in 0004_documents.sql
-- and read by exactly zero lines of JavaScript.
--
-- WHY RETIRE RATHER THAN BUILD
--
-- Producing them would be this project's first LLM call site, and it would be
-- the wrong first one.
--
-- The governing rule here is that a model is never asked to invent a number or
-- a citation — only handed SQL-computed values and stored claims and asked to
-- connect them in a sentence. That rule is written for NARRATION: the figures
-- exist before the model is called, and the model's output can be checked
-- against them.
--
-- A stance classifier does the inverse. It PRODUCES `investment_score = -37`
-- where no stored value exists, and nothing downstream can check it, because
-- there is nothing to check it against. The score IS the model's opinion. The
-- schema even admits this — `confidence_tier = 'news_derived'`, and the
-- comment above the definition in 004 says outright that these are "the
-- opinion of a model about a document, not a measurement".
--
-- A site whose first rule is that no figure is written by a model cannot have
-- a chart whose every point is. So the honest options were: build it and
-- label it unmistakably as model opinion, or do not ship it. Two indicators
-- that have sat empty for the project's whole life are not the place to spend
-- that credibility.
--
-- FOLLOWING THE PRECEDENT IN 008
--
-- `derived.datacentre_investment` was retired the same way when a real
-- measurement was found to replace it: `is_active = FALSE`, row kept. Kept
-- rather than deleted because `observations` references `indicators` and
-- because a deleted row loses the record that the decision was ever taken —
-- the next person to notice the gap re-proposes the same feature.
--
-- WHAT IS NOT TOUCHED
--
-- The `policy_classifications` table and the `policy_stance` enum stay. They
-- are correct schema for a feature that may yet be built deliberately, they
-- cost nothing empty, and dropping them would be a migration rather than a
-- seed. `derived.ai_binding_rules`, `derived.ai_proposed_rules` and
-- `derived.ai_regulation_volume` are untouched and are what the Policy lens
-- actually draws: counts of documents, computed in SQL, with no model
-- anywhere near them.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE indicators
   SET is_active = FALSE,
       description = description ||
         ' RETIRED 2026-08-30: never computed. Producing this requires a model to' ||
         ' invent a score with no stored value behind it, which is the opposite of' ||
         ' the rule this project holds. See db/seeds/028_retire_policy_stance.sql.',
       updated_at = now()
 WHERE id IN ('derived.policy_investment_stance', 'derived.policy_regulation_stance')
   AND is_active;

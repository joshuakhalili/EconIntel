-- ============================================================================
-- 0024_published_scenarios_offer_a_country.sql
--
-- Two consequences of the same discovery: /simulate/:slug shipped dead.
--
-- WHAT HAPPENED
--
-- 0023 built the tables, the engine got its equations, the repository got its
-- cache, the route got registered, the page got written and the tests passed.
-- Zero rows were ever inserted into `simulation_scenarios`. `listScenarios()`
-- returned an empty array, `getScenario()` returned null, and every request to
-- /simulate/:slug answered 404 — in production, for as long as it existed.
--
-- Nothing caught it, and the reason is worth writing down because it will
-- recur. `unrunnable_scenarios` (0023) is `CROSS JOIN LATERAL unnest(countries)`
-- with `HAVING count(param_key) = 0`. Over an empty table it returns no rows,
-- which is indistinguishable from a pass. So does every other check in
-- `scripts/check-data.js`. An empty table satisfies every constraint anybody
-- writes about its contents, because a constraint is a statement about rows.
--
-- WHAT THIS MIGRATION CAN AND CANNOT FIX
--
-- It cannot fix the empty-table case. No CHECK, no view and no trigger can:
-- they are all quantified over rows that do not exist. That half of the fix is
-- necessarily outside the database, and it lives in `check-data.js` as a check
-- that every route in APP_ROUTES has something behind it.
--
-- What it CAN fix is the shape one step in from that, which was equally
-- reachable and equally silent: `countries` defaults to '{}' and `status` is
-- an independent column, so a scenario could be flipped to 'published' with an
-- empty country array. That renders a thesis, a caveat, a set of sliders and a
-- country picker with nothing in it — a page that looks finished and can
-- compute nothing. The view above would have reported it clean for exactly the
-- same reason: unnesting an empty array produces no rows to complain about.
--
-- A draft may of course offer no countries. That is what a draft IS here — a
-- scenario whose parameter research is not finished — and constraining it
-- would make the honest intermediate state unrepresentable.
-- ============================================================================

ALTER TABLE simulation_scenarios
  ADD CONSTRAINT simulation_scenarios_published_offers_a_country
    CHECK (status = 'draft' OR cardinality(countries) > 0);

COMMENT ON CONSTRAINT simulation_scenarios_published_offers_a_country
  ON simulation_scenarios IS
  'A published scenario must offer at least one country. An empty array is not '
  'caught by unrunnable_scenarios, because unnesting it yields no rows to fail.';


-- ---------------------------------------------------------------------------
-- Retire `multiplier_decay`.
--
-- The engine used to compute the fiscal multiplier as a geometric decay from
-- its year-one value. That parameter has been removed from the model, for the
-- reason set out at length in `REQUIRED_PARAMS` in `src/server/lib/simulation.js`:
-- no source publishes a decay rate for a fiscal multiplier, and both IMF
-- sources say the investment multiplier RISES over the five years this model
-- runs. It is replaced by `fiscal_multiplier_y1` … `_y5`, one cited cell per
-- year, from IMF WP/15/95 Table 1 column (1).
--
-- A leftover row would not break anything, which is precisely why it has to
-- go. `getScenario()` returns every parameter row for a scenario and the page
-- lists them under its citations, so a retired coefficient would keep
-- appearing in the provenance panel — cited, plausible, and read by nothing.
-- A citation for a number the model does not use is worse than no citation at
-- all: it is evidence of care that is not being taken.
--
-- Expected to affect nothing today; the table is empty. It is here so that a
-- database seeded from an earlier checkout converges on the same state.
-- ---------------------------------------------------------------------------
DELETE FROM simulation_parameters WHERE param_key = 'multiplier_decay';

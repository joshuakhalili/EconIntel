-- ============================================================================
-- 0023_simulations.sql — scenarios, and the citations that make them honest
--
-- Every other number in this database was measured by somebody. A simulated
-- number was not: it is arithmetic this project performed on assumptions this
-- project chose. That is a different kind of fact, and the schema has to say so
-- or the site starts quietly mixing the two.
--
-- THE RULE THIS MIGRATION EXISTS TO ENFORCE
--
--   No coefficient enters a simulation without a published source behind it.
--
-- The alternative was to estimate our own coefficients from `observations`.
-- That was considered and rejected: most countries in this database carry the
-- same six annual World Bank series, and no amount of regression on six series
-- can separate "investment raised wages" from "a boom raised both at once".
-- Shipping a number derived that way would be inventing econometrics and
-- calling it evidence — precisely what this project exists not to do.
--
-- So the model's parameters are LOOKED UP, not fitted. Each one is a published
-- estimate — an IMF fiscal multiplier, an OECD Phillips-curve slope — carried
-- here with the citation attached to the row, `NOT NULL`. This is the same
-- discipline `events_require_evidence` applies to deals in 0020: a row that
-- cannot say where it came from should not be insertable.
--
-- WHAT A SIMULATION IS, IN THIS SCHEMA
--
-- A scenario is shaped like a lens: a page with a thesis, a caveat, and
-- something computed underneath. The difference is where its hero numbers come
-- from — a lens reads `observations`, a scenario runs `lib/simulation.js` over
-- a parameter set. Everything downstream (charts, narration, provenance) then
-- works the way it already does, which is why this reuses `confidence_tier`,
-- the `sources` registry and the `narrations` cache rather than inventing
-- parallel machinery for any of them.
--
-- Simulated output is `modelled` tier, always. It is not `derived` — that tier
-- means deterministic SQL over official inputs, and this is arithmetic over
-- assumptions. The distinction is the whole point.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The scenarios themselves.
--
-- Shaped after `lenses` (0010) on purpose: id/slug/name, a thesis in two
-- registers, sort order. A reader arriving at either kind of page should meet
-- the same furniture.
--
-- `caveat` is the one addition, and it is NOT NULL. A lens may omit its
-- caveats because its numbers were measured by a statistical agency. A
-- simulation may not: the honest sentence about what the model cannot tell you
-- is part of the output, not an optional footnote, and making it nullable would
-- make it the first thing dropped under deadline.
-- ---------------------------------------------------------------------------
CREATE TABLE simulation_scenarios (
  id            TEXT PRIMARY KEY,          -- 'ai-capex-dotcom'
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  subtitle      TEXT,

  thesis_plain  TEXT,
  thesis_expert TEXT,

  /**
   * What this model cannot tell you, in plain words, shown on the page.
   * Required — see the note above.
   */
  caveat        TEXT NOT NULL CHECK (length(btrim(caveat)) >= 40),

  /** How many years forward the equations are run. */
  horizon_years SMALLINT NOT NULL DEFAULT 5
                  CHECK (horizon_years BETWEEN 1 AND 20),

  /**
   * Which equation set in `lib/simulation.js` runs this scenario. A TEXT key
   * rather than an enum because the registry lives in JavaScript, and a new
   * model shape is a code change that would otherwise need a migration to go
   * with it for no benefit.
   */
  model_key     TEXT NOT NULL,

  /**
   * Countries this scenario can actually run for.
   *
   * Not "the G7" and not every row in `countries` — the list of countries whose
   * parameter set is COMPLETE. A country with three of the seven coefficients
   * researched does not belong here, because `runScenario()` throws on a
   * missing parameter rather than defaulting one, and the UI must not offer a
   * country that will throw. Widening this array is the last step of adding a
   * country, never the first.
   */
  countries     CHAR(3)[] NOT NULL DEFAULT '{}',

  /**
   * Draft scenarios are invisible to readers.
   *
   * Deliberately not `is_active`. That column elsewhere means "temporarily
   * hidden"; this means "not finished being written", which is a different
   * state with a different fix. Several scenarios are authored in parallel and
   * a half-researched parameter set must not be one merge away from the
   * public site.
   */
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published')),

  sort_order    SMALLINT NOT NULL DEFAULT 0,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX simulation_scenarios_order_idx
  ON simulation_scenarios (sort_order) WHERE status = 'published';

COMMENT ON COLUMN simulation_scenarios.countries IS
  'Countries with a COMPLETE parameter set. The UI offers only these, because '
  'a missing parameter throws rather than defaulting.';


-- ---------------------------------------------------------------------------
-- The inputs a reader can move.
--
-- Stored rather than hardcoded in the client so that a scenario is a content
-- object, not a component: adding a slider is a seed row, and the server can
-- validate against the same bounds the UI renders from. Two copies of a range
-- — one in JSX, one in a validator — drift, and the drift shows up as a 400 on
-- a slider the user can physically reach.
-- ---------------------------------------------------------------------------
CREATE TABLE simulation_inputs (
  scenario_id   TEXT NOT NULL REFERENCES simulation_scenarios(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,             -- 'shock_usd_bn', matches a name the model reads
  label         TEXT NOT NULL,             -- 'One-off investment injection'
  unit          TEXT NOT NULL,             -- 'usd_bn', 'percent'
  unit_symbol   TEXT,                      -- '$bn', '%'

  min_value     NUMERIC NOT NULL,
  max_value     NUMERIC NOT NULL,
  default_value NUMERIC NOT NULL,
  step          NUMERIC NOT NULL DEFAULT 1 CHECK (step > 0),

  /** One line under the control: what this lever means in the real world. */
  help_text     TEXT,

  sort_order    SMALLINT NOT NULL DEFAULT 0,

  PRIMARY KEY (scenario_id, key),

  CONSTRAINT simulation_inputs_range CHECK (min_value < max_value),
  CONSTRAINT simulation_inputs_default_in_range
    CHECK (default_value BETWEEN min_value AND max_value)
);

CREATE INDEX simulation_inputs_order_idx ON simulation_inputs (scenario_id, sort_order);


-- ---------------------------------------------------------------------------
-- The published coefficients. The point of the whole feature.
--
-- One row per (scenario, country, parameter). `citation_text` is NOT NULL and
-- non-trivial: this is where "we cite research rather than invent econometrics"
-- stops being a claim in a design document and becomes something the database
-- refuses to violate.
--
-- `source_id` is nullable and `citation_text` is not, which is the deliberate
-- way round. The `sources` registry exists for things we INGEST from; a working
-- paper cited once is not a data feed and should not need a registry row to be
-- usable. What must never be absent is the human-readable pointer that lets a
-- reader find the number in the original.
-- ---------------------------------------------------------------------------
CREATE TABLE simulation_parameters (
  scenario_id     TEXT NOT NULL REFERENCES simulation_scenarios(id) ON DELETE CASCADE,
  country_iso3    CHAR(3) NOT NULL REFERENCES countries(iso3),
  param_key       TEXT NOT NULL,           -- 'okun_coefficient', 'fiscal_multiplier_y1'

  value           NUMERIC NOT NULL,

  /**
   * The published uncertainty, where the source states one.
   *
   * Carried because a fiscal multiplier of 0.8 with a published range of 0.4
   * to 1.2 is a materially different claim from 0.8 with a tight standard
   * error, and a simulation that shows only the point estimate implies a
   * precision the literature does not have. Nullable: plenty of sources give
   * a point estimate and nothing else, and inventing a range for them would be
   * exactly the sin this table is built to prevent.
   */
  value_low       NUMERIC,
  value_high      NUMERIC,

  /** Almost always 'modelled' — a published econometric estimate. */
  confidence_tier confidence_tier NOT NULL DEFAULT 'modelled',

  /** Optional link to the provider registry, when the publisher is one we ingest. */
  source_id       TEXT REFERENCES sources(id),

  /**
   * Where this number came from, precisely enough to find it again.
   *
   * The bar is the same as `sources.attribution_text`: not "the IMF" but the
   * paper, the table, the row. A citation that cannot be followed is not a
   * citation, and this column is the only thing standing between a cited model
   * and a made-up one.
   */
  citation_text   TEXT NOT NULL CHECK (length(btrim(citation_text)) >= 20),
  citation_url    TEXT,

  /** Which period the estimate describes — vintage matters for a coefficient. */
  as_of_year      SMALLINT,

  /**
   * Anything a reader deserves to know about this specific number — most often
   * that it is a stand-in. Where no country-specific estimate exists, using a
   * neighbour's is defensible; doing it silently is not.
   */
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (scenario_id, country_iso3, param_key),

  CONSTRAINT simulation_parameters_interval
    CHECK (value_low IS NULL OR value_high IS NULL OR value_low <= value_high)
);

CREATE INDEX simulation_parameters_lookup_idx
  ON simulation_parameters (scenario_id, country_iso3);

COMMENT ON TABLE simulation_parameters IS
  'Published coefficients, one per row, each with a citation. Nothing is '
  'estimated from this database''s own observations — see the header of '
  '0023_simulations.sql for why.';


-- ---------------------------------------------------------------------------
-- Computed runs, cached.
--
-- The engine is pure arithmetic over a handful of parameters, so this is not a
-- performance necessity — a run costs microseconds and could be recomputed on
-- every request. It is here for three things that are not speed:
--
--   1. Shareable results. A permalink to "this scenario, these inputs" needs
--      the run to survive the request that made it.
--   2. Narration. `narrations` keys on a hash of its grounding, and the
--      grounding for a scenario IS the run's results — so the run has to be
--      addressable by the same hash to connect the two.
--   3. Regression evidence. When the equations change, `model_version` moves
--      and the old rows stay, which makes "did this change what the site
--      says?" an answerable question rather than a memory.
--
-- Same cache shape as `narrations`: hash the inputs, key on the hash, bump a
-- version to invalidate everything at once.
-- ---------------------------------------------------------------------------
CREATE TABLE simulation_runs (
  id            BIGSERIAL PRIMARY KEY,
  scenario_id   TEXT NOT NULL REFERENCES simulation_scenarios(id) ON DELETE CASCADE,
  country_iso3  CHAR(3) NOT NULL REFERENCES countries(iso3),

  /** The slider values, exactly as supplied. */
  inputs        JSONB NOT NULL,
  /** sha256 over (scenario, country, canonicalised inputs). */
  input_hash    TEXT NOT NULL,

  /** Year-by-year output series. The only numbers narration may speak about. */
  results       JSONB NOT NULL,

  model_key     TEXT NOT NULL,
  /** Bump to invalidate every cached run — mirrors narration's PROMPT_VERSION. */
  model_version TEXT NOT NULL,

  computed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT simulation_runs_cache_uniq
    UNIQUE (scenario_id, country_iso3, input_hash, model_version)
);

CREATE INDEX simulation_runs_recent_idx
  ON simulation_runs (scenario_id, computed_at DESC);


/**
 * Scenarios that cannot run.
 *
 * The counterpart to `empty_lenses` in 0010, and it catches the specific
 * failure this feature is prone to: a scenario published with a country in its
 * `countries` array that has no parameter rows, which throws at request time
 * rather than rendering wrong — visible to a reader as a broken page, and to
 * nobody at all until a reader finds it.
 */
CREATE VIEW unrunnable_scenarios AS
SELECT s.id,
       s.name,
       s.status,
       c.iso3                                   AS country_iso3,
       count(p.param_key)::int                  AS parameter_count
  FROM simulation_scenarios s
  CROSS JOIN LATERAL unnest(s.countries) AS c(iso3)
  LEFT JOIN simulation_parameters p
         ON p.scenario_id = s.id AND p.country_iso3 = c.iso3
 GROUP BY s.id, s.name, s.status, c.iso3
HAVING count(p.param_key) = 0;

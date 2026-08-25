-- ============================================================================
-- 0008_indicator_country.sql — where a single-country series belongs
--
-- The original model assumed geography arrives with the data: World Bank
-- returns a country per row, so the adapter can read it off each observation.
--
-- That assumption breaks for national statistics offices. ONS publishes UK
-- productivity, China's NBS publishes Chinese integrated-circuit output, the
-- Bank of Japan publishes Japanese services prices. None of them state the
-- country in the payload, because from their side it is obvious. The country is
-- a property of the SERIES, not of the observation.
--
-- The alternative was inferring geography from the series code. Provider code
-- layouts share no convention whatsoever — compare ONS/PRDY/DJR5.Q against
-- NBS/A_A0E0H/A0E0H28 against Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC
-- — so that would be pattern-matching on coincidence. A series silently
-- attributed to the wrong country is worse on a map than one that is missing:
-- the map still renders, and it is simply wrong.
--
-- NULL means either "not country-specific" (world commodity prices, frontier
-- compute) or "the country arrives per row" (World Bank). Both are legitimate,
-- so this stays nullable rather than defaulting to anything.
-- ============================================================================

ALTER TABLE indicators
  ADD COLUMN default_country_iso3 CHAR(3) REFERENCES countries(iso3);

COMMENT ON COLUMN indicators.default_country_iso3 IS
  'Country this series describes, when the source does not state it per row. '
  'NULL for world aggregates and for sources that carry country per observation.';

CREATE INDEX indicators_country_idx
  ON indicators (default_country_iso3)
  WHERE default_country_iso3 IS NOT NULL;

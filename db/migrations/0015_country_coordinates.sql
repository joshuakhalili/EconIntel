-- ============================================================================
-- 0015_country_coordinates.sql — where a country is
--
-- WHY
--
-- Nothing here has ever needed geography. The dashboard filters and charts by
-- country but never places one, so `countries` carries a name, an ISO code, a
-- World Bank region and nothing spatial.
--
-- The landing page changes that: it renders the adoption panel on a globe,
-- which needs a latitude and longitude per country. Those belong in the
-- dimension table beside the other country facts, not in a JSON file in the
-- client — a coordinate is a property of a country, the server already joins
-- this table on every country-dimensioned query, and a second copy in the
-- front end is a second thing to keep true.
--
-- Nullable, because a coordinate is not required for a country to be usable
-- here and the six supranational aggregates (WLD, EUU, EMU, OED, HIC, LMY) do
-- not have one. Anything that draws a map must handle NULL rather than assume
-- an origin — 0,0 is in the Gulf of Guinea, and a country silently rendered
-- there looks like data rather than like a missing value.
-- ============================================================================

ALTER TABLE countries
  ADD COLUMN latitude  NUMERIC(6, 3),
  ADD COLUMN longitude NUMERIC(6, 3);

COMMENT ON COLUMN countries.latitude IS
  'Representative point, degrees north, WGS84. NULL for aggregates. This is a '
  'label point for placing a marker, not a centroid — for countries with '
  'distant territories it sits on the populated mainland.';

COMMENT ON COLUMN countries.longitude IS
  'Representative point, degrees east, WGS84. NULL for aggregates.';

ALTER TABLE countries
  ADD CONSTRAINT countries_coordinates_paired
    CHECK (num_nonnulls(latitude, longitude) <> 1),
  ADD CONSTRAINT countries_latitude_range
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT countries_longitude_range
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);

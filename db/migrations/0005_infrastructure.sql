-- ============================================================================
-- 0005_infrastructure.sql — the physical buildout pillar
--
-- Data centres, power projects and chip fabs: the physical footprint of the AI
-- economy. This is the pillar where the satellite imagery eventually attaches,
-- because an asset with coordinates is a thing you can point a camera at.
--
-- Design note: assets are modelled separately from observations because they
-- are ENTITIES with a lifecycle (announced -> operational), not time-series
-- points. Their measurable attributes (capacity, investment) DO become
-- observations, joined back via asset_id.
-- ============================================================================

CREATE TYPE asset_kind AS ENUM (
  'data_centre', 'power_generation', 'grid_infrastructure',
  'semiconductor_fab', 'subsea_cable', 'research_facility'
);

CREATE TABLE assets (
  id               BIGSERIAL PRIMARY KEY,

  kind             asset_kind NOT NULL,
  name             TEXT NOT NULL,
  operator         TEXT,                -- 'Microsoft', 'Equinix'
  operator_company_id BIGINT REFERENCES companies(id),

  country_iso3     CHAR(3) REFERENCES countries(iso3),
  region_name      TEXT,                -- sub-national: state, province
  locality         TEXT,

  -- Coordinates. Stored as plain numerics rather than PostGIS geometry: we need
  -- point storage and occasional bounding-box queries, not spatial joins or
  -- projections. Adding the PostGIS extension for that would be weight without
  -- benefit. If we later need real proximity queries (e.g. "data centres within
  -- 50km of this substation"), that is the moment to migrate to geography type.
  latitude         NUMERIC(9,6),
  longitude        NUMERIC(9,6),

  -- Precision of the coordinates, because sourcing varies wildly. A press
  -- release naming a town gives you a centroid, not a building. Charting a
  -- town centroid as if it were a facility location is quietly wrong, and this
  -- column is what lets the map render uncertainty honestly.
  location_precision TEXT CHECK (location_precision IN
    ('exact', 'site', 'locality', 'region', 'country')),

  status           asset_status NOT NULL DEFAULT 'unknown',

  -- Capacity in megawatts — the industry's standard unit for data centre scale,
  -- and the one that connects the AI buildout to energy economics. Floor area
  -- is a much weaker proxy since density varies by an order of magnitude.
  capacity_mw      NUMERIC,
  planned_capacity_mw NUMERIC,

  announced_investment_usd NUMERIC,
  announced_at     DATE,
  operational_at   DATE,

  is_ai_specific   BOOLEAN,   -- NULL = unknown. Most DCs are mixed-use.

  -- Provenance: which document told us about this asset.
  source_document_id BIGINT REFERENCES documents(id) ON DELETE SET NULL,
  source_id        TEXT REFERENCES sources(id),
  confidence_tier  confidence_tier NOT NULL DEFAULT 'news_derived',

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT assets_lat_valid CHECK (latitude  IS NULL OR latitude  BETWEEN  -90 AND  90),
  CONSTRAINT assets_lon_valid CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  -- Either both coordinates or neither. A half-set of coordinates is always a bug.
  CONSTRAINT assets_coords_paired CHECK (
    (latitude IS NULL) = (longitude IS NULL)
  )
);

CREATE INDEX assets_country_idx  ON assets (country_iso3, kind);
CREATE INDEX assets_kind_idx     ON assets (kind, status);
CREATE INDEX assets_geo_idx      ON assets (latitude, longitude)
  WHERE latitude IS NOT NULL;
CREATE INDEX assets_operator_idx ON assets (operator_company_id)
  WHERE operator_company_id IS NOT NULL;

COMMENT ON COLUMN assets.location_precision IS
  'How precisely we actually know where this is. A locality centroid must not be drawn as a building footprint.';
COMMENT ON COLUMN assets.capacity_mw IS
  'Megawatts — the industry-standard measure of data centre scale and the link to energy economics.';


-- ---------------------------------------------------------------------------
-- Satellite imagery references.
--
-- We store POINTERS to imagery, never the imagery itself. Tiles are large,
-- providers' licences generally permit display rather than redistribution, and
-- caching a URL plus its capture date gives us everything the UI needs.
--
-- Multiple rows per asset over time is the point: two images of the same
-- coordinates a year apart is a visible construction record, which is the only
-- genuinely compelling reason to put satellite imagery in an economics
-- dashboard at all.
-- ---------------------------------------------------------------------------
CREATE TABLE asset_imagery (
  id            BIGSERIAL PRIMARY KEY,
  asset_id      BIGINT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,

  provider      TEXT NOT NULL,          -- 'sentinel2', 'nasa_gibs'
  image_url     TEXT NOT NULL,
  thumbnail_url TEXT,

  captured_at   DATE NOT NULL,
  cloud_cover   NUMERIC(5,2),           -- percent; high values make the image useless
  resolution_m  NUMERIC(6,2),           -- ground sample distance, metres/pixel

  bbox_west     NUMERIC(9,6),
  bbox_south    NUMERIC(9,6),
  bbox_east     NUMERIC(9,6),
  bbox_north    NUMERIC(9,6),

  attribution   TEXT NOT NULL,          -- licence obliges display; NOT NULL enforces it
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT asset_imagery_uniq UNIQUE (asset_id, provider, captured_at)
);

CREATE INDEX asset_imagery_asset_idx ON asset_imagery (asset_id, captured_at DESC);

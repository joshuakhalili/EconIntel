-- A probe is not configuration, ingestion success, or full-catalogue coverage.
CREATE TABLE source_verifications (
  source_id TEXT PRIMARY KEY REFERENCES sources(id),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  state TEXT NOT NULL CHECK (state IN ('verified', 'failed')),
  method TEXT NOT NULL,
  scope TEXT NOT NULL,
  detail TEXT NOT NULL
);

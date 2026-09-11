-- PostgreSQL CHECK treats NULL as passing: successful refreshes must explicitly
-- contain a hash rather than relying on a nullable regex comparison.
ALTER TABLE research_source_refresh_events
  ADD CONSTRAINT research_refresh_success_hash_required
  CHECK(status='inaccessible' OR (observed_hash IS NOT NULL AND observed_hash ~ '^[a-f0-9]{64}$'));

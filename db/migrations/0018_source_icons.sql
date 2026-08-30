-- ============================================================================
-- 0018_source_icons.sql — the publisher's mark, stored rather than linked
--
-- WHY THE BYTES LIVE HERE AND NOT A URL
--
-- A news card wants its publisher's logo. The obvious implementation — point
-- an <img> at https://www.ft.com/favicon.ico — is wrong twice over:
--
--   1. It tells seven news organisations who is reading this site, when, and
--      how often. Every reader's browser would make a request to each of them
--      on every page that lists news, carrying an IP address and a Referer.
--      This site's own privacy page says it loads no external service but
--      Google Fonts, and that sentence has to stay true.
--
--   2. The Content-Security-Policy in src/server/lib/security.js sets
--      img-src 'self' data:, deliberately, because a wildcard there is how a
--      tracking pixel gets in. Adding seven publisher domains to it to display
--      a 16px logo is a bad trade.
--
-- So the icon is fetched ONCE, server-side, at ingestion time, and stored as a
-- data: URI — which the existing CSP already permits and which reaches the
-- reader as part of the JSON they were already fetching. No extra request, no
-- third party, no policy change.
--
-- The CHECK constraints are the interesting part. Without the first, this
-- column would accept any string and a bug elsewhere could put an external URL
-- in it, which is the precise failure this design exists to prevent — and it
-- would fail silently, because the CSP blocks the image and an <img> that
-- cannot load renders as nothing. The second bounds the cost: a data URI is
-- carried in every news response, and a publisher serving a 200KB PNG as its
-- favicon would quietly inflate every one of them.
-- ============================================================================

ALTER TABLE sources ADD COLUMN icon_data_uri TEXT;

ALTER TABLE sources
  ADD CONSTRAINT sources_icon_is_data_uri
    CHECK (icon_data_uri IS NULL OR icon_data_uri LIKE 'data:image/%'),
  ADD CONSTRAINT sources_icon_bounded
    CHECK (icon_data_uri IS NULL OR length(icon_data_uri) <= 40000);

COMMENT ON COLUMN sources.icon_data_uri IS
  'The publisher''s favicon as a data: URI, resolved server-side by '
  'scripts/fetch-source-icons.js. Never a URL — see the note in the migration.';

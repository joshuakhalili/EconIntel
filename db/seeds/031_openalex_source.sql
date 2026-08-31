-- ============================================================================
-- 031_openalex_source.sql — the academic catalogue behind the reading lists
--
-- OpenAlex is the successor to Microsoft Academic Graph: ~250 million works,
-- CC0, no key, no rate limit worth the name. It is the only free catalogue with
-- both structured venue metadata and abstracts, and the venue metadata is what
-- makes a usable corpus possible at all — see the query notes in
-- src/server/ingestion/sources/openalex.js.
--
-- ONE ROW, NOT ONE PER STRAND. The adapter runs two queries (core journals,
-- and a whitelist of working-paper repositories) but they are two halves of one
-- corpus from one provider. `sources` is a provider registry; a strand is a
-- query, and registering a query here would put a piece of adapter
-- configuration in the reference data where nothing could keep it in step.
--
-- CREDIBILITY 7, WHICH IS LOWER THAN IT LOOKS. OpenAlex itself is an excellent
-- catalogue — the number does not grade OpenAlex's accuracy, it grades what a
-- row sourced to it is worth on a page. A work reached through this source is
-- an unread paper of unknown quality: the query filters for venue and topic,
-- not for whether the finding holds. The peer-reviewed journals in the corpus
-- range from the Quarterly Journal of Economics to titles nobody has heard of,
-- and nothing in the metadata distinguishes them. A person deciding to cite one
-- has to open it. That is exactly the judgement `question_reading.takeaway`
-- exists to record, and the reason this pipeline never writes one.
-- ============================================================================

INSERT INTO sources (id, name, homepage_url, api_base_url, licence, attribution_text, credibility, requires_key, notes) VALUES

('openalex',
 'OpenAlex',
 'https://openalex.org',
 'https://api.openalex.org',
 'CC0 1.0 (bibliographic metadata)',
 'Bibliographic data from OpenAlex (CC0)',
 7, FALSE,
 'No key. A mailto in the query string buys the "polite pool" and faster responses; the adapter takes it from SEC_USER_AGENT. Abstracts are served as an inverted index and reconstructed verbatim — never summarised. Works land in documents (kind = research) as CANDIDATES for question_reading; promoting one is an editorial act and requires reading the paper.')

ON CONFLICT (id) DO UPDATE SET
  name             = EXCLUDED.name,
  homepage_url     = EXCLUDED.homepage_url,
  api_base_url     = EXCLUDED.api_base_url,
  licence          = EXCLUDED.licence,
  attribution_text = EXCLUDED.attribution_text,
  credibility      = EXCLUDED.credibility,
  requires_key     = EXCLUDED.requires_key,
  notes            = EXCLUDED.notes;

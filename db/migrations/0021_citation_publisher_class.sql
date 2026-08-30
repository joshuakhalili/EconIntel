-- ============================================================================
-- 0021_citation_publisher_class.sql — telling the SEC from a newsletter
--
-- 0020 loaded 20 deals and held three back because their only source was an
-- aggregator or a newsletter rather than a filing or a company release. That
-- was the right question to raise and the wrong place to answer it: whether
-- this project may cite tech-insider.org is an editorial policy decision, not
-- a property of the data. Joshua has ruled that it may.
--
-- What the ruling does NOT do is make a newsletter equal to a 10-Q, and the
-- schema currently cannot express the difference. `confidence_tier` bottoms out
-- at `news_derived`, so a Reuters wire story and a Substack post land on the
-- same value. A reader looking at a $100bn commitment deserves to know which
-- one it rests on without opening the link.
--
-- Hence `event_citations.publisher_class`: what KIND of publisher this is,
-- independent of how confident anyone is in the claim.
--
-- WHY NOT EXTEND confidence_tier INSTEAD
--
-- `confidence_tier` is shared with indicators and observations, where it means
-- how a NUMBER was produced — official statistics, derived, survey, modelled.
-- Adding 'aggregator' to it would put a publishing-format concept into an
-- enum about measurement methodology, and every observation query would inherit
-- a value that cannot apply to it. The two axes are genuinely different: an
-- aggregator republishing an 8-K verbatim is a weak publisher carrying a strong
-- claim, and one column cannot say that.
--
-- WHY TEXT + CHECK
--
-- Same reasoning as `entities.sector` in 0020. This vocabulary will grow as the
-- citation base does, and a CHECK can be widened or narrowed later where an
-- enum value can never be withdrawn.
--
-- ALSO HERE: `credit_facility`
--
-- 0020 added only the four `event_kind` values its accepted rows demanded, and
-- named the three it withheld along with the rejected rows waiting on them.
-- The HUMAIN / Saudi National Infrastructure Fund row — "financing agreement of
-- up to $1.2bn" — is now loadable under the domain ruling, and it is a line
-- rather than a loan: a ceiling the borrower may not fully draw. That is
-- exactly the distinction `credit_facility` exists to make, and a row now needs
-- it, which is the only reason it is being added.
--
-- `joint_venture` and `vendor_financing` are still absent. Every row needing
-- them is rejected for a dead source URL, and those stay out.
--
-- TRANSACTION NOTE: as in 0020, migrate.js wraps this file in one transaction,
-- so nothing below may USE 'credit_facility'. Nothing does; the seed that
-- inserts that event runs in a later transaction.
-- ============================================================================

ALTER TYPE event_kind ADD VALUE IF NOT EXISTS 'credit_facility';


ALTER TABLE event_citations
  ADD COLUMN publisher_class TEXT
    CHECK (publisher_class IN (
      'filing',          -- an SEC filing or a company's own hosting of one
      'regulator',       -- a regulator's own document: FTC, CMA, NIST
      'company_release', -- a party's own press release, including via PR wire
      'wire',            -- Reuters, Bloomberg, AP — reported, not published by a party
      'news',            -- general business press
      'trade_press',     -- specialist sector press
      'aggregator',      -- republishes others' filings or reporting
      'newsletter'       -- an individual's or small outlet's write-up
    ));

CREATE INDEX event_citations_class_idx
  ON event_citations (publisher_class) WHERE publisher_class IS NOT NULL;

COMMENT ON COLUMN event_citations.publisher_class IS
  'What kind of publisher this URL is, independent of confidence in the claim. '
  'An aggregator republishing an 8-K verbatim is a weak publisher carrying a '
  'strong claim, which confidence_tier alone cannot express. Nullable because '
  'a future ingested citation may not know; the loader refuses an unmapped host '
  'rather than guessing, which is where this is actually enforced.';


/**
 * investment_edges, replaced again — one column appended, nothing else touched.
 *
 * `source_classes` is what a reader needs beside a figure: the distinct kinds
 * of publisher standing behind this deal, so "$100bn — newsletter" and
 * "$13bn — filing" cannot render identically. Aggregated rather than reduced to
 * a single "weakest" value on purpose: an event carried by both a filing and an
 * aggregator is better attested than one carried by the aggregator alone, and
 * collapsing to the weakest would hide that.
 */
CREATE OR REPLACE VIEW investment_edges AS
SELECT e.id                                   AS event_id,
       e.from_entity_id,
       f.name                                 AS from_name,
       e.to_entity_id,
       t.name                                 AS to_name,
       e.kind,
       e.status,
       e.amount_usd,
       e.capacity_mw,
       e.announced_date,
       e.location_iso3,
       e.headline,
       e.is_verified,
       e.confidence_tier,
       (SELECT count(*)::int FROM event_sources s WHERE s.event_id = e.id)
                                              AS source_count,
       (SELECT count(*)::int FROM event_citations c WHERE c.event_id = e.id)
                                              AS citation_count,
       (SELECT count(*)::int FROM event_sources s WHERE s.event_id = e.id)
       + (SELECT count(*)::int FROM event_citations c WHERE c.event_id = e.id)
                                              AS evidence_count,
       (SELECT count(*)::int FROM event_participants p WHERE p.event_id = e.id)
                                              AS participant_count,
       e.amount_basis,
       e.is_bidirectional,
       e.loop_status,
       e.loop_description,
       e.structure_label,
       f.sector                               AS from_sector,
       t.sector                               AS to_sector,
       (SELECT string_agg(DISTINCT c.publisher_class, ', ')
          FROM event_citations c WHERE c.event_id = e.id)
                                              AS source_classes
  FROM events e
  JOIN entities f ON f.id = e.from_entity_id
  LEFT JOIN entities t ON t.id = e.to_entity_id
 WHERE e.status <> 'cancelled';

COMMENT ON VIEW investment_edges IS
  'One row per non-cancelled deal, with how many documents and citations attest '
  'to it, what kind of publisher they are, and both parties'' stack sector. '
  'from_entity_id is the payer. This is what the circular-financing diagram '
  'draws from — never monthly_investment, which sums opposite-facing legs of '
  'the same loop into a meaningless total.';

/**
 * unverified_loops, replaced — same reason, same one column.
 *
 * This is the worklist for checking loop claims, so it is exactly where knowing
 * that a claim rests on a newsletter matters most: those are the ones a person
 * should open first.
 */
CREATE OR REPLACE VIEW unverified_loops AS
SELECT e.id                    AS event_id,
       e.announced_date,
       e.headline,
       e.loop_status,
       e.loop_description,
       e.confidence_tier,
       f.name                  AS from_name,
       t.name                  AS to_name,
       (SELECT count(*)::int FROM event_citations c WHERE c.event_id = e.id)
                               AS citation_count,
       (SELECT count(*)::int FROM event_citations c
         WHERE c.event_id = e.id AND c.is_checked) AS checked_citation_count,
       (SELECT string_agg(DISTINCT c.publisher_class, ', ')
          FROM event_citations c WHERE c.event_id = e.id) AS source_classes
  FROM events e
  JOIN entities f ON f.id = e.from_entity_id
  LEFT JOIN entities t ON t.id = e.to_entity_id
 WHERE e.loop_status <> 'none'
   AND e.is_verified = FALSE
 ORDER BY e.announced_date DESC;

COMMENT ON VIEW unverified_loops IS
  'Loop claims awaiting human verification, with the kind of publisher behind '
  'each. Shown to readers marked unchecked — this view is the worklist, and '
  'source_classes says which to open first.';

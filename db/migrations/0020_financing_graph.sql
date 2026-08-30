-- ============================================================================
-- 0020_financing_graph.sql — making `events` able to hold real AI financing
--
-- 0007 built the deal model against a mental picture of "Nvidia invests in
-- OpenAI": two parties, one arrow, one amount, money running the same way the
-- sentence does. That picture is right about a venture round and wrong about
-- most of AI infrastructure finance, where the money moves through syndicates,
-- joint ventures, offtake guarantees and delayed-draw term loans, and where the
-- party that announces a deal is routinely the one receiving the cash.
--
-- The first real dataset — 33 dated, sourced deals from 2023-2026 — broke the
-- model in five specific places. This migration fixes those five and nothing
-- else. Each is argued rather than asserted, because each was a choice between
-- representations that are not equally honest.
--
-- ---------------------------------------------------------------------------
-- 1. CONSORTIA: one counterparty in the key, the rest in a join table
-- ---------------------------------------------------------------------------
--
-- Nine of the 33 deals name a group rather than a company on one side:
-- `Apollo/BlackRock/Blackstone/Brookfield/Goldman/KKR`, `Blackstone-led
-- lenders`, `GIC/CPP Investments JV`, `term-loan investors`, and so on.
--
-- Two obvious answers are both wrong. Inventing a consortium entity puts a
-- company that does not exist into a table a human reads as a roster of real
-- actors; "Blackstone-led lenders" would be a fabrication in the place
-- fabrications are hardest to spot. Exploding into one event per member turns
-- Nvidia's single $500bn platform MoU into six $500bn deals, and every
-- SUM(amount_usd) in the project is then wrong by 6x, permanently and silently.
--
-- So: the event stays bilateral, and `event_participants` carries the rest.
-- Which entity occupies the foreign key is decided by three ordered rules,
-- applied mechanically and printed per row by the loader so no assignment is
-- invisible:
--
--   (a) The group is a real, legally constituted vehicle — an incorporated JV
--       or partnership that itself signed the deal. Then it IS an entity, and
--       creating it is accurate rather than inventive. Its partners are
--       recorded as `jv_partner`.
--   (b) The group's description explicitly names a lead ("Blackstone-led",
--       "led by Magnetar", "lenders including Macquarie ..."). The lead takes
--       the key; the others become `participant` rows.
--   (c) Neither — `term-loan investors` names nobody. The row is REJECTED.
--       A financing edge with an anonymous end is not a fact about anyone.
--
-- `event_participants` DELIBERATELY HAS NO AMOUNT COLUMN. That is the whole
-- guarantee: you cannot double-count what you cannot sum. The deal's money
-- exists exactly once, on the event. Member shares are almost never disclosed,
-- so a share column would fill with nulls and guesses, and the first person to
-- SUM it would produce a figure no source supports.
--
-- ---------------------------------------------------------------------------
-- 2. SECTOR: `kind` is what an actor legally is, `sector` is what it does here
-- ---------------------------------------------------------------------------
--
-- The source types entities as hyperscaler / neocloud / chipmaker /
-- datacenter_operator / private_credit_fund / sovereign_fund / ai_lab. All
-- seven collapse into `company`, `research_lab` or `investor`, and the collapse
-- destroys the one thing a circular-financing diagram is made of: the loop runs
-- chipmaker -> neocloud -> private credit -> chipmaker, and colouring that by
-- `kind` puts Nvidia, CoreWeave and Equinix in a single undifferentiated blob.
--
-- `entity_kind` is NOT extended. Adding 'neocloud' to it would force Equinix to
-- stop being a `company`, which is false, and would break seeded rows and
-- extraction that already depend on the five legal categories. Sector is a
-- second, independent axis.
--
-- TEXT with a CHECK rather than an enum, on purpose. This vocabulary will grow
-- as the graph does, and a CHECK can be widened or narrowed in a later
-- migration where an enum value can never be removed once added.
--
-- One entity, one sector. Where that looks false it usually isn't: Microsoft is
-- a hyperscaler that sometimes acts as an investor, and "acted as an investor
-- HERE" is a fact about a deal. It lives on `event_participants.role`.
--
-- ---------------------------------------------------------------------------
-- 3. LOOPS: the flag and its sentence are columns, not a dropped cell
-- ---------------------------------------------------------------------------
--
-- 28 of the 33 rows are flagged as forming a financing loop and carry a
-- sentence saying which loop and how. That is the entire feature. Loading the
-- deals without it produces a table that cannot answer the question it was
-- gathered to answer.
--
-- `loop_description` is required whenever `loop_status` is not 'none'. A loop
-- flag with no explanation is an accusation, and an accusation a reader cannot
-- check is the thing this codebase most consistently refuses to publish.
--
-- There is deliberately NO `loops` table naming each cycle. A loop is a cycle
-- in a graph and the graph can find its own cycles; naming them up front would
-- be an editorial layer no source in this dataset supports.
--
-- ---------------------------------------------------------------------------
-- 4. EVENT KIND: four structures the enum could not name
-- ---------------------------------------------------------------------------
--
-- The source's `event_type` is free text: 30 distinct strings across 33 rows,
-- from "senior secured term loan B" to "AI Infrastructure Partnership (AIP)
-- formation". Forcing those onto the eight existing values discarded the
-- distinction that matters most — a $926m term loan and a $2bn equity cheque
-- both became 'investment', which is the difference between debt and ownership.
--
-- FOUR values are added, and only four: exactly those the accepted rows demand.
-- Not a speculative vocabulary of everything AI finance might one day need. An
-- enum value with no row behind it is a closed vocabulary filling up with
-- guesses, and `event_kind` is used by extraction, which will reach for
-- whatever is there.
--
-- Three structures this dataset DOES contain have no value here on purpose,
-- because every row needing them was rejected on other grounds and may never be
-- loaded. Named so the next person knows exactly what to add and why:
--
--   credit_facility  — HUMAIN / Saudi National Infrastructure Fund, "up to
--                      $1.2bn". Rejected: sole source is fwdstart.me.
--   joint_venture    — Equinix/GIC/CPP xScale; MGX/BlackRock GIP/Microsoft AIP;
--                      MGX/Bpifrance/Mistral/Nvidia Paris campus. All three
--                      rejected: dead or truncated source URLs.
--   vendor_financing — Nvidia's $500bn compute-financing platforms with
--                      residual-value support. Rejected: truncated source URL.
--
-- `structure_label` keeps the source's own words on every row regardless, so
-- the mapping onto `kind` stays auditable and reversible instead of being a
-- lossy one-way editorial act.
--
-- ---------------------------------------------------------------------------
-- 5. THE RULE 0007 STATED AND DID NOT ENFORCE
-- ---------------------------------------------------------------------------
--
-- 0007's header says "no event exists without a source" and nothing in it
-- enforces that. `investment_edges` LEFT JOINs `event_sources` and reports
-- source_count = 0 without complaint.
--
-- `event_sources` cannot hold these citations: it references `documents(id)`,
-- and a document is text WE HOLD — it has a body, a publisher registered in
-- `sources`, a full-text index, and it feeds the reader-facing news panel. We
-- have 33 URLs and no fetched articles. Manufacturing document rows to satisfy
-- a foreign key would put things we have not read into the table that means
-- "things we have read", and `documents` has nowhere to record the one fact we
-- do have about each link: whether it still resolves.
--
-- So `event_citations` holds a bare URL with its HTTP status and check time,
-- and a DEFERRABLE constraint trigger requires every event to have at least one
-- citation OR one document by the end of the transaction. Deferred because the
-- event must exist before anything can point at it, and because `db:seed` runs
-- every seed file inside one transaction.
--
-- The two tables are not rivals and this forecloses nothing. A citation is a
-- URL we are standing behind; a source is a document we hold. If someone later
-- adds a `deal_press` row to `sources` and ingests these articles properly, the
-- events gain `event_sources` rows, keep their citations, and the trigger is
-- already satisfied by either.
--
-- ---------------------------------------------------------------------------
-- ALTER TYPE INSIDE A TRANSACTION — DO NOT "SIMPLIFY" THIS BACK TOGETHER
-- ---------------------------------------------------------------------------
--
-- src/server/db/migrate.js wraps each migration file in one transaction.
-- Postgres 12+ permits ALTER TYPE ... ADD VALUE inside a transaction block but
-- forbids USING the new label before that transaction commits. Verified against
-- this database (PostgreSQL 18.4) before relying on it.
--
-- Therefore nothing below writes, defaults to, or CHECKs one of the four new
-- `event_kind` labels, and the events that use them are inserted by
-- db/seeds/027_financing_events.sql, which `db:seed` runs in a later
-- transaction. Moving those inserts into this file will fail at COMMIT.
--
-- Types CREATEd in this file are exempt from that restriction and are used
-- freely below.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 4a. The four structures the accepted rows require. See section 4.
--
-- debt_facility     — term borrowing against assets or contracted cash flows:
--                     a GPU-backed loan, a senior secured term loan, a private
--                     placement funding a named capex programme. Distinct from
--                     'investment' because it buys no ownership.
-- convertible_note  — money that is debt now and equity later. Recording it as
--                     'investment' overstates today's ownership; recording it
--                     as debt misses that it is meant to convert.
-- government_grant  — public money: CHIPS Act awards and equivalents. Distinct
--                     from 'investment' because there is no equity and the
--                     conditions attached are political rather than financial.
-- offtake           — a commitment to buy output over time: cloud capacity,
--                     compute, chips. 'chip_order' covered only the hardware
--                     case, and the largest numbers in this dataset are cloud
--                     purchase commitments, not chip orders.
-- ---------------------------------------------------------------------------
ALTER TYPE event_kind ADD VALUE IF NOT EXISTS 'debt_facility';
ALTER TYPE event_kind ADD VALUE IF NOT EXISTS 'convertible_note';
ALTER TYPE event_kind ADD VALUE IF NOT EXISTS 'government_grant';
ALTER TYPE event_kind ADD VALUE IF NOT EXISTS 'offtake';


-- ---------------------------------------------------------------------------
-- 2a. Where an entity sits in the stack. See section 2.
-- ---------------------------------------------------------------------------
ALTER TABLE entities
  ADD COLUMN sector TEXT
    CHECK (sector IN (
      'ai_lab',              -- OpenAI, Anthropic, Mistral, xAI
      'chipmaker',           -- Nvidia, TSMC, AMD
      'hyperscaler',         -- Microsoft, Amazon, Alphabet, Oracle
      'neocloud',            -- CoreWeave, Lambda, IREN: GPU capacity for rent
      'datacenter_operator', -- Equinix, Aligned, NAVER: the buildings and power
      'private_credit_fund', -- Blackstone, Blue Owl, Apollo, Brookfield
      'sovereign_fund',      -- MGX, PIF/HUMAIN, GIC
      'other_investor',      -- CPP Investments, Bpifrance, SoftBank
      'government'           -- the US Department of Commerce as a CHIPS grantor
    ));

CREATE INDEX entities_sector_idx ON entities (sector) WHERE sector IS NOT NULL;

COMMENT ON COLUMN entities.sector IS
  'Position in the AI infrastructure stack, for the circular-financing diagram. '
  'Independent of `kind`, which records what legal sort of thing this is. NULL '
  'means nobody has decided yet, not that the entity sits outside the stack.';


-- ---------------------------------------------------------------------------
-- Whether a headline figure is a ceiling or the size of a done deal.
--
-- The most dangerous ambiguity in this dataset. Nvidia's $500bn is capital its
-- partners intend to mobilise "over time"; CoreWeave's $7.5bn facility was
-- signed. Adding them produces a number describing nothing, and every existing
-- aggregate in this schema — `monthly_investment` included — will happily do
-- exactly that. Any total that does not GROUP BY this column is wrong.
--
-- Two values, not four. The source's own `amount_type` vocabulary is
-- commitment / drawn / disclosed-total and it uses two of them; 'drawn' is
-- added when a row needs it. `amount_is_estimate` already carries "this figure
-- was inferred", so 'estimate' would be a second way to say one thing.
-- ---------------------------------------------------------------------------
CREATE TYPE amount_basis AS ENUM (
  'commitment',      -- a ceiling: "up to", "intends to mobilise", "over time"
  'disclosed_total'  -- the stated size of a transaction that happened
);

-- Whether the loop claim is the source's or an inference, and how strong.
CREATE TYPE loop_status AS ENUM (
  'none',      -- no circularity claimed
  'alleged',   -- circularity asserted by a journalist or analyst, not a party
  'forms_loop' -- both legs documented; the circle closes on the evidence
);

ALTER TABLE events
  ADD COLUMN amount_basis     amount_basis,
  ADD COLUMN loop_status      loop_status NOT NULL DEFAULT 'none',
  ADD COLUMN loop_description TEXT,
  ADD COLUMN structure_label  TEXT,

  /*
   * Capital and value move both ways: a joint venture, a platform MoU, a
   * partnership where each side funds the other. The diagram must NOT draw an
   * arrowhead on such an edge, and no aggregate may treat it as a transfer in
   * either direction.
   *
   * This is the only direction information stored, because from_entity_id is
   * normalised to the PAYER at load time — see the note on `money_flow`
   * below. A boolean for the one case normalisation cannot express beats an
   * enum re-encoding a direction the key already carries.
   */
  ADD COLUMN is_bidirectional BOOLEAN NOT NULL DEFAULT FALSE,

  -- A loop flag with no explanation is an accusation. See section 3.
  ADD CONSTRAINT events_loop_needs_description
    CHECK (loop_status = 'none' OR (loop_description IS NOT NULL
                                    AND length(trim(loop_description)) >= 20)),

  -- A figure with no basis cannot be aggregated safely, so it may not exist.
  ADD CONSTRAINT events_amount_needs_basis
    CHECK (amount_usd IS NULL OR amount_basis IS NOT NULL);

CREATE INDEX events_loop_idx ON events (loop_status) WHERE loop_status <> 'none';

COMMENT ON COLUMN events.amount_basis IS
  'Whether amount_usd is a ceiling (commitment) or the size of a done deal '
  '(disclosed_total). Totals that ignore this column are wrong.';
COMMENT ON COLUMN events.structure_label IS
  'The source''s own words for the deal type, verbatim, so the mapping onto '
  '`kind` stays auditable: "senior secured term loan B" -> debt_facility.';
COMMENT ON COLUMN events.is_bidirectional IS
  'Capital and value move both ways (a JV, a platform MoU). The diagram must '
  'not draw an arrowhead on this edge and no aggregate may treat it as a '
  'one-way transfer.';

/**
 * from_entity_id NOW MEANS THE PAYER, AND THE LOADER ENFORCES IT.
 *
 * 0007 assumed the acting party is always the paying party. In financing that
 * is routinely false: a borrower announces its own facility, so the borrower is
 * the subject of the sentence and the named party while the cash runs the other
 * way. Eight of these 33 rows are marked `b_to_a` for exactly that reason.
 *
 * Two ways to handle it: store the source's direction in a column and make
 * every consumer honour it, or normalise on the way in so from -> to always
 * means money. Normalising wins, because the column would be optional and the
 * first chart that forgot it would draw the CoreWeave debt backwards — the
 * precise error 0007's own comment warns about.
 *
 * scripts/load-financing-deals.js therefore swaps the parties where the source
 * says `b_to_a`, and PRINTS A LINE FOR EVERY SWAP. A silent swap would be the
 * same failure with better manners.
 *
 * Where a row's stated direction contradicts its own description — the payer
 * named nowhere on the row — the row is rejected rather than guessed at.
 */
COMMENT ON COLUMN events.from_entity_id IS
  'The party that pays. Normalised at load: a source describing a borrower '
  'announcing its own facility has its parties swapped, and the swap is logged. '
  'See migration 0020.';


-- ---------------------------------------------------------------------------
-- 1a. Consortium membership. See section 1.
--
-- NO AMOUNT COLUMN, ON PURPOSE.
-- ---------------------------------------------------------------------------
CREATE TYPE event_side AS ENUM ('from', 'to');

CREATE TYPE participant_role AS ENUM (
  'lead',        -- the source says this party led it ("Blackstone-led")
  'co_lead',     -- two or more named as leading together
  'participant', -- named in the group with no stated seniority
  'jv_partner',  -- an equity partner in a named joint venture
  'arranger'     -- structured or syndicated it without necessarily funding it
);

CREATE TABLE event_participants (
  event_id   BIGINT NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  entity_id  TEXT   NOT NULL REFERENCES entities(id) ON DELETE RESTRICT,

  side       event_side NOT NULL,
  role       participant_role NOT NULL DEFAULT 'participant',

  -- What the source said about this party's part, where it said anything:
  -- 'Global Infrastructure Partners', 'Tactical Opportunities', 'co-lead
  -- investor'. Not a place for inference.
  note       TEXT,

  PRIMARY KEY (event_id, entity_id, side)
);

CREATE INDEX event_participants_entity_idx ON event_participants (entity_id);
CREATE INDEX event_participants_side_idx   ON event_participants (event_id, side);

COMMENT ON TABLE event_participants IS
  'Members of a syndicate, consortium or joint venture on one side of an event, '
  'beside the one member holding the foreign key. No amount column by design: '
  'member shares are almost never disclosed and a nullable share column is an '
  'invitation to sum guesses. The deal amount exists exactly once, on `events`.';


-- ---------------------------------------------------------------------------
-- 5a. Citations. See section 5.
-- ---------------------------------------------------------------------------
CREATE TABLE event_citations (
  id           BIGSERIAL PRIMARY KEY,
  event_id     BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  url          TEXT NOT NULL CHECK (url ~ '^https?://'),

  -- The host, stored rather than derived, so "how much of this graph rests on
  -- one outlet" is a GROUP BY and not a regex over every row.
  publisher    TEXT NOT NULL,

  -- A filing, an official press release or a regulator's own document, as
  -- against a report about one. 0007's `event_sources.is_primary` means the
  -- same thing and is worded the same way on purpose.
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,

  /*
   * Whether the link was fetched and what it said. This is the column
   * `documents` has no room for and the reason this table exists rather than 33
   * invented document rows. Four of the 33 URLs in the first batch were
   * truncated mid-slug and dead; recording the status is how the next batch
   * gets caught before it reaches a reader.
   *
   * `http_status` NULL means never fetched. `is_checked` means a PERSON read
   * the page and confirmed it says what the event claims — never set by a
   * script, and a 200 from a liveness probe is not it.
   */
  http_status  SMALLINT,
  fetched_at   TIMESTAMPTZ,
  is_checked   BOOLEAN NOT NULL DEFAULT FALSE,
  checked_at   TIMESTAMPTZ,

  -- The verbatim line supporting the claim, once someone has read the page.
  -- 0007's event_sources.quote, for the same reason and with the same meaning.
  quote        TEXT,

  note         TEXT,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT event_citations_uniq UNIQUE (event_id, url),
  CONSTRAINT event_citations_checked_has_date
    CHECK (is_checked = FALSE OR checked_at IS NOT NULL)
);

CREATE INDEX event_citations_event_idx     ON event_citations (event_id);
CREATE INDEX event_citations_publisher_idx ON event_citations (publisher);

COMMENT ON TABLE event_citations IS
  'A URL standing behind an event, for the case where we have the link but not '
  'the document. Distinct from event_sources, which requires a fetched row in '
  '`documents` — see migration 0020 section 5 for why one cannot stand in for '
  'the other. Either satisfies the evidence trigger.';
COMMENT ON COLUMN event_citations.is_checked IS
  'A person opened this page and confirmed it says what the event claims. '
  'A 200 from an automated liveness probe is not this.';

/**
 * The enforcement 0007 described and left to good intentions.
 *
 * Deferred, and it has to be: the event must exist before a citation can point
 * at it, and `db:seed` runs every seed file inside a single transaction. The
 * check therefore fires at COMMIT, when the whole picture is present.
 *
 * Returns quietly if the event has since been deleted in the same transaction.
 * An event removed on purpose is not an event missing its source.
 */
CREATE FUNCTION events_require_evidence() RETURNS trigger AS $$
DECLARE
  target BIGINT;
  attestations INT;
BEGIN
  IF TG_TABLE_NAME = 'events' THEN
    target := NEW.id;
  ELSE
    target := OLD.event_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM events WHERE id = target) THEN
    RETURN NULL;
  END IF;

  SELECT (SELECT count(*) FROM event_citations WHERE event_id = target)
       + (SELECT count(*) FROM event_sources   WHERE event_id = target)
    INTO attestations;

  IF attestations = 0 THEN
    RAISE EXCEPTION
      'event % has no citation and no source document. Migration 0007: no event exists without a source.',
      target
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER events_evidence_required
  AFTER INSERT OR UPDATE ON events
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION events_require_evidence();

-- Removing the last citation is the same violation as never adding one.
CREATE CONSTRAINT TRIGGER event_citations_evidence_required
  AFTER DELETE OR UPDATE ON event_citations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION events_require_evidence();


-- ---------------------------------------------------------------------------
-- Views.
-- ---------------------------------------------------------------------------

/**
 * investment_edges, replaced.
 *
 * Same columns in the same order and types, with new ones appended — which is
 * all CREATE OR REPLACE permits and all that is wanted. Two changes:
 *
 *   `source_count` becomes a scalar subquery. It counted `event_sources` via a
 *   LEFT JOIN beside no other join, which was correct, but a second evidence
 *   table would have turned that GROUP BY into a product. Its meaning is
 *   unchanged: fetched documents only.
 *
 *   `evidence_count` is what a reader should be shown — documents plus
 *   citations. With the trigger in place it can never be zero, which is the
 *   point of the trigger.
 *
 * THIS VIEW, NOT `monthly_investment`, IS WHAT THE FINANCING DIAGRAM DRAWS
 * FROM. An investment and the cloud commitment tied to it are two rows pointing
 * opposite ways — a $13bn stake in OpenAI and OpenAI's $250bn Azure order are
 * both real and are not additive. `monthly_investment` sums `amount_usd` across
 * every kind and both amount_bases and will produce a `total_usd` that means
 * nothing here. That is a fact about circular financing, not a bug to fix.
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
       t.sector                               AS to_sector
  FROM events e
  JOIN entities f ON f.id = e.from_entity_id
  LEFT JOIN entities t ON t.id = e.to_entity_id
 WHERE e.status <> 'cancelled';

COMMENT ON VIEW investment_edges IS
  'One row per non-cancelled deal, with how many documents and citations attest '
  'to it, and both parties'' stack sector. from_entity_id is the payer. This is '
  'what the circular-financing diagram draws from — never monthly_investment, '
  'which sums opposite-facing legs of the same loop into a meaningless total.';

/**
 * financing_edges — one drawable arrow per party, consortium members included.
 *
 * investment_edges gives one row per deal, which draws the principal arrow and
 * loses the syndicate. This adds a leg for every `event_participants` row, so
 * a facility led by Blackstone alongside five others draws six arrows.
 *
 * `attributed_amount_usd` is NULL on every participant leg. The arrow is
 * documented; that member's share of the money is not, and nothing downstream
 * may be able to invent one. `event_amount_usd` carries the deal's real size
 * for a tooltip and REPEATS across the legs of one event — so sum `events`,
 * never this view, for any total.
 */
CREATE VIEW financing_edges AS
-- The principal edge: the two parties holding the foreign keys.
SELECT e.id                       AS event_id,
       e.from_entity_id           AS payer_id,
       f.name                     AS payer_name,
       f.sector                   AS payer_sector,
       e.to_entity_id             AS payee_id,
       t.name                     AS payee_name,
       t.sector                   AS payee_sector,
       TRUE                       AS is_principal,
       NULL::participant_role     AS participant_role,
       e.amount_usd               AS event_amount_usd,
       e.amount_usd               AS attributed_amount_usd,
       e.kind, e.status, e.structure_label, e.announced_date, e.location_iso3,
       e.headline, e.amount_basis, e.is_bidirectional,
       e.loop_status, e.loop_description, e.confidence_tier, e.is_verified
  FROM events e
  JOIN entities f ON f.id = e.from_entity_id
  LEFT JOIN entities t ON t.id = e.to_entity_id
 WHERE e.status <> 'cancelled'

UNION ALL

-- One leg per additional consortium member, amount deliberately NULL.
SELECT e.id,
       CASE WHEN p.side = 'from' THEN p.entity_id ELSE e.from_entity_id END,
       CASE WHEN p.side = 'from' THEN m.name      ELSE f.name           END,
       CASE WHEN p.side = 'from' THEN m.sector    ELSE f.sector         END,
       CASE WHEN p.side = 'to'   THEN p.entity_id ELSE e.to_entity_id   END,
       CASE WHEN p.side = 'to'   THEN m.name      ELSE t.name           END,
       CASE WHEN p.side = 'to'   THEN m.sector    ELSE t.sector         END,
       FALSE,
       p.role,
       e.amount_usd,
       NULL::numeric,
       e.kind, e.status, e.structure_label, e.announced_date, e.location_iso3,
       e.headline, e.amount_basis, e.is_bidirectional,
       e.loop_status, e.loop_description, e.confidence_tier, e.is_verified
  FROM events e
  JOIN event_participants p ON p.event_id = e.id
  JOIN entities m ON m.id = p.entity_id
  JOIN entities f ON f.id = e.from_entity_id
  LEFT JOIN entities t ON t.id = e.to_entity_id
 WHERE e.status <> 'cancelled'
   -- The member holding the foreign key is already the principal edge.
   AND p.entity_id IS DISTINCT FROM e.from_entity_id
   AND p.entity_id IS DISTINCT FROM e.to_entity_id;

COMMENT ON VIEW financing_edges IS
  'Drawable arrows for the circular-financing diagram: the principal edge plus '
  'one leg per additional consortium member. attributed_amount_usd is NULL on '
  'member legs because their shares are undisclosed. Never SUM this view for a '
  'total — event_amount_usd repeats across legs. Sum `events`.';

/**
 * Events whose loop claim nobody has checked.
 *
 * The sibling of `unreviewed_figures` and `unreviewed_takeaways`, for the same
 * reason: "what is this site asserting ahead of its own review" should be one
 * query, not a remembered WHERE clause. A loop claim is the strongest thing
 * this dataset says about anyone, and every one of them arrives unverified.
 */
CREATE VIEW unverified_loops AS
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
         WHERE c.event_id = e.id AND c.is_checked) AS checked_citation_count
  FROM events e
  JOIN entities f ON f.id = e.from_entity_id
  LEFT JOIN entities t ON t.id = e.to_entity_id
 WHERE e.loop_status <> 'none'
   AND e.is_verified = FALSE
 ORDER BY e.announced_date DESC;

COMMENT ON VIEW unverified_loops IS
  'Loop claims awaiting human verification. Shown to readers marked unchecked — '
  'this view is the worklist for checking them.';

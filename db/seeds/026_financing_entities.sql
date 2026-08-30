-- ============================================================================
-- 026_financing_entities.sql — the money behind the compute
--
-- 005 seeded the operators: who designs the chips, who runs the clouds, who
-- trains the models. It has exactly one investor in it (SoftBank) and no
-- financial institutions at all, which was fine while the graph was about
-- products and is not fine now that it is about financing.
--
-- The first real deal dataset needs counterparties 005 has no room for: the
-- private-credit managers writing the GPU loans, the sovereign funds anchoring
-- the rounds, the GPU clouds doing the borrowing, and the specific US agency
-- that hands out CHIPS money. `events.from_entity_id` is NOT NULL with ON
-- DELETE RESTRICT, so every one of them has to exist before a single deal can
-- be loaded.
--
-- Seeded by hand and marked is_verified = TRUE, for 005's reason: these are the
-- nodes every financing edge attaches to, and resolution failing here does not
-- produce a small error — it splits one firm into several nodes and the graph
-- silently shows a structure that is not the real one.
--
-- CIKs are left NULL rather than guessed. 005 read every one of its CIKs out of
-- the SEC ticker map; none of these were read, so none are claimed. Several of
-- these firms are listed and do have one — a later pass can fill them in from
-- the same file 005 used.
--
-- WHY `sector` IS SET HERE AND MOSTLY NOT IN 005
--
-- Migration 0020 adds `entities.sector`: where an actor sits in the AI stack,
-- as against `kind`, which is what it legally is. This file sets it for the
-- entities that appear in the financing graph — the new ones below, and the
-- dozen 005 rows those deals connect to. Entities outside the deal graph are
-- left NULL rather than being classified on a guess by someone who did not
-- research them. NULL means undecided, and undecided is the truth about them.
-- ============================================================================

INSERT INTO entities (
  id, name, kind, country_iso3, description, homepage_url, ticker, cik,
  founded_year, is_verified, sector
) VALUES

-- ── GPU clouds ("neoclouds") ────────────────────────────────────────────────
-- Rent GPU capacity by the hour. Structurally the most leveraged layer of the
-- stack: they buy depreciating hardware with borrowed money against contracts
-- from a handful of customers, several of whom also lend to or invest in them.

('lambda', 'Lambda Labs', 'company', 'USA',
 'GPU cloud provider. Pioneered borrowing against Nvidia hardware itself: its 2024 facility was secured on the GPUs it was used to buy, and its later term loans are underwritten by Nvidia offtake agreements — making Nvidia supplier, guarantor and credit support at once.',
 'https://lambda.ai', NULL, NULL, 2012, TRUE, 'neocloud'),

('iren', 'IREN Limited', 'company', 'AUS',
 'Vertically integrated AI cloud operator that came out of bitcoin mining and owns its own power. Its financings are the clearest example of a compute contract being used as collateral: a hyperscaler''s take-or-pay obligation is what makes multi-billion GPU debt investment-grade.',
 'https://iren.com', 'IREN', NULL, 2018, TRUE, 'neocloud'),

-- ── Data-centre operators ───────────────────────────────────────────────────

('aligned', 'Aligned Data Centers', 'company', 'USA',
 'North and South American data-centre operator, taken private in 2025 by a consortium spanning sovereign capital, a chipmaker, a hyperscaler and an asset manager — one transaction in which most layers of the AI stack bought the same landlord.',
 'https://alignedde.com', NULL, NULL, 2013, TRUE, 'datacenter_operator'),

('naver', 'NAVER Corporation', 'company', 'KOR',
 'South Korea''s largest internet company and operator of the GAK Sejong data centre. Its AI-factory expansion is a template for sovereign AI capacity: a domestic operator, an infrastructure fund''s capital and a chipmaker''s equity in one project.',
 'https://www.navercorp.com', NULL, NULL, 1999, TRUE, 'datacenter_operator'),

('chirisa', 'Chirisa Technology Parks', 'company', NULL,
 'Data-centre developer. Appears in this graph only as a joint-venture partner on build-to-suit capacity leased to GPU clouds, which is how most AI data-centre debt is actually held: at a project company, not on anyone''s corporate balance sheet.',
 'https://chirisa.com', NULL, NULL, NULL, TRUE, 'datacenter_operator'),

('powerhouse_dc', 'PowerHouse Data Centers', 'company', 'USA',
 'Data-centre developer and joint-venture partner on AI/HPC build-to-suit projects. A subsidiary of American Real Estate Partners.',
 'https://powerhousedcs.com', NULL, NULL, NULL, TRUE, 'datacenter_operator'),

-- ── Private credit and alternative asset managers ───────────────────────────
-- The lenders of last resort for hardware banks will not finance. Their
-- appearance across every layer at once — lending to the clouds, owning the
-- buildings, partnering with the chipmaker — is what turns a set of ordinary
-- loans into a single correlated exposure.

('blue_owl', 'Blue Owl Capital', 'investor', 'USA',
 'Alternative asset manager and the most prolific single financier of AI infrastructure: leads GPU-equipment loans, sponsors the joint ventures that own the buildings, and lends to the clouds that lease them.',
 'https://www.blueowl.com', 'OWL', NULL, 2021, TRUE, 'private_credit_fund'),

('blackstone', 'Blackstone Inc.', 'investor', 'USA',
 'The largest alternative asset manager. Its credit arm led the debt facilities that funded CoreWeave''s GPU fleet, and it is one of the asset managers Nvidia has partnered with to mobilise third-party capital for compute.',
 'https://www.blackstone.com', 'BX', NULL, 1985, TRUE, 'private_credit_fund'),

('magnetar', 'Magnetar Capital', 'investor', 'USA',
 'Hedge fund and credit investor; an early backer of CoreWeave in both equity and debt, which is the pattern this dataset exists to trace — the same firm on both sides of a company''s capital structure.',
 'https://www.magnetar.com', NULL, NULL, 2005, TRUE, 'private_credit_fund'),

('brookfield', 'Brookfield Asset Management', 'investor', 'CAN',
 'Infrastructure investor financing the power and buildings AI compute runs on, increasingly alongside chipmakers rather than merely for them.',
 'https://www.brookfield.com', 'BAM', NULL, 1899, TRUE, 'private_credit_fund'),

('apollo', 'Apollo Global Management', 'investor', 'USA',
 'Alternative asset manager and one of the partners in Nvidia''s compute-financing platforms.',
 'https://www.apollo.com', 'APO', NULL, 1990, TRUE, 'private_credit_fund'),

('kkr', 'KKR & Co. Inc.', 'investor', 'USA',
 'Private equity and credit manager; a partner in Nvidia''s compute-financing platforms.',
 'https://www.kkr.com', 'KKR', NULL, 1976, TRUE, 'private_credit_fund'),

('goldman_sachs', 'The Goldman Sachs Group', 'investor', 'USA',
 'Investment bank and asset manager; a partner in Nvidia''s compute-financing platforms and an arranger of AI-infrastructure debt.',
 'https://www.goldmansachs.com', 'GS', NULL, 1869, TRUE, 'private_credit_fund'),

('blackrock', 'BlackRock, Inc.', 'investor', 'USA',
 'The largest asset manager. Through Global Infrastructure Partners it co-founded the AI Infrastructure Partnership with Microsoft and MGX, placing it in the same graph as both a hyperscaler and a sovereign fund.',
 'https://www.blackrock.com', 'BLK', NULL, 1988, TRUE, 'private_credit_fund'),

('macquarie', 'Macquarie Group', 'investor', 'AUS',
 'Investment bank and infrastructure financier; lender on GPU-backed facilities where the chips themselves are the collateral.',
 'https://www.macquarie.com', NULL, NULL, 1969, TRUE, 'private_credit_fund'),

('idf', 'Industrial Development Funding', 'investor', NULL,
 'Asset-based lender appearing alongside Macquarie in GPU-collateralised financing. Named in reporting without further detail; treated here as a participant with an undisclosed share, because that is all any source says.',
 NULL, NULL, NULL, NULL, TRUE, 'private_credit_fund'),

-- ── Sovereign and state-linked capital ──────────────────────────────────────

('mgx', 'MGX', 'investor', 'ARE',
 'Abu Dhabi AI and advanced-technology investment fund backed by Mubadala and G42. Holds positions at every layer at once — frontier labs, data-centre operators, chip supply and AI campuses — which makes it the clearest single case of one capital source underwriting an entire stack.',
 'https://www.mgx.ae', NULL, NULL, 2024, TRUE, 'sovereign_fund'),

('humain', 'HUMAIN', 'company', 'SAU',
 'Saudi AI company wholly owned by the Public Investment Fund. Channels PIF capital into frontier-lab equity abroad and data-centre capacity at home.',
 'https://humain.ai', NULL, NULL, 2025, TRUE, 'sovereign_fund'),

('saudi_nif', 'Saudi National Infrastructure Fund', 'investor', 'SAU',
 'Saudi state infrastructure financier (NIF), funding domestic AI and digital build-out.',
 'https://nif.gov.sa', NULL, NULL, 2019, TRUE, 'sovereign_fund'),

('gic', 'GIC Private Limited', 'investor', 'SGP',
 'Singapore''s sovereign wealth fund; a joint-venture partner in hyperscale data-centre capacity.',
 'https://www.gic.com.sg', NULL, NULL, 1981, TRUE, 'sovereign_fund'),

-- ── Other institutional investors ───────────────────────────────────────────

('cpp_investments', 'CPP Investments', 'investor', 'CAN',
 'Manager of the Canada Pension Plan. A pension fund appearing in AI data-centre joint ventures is the point: retirement money is now exposed to GPU utilisation assumptions.',
 'https://www.cppinvestments.com', NULL, NULL, 1997, TRUE, 'other_investor'),

('bpifrance', 'Bpifrance', 'investor', 'FRA',
 'French national investment bank; co-sponsor of European AI campus capacity and a backer of France''s frontier lab.',
 'https://www.bpifrance.fr', NULL, NULL, 2012, TRUE, 'other_investor'),

-- ── Subsidiaries and agencies that are their own counterparty ───────────────

('tsmc_arizona', 'TSMC Arizona Corporation', 'company', 'USA',
 'TSMC''s US manufacturing subsidiary and the entity that actually received the CHIPS Act award. Kept distinct from its Taiwanese parent because the money, the conditions and the jurisdiction all attach to the subsidiary — recording the grant against TSMC would misstate both the policy and the geography.',
 'https://www.tsmc.com/english/aboutTSMC/TSMC_Arizona', NULL, NULL, 2020, TRUE, 'chipmaker'),

('us_commerce', 'US Department of Commerce', 'government', 'USA',
 'Administers the CHIPS and Science Act through NIST, making it the counterparty on every US semiconductor subsidy award. Distinct from the general `us_government` entity, which covers export controls and policy: the graph is more useful with the agency that signed than with a country.',
 'https://www.commerce.gov', NULL, NULL, 1903, TRUE, 'government')

ON CONFLICT (id) DO UPDATE SET
  name         = EXCLUDED.name,
  kind         = EXCLUDED.kind,
  country_iso3 = EXCLUDED.country_iso3,
  description  = EXCLUDED.description,
  homepage_url = EXCLUDED.homepage_url,
  ticker       = EXCLUDED.ticker,
  cik          = EXCLUDED.cik,
  founded_year = EXCLUDED.founded_year,
  is_verified  = EXCLUDED.is_verified,
  sector       = EXCLUDED.sector,
  updated_at   = now();


-- ---------------------------------------------------------------------------
-- Sector for the entities 005 already seeded that this graph connects to.
--
-- Only `sector` is touched. 005 owns everything else about these rows, and a
-- second file editing a name or a CIK is how two seeds start disagreeing.
--
-- Nvidia is `chipmaker` even though it is also, in this dataset, an equity
-- investor, a lender's guarantor and an offtaker. Sector is what an entity
-- primarily IS; what it did in a particular deal is a fact about that deal and
-- lives on `event_participants.role`. Flattening the two would put Nvidia in
-- the private-credit band of the diagram and lose the loop entirely.
-- ---------------------------------------------------------------------------
UPDATE entities SET sector = v.sector, updated_at = now()
  FROM (VALUES
    ('nvidia',         'chipmaker'),
    ('tsmc',           'chipmaker'),
    ('amd',            'chipmaker'),
    ('broadcom',       'chipmaker'),
    ('microsoft',      'hyperscaler'),
    ('amazon',         'hyperscaler'),
    ('alphabet',       'hyperscaler'),
    ('oracle',         'hyperscaler'),
    ('meta',           'hyperscaler'),
    ('coreweave',      'neocloud'),
    ('openai',         'ai_lab'),
    ('anthropic',      'ai_lab'),
    ('mistral',        'ai_lab'),
    ('xai',            'ai_lab'),
    ('deepmind',       'ai_lab'),
    ('equinix',        'datacenter_operator'),
    ('digital_realty', 'datacenter_operator'),
    ('softbank',       'other_investor'),
    ('us_government',  'government')
  ) AS v(id, sector)
 WHERE entities.id = v.id
   AND entities.sector IS DISTINCT FROM v.sector;


-- ---------------------------------------------------------------------------
-- Aliases.
--
-- Every form the research table and the reporting behind it actually use, so
-- that resolution is a lookup rather than a judgement. 005's rule applies:
-- stored lowercased, lookups must lowercase too.
--
-- The important ones here are the second names for entities 005 already has.
-- 'openai global llc' and 'openai pbc' are the same lab under two legal
-- wrappers; 'microsoft azure' is Microsoft. Without these rows the financing
-- graph draws OpenAI twice and shows Microsoft investing in a company it is.
-- ---------------------------------------------------------------------------
INSERT INTO entity_aliases (alias, entity_id) VALUES
  -- Second names for entities 005 already seeded.
  ('openai global llc', 'openai'), ('openai global', 'openai'),
  ('openai pbc', 'openai'), ('openai group pbc', 'openai'),
  ('anthropic pbc', 'anthropic'),
  ('microsoft azure', 'microsoft'), ('azure', 'microsoft'),
  ('alphabet google', 'alphabet'), ('google llc', 'alphabet'),
  ('amazon web services', 'amazon'), ('amazon.com', 'amazon'),
  ('mistral', 'mistral'),

  -- GPU clouds.
  ('lambda', 'lambda'), ('lambda labs', 'lambda'),
  ('lambda compute ii llc', 'lambda'), ('lambda compute', 'lambda'),
  ('iren', 'iren'), ('iren limited', 'iren'), ('iris energy', 'iren'),

  -- Data centres.
  ('aligned', 'aligned'), ('aligned data centers', 'aligned'),
  ('naver', 'naver'), ('naver corporation', 'naver'), ('gak sejong', 'naver'),
  ('chirisa', 'chirisa'), ('chirisa technology parks', 'chirisa'),
  ('powerhouse data centers', 'powerhouse_dc'), ('powerhouse', 'powerhouse_dc'),

  -- Private credit.
  ('blue owl', 'blue_owl'), ('blue owl capital', 'blue_owl'),
  ('blue owl funds', 'blue_owl'), ('blue owl real estate', 'blue_owl'),
  ('blackstone', 'blackstone'), ('blackstone inc', 'blackstone'),
  ('blackstone tactical opportunities', 'blackstone'), ('bx', 'blackstone'),
  ('magnetar', 'magnetar'), ('magnetar capital', 'magnetar'),
  ('brookfield', 'brookfield'), ('brookfield asset management', 'brookfield'),
  ('apollo', 'apollo'), ('apollo global management', 'apollo'),
  ('kkr', 'kkr'),
  ('goldman sachs', 'goldman_sachs'), ('goldman', 'goldman_sachs'),
  ('blackrock', 'blackrock'), ('blackrock gip', 'blackrock'),
  ('global infrastructure partners', 'blackrock'),
  ('macquarie', 'macquarie'), ('macquarie group', 'macquarie'),
  ('industrial development funding', 'idf'), ('idf', 'idf'),

  -- Sovereign and institutional.
  ('mgx', 'mgx'),
  ('humain', 'humain'), ('humain (pif-owned)', 'humain'),
  ('saudi national infrastructure fund', 'saudi_nif'), ('nif', 'saudi_nif'),
  ('gic', 'gic'), ('gic private limited', 'gic'),
  ('cpp investments', 'cpp_investments'),
  ('canada pension plan investment board', 'cpp_investments'),
  ('bpifrance', 'bpifrance'),

  -- Subsidiaries and agencies.
  ('tsmc arizona', 'tsmc_arizona'), ('tsmc arizona corporation', 'tsmc_arizona'),
  ('us department of commerce', 'us_commerce'),
  ('u.s. department of commerce', 'us_commerce'),
  ('department of commerce', 'us_commerce'), ('commerce department', 'us_commerce')
ON CONFLICT (alias) DO UPDATE SET entity_id = EXCLUDED.entity_id;

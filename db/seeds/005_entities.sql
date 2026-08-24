-- ============================================================================
-- 005_entities.sql — the actors in the AI economy
--
-- Seeded by hand rather than extracted, and marked is_verified = TRUE, because
-- these are the nodes every investment edge will attach to. Entity resolution
-- failing here does not produce a small error: it splits one company into
-- several nodes and the financing graph silently shows a different structure
-- than reality.
--
-- Every CIK below was read from https://www.sec.gov/files/company_tickers.json
-- on 2026-08-25, not recalled. A wrong CIK would join a company's deals to
-- another company's financial statements.
--
-- Private companies have no CIK by definition. That is a fact about them, not a
-- gap to be filled with a guess.
-- ============================================================================

INSERT INTO entities (
  id, name, kind, country_iso3, description, homepage_url, ticker, cik,
  founded_year, is_verified
) VALUES

-- ── Chip designers and manufacturers ────────────────────────────────────────
('nvidia', 'NVIDIA Corporation', 'company', 'USA',
 'Designs the GPUs used to train and serve most large AI models. Its capital expenditure, supply commitments and equity investments are the single most informative private-sector signal in AI infrastructure.',
 'https://www.nvidia.com', 'NVDA', 1045810, 1993, TRUE),

('tsmc', 'Taiwan Semiconductor Manufacturing Company', 'company', 'TWN',
 'Manufactures the leading-edge chips that Nvidia and others design. A physical bottleneck for the entire industry: capacity here caps AI compute growth globally.',
 'https://www.tsmc.com', 'TSM', 1046179, 1987, TRUE),

('amd', 'Advanced Micro Devices', 'company', 'USA',
 'The principal competitor to Nvidia in AI accelerators. Its share of orders indicates whether the compute market is consolidating or diversifying.',
 'https://www.amd.com', 'AMD', 2488, 1969, TRUE),

('broadcom', 'Broadcom Inc.', 'company', 'USA',
 'Builds custom AI accelerators for hyperscalers and supplies the networking silicon that connects large clusters.',
 'https://www.broadcom.com', 'AVGO', 1730168, 1961, TRUE),

('intel', 'Intel Corporation', 'company', 'USA',
 'Chip designer and manufacturer, and the main recipient of US CHIPS Act support for domestic fabrication.',
 'https://www.intel.com', 'INTC', 50863, 1968, TRUE),

('micron', 'Micron Technology', 'company', 'USA',
 'Supplies the high-bandwidth memory that sits beside AI accelerators. Memory supply has repeatedly been the binding constraint on shipments.',
 'https://www.micron.com', 'MU', 723125, 1978, TRUE),

('asml', 'ASML Holding NV', 'company', 'NLD',
 'Sole supplier of extreme-ultraviolet lithography machines. Every leading-edge AI chip in the world is made on ASML equipment, making it the narrowest point in the supply chain and the focus of export controls.',
 'https://www.asml.com', 'ASML', 937966, 1984, TRUE),

('arm', 'Arm Holdings plc', 'company', 'GBR',
 'Licenses the processor architecture underlying most mobile and a growing share of data-centre silicon.',
 'https://www.arm.com', 'ARM', 1973239, 1990, TRUE),

('qualcomm', 'Qualcomm Inc.', 'company', 'USA',
 'Mobile and edge silicon; a proxy for AI inference moving from data centres onto devices.',
 'https://www.qualcomm.com', 'QCOM', 804328, 1985, TRUE),

('texas_instruments', 'Texas Instruments', 'company', 'USA',
 'Analogue and embedded semiconductors — a broad barometer of industrial electronics demand rather than AI specifically.',
 'https://www.ti.com', 'TXN', 97476, 1930, TRUE),

-- ── Hyperscalers and cloud ──────────────────────────────────────────────────
('microsoft', 'Microsoft Corporation', 'company', 'USA',
 'The largest investor in OpenAI and one of the largest builders of AI data centres. Its quarterly capital expenditure is among the clearest available measures of real AI spending.',
 'https://www.microsoft.com', 'MSFT', 789019, 1975, TRUE),

('alphabet', 'Alphabet Inc.', 'company', 'USA',
 'Parent of Google and DeepMind. Builds its own accelerators (TPUs), so its spending shows in capital expenditure rather than in chip purchases.',
 'https://abc.xyz', 'GOOGL', 1652044, 1998, TRUE),

('amazon', 'Amazon.com Inc.', 'company', 'USA',
 'Operates AWS, the largest cloud provider, and is a principal investor in Anthropic. Also designs its own training and inference silicon.',
 'https://www.amazon.com', 'AMZN', 1018724, 1994, TRUE),

('meta', 'Meta Platforms, Inc.', 'company', 'USA',
 'Builds frontier models released with open weights and spends heavily on compute without selling cloud capacity — an unusual position that makes its capex almost purely internal AI investment.',
 'https://www.meta.com', 'META', 1326801, 2004, TRUE),

('oracle', 'Oracle Corporation', 'company', 'USA',
 'Cloud infrastructure provider that has taken very large AI compute commitments, central to several of the circular financing arrangements of 2025-26.',
 'https://www.oracle.com', 'ORCL', 1341439, 1977, TRUE),

('coreweave', 'CoreWeave, Inc.', 'company', 'USA',
 'A specialised AI cloud provider renting GPU capacity. Sits at the centre of vendor-financing arrangements in which a chip supplier also invests in its own customer.',
 'https://www.coreweave.com', 'CRWV', 1769628, 2017, TRUE),

('ibm', 'International Business Machines', 'company', 'USA',
 'Enterprise AI and consulting; a proxy for adoption among large incumbent firms rather than for frontier development.',
 'https://www.ibm.com', 'IBM', 51143, 1911, TRUE),

-- ── Data-centre infrastructure ──────────────────────────────────────────────
('equinix', 'Equinix, Inc.', 'company', 'USA',
 'Data-centre operator. Its capacity additions are a physical measure of where AI infrastructure is actually being built.',
 'https://www.equinix.com', 'EQIX', 1101239, 1998, TRUE),

('digital_realty', 'Digital Realty Trust', 'company', 'USA',
 'Data-centre landlord; leasing volumes indicate demand for compute capacity ahead of it coming online.',
 'https://www.digitalrealty.com', 'DLR', 1297996, 2004, TRUE),

('vertiv', 'Vertiv Holdings Co', 'company', 'USA',
 'Supplies power and cooling equipment for data centres. A useful leading indicator: cooling is ordered before servers are installed.',
 'https://www.vertiv.com', 'VRT', 1674101, 1946, TRUE),

('supermicro', 'Super Micro Computer, Inc.', 'company', 'USA',
 'Assembles AI servers. Revenue tracks GPU deployment closely.',
 'https://www.supermicro.com', 'SMCI', 1375365, 1993, TRUE),

('dell', 'Dell Technologies Inc.', 'company', 'USA',
 'Enterprise hardware supplier; AI server backlog indicates adoption outside the hyperscalers.',
 'https://www.dell.com', 'DELL', 1571996, 1984, TRUE),

('arista', 'Arista Networks, Inc.', 'company', 'USA',
 'High-speed networking for large GPU clusters, which are bandwidth-bound as much as compute-bound.',
 'https://www.arista.com', 'ANET', 1596532, 2004, TRUE),

-- ── AI research labs. Mostly private: no CIK exists to record. ──────────────
('openai', 'OpenAI', 'research_lab', 'USA',
 'Developer of GPT models and ChatGPT. Privately held, so its finances are visible only through the disclosures of its investors and partners — which is precisely why the investment graph matters for understanding it.',
 'https://openai.com', NULL, NULL, 2015, TRUE),

('anthropic', 'Anthropic', 'research_lab', 'USA',
 'Developer of the Claude models. Privately held, principally backed by Amazon and Google.',
 'https://www.anthropic.com', NULL, NULL, 2021, TRUE),

('deepmind', 'Google DeepMind', 'research_lab', 'GBR',
 'Alphabet''s AI research division, formed by merging DeepMind and Google Brain. UK-based, which makes it the largest frontier AI operation outside the United States.',
 'https://deepmind.google', NULL, NULL, 2010, TRUE),

('xai', 'xAI', 'research_lab', 'USA',
 'Frontier model developer, notable for building its own very large training cluster rather than renting capacity.',
 'https://x.ai', NULL, NULL, 2023, TRUE),

('mistral', 'Mistral AI', 'research_lab', 'FRA',
 'The most prominent European frontier model developer, and the main data point on whether the EU can sustain independent AI capability.',
 'https://mistral.ai', NULL, NULL, 2023, TRUE),

('deepseek', 'DeepSeek', 'research_lab', 'CHN',
 'Chinese model developer whose efficiency claims challenged assumptions about how much compute frontier capability requires — economically significant regardless of how the claims resolve.',
 'https://www.deepseek.com', NULL, NULL, 2023, TRUE),

('alibaba', 'Alibaba Group Holding', 'company', 'CHN',
 'Chinese cloud provider and developer of the Qwen open-weight models.',
 'https://www.alibabagroup.com', 'BABA', 1577552, 1999, TRUE),

-- ── Investors ───────────────────────────────────────────────────────────────
('softbank', 'SoftBank Group', 'investor', 'JPN',
 'Japanese investment holding company and one of the largest single backers of AI infrastructure. Not in the SEC ticker map: it files as a foreign private issuer.',
 'https://group.softbank', NULL, NULL, 1981, TRUE),

-- ── Governments ─────────────────────────────────────────────────────────────
('us_government', 'United States Government', 'government', 'USA',
 'Sets export controls on AI chips and funds domestic semiconductor manufacturing. The most consequential single policy actor in the sector.',
 'https://www.usa.gov', NULL, NULL, NULL, TRUE),

('european_commission', 'European Commission', 'government', 'FRA',
 'Sets EU AI regulation, including the AI Act, and funds European compute infrastructure.',
 'https://commission.europa.eu', NULL, NULL, NULL, TRUE),

('uk_government', 'United Kingdom Government', 'government', 'GBR',
 'Funds UK compute capacity and hosts the AI Safety Institute.',
 'https://www.gov.uk', NULL, NULL, NULL, TRUE),

('china_government', 'Government of China', 'government', 'CHN',
 'Directs state investment into domestic semiconductor capability in response to export controls.',
 'https://www.gov.cn', NULL, NULL, NULL, TRUE)

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
  updated_at   = now();


-- ---------------------------------------------------------------------------
-- Aliases.
--
-- Every form a source might plausibly use. Stored lowercased; lookups must
-- lowercase too. Extraction without this table creates 'Nvidia', 'NVIDIA Corp'
-- and 'NVDA' as three separate nodes, which does not look like an error on a
-- graph — it looks like three companies.
-- ---------------------------------------------------------------------------
INSERT INTO entity_aliases (alias, entity_id) VALUES
  ('nvidia', 'nvidia'), ('nvidia corp', 'nvidia'), ('nvidia corporation', 'nvidia'), ('nvda', 'nvidia'),
  ('tsmc', 'tsmc'), ('taiwan semiconductor', 'tsmc'), ('taiwan semiconductor manufacturing', 'tsmc'), ('tsm', 'tsmc'),
  ('amd', 'amd'), ('advanced micro devices', 'amd'),
  ('broadcom', 'broadcom'), ('avgo', 'broadcom'),
  ('intel', 'intel'), ('intel corp', 'intel'), ('intc', 'intel'),
  ('micron', 'micron'), ('micron technology', 'micron'),
  ('asml', 'asml'), ('asml holding', 'asml'),
  ('arm', 'arm'), ('arm holdings', 'arm'),
  ('qualcomm', 'qualcomm'),
  ('texas instruments', 'texas_instruments'),
  ('microsoft', 'microsoft'), ('microsoft corp', 'microsoft'), ('msft', 'microsoft'),
  ('alphabet', 'alphabet'), ('google', 'alphabet'), ('google cloud', 'alphabet'), ('googl', 'alphabet'),
  ('amazon', 'amazon'), ('aws', 'amazon'), ('amazon web services', 'amazon'), ('amzn', 'amazon'),
  ('meta', 'meta'), ('meta platforms', 'meta'), ('facebook', 'meta'),
  ('oracle', 'oracle'), ('oracle corp', 'oracle'), ('orcl', 'oracle'),
  ('coreweave', 'coreweave'),
  ('ibm', 'ibm'), ('international business machines', 'ibm'),
  ('equinix', 'equinix'),
  ('digital realty', 'digital_realty'),
  ('vertiv', 'vertiv'),
  ('super micro', 'supermicro'), ('supermicro', 'supermicro'), ('super micro computer', 'supermicro'),
  ('dell', 'dell'), ('dell technologies', 'dell'),
  ('arista', 'arista'), ('arista networks', 'arista'),
  ('openai', 'openai'), ('open ai', 'openai'), ('chatgpt', 'openai'),
  ('anthropic', 'anthropic'), ('claude', 'anthropic'),
  ('deepmind', 'deepmind'), ('google deepmind', 'deepmind'),
  ('xai', 'xai'), ('x.ai', 'xai'), ('grok', 'xai'),
  ('mistral', 'mistral'), ('mistral ai', 'mistral'),
  ('deepseek', 'deepseek'),
  ('alibaba', 'alibaba'), ('alibaba group', 'alibaba'), ('baba', 'alibaba'),
  ('softbank', 'softbank'), ('softbank group', 'softbank'), ('vision fund', 'softbank'),
  ('us government', 'us_government'), ('white house', 'us_government'), ('united states government', 'us_government'),
  ('european commission', 'european_commission'), ('eu commission', 'european_commission'),
  ('uk government', 'uk_government'), ('british government', 'uk_government'),
  ('chinese government', 'china_government'), ('government of china', 'china_government')
ON CONFLICT (alias) DO UPDATE SET entity_id = EXCLUDED.entity_id;

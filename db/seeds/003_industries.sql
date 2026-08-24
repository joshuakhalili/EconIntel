-- ============================================================================
-- 003_industries.sql — the industry taxonomy
--
-- Two levels: broad sectors, then the sub-sectors where AI adoption is
-- economically distinct. Deliberately shallow. ISIC has hundreds of classes;
-- the AI-adoption surveys we depend on report at roughly this granularity, so
-- finer detail would be precision we cannot actually source.
--
-- Crosswalk columns (isic_rev4, nace_rev2, naics) let us join to official
-- statistics that use those standards. They are informational rather than
-- exact one-to-one mappings — several of our buckets span multiple official
-- classes, which is noted where it matters.
-- ============================================================================

-- Parents first: the self-referencing FK requires it.
INSERT INTO industries (code, name, parent_code, isic_rev4, nace_rev2, naics, sort_order) VALUES
  ('agri',      'Agriculture & Extraction',      NULL, 'A',   'A',   '11',    10),
  ('manuf',     'Manufacturing',                 NULL, 'C',   'C',   '31-33', 20),
  ('energy',    'Energy & Utilities',            NULL, 'D',   'D',   '22',    30),
  ('construct', 'Construction & Real Estate',    NULL, 'F',   'F',   '23',    40),
  ('retail',    'Retail & Wholesale',            NULL, 'G',   'G',   '44-45', 50),
  ('transport', 'Transport & Logistics',         NULL, 'H',   'H',   '48-49', 60),
  ('ict',       'Information & Communication',   NULL, 'J',   'J',   '51',    70),
  ('finance',   'Financial Services',            NULL, 'K',   'K',   '52',    80),
  ('prof',      'Professional Services',         NULL, 'M',   'M',   '54',    90),
  ('public',    'Public Administration',         NULL, 'O',   'O',   '92',   100),
  ('health',    'Health & Social Care',          NULL, 'Q',   'Q',   '62',   110),
  ('education', 'Education',                     NULL, 'P',   'P',   '61',   120),
  ('creative',  'Creative & Media',              NULL, 'R',   'R',   '71',   130),
  ('hospitality','Hospitality & Leisure',        NULL, 'I',   'I',   '72',   140)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, isic_rev4 = EXCLUDED.isic_rev4,
  nace_rev2 = EXCLUDED.nace_rev2, naics = EXCLUDED.naics,
  sort_order = EXCLUDED.sort_order;

-- Children: sub-sectors where AI adoption behaves differently from the parent.
INSERT INTO industries (code, name, parent_code, isic_rev4, nace_rev2, naics, sort_order) VALUES

  -- Manufacturing splits because semiconductor manufacturing is AI SUPPLY,
  -- while the rest of manufacturing is AI DEMAND. Aggregating them would
  -- produce a number that means nothing.
  ('manuf.semi',    'Semiconductors & Electronics', 'manuf', 'C26', 'C26', '3344', 21),
  ('manuf.auto',    'Automotive',                   'manuf', 'C29', 'C29', '3361', 22),
  ('manuf.pharma',  'Pharmaceuticals',              'manuf', 'C21', 'C21', '3254', 23),
  ('manuf.machine', 'Industrial Machinery',         'manuf', 'C28', 'C28', '3332', 24),

  -- ICT splits because "software" and "data centres" are radically different
  -- capital structures: one is people, the other is concrete and megawatts.
  ('ict.software',  'Software & IT Services',       'ict', 'J62', 'J62', '5415', 71),
  ('ict.datacentre','Data Centres & Cloud',         'ict', 'J63', 'J63', '5182', 72),
  ('ict.telecom',   'Telecommunications',           'ict', 'J61', 'J61', '5171', 73),

  ('finance.bank',  'Banking',                      'finance', 'K64', 'K64', '5221', 81),
  ('finance.insure','Insurance',                    'finance', 'K65', 'K65', '5241', 82),
  ('finance.asset', 'Asset Management',             'finance', 'K66', 'K66', '5239', 83),

  ('prof.legal',    'Legal Services',               'prof', 'M69', 'M69', '5411', 91),
  ('prof.consult',  'Consulting & Accounting',      'prof', 'M70', 'M70', '5416', 92),
  ('prof.rnd',      'Scientific R&D',               'prof', 'M72', 'M72', '5417', 93),

  -- Creative sub-sectors are where generative AI's displacement effects are
  -- most visible and most contested — worth tracking separately rather than
  -- buried inside a 'Creative & Media' aggregate.
  ('creative.film', 'Film, TV & Video',             'creative', 'J59', 'J59', '5121', 131),
  ('creative.pub',  'Publishing & News',            'creative', 'J58', 'J58', '5111', 132),
  ('creative.design','Design & Advertising',        'creative', 'M73', 'M73', '5418', 133),

  ('energy.power',  'Power Generation',             'energy', 'D351', 'D35.1', '2211', 31),
  ('energy.grid',   'Grid & Transmission',          'energy', 'D351', 'D35.1', '2212', 32)

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, parent_code = EXCLUDED.parent_code,
  isic_rev4 = EXCLUDED.isic_rev4, nace_rev2 = EXCLUDED.nace_rev2,
  naics = EXCLUDED.naics, sort_order = EXCLUDED.sort_order;

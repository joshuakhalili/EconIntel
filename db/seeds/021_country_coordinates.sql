-- Where each country sits, for the globe on the landing page.
--
-- These are label points, not centroids. For most countries the difference is
-- academic; for a few it matters and a true centroid would be wrong:
--
--   USA  placed in the continental interior. The true centroid of US territory
--        including Alaska and Hawaii falls near South Dakota but drags west;
--        a marker in the sea off Oregon would read as an error.
--   FRA  placed on the mainland. Including French Guiana and the overseas
--        departments would pull the centroid into the Atlantic.
--   NOR  placed on the southern mainland rather than averaged with Svalbard.
--   RUS  placed west of the Urals, where the population is, rather than in
--        central Siberia where the geometric centre is.
--   IDN  placed on Java. NZL on the North Island. CHL mid-country.
--
-- Rounded to three decimals — roughly 100 metres, which is far finer than a
-- country-sized dot needs and avoids implying more precision than a label
-- point has.
--
-- The six supranational aggregates are deliberately left NULL. WLD, EUU, EMU,
-- OED, HIC and LMY are not places, and giving them a coordinate would put a
-- dot somewhere that means nothing.

UPDATE countries SET latitude = c.lat, longitude = c.lon
  FROM (VALUES
    ('ARE',  24.467,  54.367),   -- Abu Dhabi
    ('ARG', -34.600, -58.383),   -- Buenos Aires
    ('AUS', -25.000, 134.000),   -- interior; population is coastal but the
                                 -- mainland centre reads correctly on a globe
    ('AUT',  47.517,  14.550),
    ('BEL',  50.850,   4.350),
    ('BRA', -14.235, -51.925),
    ('CAN',  56.130,-106.347),
    ('CHE',  46.818,   8.228),
    ('CHL', -33.450, -70.667),   -- Santiago; the country is 4,300km long
    ('CHN',  35.862, 104.195),
    ('COL',   4.571, -74.297),
    ('CZE',  49.818,  15.473),
    ('DEU',  51.166,  10.452),
    ('DNK',  56.264,   9.502),   -- Jutland, excluding Greenland
    ('EGY',  26.820,  30.802),
    ('ESP',  40.464,  -3.749),   -- mainland, excluding the Canaries
    ('FIN',  61.924,  25.748),
    ('FRA',  46.228,   2.214),   -- metropolitan France only
    ('GBR',  54.000,  -2.500),
    ('IDN',  -7.500, 110.000),   -- Java, where over half the population lives
    ('IND',  20.594,  78.963),
    ('IRL',  53.413,  -8.244),
    ('ISR',  31.046,  34.852),
    ('ITA',  41.872,  12.567),
    ('JPN',  36.205, 138.253),
    ('KEN',  -0.024,  37.906),
    ('KOR',  35.908, 127.767),
    ('MEX',  23.635,-102.553),
    ('MYS',   4.211, 101.976),
    ('NGA',   9.082,   8.675),
    ('NLD',  52.133,   5.291),
    ('NOR',  60.472,   8.469),   -- southern mainland, excluding Svalbard
    ('NZL', -38.000, 176.000),   -- North Island
    ('POL',  51.919,  19.145),
    ('PRT',  39.400,  -8.224),   -- mainland, excluding the Azores and Madeira
    ('RUS',  55.750,  37.617),   -- Moscow; the geometric centre is uninhabited
    ('SAU',  23.886,  45.079),
    ('SGP',   1.352, 103.820),
    ('SWE',  60.128,  18.644),
    ('TUR',  38.964,  35.243),
    ('TWN',  23.698, 120.961),
    ('USA',  39.500, -98.350),   -- continental interior, excluding AK and HI
    ('VNM',  14.058, 108.277),
    ('ZAF', -30.559,  22.937)
  ) AS c(iso3, lat, lon)
 WHERE countries.iso3 = c.iso3;

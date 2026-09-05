-- ============================================================================
-- 040_country_coverage.sql — where the fifty-five new countries sit
--
-- db/seeds/002 grew from 44 real countries to 99 on 2026-09-04, because that
-- table is not a picker list: `ingestWorldBankIndicator` asks the World Bank
-- API only for the ISO3 codes already in it and discards anything else the API
-- returns (src/server/ingestion/runner.js:139-152). Every multi-country World
-- Bank series was capped at 44 entities however wide the source was.
--
-- The landing globe needs a coordinate per country, so the new rows need one
-- too. This file runs after 021_country_coordinates.sql on purpose: 021 argues
-- carefully for hand-placed LABEL POINTS on the original 44 (USA in the
-- continental interior rather than at a true centroid dragged west by Alaska;
-- Russia west of the Urals where the population is), and re-running the seeds
-- must not overwrite that reasoning. Nothing here touches a row 021 sets.
--
-- WHERE THESE NUMBERS COME FROM
--
-- Capital-city coordinates as published by the World Bank's own country
-- register, fetched 2026-09-04:
--
--     curl 'https://api.worldbank.org/v2/country?format=json&per_page=400'
--
-- and rounded to three decimals, matching 021's convention — roughly 100
-- metres, far finer than a country-sized dot needs.
--
-- A capital is not a label point, and for a large country the two differ: this
-- puts Brazil's neighbours on their capitals while Brazil itself sits at its
-- geographic centre. That inconsistency is deliberate and is the cheaper error.
-- The alternative was inventing 55 label points, and a made-up centroid is a
-- number this project is not allowed to write.
--
-- ONE COORDINATE IS NOT THE WORLD BANK'S, AND WHY
--
-- Its Pakistan record gives 30.5167, 72.8 for "Islamabad". Islamabad is at
-- 33.684, 73.048, which puts the World Bank's point 353km away on a bearing of
-- 184° — almost due SOUTH of the city, and nowhere near it. (An earlier draft
-- of this note said "roughly 400km south-east", wrong on the direction and
-- loose on the distance; both were recomputed by haversine from the two
-- coordinates on the line above.) Copying an obviously wrong coordinate
-- because it came from an
-- authority is not sourcing, so the real one is used and the divergence is
-- recorded here. Every other row was checked against the country it belongs to
-- and lands inside it.
--
-- Côte d'Ivoire is worth one line as well: the World Bank labels the point
-- "Yamoussoukro" but the coordinates it gives (5.332, -4.030) are Abidjan's,
-- the former capital. Both are Ivorian, the dot lands correctly, and no
-- correction is needed — but the label in the comment below is the World
-- Bank's, not a claim of ours.
-- ============================================================================

UPDATE countries SET latitude = c.lat, longitude = c.lon
  FROM (VALUES
    -- Europe & Central Asia
    ('ALB',  41.332,   19.817),   -- Tirana
    ('BGR',  42.711,   23.324),   -- Sofia
    ('BIH',  43.861,   18.421),   -- Sarajevo
    ('CYP',  35.168,   33.374),   -- Nicosia
    ('EST',  59.439,   24.759),   -- Tallinn
    ('GRC',  37.979,   23.717),   -- Athens
    ('HRV',  45.807,   15.961),   -- Zagreb
    ('HUN',  47.498,   19.041),   -- Budapest
    ('ISL',  64.135,  -21.895),   -- Reykjavík
    ('KAZ',  51.188,   71.438),   -- Astana
    ('LTU',  54.690,   25.280),   -- Vilnius
    ('LUX',  49.610,    6.130),   -- Luxembourg City
    ('LVA',  56.947,   24.105),   -- Riga
    ('MLT',  35.904,   14.519),   -- Valletta
    ('MNE',  42.460,   19.259),   -- Podgorica
    ('ROU',  44.448,   26.098),   -- Bucharest
    ('SRB',  44.802,   20.466),   -- Belgrade
    ('SVK',  48.148,   17.107),   -- Bratislava
    ('SVN',  46.055,   14.504),   -- Ljubljana
    ('UKR',  50.454,   30.504),   -- Kyiv ("Kiev" in the World Bank record)

    -- Sub-Saharan Africa
    ('AGO',  -8.812,   13.242),   -- Luanda
    ('CIV',   5.332,   -4.030),   -- labelled Yamoussoukro, coordinates Abidjan
    ('CMR',   3.872,   11.517),   -- Yaoundé
    ('ETH',   9.023,   38.747),   -- Addis Ababa
    ('GHA',   5.570,   -0.208),   -- Accra
    ('MOZ', -25.966,   32.571),   -- Maputo
    ('RWA',  -1.953,   30.059),   -- Kigali
    ('SEN',  14.725,  -17.473),   -- Dakar
    ('TZA',  -6.175,   35.738),   -- Dodoma
    ('UGA',   0.314,   32.573),   -- Kampala
    ('ZMB', -15.398,   28.294),   -- Lusaka
    ('ZWE', -17.831,   31.067),   -- Harare

    -- South Asia
    ('BGD',  23.706,   90.411),   -- Dhaka
    ('LKA',   6.921,   79.853),   -- Colombo
    ('NPL',  27.694,   85.316),   -- Kathmandu
    ('PAK',  33.684,   73.048),   -- Islamabad — NOT the World Bank's 30.5167, 72.8

    -- Middle East & North Africa
    ('DZA',  36.740,    3.051),   -- Algiers
    ('JOR',  31.950,   35.926),   -- Amman
    ('KWT',  29.372,   47.982),   -- Kuwait City
    ('MAR',  33.990,   -6.870),   -- Rabat
    ('QAT',  25.295,   51.508),   -- Doha
    ('TUN',  36.790,   10.210),   -- Tunis

    -- Latin America & Caribbean
    ('CRI',   9.637,  -84.009),   -- San José
    ('DOM',  18.479,  -69.891),   -- Santo Domingo
    ('ECU',  -0.229,  -78.524),   -- Quito
    ('GTM',  14.625,  -90.533),   -- Guatemala City
    ('PAN',   8.994,  -79.519),   -- Panama City
    ('PER', -12.093,  -77.046),   -- Lima
    ('URY', -34.894,  -56.068),   -- Montevideo

    -- East Asia & Pacific
    ('HKG',  22.396,  114.109),   -- Hong Kong
    ('KHM',  11.556,  104.874),   -- Phnom Penh
    ('MNG',  47.913,  106.937),   -- Ulaanbaatar
    ('PHL',  14.552,  121.035),   -- Manila
    ('PNG',  -9.474,  147.194),   -- Port Moresby
    ('THA',  13.731,  100.521)    -- Bangkok
  ) AS c(iso3, lat, lon)
 WHERE countries.iso3 = c.iso3;

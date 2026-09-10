-- Verified 2026-09-10 from Census's own chart JSON (40 rows; 20 current-use
-- observations). No Census API key required. This is a new questionnaire
-- series, not an extension of the older BTOS or OECD series.
INSERT INTO sources(id,name,homepage_url,api_base_url,licence,attribution_text,credibility,requires_key,notes)
VALUES ('census_btos','US Census Bureau — BTOS','https://www.census.gov/hfp/btos/data',
 'https://www.census.gov/hfp/btos/ai_national.json','US Government public data',
 'Source: U.S. Census Bureau, Business Trends and Outlook Survey (experimental data).',10,FALSE,
 'Official chart publication JSON, not Census data API. Revised AI-use wording from November 17, 2025; a level shift led Census to begin a new series. https://www.census.gov/hfp/btos/downloads/AI%20Question%20Wording%20Updates.pdf')
ON CONFLICT(id) DO UPDATE SET notes=EXCLUDED.notes;

INSERT INTO indicators(id,name,description,pillar,quantity_kind,cadence,confidence_tier,unit,unit_symbol,decimals,source_id,source_series_code,source_url,higher_is_better,has_country_dim,has_industry_dim,has_company_dim,refresh_interval,default_country_iso3)
VALUES ('census_btos.ai_use_current.USA','United States — Businesses using AI (BTOS)',
 'Share of US employer businesses reporting AI use in the previous two weeks. Experimental BTOS estimates, every two weeks. This series starts with revised question wording on November 17, 2025 and must not be joined to the earlier question. It measures self-reported use, not intensity, profitability or a causal productivity effect. Its employer-business population and question differ from Eurostat and OECD surveys. The chart publication does not supply uncertainty intervals; small changes should not be called statistically significant.',
 'adoption','rate','irregular','official','Percentage of employer businesses','%',1,'census_btos','national_current_ai_use_v2025_11',
 'https://www.census.gov/hfp/btos/data',NULL,TRUE,FALSE,FALSE,INTERVAL '14 days','USA')
ON CONFLICT(id) DO UPDATE SET description=EXCLUDED.description,source_series_code=EXCLUDED.source_series_code,is_active=TRUE;

INSERT INTO question_indicators(question_id,indicator_id,role,sort_order,country_iso3,series_panel,caption_plain,caption_expert)
VALUES ('adoption','census_btos.ai_use_current.USA','supporting',22,'USA','Census BTOS — revised November 2025 questionnaire',
 'A more timely US adoption measure: the share of employer businesses reporting AI use in the previous two weeks. This experimental survey measures use, not productivity gains. Wording changed in November 2025, so the line starts with the new questionnaire; do not join it to the earlier series or rank its level against a different national survey.',
 'Experimental national BTOS estimates from the Census chart publication. Reference windows span fourteen days. Current-use responses only; expected next-six-month use is excluded. Population and instrument are not harmonised with Eurostat/OECD. No confidence intervals are supplied in this publication, so adjacent point changes are descriptive and not significance tests.')
ON CONFLICT(question_id,indicator_id) DO UPDATE SET caption_plain=EXCLUDED.caption_plain,caption_expert=EXCLUDED.caption_expert,series_panel=EXCLUDED.series_panel;

INSERT INTO research_claims(id,question_id,statement,claim_type,verdict,geography,period,limitations,change_trigger)
VALUES ('intervention:adoption:btos-revised-question','adoption',
 'The revised Census BTOS series measures recent self-reported AI use by US employer businesses, not productivity gains or a comparable level for every national survey.',
 'descriptive','qualified','US employer businesses','Revised questionnaire from November 17, 2025',
 'Experimental survey; use is not intensity or a causal effect. The wording break prevents splicing to older BTOS observations. The chart publication supplies no uncertainty intervals.',
 'A questionnaire revision, a changed target population, or new uncertainty estimates requires a fresh interpretation.')
ON CONFLICT(id) DO UPDATE SET statement=EXCLUDED.statement,limitations=EXCLUDED.limitations,change_trigger=EXCLUDED.change_trigger;

INSERT INTO research_evidence(id,claim_id,source_url,source_title,source_version,locator,finding,method,limitations,relationship,relevance,access_basis,publication_stage)
VALUES ('intervention:adoption:btos-revised-question:publication','intervention:adoption:btos-revised-question',
 'https://www.census.gov/hfp/btos/ai_national.json','Census BTOS official national AI-use chart publication',
 'Retrieved September 10, 2026; revised-question series',
 'Rows labelled Current AI Use (Last Two Weeks); Date and Estimate fields',
 'The publication separates current-use estimates from expected use over the next six months. Only current-use rows enter this chart.',
 'Experimental national employer-business survey; the adapter selects the explicitly labelled current-use responses.',
 'No confidence intervals in this JSON publication; earlier question wording and other national instruments are not interchangeable.',
 'supports','This source establishes what the plotted US series measures, not an effect of AI on output or employment.',
 'full_text','official_data')
ON CONFLICT(id) DO UPDATE SET finding=EXCLUDED.finding,limitations=EXCLUDED.limitations,relevance=EXCLUDED.relevance,source_version=EXCLUDED.source_version;

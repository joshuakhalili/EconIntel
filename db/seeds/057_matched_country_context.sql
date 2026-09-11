-- Primary WDI glossary definitions verified 2026-09-10. No new adapter or key.
-- Matched CONCEPTS across economies, not claims of equal survey quality or AI effects.
INSERT INTO indicators(id,name,description,pillar,quantity_kind,cadence,confidence_tier,unit,unit_symbol,decimals,source_id,source_series_code,source_url,higher_is_better,has_country_dim,has_industry_dim,has_company_dim,refresh_interval,default_country_iso3)
VALUES
('wb.SL.GDP.PCAP.EM.KD','GDP per person employed (constant 2021 PPP dollars)',
 'GDP divided by total employment, in constant 2021 PPP international dollars. Economy-wide labour productivity per worker, not per hour. Employment estimates include modelled/imputed data; rankings require country-specific quality checks. No causal AI attribution.',
 'adoption','currency','annual','official','constant_2021_ppp_international_dollars','$',0,'worldbank','SL.GDP.PCAP.EM.KD','https://data.worldbank.org/indicator/SL.GDP.PCAP.EM.KD',NULL,TRUE,FALSE,FALSE,INTERVAL '7 days','USA'),
('wb.SL.EMP.TOTL.SP.ZS','Employment-to-population ratio, ages 15+ (ILO modelled)',
 'Employed people as a percentage of the population aged15+, both sexes. Includes ILO modelled estimates. Demographic and labour-force-participation changes affect this ratio; it is not an unemployment rate or an estimate of AI displacement.',
 'adoption','rate','annual','official','percent','%',1,'worldbank','SL.EMP.TOTL.SP.ZS','https://data.worldbank.org/indicator/SL.EMP.TOTL.SP.ZS',NULL,TRUE,FALSE,FALSE,INTERVAL '7 days','USA'),
('wb.NE.GDI.FTOT.ZS','Gross fixed capital formation (% of GDP)',
 'National-accounts acquisitions less disposals of fixed assets as a share of GDP. Covers the whole economy, not AI capital expenditure; GDP denominator movements and SNA compilation differences qualify comparisons.',
 'adoption','rate','annual','official','percent_of_gdp','%',1,'worldbank','NE.GDI.FTOT.ZS','https://data.worldbank.org/indicator/NE.GDI.FTOT.ZS',NULL,TRUE,FALSE,FALSE,INTERVAL '7 days','USA')
ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,unit=EXCLUDED.unit,is_active=TRUE;

INSERT INTO question_indicators(question_id,indicator_id,role,sort_order,country_iso3,series_panel,caption_plain,caption_expert)
VALUES
('productivity','wb.SL.GDP.PCAP.EM.KD','supporting',90,'USA','Economy-wide output per worker — WDI context',
 'An economy-wide productivity benchmark in constant2021PPP dollars per employed person. This chart initially shows the US; country coverage links offer other economies using the same concept. It is not output per hour or an estimate of AI gains.',
 'GDP/total employment uses modelled employment inputs. Changes in hours, sector composition, capital intensity and non-AI technology all affect it. WDI warns against rankings based on imputed observations; inspect national data quality before comparisons.'),
('jobs','wb.SL.EMP.TOTL.SP.ZS','supporting',90,'USA','Employment-to-population — WDI/ILO context',
 'The share of people aged15+ who are employed complements the unemployment rate: people outside the labour force remain in its denominator. The US is shown initially; the same definition is available through country coverage. This is context, not proof of AI job losses.',
 'Both-sexes ILO modelled employment/population ratio. Ageing, education, participation and imputation can move the ratio independently of AI. This is not the share of workers retained and should not be ranked across countries without quality checks.'),
('money','wb.NE.GDI.FTOT.ZS','supporting',90,'USA','Whole-economy fixed investment — WDI context',
 'Fixed investment as a share of GDP provides a whole-economy scale comparison. It includes much more than AI and cannot identify AI spending or returns. The US is shown initially; other economies are accessible through country coverage.',
 'Gross fixed capital formation comprises acquisitions less disposals of fixed assets under national accounts. A changing GDP denominator and differences in SNA vintages qualify the ratio. It is neither real investment growth nor investment by AI-exposed firms.')
ON CONFLICT(question_id,indicator_id) DO UPDATE SET caption_plain=EXCLUDED.caption_plain,caption_expert=EXCLUDED.caption_expert,series_panel=EXCLUDED.series_panel;

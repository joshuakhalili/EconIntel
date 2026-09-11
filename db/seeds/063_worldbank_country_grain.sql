-- Forward correction to 057. default_country_iso3 is a provider-series
-- attribution, NOT a preferred UI selection (migration 0008). These World
-- Bank series carry geography on every observation. The question placements
-- retain their explicit USA selection; CountrySelect independently defaults
-- to USA when available. Do not weaken the country-attribution data gate.
UPDATE indicators
   SET default_country_iso3 = NULL
 WHERE id IN ('wb.SL.GDP.PCAP.EM.KD', 'wb.SL.EMP.TOTL.SP.ZS')
   AND source_id = 'worldbank'
   AND has_country_dim
   AND default_country_iso3 = 'USA';

-- Units, cleaned of the notes that were written into them during ingestion.
--
-- `unit` is rendered next to a number. Nineteen of them carried working notes
-- from whoever added the series — spot-checked values, DBnomics dimension
-- codes, reminders that the feed uses 'NA' sentinel strings — and several were
-- cut off mid-word at sixty characters, so a chart could print
-- "10,000 yuan (dimension unit=10000_yuan); 2025 value 1,548,31" as though
-- that were the unit of measurement.
--
-- `displayUnit()` in the client already truncates these at the parenthesis, so
-- none of this is visible on the site today. That is a mitigation in one
-- formatting helper, not a fix: the API serves the raw string, and so does
-- anyone reading the database directly. The note belonged in `description`,
-- never in `unit`.
--
-- Where a parenthetical carried something real — the RBA's observed index base
-- period — it is kept, in the unit proper. Where it carried an ingestion
-- detail, it is dropped.
--
-- Pure UPDATE, so idempotent by construction; no ON CONFLICT needed. Guarded by
-- `scripts/check-data.js`, which fails on any unit over sixty characters or
-- containing a parenthesis.

UPDATE indicators SET unit = 'Index, 2020 = 100'
 WHERE id = 'dbn.BOJ.CGPI.2300440015';

UPDATE indicators SET unit = 'Index, 2015 = 100'
 WHERE id IN ('dbn.BOJ.SPPI.5201330001',
              'dbn.BOJ.SPPI.5201350004',
              'dbn.BOJ.SPPI.5201450003');

UPDATE indicators SET unit = 'Percent of posts vacant, unadjusted'
 WHERE id = 'dbn.Eurostat.jvs_q_nace2.Q.NSA.J.TOTAL.JVR.EU27_2020';

UPDATE indicators SET unit = 'Job openings per applicant'
 WHERE id = 'dbn.JILPT.e0208.M.1.1';

-- China's National Bureau of Statistics publishes in units of ten thousand and
-- one hundred million rather than thousands and millions. Spelled out, because
-- "10,000 persons" beside a value of 55 invites reading 55 as the headcount.
UPDATE indicators SET unit = 'Tens of thousands of persons'
 WHERE id = 'dbn.NBS.A_A0406.A040608';

UPDATE indicators SET unit = 'Yuan per year'
 WHERE id = 'dbn.NBS.A_A040I.A040I08';

UPDATE indicators SET unit = 'Hundreds of millions of kWh'
 WHERE id = 'dbn.NBS.A_A0711.A071107';

UPDATE indicators SET unit = 'Tens of thousands of units'
 WHERE id = 'dbn.NBS.A_A0E0H.A0E0H28';

UPDATE indicators SET unit = 'Tens of thousands of yuan'
 WHERE id = 'dbn.NBS.A_A0G11.A0G1101';

UPDATE indicators SET unit = 'Hundreds of millions of units'
 WHERE id = 'dbn.NBS.M_A02092Q.A02092Q01';

UPDATE indicators SET unit = 'Index, 2023 = 100, seasonally adjusted'
 WHERE id IN ('dbn.ONS.PRDY.DJR5.Q', 'dbn.ONS.PRDY.GYY7.Q');

UPDATE indicators SET unit = 'Thousands of vacancies'
 WHERE id = 'dbn.ONS.UNEM.JP9P.M';

-- The RBA series carries no published base year; 2025-Q4 = 100.0 is the base
-- observed in the data itself. Kept, because an index without its base is not
-- interpretable, and stated as observed rather than as published.
UPDATE indicators SET unit = 'Index, observed base 2025 Q4 = 100'
 WHERE id = 'dbn.RBA.H4.GNFPROSQI';

UPDATE indicators SET unit = 'Percent, year-ended growth'
 WHERE id = 'dbn.RBA.H4.GNFULCYP';

UPDATE indicators SET unit = 'Percent of labour force'
 WHERE id = 'dbn.RBA.H5.GLFOSVTLF';

UPDATE indicators SET unit = 'Tens of thousands of persons'
 WHERE id = 'dbn.STATJP.MIm.M.EP.B.TTP.SA';

UPDATE indicators SET updated_at = now()
 WHERE id IN ('dbn.BOJ.CGPI.2300440015', 'dbn.BOJ.SPPI.5201330001',
              'dbn.BOJ.SPPI.5201350004', 'dbn.BOJ.SPPI.5201450003',
              'dbn.Eurostat.jvs_q_nace2.Q.NSA.J.TOTAL.JVR.EU27_2020',
              'dbn.JILPT.e0208.M.1.1', 'dbn.NBS.A_A0406.A040608',
              'dbn.NBS.A_A040I.A040I08', 'dbn.NBS.A_A0711.A071107',
              'dbn.NBS.A_A0E0H.A0E0H28', 'dbn.NBS.A_A0G11.A0G1101',
              'dbn.NBS.M_A02092Q.A02092Q01', 'dbn.ONS.PRDY.DJR5.Q',
              'dbn.ONS.PRDY.GYY7.Q', 'dbn.ONS.UNEM.JP9P.M',
              'dbn.RBA.H4.GNFPROSQI', 'dbn.RBA.H4.GNFULCYP',
              'dbn.RBA.H5.GLFOSVTLF', 'dbn.STATJP.MIm.M.EP.B.TTP.SA');

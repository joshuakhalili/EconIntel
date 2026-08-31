-- ═══════════════════════════════════════════════════════════════════════════
-- Put the newly ingested series on the pages they were ingested FOR.
--
-- Seed 032 loaded nine indicators and 1,855 observations. `check:data` then
-- failed with "has observations but appears on no question" for seven of
-- them, and that check is right: an indicator with data that no page shows is
-- data nobody can reach. Ingesting a series and not placing it is half a job.
--
-- PLACEMENT IS NOT INVENTED HERE
--
-- Each of these was requested by a specific verdict in
-- docs/research/blocked-questions-2026-08-30-verdicts.md, which names the page
-- it is meant to sharpen. The mapping below is that document's, not a fresh
-- editorial judgement:
--
--   BLS CES 5132 + FRED 518 + JOLTS  →  sector-jobs
--   BEA software components          →  software-not-steel
--   Epoch GPU price-performance      →  chip-prices
--
-- CAPTIONS DESCRIBE THE SERIES, NEVER THE FINDING
--
-- `caption_plain` says what the chart shows and why it is on the page.
-- `caption_expert` says what the series actually measures and where it
-- misleads. Neither states what the data proves — that belongs in the answer,
-- which a person writes. Every caption below is checkable against the
-- indicator's own metadata or against the source's documentation.
--
-- ALL THREE QUESTIONS ARE STILL is_active = FALSE
--
-- This makes them worth reading. It does not publish them. Activation stays
-- the single UPDATE at the end of the verdicts file, for Joshua, after he has
-- read the prose.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── sector-jobs ────────────────────────────────────────────────────────────
-- The question is whether the industry that sells AI is hiring. Its hero is
-- `fred.USINFO`, the whole information supersector — which buries the answer,
-- because that aggregate also contains telecoms and publishing, industries
-- shrinking for reasons that have nothing to do with AI. These three split the
-- AI-intensive part out.
INSERT INTO question_indicators
  (question_id, indicator_id, role, sort_order, chart_group, caption_plain, caption_expert)
VALUES
  ('sector-jobs', 'dbn.BLS.ce.CES5051320001', 'supporting', 10, 'information-subsectors',
   'Software publishers, counted on their own rather than inside the whole information sector.',
   'CES NAICS 5132. The 2022 NAICS revision renumbered software publishers from 5112 to 5132; series under the old code return nothing. Seasonally adjusted, thousands of employees. Ends December 2024 — no fresher source publishes this series.'),

  ('sector-jobs', 'fred.CES5051800001', 'supporting', 11, 'information-subsectors',
   'Data processing and hosting — the part of the sector that runs the computers, counted separately.',
   'CES NAICS 518, taken from FRED rather than the DBnomics mirror because that mirror stops in January 2025. Seasonally adjusted, thousands of employees.'),

  ('sector-jobs', 'dbn.BLS.jt.JTS510000000000000JOL', 'supporting', 12, 'information-flows',
   'Open positions in the information sector. A count of jobs employers are trying to fill, which moves before employment does.',
   'JOLTS, seasonally adjusted, thousands of positions on the last business day of the month. Openings are a stock, not a flow, and are not comparable with the hires and quits beside them except in direction.'),

  ('sector-jobs', 'dbn.BLS.jt.JTS510000000000000HIL', 'supporting', 13, 'information-flows',
   'People hired into the sector each month.',
   'JOLTS hires, seasonally adjusted, thousands per month. A gross flow: it counts every hire, including replacements, so it does not net against separations.'),

  ('sector-jobs', 'dbn.BLS.jt.JTS510000000000000QUL', 'supporting', 14, 'information-flows',
   'People who left voluntarily each month. Quits fall when workers think another job would be hard to find.',
   'JOLTS quits, seasonally adjusted, thousands per month. Voluntary separations only — layoffs and discharges are a separate series and are not included here.')
ON CONFLICT (question_id, indicator_id) DO UPDATE
  SET role = EXCLUDED.role,
      sort_order = EXCLUDED.sort_order,
      chart_group = EXCLUDED.chart_group,
      caption_plain = EXCLUDED.caption_plain,
      caption_expert = EXCLUDED.caption_expert;

-- ── software-not-steel ─────────────────────────────────────────────────────
-- The caveat on this page says own-account software is estimated from
-- programmer pay rather than observed. These three are the split that makes
-- that checkable instead of merely asserted.
--
-- They share a chart_group and a unit, so they draw on one axis. They also
-- sum to `dbn.BEA.NIPA-T50605.B985RC-A`, which is already on the page —
-- verified against 2020-2024, exact in four years and one million out in the
-- fifth on rounding.
INSERT INTO question_indicators
  (question_id, indicator_id, role, sort_order, chart_group, caption_plain, caption_expert)
VALUES
  ('software-not-steel', 'dbn.BEA.NIPA-T50605.Y003RC-A', 'supporting', 20, 'software-by-type',
   'Prepackaged software — bought off the shelf. The part of the total that is an actual purchase.',
   'BEA NIPA table 5.6.5, millions of current dollars, annual. Nominal: no deflator is applied here, so movement across decades is partly the dollar.'),

  ('software-not-steel', 'dbn.BEA.NIPA-T50605.Y004RC-A', 'supporting', 21, 'software-by-type',
   'Custom software — commissioned from someone else. Also a real transaction, at a negotiated price.',
   'BEA NIPA table 5.6.5, millions of current dollars, annual. Nominal.'),

  ('software-not-steel', 'dbn.BEA.NIPA-T50605.Y005RC-A', 'supporting', 22, 'software-by-type',
   'Own-account software — written in house. Nobody bought this; the figure is an estimate of what it cost to produce.',
   'BEA NIPA table 5.6.5, millions of current dollars, annual. There is no transaction to observe, so BEA estimates it as the compensation of the programmers and analysts doing the work, plus intermediate inputs and a margin — which means it rises with programmer pay whether or not more software was produced. It was 14% of the total in 2024, down from 47% in 1985. Nominal.')
ON CONFLICT (question_id, indicator_id) DO UPDATE
  SET role = EXCLUDED.role,
      sort_order = EXCLUDED.sort_order,
      chart_group = EXCLUDED.chart_group,
      caption_plain = EXCLUDED.caption_plain,
      caption_expert = EXCLUDED.caption_expert;

-- ── chip-prices ────────────────────────────────────────────────────────────
-- The page asks whether chips have stopped getting cheaper. Its hero is a
-- nominal PPI that has been flat since 2021, and its caveat says the official
-- index is documented to understate quality-adjusted declines.
--
-- This series is the closest published thing to the quality-adjusted measure
-- that argument wants, and its limits are severe enough that they are stated
-- in the caption rather than left to the caveat. It is `context`, not
-- `supporting`, precisely because it cannot settle the question.
INSERT INTO question_indicators
  (question_id, indicator_id, role, sort_order, chart_group, caption_plain, caption_expert)
VALUES
  ('chip-prices', 'epoch.gpu_price_performance', 'context', 30, NULL,
   'What a dollar buys in raw computing power, over the same years the price index above stayed flat. It improved roughly 430 times between 2008 and 2022.',
   'Epoch AI, running maximum of FLOP/s per US dollar across notable GPUs and ML accelerators, CC BY. THREE LIMITS, all load-bearing. It is a convenience sample of notable chips, not a priced basket, so it is not a price index and cannot be compared like one. The step in 2018 is partly the best-performing part moving from FP32 to tensor FP16 — a change in what is being measured, not only in what it costs. And it is flat after September 2022, which reflects what has been sampled since, not a halt: no published index measures quality-adjusted compute prices to the present, which is why the caveat argues the point in prose rather than showing it.')
ON CONFLICT (question_id, indicator_id) DO UPDATE
  SET role = EXCLUDED.role,
      sort_order = EXCLUDED.sort_order,
      chart_group = EXCLUDED.chart_group,
      caption_plain = EXCLUDED.caption_plain,
      caption_expert = EXCLUDED.caption_expert;

-- ── productivity ───────────────────────────────────────────────────────────
-- The last orphan, and the only one here not named by the research.
--
-- `derived.ai_news_volume` is the GDELT series that was broken three ways
-- until 2026-08-30 and now holds 116 monthly observations — the first it has
-- ever had. It has never appeared on a page, because there was never anything
-- to draw.
--
-- Its placement is not a fresh judgement either: the indicator's own
-- description, written when it was defined, says it is "a measure of ATTENTION,
-- included as a deliberate contrast to the hard indicators — divergence
-- between attention and measured productivity is itself the finding." This is
-- that page.
--
-- `context`, not `supporting`. It is not evidence about productivity; it is
-- the thing productivity is being contrasted with, and a reader should not be
-- able to mistake a coverage share for a measurement. Its own confidence tier
-- already renders it distinctly.
--
-- NOTE: `productivity` is is_active = TRUE. This is the one placement in this
-- file that changes a page readers can already see.
INSERT INTO question_indicators
  (question_id, indicator_id, role, sort_order, chart_group, caption_plain, caption_expert)
VALUES
  ('productivity', 'derived.ai_news_volume', 'context', 19, NULL,
   'How much the world has been talking about AI and the economy, over the same period the productivity figures above barely moved. The gap between the two is the point.',
   'GDELT, share of monitored worldwide news coverage matching an AI-economics query, monthly. A share rather than a count, so it cannot rise merely because GDELT indexed more outlets. It measures coverage, not activity, and nothing here establishes that attention causes or predicts anything — it is on this page as the contrast, not as evidence.')
ON CONFLICT (question_id, indicator_id) DO UPDATE
  SET role = EXCLUDED.role,
      sort_order = EXCLUDED.sort_order,
      chart_group = EXCLUDED.chart_group,
      caption_plain = EXCLUDED.caption_plain,
      caption_expert = EXCLUDED.caption_expert;

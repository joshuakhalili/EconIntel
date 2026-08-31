# Simulation coefficients — published sources

Compiled 31 Aug 2026. Every number below is a cell or a quoted sentence from a
document I downloaded and read in full text. Where I did arithmetic on published
cells, it is labelled as arithmetic, not as a finding.

Sign convention: the model wants magnitudes positive. Phillips-curve slopes are
published as **negative** coefficients on the unemployment rate/gap (inflation falls
when unemployment rises). I report the magnitude and flag the flip each time.

---

## 1. `fiscal_multiplier_y1` — investment/capital spending shock, year one

| value | country | source | uncertainty |
|---|---|---|---|
| **0.457** | advanced economies (17 OECD) | Abiad, Abdul; Furceri, Davide; Topalova, Petia (2015), *The Macroeconomic Effects of Public Investment: Evidence from Advanced Economies*, IMF Working Paper WP/15/95, **Table 1, column (1) "Baseline", row k = 0**, p. 17. Sample 17 OECD economies, 1985–2013, annual data, country and year fixed effects. | SE 0.147 (clustered by country). Across the ten specifications in Table 1: 0.264 – 1.013. Leave-one-country-out (p. 18): "the impact of public investment on output ranges from 0.4 to 0.57 at time k=0". |

- Fetched: `https://infrastructuregovern.imf.org/content/dam/PIMA/Knowledge-Hub/Publications/pubdocuments/The%20Macroeconomic%20Effects%20of%20Public%20Investment%20Evidence%20from%20Advanced%20Economies.pdf` (HTTP 200)
- Published version: Abiad, Furceri & Topalova (2016), "The macroeconomic effects of public investment: Evidence from advanced economies", *Journal of Macroeconomics* 50: 224–240. Same analysis appears as IMF *World Economic Outlook*, October 2014, Chapter 3.
- The shock is an unanticipated 1 percentage point of GDP increase in public investment; the coefficient is the % change in the **level** of output. Paper text (p. 11): *"increases the level of output by about 0.4 percent in the same year … this implies short-term investment spending multipliers of about 0.4."* This is exactly the model's `multiplier(t) × (shock/GDP) × 100`.
- Sign: published positive. No flip needed.
- **State dependence** (p. 12): during periods of large negative output gaps the short-term multiplier is **0.6** and significant; with large positive output gaps it is **0.2** and not significant. In low-growth periods output rises "about 1½ percent in the same year" (Figure 2).

**Corroboration.** Ramey, Valerie A. (2019), "Ten Years after the Financial Crisis: What Have We Learned from the Renaissance in Fiscal Research?", *Journal of Economic Perspectives* 33(2): 89–114, p. 102: *"There is surprisingly little recent aggregate evidence on multipliers for public investment. As one example, Iltzetzki, Mendoza, and Végh (2010) found multipliers for public investment that ranged between 0.4 in the short-run to 1.6 in the long-run in their panel of countries."* Fetched: `https://econweb.ucsd.edu/~vramey/research/Ramey_Fiscal_JEP.pdf`.

Note the *published* Ilzetzki–Mendoza–Végh paper (2013, *Journal of Monetary Economics* 60(2): 239–254, §4.8, read at `https://www.sas.upenn.edu/~egme/pp/MendozaetalJME.pdf`) is more guarded: for **high-income** countries *"Estimates at all horizons are similar to the government consumption multipliers of Fig. 3. We have no robust evidence that government investment is more productive in its stimulative effect in high-income countries."* Their consumption multipliers for high-income countries are 0.3–0.7 (Ramey 2019, Table 1). The 0.6-impact figure in that section is for **developing** countries. So Ramey's 0.4→1.6 sentence should not be read as a high-income investment result.

---

## 2. `multiplier_decay` — **NOT VERIFIABLE as a published coefficient**

No source I found publishes a geometric decay parameter for a fiscal multiplier. Worse, both IMF sources say the investment multiplier **rises** in years 2–4, so a decay below 1 is not supported by the literature over the horizon the model runs.

Two published anchors, in order of directness:

**(a) The actual annual profile.** Abiad, Furceri & Topalova (2015), IMF WP/15/95, Table 1, column (1) baseline — output level response to a 1pp-of-GDP public investment shock:

| horizon k | coefficient | SE |
|---|---|---|
| 0 | 0.457 | 0.147 |
| 1 | 0.755 | 0.238 |
| 2 | 1.035 | 0.322 |
| 3 | 1.389 | 0.394 |
| 4 | 1.539 | 0.441 |

*My arithmetic on those cells* (not a published number): the year-on-year ratios are 1.65, 1.37, 1.34, 1.11. If `multiplier_decay` is fitted to this profile it is **greater than 1**, i.e. amplification, not decay. Paper text p. 11: *"Four years after an unanticipated shock … the level of real output is 1.5 percent higher, which corresponds to a medium-term fiscal multiplier of about 1.4."*

**(b) The IMF's own guidance for general spending.** Batini, Nicoletta; Eyraud, Luc; Forni, Lorenzo; Weber, Anke (2014), *Fiscal Multipliers: Size, Determinants, and Use in Macroeconomic Projections*, IMF Technical Notes and Manuals TNM/14/04, **Section II.C "Persistence of Fiscal Multipliers" (p. 9–10)** and **Section III (p. 16)**:

> *"the output effect of an exogenous fiscal shock vanishes within five years—even if fiscal measures are permanent. The effect does not decline in a linear way but usually has an inverted U shape, with the maximum impact occurring in the second year … Based on the literature review by Mineshima and others (2014), the second-year multiplier is, on average, 10–30 percent higher than in the first-year."*

> *"it seems safe to assume a decline to zero in multiplier size over five years, with possibly a higher multiplier in the second year (by 10 to 30 percent relative to the first-year)."* (p. 16)

And specifically on investment (p. 10):

> *"the effect of a permanent discretionary change in public investment or corporate taxes is longer, and may even be permanent, with multipliers steadily increasing after the first year towards their long-term values (Coenen and others, 2012)."*

- imf.org blocks direct fetching (403 on every attempt, including the Wayback snapshot, which itself archived a 403 page). I read the PDF through `https://r.jina.ai/https://www.imf.org/external/pubs/ft/tnm/2014/tnm1404.pdf` (HTTP 200, 33 pages, full text). The canonical URL is `https://www.imf.org/external/pubs/ft/tnm/2014/tnm1404.pdf`.
- TNM/14/04 also gives the well-known first-year averages (Section II.A, p. 3): *"first-year multipliers amount on average to 0.75 for government spending and 0.25 for government revenues in AEs"* — citing Mineshima and others (2014), a survey of 41 studies.

**What this means for the model.** Any single `multiplier_decay` is a calibration choice, not an estimate. The two defensible options, both traceable:
- `1.65` — the AFT Table 1 year-1/year-0 ratio, if the model should reproduce the published investment profile.
- Something in the region of `0.6` — the only value consistent with TNM/14/04's "decline to zero over five years" guidance for spending generally, but it contradicts that source's own statement that year 2 is 10–30% *higher* than year 1, and contradicts AFT for investment specifically.

I would report this as a modelling assumption in the UI rather than as a sourced coefficient.

---

## 3. `wage_phillips_slope` — pp of nominal wage growth per pp of unemployment

| value | country | source | uncertainty |
|---|---|---|---|
| **0.332** | advanced economies (29) | IMF, *World Economic Outlook*, October 2017, Chapter 2, "Recent Wage Dynamics in Advanced Economies: Drivers and Implications", **Annex Table 2.3.1, column (1), row "Unemployment Rate"**, p. 104. Published as **−0.332**. | SE 0.0261. Across the eight columns of that table: 0.261 – 0.464. |

- Fetched: `https://www.imf.org/-/media/Files/Publications/WEO/2017/October/pdf/analytical-chapters/c2.ashx` via `https://r.jina.ai/…` (HTTP 200, 44 pages).
- Dependent variable: **year-over-year** growth rate of compensation per hour of workers excluding the self-employed. Quarterly panel, 2000:Q1–2016:Q4, 29 advanced economies (USA, GBR, DEU, FRA, ITA, JPN, CAN all in sample). Country and year fixed effects. Specification follows Galí (2011).
- **Frequency note:** because the dependent variable is an annual (y/y) growth rate and the regressor is the contemporaneous unemployment level, this coefficient is already in "pp of annual wage growth per pp of unemployment". No quarterly→annual conversion needed.
- Chapter text (p. 90): *"A 1 percentage point increase in the unemployment rate is associated with a 0.3 to 0.4 percentage point decline in nominal wage growth."*
- Sign: source is negative; flip to positive for the model, because the model multiplies by `-unemploymentGap`.

**Corroboration (four independent estimates, all in the 0.17–0.48 band):**

| value | scope | source |
|---|---|---|
| 0.361 – 0.476 | 31 advanced economies, 2000Q1–2019Q4 | IMF *WEO* Oct 2022, Ch. 2 Online Annex, **Annex Table 2.4.1**, "Unemployment" row, AE columns. SEs 0.088–0.140. `https://www.imf.org/-/media/files/publications/weo/2022/october/english/ch2annex.pdf` |
| 0.36 (SE 0.06) | 10 advanced economies, 1992Q1–2018Q2 | Cunningham, Rose; Rai, Vikram & Hess, Kristina (2019), *Exploring Wage Phillips Curves in Advanced Economies*, Bank of Canada Staff Discussion Paper 2019-8 (August 2019, updated October 2019), **Table A-1, column (2)**, "UR gap (HP)". `https://www.bankofcanada.ca/wp-content/uploads/2019/08/sdp2019-8.pdf` |
| 0.180 (SE 0.055) | USA, average hourly earnings, 1988–2018 | Hooper, Peter; Mishkin, Frederic S.; Sufi, Amir (2019), *Prospects for Inflation in a High Pressure Economy: Is the Phillips Curve Dead or Is It Just Hibernating?*, NBER Working Paper 25792, **Table 2.6, "Linear" column**. Full-sample 1964–2018 (Table 2.3): 0.379 (SE 0.081). `https://www.nber.org/system/files/working_papers/w25792/w25792.pdf` |
| 0.17 (SE 0.07) | 18-country panel, pre-pandemic (≤2019Q4) | Jordà, Òscar & Nechio, Fernanda (2023), "Inflation and wage growth since the pandemic", *European Economic Review* 156: 104474, **Table 1**, "Unemployment gap" row. |

**Nonlinearity is the main caveat.** HMS Table 2.6 spline: slope 0.089 when the unemployment gap is positive, 0.929 when it is negative. A single linear slope understates the response in a tight labour market by a factor of roughly ten in their estimates.

---

## 4. `wage_persistence` — share of last period's wage-growth deviation carried forward

| value | country | source | uncertainty |
|---|---|---|---|
| **0.55** | 18-country advanced panel, sample ≤ 2019Q4 | Jordà, Òscar & Nechio, Fernanda (2023), "Inflation and wage growth since the pandemic", *European Economic Review* 156: 104474, **Table 1, "Lagged nominal wages π^w_{t-1}", pre-pandemic column**. | SE 0.07 (clustered by country). Post-pandemic (≥2020Q3) estimate: **0.34** (SE 0.09). |
| 0.65 / 0.64 | 10 advanced economies, 1992Q1–2018Q2 | Cunningham, Rose; Rai, Vikram & Hess, Kristina (2019), *Exploring Wage Phillips Curves in Advanced Economies*, Bank of Canada Staff Discussion Paper 2019-8, **Table A-5, columns (3) and (4)**, row "Nominal wages = L,". Arellano–Bond GMM. Text p. 15: *"The lagged wage growth variable has a large, positive coefficient of about 0.65, indicating wage growth is quite smooth, with a strong autoregressive component."* | SE 0.02 and 0.03. |

- Jordà & Nechio read at `https://pmc.ncbi.nlm.nih.gov/articles/PMC10184877/` (open access, full text incl. Table 1); DOI 10.1016/j.euroecorev.2023.104474, verified via Crossref.
- Both estimates are **< 1**, so the difference equation converges. No source I found argues for ≥ 1.
- **Frequency problem — read this before using the number.** In both papers the data are **quarterly** and the dependent variable is a **year-over-year** wage growth rate, so the lag is `π^w` one *quarter* earlier, not one *year* earlier. There is no published annual AR(1) on wage growth that I could find. Dropping 0.55–0.65 straight into an annual step overstates carry-over — the four-quarter-lag autocorrelation of an overlapping y/y series is materially lower, and it cannot be recovered by raising 0.55 to the fourth power (the overlapping-window MA structure breaks that). I have not converted it and I do not recommend that anyone does silently.

**One correction worth carrying.** Jordà & Nechio's footnote 9 says *"his estimate of the parameter on the lagged wage inflation average is 0.642"*, referring to Galí (2011). I checked Galí's paper directly (Galí, Jordi (2011), "The Return of the Wage Phillips Curve", *Journal of the European Economic Association* 9(3): 436–461; NBER WP 15758, `https://www.nber.org/system/files/working_papers/w15758/w15758.pdf`). In his **Table 2, column (8)** the 0.642 (SE 0.052) coefficient sits on the row `π^(4)_{t-1}` — **lagged four-quarter PRICE inflation**, the indexation term, not lagged wage inflation. His §4.2 text is explicit: *"a positive coefficient on lagged price inflation in the presence of indexation."* **Do not use 0.642 as `wage_persistence`.** (It is arguably a decent source for the *reverse* channel — price→wage indexation — if the model ever wants one.)

---

## 5. `price_phillips_slope` — pp of price inflation per pp of unemployment

Per-country, from Blanchard, Olivier; Cerutti, Eugenio; Summers, Lawrence (2015), *Inflation and Activity — Two Explorations and Their Monetary Policy Implications*, NBER Working Paper 21726 (also IMF WP/15/230), **Table 6, "Slope of the Phillips Curve", sample period 1990–2014**. Fetched: `https://www.nber.org/system/files/working_papers/w21726/w21726.pdf`.

Specification (their eq. 2): `π_t = θ(u_t − u*_t) + λπ^e_t + μπ^m_t + ε_t`, headline CPI inflation as a quarterly annualised rate, **no lagged-inflation term**, constant coefficients. Because there is no lag structure, θ is directly the pp effect on the annual inflation rate of a 1pp unemployment gap sustained through the year — no conversion needed.

| country | θ (natural rate = u*) | SE | θ (natural rate = ū) | SE | usable? |
|---|---|---|---|---|---|
| USA | −0.29 *** | 0.07 | −0.25 *** | 0.07 | yes → **0.29** |
| JPN | −1.09 *** | 0.17 | −0.50 *** | 0.09 | yes, but the two specs differ by 2× → **0.50–1.09** |
| DEU | −0.11 | 0.09 | −0.12 | 0.07 | **not significant in either spec** |
| GBR | +0.04 | 0.11 | +0.02 | 0.10 | **wrong sign, not significant** |
| FRA | −0.49 *** | 0.14 | −0.32 *** | 0.08 | yes → **0.32–0.49** |
| ITA | −0.12 | 0.09 | −0.15 *** | 0.06 | significant only in the ū spec → **0.15** |
| CAN | −0.32 *** | 0.16 | −0.21 | 0.13 | significant only in the u* spec → **0.32** |

Their own text (p. 24): *"Countries where the coefficient is not significant in either specification are Germany, the United Kingdom, Norway, and Denmark."* And on the UK specifically (fn. 17): *"there appears to be a stable and significant relation between wage inflation, expected inflation and unemployment (Broadbent, 2014). What appears to have broken down is the relation between wage inflation and price inflation."*

**US-only alternative,** with a lag structure, from Hooper, Mishkin & Sufi (2019), NBER WP 25792:

| value | sample | table |
|---|---|---|
| 0.141 (SE 0.036) | US core PCE, 1961–2018, linear | Table 2.1 |
| 0.037 (SE 0.032, **not significant**) | US core PCE, 1988–2018, linear | Table 2.5 |

These are short-run coefficients on quarterly annualised core PCE **with lagged inflation in the equation**. HMS give the conversion themselves (fn. 2 and 4, p. 12): the long-run slope is `β/(1 − Σγ) = β/δ`. That is 0.141/0.193 = **0.73** for 1961–2018 and 0.037/0.526 = **0.07** for 1988–2018. I am reporting that arithmetic explicitly rather than folding it in.

**IMF WEO April 2013 Ch. 3 ("The Dog That Didn't Bark") gave me nothing citable.** I read the full chapter (`https://www.imf.org/external/pubs/ft/weo/2013/01/pdf/c3.pdf` via r.jina.ai, HTTP 200). It reports κ only as a **cross-country median with an interquartile range in Figures 3.6 and 3.7** — there is no table of country point estimates anywhere in the chapter or its appendix. Reading a value off a figure is not the standard this project is holding itself to. Blanchard, Cerutti & Summers (2015) is the same research programme re-estimated by one of its authors with a table, which is why I used it instead.

---

## 6. `wage_price_passthrough` — share of excess wage growth reaching prices

| value | country | source | uncertainty |
|---|---|---|---|
| **≈0.33** | Europe (EU15+3 and newer EU member states) | Boranova, Vizhdan; Huidrom, Raju; Nowak, Sylwia; Topalova, Petia; Tulin, Volodymyr; Varghese, Richard (2019), *Wage Growth and Inflation in Europe: A Puzzle?*, IMF Working Paper WP/19/280, **Section III.A, p. 13, and Figure 3, panel 3**: *"The passthrough from wages to prices at the end of 3 years is about one-third, with a slightly higher estimate for the newer EU member states."* | Not published as a point estimate with a standard error — it is the ratio of two cumulative impulse responses from a panel VAR. Two-standard-deviation bands are shown on the underlying IRFs in Figure 3 panels 1–2. |

- Fetched: `https://www.imf.org/-/media/files/publications/wp/2019/wpiea2019280-print-pdf.pdf` via r.jina.ai (HTTP 200, 40 pages).
- **Horizon:** this is cumulative over **three years**, defined as (cumulative price response) ÷ (cumulative wage response). It is not a one-year coefficient. Using it as an annual pass-through in a one-year step is an approximation, and I am flagging it rather than adjusting it.
- **Regime dependence is large and published:**
  - Post-2008: *"The passthrough ratio declined to less than 20 percent"* (Section III.B, p. 13, Figure 4 panel 2).
  - Low-inflation regime: *"a 1 percentage point wage increase raises inflation by a cumulative 0.3 percent over three years, with an estimated passthrough ratio of about 11 percent."* High-inflation regime: *"passthrough ratio of about a third"* (Section IV.A, Figure 5 panels 3–4).
  - Well-anchored expectations (75th percentile): 0.9pp cumulative over 3 years.
- Sign: published positive.

**Corroboration and dissent.**
- Bobeica, Elena; Ciccarelli, Matteo; Vansteenkiste, Isabel (2019), *The Link between Labor Cost and Price Inflation in the Euro Area*, ECB Working Paper 2235 — quarterly, 1985Q1–2018Q1, Germany/France/Italy/Spain. Finds a strong link; pass-through is *"systematically lower in periods of low inflation"* and lower for supply than demand shocks. Fetched: `https://www.ecb.europa.eu/pub/pdf/scpwps/ecb.wp2235~69b97077ff.en.pdf`. Boranova et al. explicitly state their estimates are *"quite similar to those of Bobeica, Ciccarelli and Vansteenkiste (2019) and Bundesbank (2019)."*
- **Counterpoint for the US:** Peneva & Rudd (2017), "The Passthrough of Labor Costs to Price Inflation", *Journal of Money, Credit and Banking* — as characterised in ECB WP 2235 p. 6, they *"show how the pass-through of labor cost growth to price inflation in the US has declined over the past several decades (to the point where it is currently close to zero)."* I did not read Peneva & Rudd directly; this is a second-hand characterisation and should be treated as such.

---

# Plain answers to the three questions

## What I could not verify

**`multiplier_decay`.** No published paper gives a geometric decay parameter for a fiscal multiplier. What I tried: IMF TNM/14/04 (read in full — it has a whole section on persistence but expresses it qualitatively, as "second year 10–30% higher, then to zero by year five"); Ramey (2019) JEP Tables 1–3 (all cumulative multipliers, which by construction cannot give a per-year decay); Ilzetzki–Mendoza–Végh 2013 §4.8 and Fig. 9 (cumulative); Abiad–Furceri–Topalova WP/15/95 Table 1 (this *does* give the annual level path, and it rises). Any single decay number is a calibration.

**Per-country `fiscal_multiplier_y1`.** AFT is a 17-country panel with no country breakdown; TNM/14/04's "bucket approach" is explicitly a substitute for country estimates, not a set of them.

**An annual-frequency `wage_persistence`.** Everything published is a quarterly lag on a y/y series. I found no annual estimate.

**Anything from IMF WEO April 2013 Ch. 3.** The chapter genuinely does not contain a table of country slopes — only figures.

## Where the literature disagrees enough that a point estimate misleads

1. **The investment multiplier's time profile.** The IMF says it rises for four years (0.46 → 1.54). Ramey's survey says there is *"surprisingly little recent aggregate evidence"* on investment multipliers at all, and the published Ilzetzki–Mendoza–Végh paper says it is indistinguishable from the consumption multiplier in high-income countries. The AFT year-one number is solid; the shape after that is contested.

2. **State dependence of the multiplier.** AFT: 0.6 in a large negative output gap vs 0.2 (insignificant) in a positive one. Auerbach & Gorodnichenko (2012), as reported by Ramey (2019, p. 102): 2.2 in recessions, −0.3 in expansions. Ramey's own assessment on the next page: *"subsequent research has found many of the state-dependent results to be very fragile … The more robust methods generally fail to produce multipliers above one during recessions or times of slack."* A single linear multiplier is a defensible simplification but the range around it is roughly 0.2 to 2.2.

3. **Phillips-curve nonlinearity.** HMS Table 2.6: the wage slope is 0.09 above NAIRU and 0.93 below it. A linear model with one slope is wrong in both directions depending on where the simulation puts unemployment.

4. **Whether the price Phillips curve exists at all for some countries.** Germany and the UK have insignificant slopes over 1990–2014 in Blanchard–Cerutti–Summers, and the UK's point estimate has the wrong sign. HMS find the US price slope insignificant post-1988 (0.037, SE 0.032). The *wage* Phillips curve, by contrast, is robustly significant everywhere I looked. If one of the two channels has to carry the model, it should be the wage one.

5. **Wage-price pass-through.** One-third in Europe over the full sample, under 20% post-2008, ~11% in low-inflation regimes, and "close to zero" for the US in Peneva & Rudd. This is the coefficient with the widest honest range — a factor of three or more depending on regime.

## Is per-country differentiation supportable?

**Mostly no. One advanced-economy set is the honest answer, with one partial exception.**

- `fiscal_multiplier_y1`: **advanced-economy only.** No per-country source.
- `multiplier_decay`: **advanced-economy only**, and flagged as an assumption.
- `wage_phillips_slope`: **advanced-economy only.** The WEO Oct 2017 table's column (4) reports the *average* of country-specific estimates (0.464), not the individual countries, and I found no published table of per-country wage-PC slopes for all seven.
- `wage_persistence`: **advanced-economy only.**
- `wage_price_passthrough`: **Europe only**, and the honest framing is "Europe, three-year cumulative"; there is no comparable USA/JPN/CAN number, and what US evidence exists points much lower.
- `price_phillips_slope`: **this is the one that could be per-country** — Blanchard–Cerutti–Summers Table 6 covers all seven. But three of the seven (DEU, GBR, ITA) are statistically indistinguishable from zero, and GBR's sign is wrong. Publishing a differentiated set that implies Germany's Phillips curve is 0.11 and Britain's is −0.04 would give an appearance of precision the table does not support. If differentiation is wanted here, it should ship with the significance markers and the wrong-sign note visible to the reader, or not at all.

My recommendation: one advanced-economy parameter set, with the per-country BCS table available as a documented alternative for `price_phillips_slope` if the UI can show significance alongside it.

---

## Fetch notes for whoever repeats this

- `imf.org` returns **403** to curl regardless of headers, and the Wayback Machine's snapshot of the TNM PDF is itself an archived 403 page. The working route is the reader proxy: `curl -sL -o out.txt "https://r.jina.ai/https://www.imf.org/<path>.pdf"` — returns clean markdown with tables mostly intact. This worked for TNM/14/04, WEO Apr 2013 Ch.3, WEO Oct 2017 Ch.2, WEO Oct 2022 Ch.2 + annex, and WP/19/280.
- One IMF paper *is* directly fetchable: WP/15/95 is mirrored on `infrastructuregovern.imf.org`, which is not behind the same edge rules.
- NBER (`nber.org/system/files/working_papers/wNNNNN/wNNNNN.pdf`), ECB, Bank of Canada, PMC and author pages (`econweb.ucsd.edu`, `sas.upenn.edu`) all fetch fine with a browser user-agent.

# Wage and price Phillips coefficients — per-country search

Compiled 2 Sep 2026. Follows `simulation-coefficients-2026-08-31.md`, which
established the four coefficients below at the **advanced-economy panel** level.
The question here was narrower and harder: does the literature support a
**per-country** value for USA, GBR, DEU, FRA, ITA, JPN, CAN?

Same standard as the previous round. Every number is a named cell or a quoted
sentence from a document I downloaded and read, with the URL that returned 200,
the sample period, and the uncertainty. Arithmetic I did on published cells is
labelled as arithmetic.

**The short answer: only `price_phillips_slope` is genuinely per-country for all
seven. No country has a defensible complete set across all four.** Two countries
— Germany and Japan — have *some* published number in every row, and both have
two of the four compromised: one is a coefficient its own authors wrote a paper
to debunk, another has units I could not resolve. The reasoning is at the bottom.

---

## Sign conventions — read this before using any number below

Three different conventions appear in the sources, and two of them look
identical on the page while meaning opposite things.

| convention | who uses it | what a **positive** published coefficient means |
|---|---|---|
| **A.** slope on `(u − u*)` or on `u` | Blanchard–Cerutti–Summers; Hooper–Mishkin–Sufi; IMF WEO; Bank of Canada; Bonam et al. | inflation *rises* when unemployment rises — perverse |
| **B.** slope on `(u* − u)` | **OECD WP 1579, all tables** | inflation *rises* when unemployment falls — normal |
| **C.** slope on a labour-shortage / tightness index | Bonam et al. Table 2 | inflation rises when the labour market tightens — normal |

The engine wants magnitudes, and it multiplies by `-unemploymentGap`. So:

- **Convention A sources need a sign flip.** Published −0.29 → use 0.29.
- **Convention B sources do NOT need a flip.** Published +0.87 → use 0.87.
- Convention C is not in the engine's units at all and cannot be converted.

This matters concretely. OECD publishes Germany's price slope as **+0.87** and
Blanchard–Cerutti–Summers publish it as **−0.11**. Those are *not* a
disagreement about direction. Both say "inflation falls when unemployment
rises". They disagree about *magnitude and significance*, which is a different
and much more interesting problem — see §3.

The OECD states its convention explicitly, in ECO/WKP(2019)49 footnote 3, p. 7:

> *"The sign convention adopted in [1], and throughout the paper, is such that a
> positive unemployment gap is a situation where actual unemployment is lower
> than equilibrium unemployment so that the labour market can be characterised as
> facing excess demand pressures."*

---

## 1. `wage_phillips_slope` — pp of nominal wage growth per pp of unemployment

### Per-country: three of seven, from one source

Bonam, Dennis; de Haan, Jakob; van Limbergen, Duncan (2018), *Time-varying wage
Phillips curves in the euro area with a new measure for labor market slack*,
De Nederlandsche Bank Working Paper No. 587, February 2018, **Table 1, row
"Unemployment gap, s_t", p. 12**.

| country | published coefficient | SE | needs flip? | magnitude for the engine |
|---|---|---|---|---|
| **DEU** | **−0.421 \*\*\*** | 0.118 | yes (convention A) | 0.421 — **but see the caveat below** |
| **FRA** | **−0.100 \*\*\*** | 0.033 | yes | 0.100 |
| **ITA** | −0.060 | 0.067 | — | **not significant; do not use** |
| (NLD) | −0.134 \*\* | 0.060 | yes | 0.134 |
| (ESP) | −0.044 \*\* | 0.018 | yes | 0.044 |

- Fetched: `https://r.jina.ai/https://www.dnb.nl/media/mgzheumf/working-paper-no-587_tcm47-373421.pdf` (HTTP 200, 30 pages). Direct curl to dnb.nl returns 403.
- Published version: Bonam, de Haan & van Limbergen (2021), *Economic Modelling* 96: 157–171, DOI `10.1016/j.econmod.2020.12.027` (verified via Crossref).
- Specification (their eq. 2): `w_t = ω + ρ·w_{t−1} + γ·s_t + α·π^e_t + e_t`, OLS, constant parameters.
- Dependent variable: **year-over-year growth rate of negotiated wages**, ECB Statistical Data Warehouse. Chosen over compensation per employee because (their footnote 8) compensation measures are *"subject to one-offs (e.g. bonuses), changes in social contributions, fiscal policy shocks, wage drift and compositional effects."*
- Slack: European Commission unemployment gap. Expectations: one-year-ahead Consensus Forecasts.
- Sample: 1999Q1–2016Q2, quarterly, 69 observations. Adj. R²: DE 0.542, FR 0.945, IT 0.779.

**The German number is disowned by its own authors.** This is the single most
important caveat in this document. The constant-parameter Table 1 is a warm-up;
the paper's actual result is a Bayesian time-varying-parameter estimate, and on
that basis (p. 16):

> *"imposing a time-invariant Phillips curve slope may cause one to mistakenly
> conclude that the wage/slack relationship is significant, even though it is not
> (as we find for Germany), or the other way around (in the case of Italy)."*

And earlier, on Germany specifically: *"Towards the end of the sample, the
wage/slack relationship in Germany becomes insignificant (in Bayesian terms)."*
So Table 1's −0.421 is exactly the artefact the paper was written to expose.
Italy's insignificant −0.060 is the mirror image — the authors think Italy's
curve *is* alive once time variation is allowed, but they publish that only as a
chart (their Figure 4), not as a number.

Their Table 2 (p. 13) re-estimates with the EC labour-shortage indicator instead
of the unemployment gap: DE +0.068\*\*\*, FR +0.014\*\*\*, IT +0.018 (n.s.).
Convention C — positive, no flip — but the units are survey-index points, not
percentage points of unemployment, so these are **not convertible** to what the
engine wants. They are here only to show the ranking changes completely.

### USA: available, from a different literature

Hooper, Peter; Mishkin, Frederic S.; Sufi, Amir (2019), *Prospects for Inflation
in a High Pressure Economy: Is the Phillips Curve Dead or Is It Just
Hibernating?*, NBER Working Paper 25792. Fetched:
`https://www.nber.org/system/files/working_papers/w25792/w25792.pdf` (HTTP 200).

| value | sample | table | SE |
|---|---|---|---|
| **−0.180 \*\*\*** → magnitude **0.180** | 1988–2018, average hourly earnings | **Table 2.6, "ugap", Linear column, p. 22** | 0.055 |
| **−0.379 \*\*\*** → magnitude **0.379** | 1964–2018, average hourly earnings | **Table 2.3, "ugap", Linear column, p. 18** | 0.081 |
| −0.403 \*\*\* → magnitude 0.403 | 1954–2018, compensation per hour | Table 2.4, Linear column | (not read) |

Convention A, flip needed. Quarterly data, `ugap = u − u*` in percentage points.
Their own summary of the wage curve across all four wage measures (p. 22):
*"these results show short run Phillips curve slopes in the vicinity of -0.2 to
-0.3, considerably steeper than for the price Phillips curves over this period."*

**Nonlinearity, again.** Table 2.6 spline: 0.089 above NAIRU, 0.929 below it.
The previous round already flagged this; it is confirmed.

### JPN: published, but the units cannot be pinned down — do not use

Hoshi, Takeo & Kashyap, Anil K (2020), *The Great Disconnect: The Decoupling of
Wage and Price Inflation in Japan*, NBER Working Paper 27332, **Table 2, Panel A
("Wage Inflation for All Workers"), row "Lagged UNEMP", p. 26**. Fetched:
`https://www.nber.org/system/files/working_papers/w27332/w27332.pdf` (HTTP 200).

| sample | coefficient | SE | t |
|---|---|---|---|
| 1981–1997 | −0.0756 | 0.0121 | −6.25 |
| 1998–2018 | −0.0234 | 0.0078 | −2.99 |

Convention A. Significant in both sub-samples, and the break is the paper's whole
point. **But I could not establish the units, and so I am not converting it.**

The dependent variable is defined on p. 5 as the *"four quarter change in the
natural logarithm"* of wages — a fraction, not a percentage. Three cross-checks
against the authors' own prose disagree by a factor of ten:

- Bonus panel, pre-1998 (p. 9): a 0.2pp unemployment fall *"would raise bonuses
  by about 0.4 percentage point"*; coefficient 0.0195. That implies **×100**
  (0.2 × 1.95 = 0.39). ✓
- Bonus panel, post-1998: same sentence gives 0.7pp; coefficient 0.0342. Also
  **×100** (0.2 × 3.42 = 0.68). ✓
- Wage panel, pre-1998 (p. 9): *"when unemployment rose by 0.2 percentage points
  in one quarter, inflation would fall by about 0.15 percentage point in the next
  quarter"*; coefficient 0.0756. That implies **×10** (0.2 × 0.756 = 0.15). ✗

Two of three say the wage coefficient means 7.56pp of annual wage growth per pp
of unemployment, which is implausibly steep; the third says 0.756, which is
plausible. One of those sentences has a typo and I cannot tell which. Reporting
the cell and refusing the conversion is the correct outcome here. If Japan's wage
slope becomes load-bearing, the fix is to read the published version or write to
the authors, not to guess.

### GBR and CAN: not available

I found no published per-country wage Phillips slope for the United Kingdom or
Canada. What I checked, and what each one actually contains, is in §5.

Note the one substantive claim about the UK, from Blanchard, Cerutti & Summers
(2015) footnote 17, p. 24: *"In the case of the United Kingdom, there appears to
be a stable and significant relation between wage inflation, expected inflation
and unemployment (Broadbent, 2014). What appears to have broken down is the
relation between wage inflation and price inflation."* That is a claim that a UK
wage Phillips curve exists — sourced to a speech, with no coefficient given
anywhere in BCS.

### Advanced-economy fallbacks (all verified first-hand this round)

| value | scope | source | note |
|---|---|---|---|
| **0.332** (pub. −0.332, SE 0.0261) | 29 AEs, 2000Q1–2016Q4 | Hong, Gee Hee; Köczán, Zsóka; Lian, Weicheng; Nabar, Malhar (2018), *More Slack than Meets the Eye? Recent Wage Dynamics in Advanced Economies*, IMF WP/18/50, **Table 3, column (1), "Unemployment Rate", p. 19** | This is the working-paper twin of WEO Oct 2017 Ch. 2, Annex Table 2.3.1 — same cell, cited in the previous round. Read directly this time. |
| 0.354–0.476 (pub. negative) | 31 AEs, 2000Q1–2019Q4 | IMF *WEO* Oct 2022, Ch. 2 Online Annex, **Annex Table 2.4.1**, AE columns, "Unemployment" row. SEs 0.0839–0.140. | Column-to-sample alignment in the reader-proxy text is not fully reliable; treat as a range, not four separate estimates. |
| 0.36 (pub. −0.36, SE 0.06) | 10 AEs, 1992Q1–2018Q2 | Cunningham, Rose; Rai, Vikram; Hess, Kristina (2019), Bank of Canada SDP 2019-8, **Table A-1, col. (2), "UR gap (HP)"** | Specification has **no** lagged wage term. |
| **0.13 (pub. −0.13, SE 0.04)** | same | same, **Table A-5, col. (3)**, Arellano–Bond | Specification **does** have a lagged wage term (0.65). |

**Do not pair 0.36 with a persistence of 0.65.** They come from different columns
of the same paper and the second already nets out the first. *My arithmetic on
those cells:* the implied long-run slope from the Arellano–Bond column is
0.13 / (1 − 0.65) = **0.371**, which reproduces the 0.36 baseline almost exactly.
Column (4) of the same table gives 0.08 / (1 − 0.64) = 0.222 against an 0.30
baseline — looser, same direction. If the engine carries a `wage_persistence`
term at all, the slope that goes with it is ≈0.13, not ≈0.36. Using 0.36
alongside 0.65 roughly triples the long-run response.

---

## 2. `wage_persistence` — AR coefficient on lagged wage growth

### Per-country: three of seven, same source, same table

Bonam, de Haan & van Limbergen (2018), DNB WP 587, **Table 1, row "Lagged wage
growth, w_{t−1}", p. 12**. Published **positive**; no flip.

| country | coefficient | SE |
|---|---|---|
| **DEU** | **0.511 \*\*\*** | 0.098 |
| **FRA** | **0.818 \*\*\*** | 0.044 |
| **ITA** | **0.771 \*\*\*** | 0.088 |
| (NLD) | 0.808 \*\*\* | 0.044 |
| (ESP) | 0.731 \*\*\* | 0.069 |

All < 1, so the difference equation converges. Their Table 2, with the
labour-shortage slack measure, gives DE 0.566, FR 0.856, IT 0.821 — the paper
notes (p. 13) that the alternative specification *"points (at least for most
countries) to a somewhat stronger persistence in wage growth dynamics."* So
persistence is specification-sensitive at the ±0.05 level, which is small
compared with the frequency problem below.

**The frequency problem is unchanged and it is the binding constraint.** The
previous round flagged it for the panel estimates; it applies identically here.
The data are **quarterly** and the dependent variable is a **year-over-year**
growth rate, so `w_{t−1}` is wage growth one *quarter* earlier, not one *year*
earlier. Dropping 0.82 into an annual step overstates carry-over badly, and
raising 0.82 to the fourth power does not fix it — the overlapping-window
moving-average structure of a y/y series breaks that identity. I have not
converted these and I do not recommend anyone does silently. I found no
annual-frequency wage-persistence estimate for any country.

### JPN: published, unit-free, but not significant

Hoshi & Kashyap (2020), NBER WP 27332, **Table 2, Panel A, p. 26**. The wage
series is modelled as AR(2).

| sample | AR(1) | AR(2) | sum | significance |
|---|---|---|---|---|
| 1981–1997 | 0.2659 (0.1141, t = 2.33) | 0.2305 (0.1384, t = 1.67) | **0.496** | AR(1) significant at 5%, AR(2) not |
| 1998–2018 | 0.0945 (0.1040, t = 0.91) | 0.2016 (0.1209, t = 1.67) | **0.296** | **neither significant** |

Unlike the slope, these are unit-free, so the units problem in §1 does not touch
them. But for the modern sample **neither AR term is statistically distinguishable
from zero**, so "Japanese wage growth has persistence 0.30" is not a claim this
table supports. Same quarterly-lag-on-a-y/y-series caveat as everywhere else.

### USA, GBR, CAN: not available

The two obvious US candidates both turn out not to contain a lagged-wage term at
all:

- **Galí (2011)** — I re-verified the correction the previous round made, because
  it is load-bearing and I am building on it. In Galí, Jordi (2011), "The Return
  of the Wage Phillips Curve", NBER WP 15758, **Table 2, p. 39** (PDF page 39,
  confirmed by word-coordinate extraction), the 0.642 (SE 0.052) coefficient sits
  on the row `π^(4)_{t−1}` — **four-quarter lagged PRICE inflation**. The row
  above it, `π_{t−1}`, carries 0.500 / 0.505 / 0.522 and is one-quarter lagged
  price inflation. His §4.2 text confirms the reading: the model predicts *"a
  positive coefficient on lagged price inflation in the presence of indexation."*
  There is **no lagged wage inflation term anywhere in Galí's specification**, so
  the paper cannot supply a `wage_persistence` at all. The previous round's
  warning stands, verified independently.
- **Hooper, Mishkin & Sufi (2019)** — their wage equations carry "Sum Lag Infl.
  Coeffs." (0.373 for 1988–2018 in Table 2.6; 0.957 for 1964–2018 in Table 2.3),
  which is again **lagged price inflation in a wage equation**, not lagged wage
  growth. Do not use these as persistence either. They are the price→wage
  indexation channel, which is the *reverse* of `wage_price_passthrough` and is
  the one channel in this whole exercise that is well-sourced per country and
  currently unused by the engine.
- **IMF WP/18/50** — Table 3 likewise has "Lagged Inflation 0.215\*\*\* (0.0438)"
  and no lagged wage term.

### Advanced-economy fallbacks

0.55 (SE 0.07) pre-pandemic and 0.34 (SE 0.09) post-pandemic — Jordà & Nechio
(2023), *European Economic Review* 156: 104474, Table 1. And 0.65 / 0.64 —
Bank of Canada SDP 2019-8, Table A-5, cols. (3) and (4), Arellano–Bond, SEs 0.02
and 0.03. Both cited in the previous round; the Bank of Canada cells re-read and
confirmed this round.

---

## 3. `price_phillips_slope` — pp of price inflation per pp of unemployment

**This is the one coefficient with genuine per-country coverage of all seven, and
now from two independent sources.** They agree on some countries and disagree
sharply on others, which is itself the finding.

### Source A — OECD, all seven, convention B (no flip)

Turner, David; Chalaux, Thomas; Guillemette, Yvan; Rusticelli, Elena (2019),
*Insights from OECD Phillips Curve Equations on Recent Inflation Outcomes*, OECD
Economics Department Working Paper No. 1579, ECO/WKP(2019)49.
Fetched: `https://one.oecd.org/document/ECO/WKP(2019)49/en/pdf` (HTTP 200, 44 pages).

**Table 1, "Long-run GAPUNR coefficient", OECD unemployment-gap column, p. 9.**
Sample 1998Q1–2019Q1 for every equation, quarterly. Dependent variable: core CPI
(core PCE for the United States; harmonised core for European countries).

| country | long-run coefficient | Adj. R² | flip? | usable? |
|---|---|---|---|---|
| USA | **0.11 \*\*\*** | 0.50 | **no** | yes |
| JPN | **0.69 \*\*\*** | 0.68 | no | yes |
| DEU | **0.87 \*\*\*** | 0.30 | no | yes — but contradicts source B, see below |
| GBR | **−0.30 \*** | 0.46 | no | **wrong sign under convention B** — implies inflation *rises* with unemployment |
| FRA | **1.00 \*** | 0.33 | no | significant only at 10% |
| ITA | **0.37 \*\*\*** | 0.66 | no | yes |
| CAN | 0.18 | 0.29 | no | **not significant** |
| (euro area) | 0.32 \* | 0.25 | no | — |

Robustness: the same table re-runs each equation with the IMF's and the European
Commission's unemployment-gap series without changing the specification. USA 0.11
/ 0.15 / 0.10; JPN 0.69 / 0.67 / NA; ITA 0.37 / 0.49 / 0.43 — stable. DEU 0.87 /
0.52 / **0.13 (n.s.)** and FRA 1.00 / 0.88 (n.s.) / 0.39 (n.s.) — not stable at
all. Germany's headline 0.87 survives only on the OECD's own gap measure.

Paper's own summary (¶9, p. 10): *"The coefficients on the unemployment gap in
the updated Phillips curves are positive for an overwhelming majority of OECD
countries and statistically significant to at least the 10% level in about 60% of
these cases."*

**The impact coefficients, and how the long-run number is built.** Annex Table
B1, panel (i) "G7 and euro area aggregate", p. 37, gives the full estimated
equation per country. Their eq. [6] is
`Δπ_t = τ − θ·π_{t−1} + b̃(L)·Δπ_{t−1} + β·(U*_t − U_t) + supply shocks`.

Column (1) for each country (the current Secretariat specification, without the
"slippage" term):

| country | β on `(U* − U)` | θ on lagged inflation | Adj. R² |
|---|---|---|---|
| USA | 0.03 \*\*\* | 0.97 \*\*\* | 0.50 |
| JPN | 0.08 \*\*\* | 0.48 \*\*\* | 0.68 |
| DEU | 0.13 \*\*\* | 0.58 \*\*\* | 0.30 |
| GBR | −0.05 \* | 0.66 \*\*\* | 0.46 |
| FRA | 0.04 \* | 0.15 \*\* | 0.33 |
| ITA | 0.04 \*\*\* | 0.42 \*\*\* | 0.66 |
| CAN | 0.03 | 0.59 \*\*\* | 0.29 |
| euro area | 0.02 \* | 0.24 \*\*\* | 0.25 |

pdftotext collapses this table's columns, so I extracted it with word-level
bounding boxes and aligned each value to its column header by x-coordinate. Two
independent checks confirm the alignment:

1. The Adj. R² row matches Table 1's OECD-gap column exactly for all eight
   entries.
2. *My arithmetic on those cells:* the dependent variable is the **quarterly**
   change in core inflation, so the long-run effect on the annualised inflation
   rate is `4β/θ`. USA 4(0.03)/0.97 = 0.124 vs 0.11 published. JPN 4(0.08)/0.48 =
   0.667 vs 0.69. DEU 4(0.13)/0.58 = 0.897 vs 0.87. GBR 4(−0.05)/0.66 = −0.303 vs
   −0.30. FRA 4(0.04)/0.15 = 1.067 vs 1.00. ITA 4(0.04)/0.42 = 0.381 vs 0.37. CAN
   4(0.03)/0.59 = 0.203 vs 0.18. Every one reproduces to rounding on two-decimal
   inputs.

If the engine ever wants a **price**-inflation persistence parameter, `(1 − θ)`
from that table is a defensible per-country source: USA 0.03, JPN 0.52, DEU 0.42,
GBR 0.34, FRA 0.85, ITA 0.58, CAN 0.41 — quarterly, anchored-expectations
framework, not the same object as `wage_persistence` and not a substitute for it.

**Short-run non-linear slopes, five of seven.** Table 4, p. 26, Markov-switching:

| country | linear | positive gap (boom) | negative gap (slack) | boom ÷ linear |
|---|---|---|---|---|
| USA | 0.014 \* | 0.030 \*\*\* | 0.000 | 2.1 |
| JPN | 0.084 \*\*\* | 0.089 \*\* | 0.060 \*\* | 1.1 |
| DEU | 0.121 \*\*\* | 0.155 \*\*\* | 0.110 \* | 1.3 |
| FRA | 0.037 \* | 0.089 \*\*\* | 0.034 \* | 2.4 |
| ITA | 0.040 \*\*\* | 0.111 \* | 0.016 | 2.7 |
| (euro area) | 0.021 \* | 0.092 \*\*\* | 0.012 | 4.5 |

Canada is absent. The United Kingdom is excluded, and the footnote (18, p. 25) is
blunt about why: *"The United Kingdom was excluded because of the difficulty of
getting a correctly-signed unemployment gap term in the linear specification."*

### Source B — Blanchard, Cerutti & Summers, all seven, convention A (flip needed)

Re-read and re-verified this round: NBER WP 21726, **Table 6, "Slope of the
Phillips Curve", p. 24**, sample 1990–2014, headline CPI as a
quarterly annualised rate, no lagged-inflation term. Fetched:
`https://www.nber.org/system/files/working_papers/w21726/w21726.pdf` (HTTP 200).
The table transcribed in the previous round is correct; I confirm every G7 cell.

One transcription note for whoever repeats this: the body text on p. 25 says
*"the coefficient for Japan is equal to -1.08"* while Table 6 reads **−1.09**.
Use the table.

### Where the two sources disagree, and what to do about it

| country | OECD long-run (conv. B) | BCS 1990–2014, u\* spec (conv. A → magnitude) | verdict |
|---|---|---|---|
| USA | 0.11 \*\*\* | 0.29 \*\*\* | agree on direction and significance; factor ~2.6 apart |
| JPN | 0.69 \*\*\* | 1.09 \*\*\* | agree; Japan is the steepest in both |
| ITA | 0.37 \*\*\* | 0.12 (n.s.); 0.15 \*\*\* in the ū spec | agree on direction, disagree on significance |
| FRA | 1.00 \* | 0.49 \*\*\* | agree on direction |
| CAN | 0.18 (n.s.) | 0.32 \*\*\* | **disagree on significance** |
| DEU | **0.87 \*\*\*** | **0.11 (n.s.)** | **flat contradiction** — OECD's steepest G7 country after France is BCS's textbook example of a dead Phillips curve |
| GBR | −0.30 \* (perverse) | +0.04 (n.s.), perverse | **both wrong-signed**; only source that agrees, and it agrees on failure |

Germany is worth staring at. BCS 1990–2014 says −0.11 (SE 0.09), insignificant,
and names Germany explicitly as one of four countries where the coefficient is
not significant in either specification. OECD 1998Q1–2019Q1 says +0.87,
significant at 1%. Different samples, different inflation measures (headline vs
harmonised core), different treatment of expectations (BCS drop lagged inflation
entirely; OECD anchor at the target and estimate the pull). Both are defensible.
They cannot both be used.

The UK is the only clean result: **two independent teams, twenty years apart,
both get a wrong-signed and insignificant price Phillips curve for the United
Kingdom, and one of them refused to run its non-linear model on the country at
all.** Publishing a UK price Phillips slope of any sign would be inventing one.

---

## 4. `wage_price_passthrough` — share of wage growth reaching prices

**This is the weakest of the four, and per-country it is close to empty.** Only
one G7 country has a number, and it is a sentence about a chart.

### DEU — the only per-country figure I could find

Bobeica, Elena; Ciccarelli, Matteo; Vansteenkiste, Isabel (2019), *The Link
between Labor Cost and Price Inflation in the Euro Area*, ECB Working Paper No.
2235, February 2019, **§"How does the pass-through differ across countries?",
p. 21**. Fetched:
`https://www.ecb.europa.eu/pub/pdf/scpwps/ecb.wp2235~69b97077ff.en.pdf`
(HTTP 200, 60+ pages).

> *"The pass-through in Germany is lower and clearly driven by services.
> Nevertheless, a **0.4** pass-through suggests that labour costs are being
> passed through to prices in a noticeable manner. The Bundesbank also
> acknowledges the importance of wage developments for consumer prices and
> confirms that the pass-through from wages to prices is below 50% (see Kohns
> (2018))."*

- **Value: ≈0.4. Country: Germany, total economy. Published positive; no flip.**
- Sample: 1985Q1–2018Q1, quarterly, country and sector level.
- Method: steady-state pass-through from a Cholesky-identified Bayesian VAR, four
  lags. It is the value the impulse response settles at, read off **Figure 7** —
  the paper publishes it as a chart with 68% credible bands, and this sentence is
  the only place a number appears in text.
- **Uncertainty is not published as a standard error.** Appendix F, Figure 15,
  shows recursive estimates of the steady-state pass-through distribution (median
  and 68% credible interval) for all sectors and countries; the paper says these
  are *"almost always significantly different from zero"* but never tabulates
  them. So the honest uncertainty statement is: sign is confident, magnitude is a
  point read off a chart by its own authors.

FRA, ITA and ESP get the same treatment — narrative only, no numbers:

> *"Figure 7 in this regards shows that **France** exhibits the highest
> pass-through values across all sectors … Also in **Italy** the pass-through of
> labour costs to prices is driven by services … **Spain** stands out with a low
> steady-state pass-through in the services sector."*

So the ranking is France > Italy ≈ Germany > Spain, with one number attached to
one country. Note this reverses the intuitive story: the paper flags that except
in France, the pass-through is driven by **services** rather than manufacturing,
which *"contrasts with the idea that the pass-through of wages into prices should
be higher in sectors more exposed to international competition"* (conclusions, p. 33).

### USA — no number, and the previous round's characterisation needs a correction

The previous round recorded, second-hand via ECB WP 2235, that Peneva & Rudd show
US pass-through is *"currently close to zero"*. I read Peneva & Rudd directly this
time, and **that is only half of what they found.**

Peneva, Ekaterina V. & Rudd, Jeremy B. (2015), *The Passthrough of Labor Costs to
Price Inflation*, Federal Reserve Board Finance and Economics Discussion Series
2015-042. Fetched:
`https://www.federalreserve.gov/econresdata/feds/2015/files/2015042pap.pdf`
(HTTP 200, 33 pages). Published as *Journal of Money, Credit and Banking* 49(8):
1777–1802 (2017). Note the URL in the previous round's likely path
(`/econres/feds/files/2015042pap.pdf`) returns **404**; the working path is
`/econresdata/feds/2015/files/`.

The result depends entirely on which labour-cost measure is used (§III, pp. 8–9):

- **Productivity-and-Costs-based compensation:** *"the passthrough of unit labor
  costs to core inflation has diminished markedly over time; in particular, in the
  last year of the sample the point estimate for the response's peak value is only
  about one-fourth as large as in 1975 … and is statistically indistinguishable
  from zero."*
- **Employment Cost Index:** *"In this specification, the passthrough of labor
  cost changes into core inflation varies little over the sample period, with a
  peak response that remains statistically significant throughout."*

So "US pass-through is zero" is defensible for one measure and false for the
other, in the same paper, from the same authors. Either way there is **no citable
point estimate**: the paper reports everything as time-varying impulse responses
in Figures 1–2, and the authors say explicitly (footnote 12) why they prefer IRFs
over the summed lag coefficients. Nothing here can be dropped into a scalar
parameter.

### JPN — no number, but the strongest qualitative result of the four

Hoshi & Kashyap (2020), NBER WP 27332, §5, pp. 12–13. Cholesky VAR on
(core-core inflation, wage inflation, bonus inflation):

- 1981–1997: *"The pass-through is meaningful, a one standard deviation shock to
  wages moves prices by about two-thirds of a standard deviation."* That is a
  ratio of standard deviations, not an elasticity, so it is not the engine's
  parameter — but it is a real, published, per-country magnitude.
- 1998–2018: *"An increase in wages or bonuses does not have any visible impact on
  core-core inflation … at the eight quarter horizon, wage and bonus inflation
  explain less than 5% of the core-core inflation variation."* Granger causality
  from wages to prices fails outright (their Table 7, Panel A).

Their conclusion, p. 13: *"Before 1998, both wages and bonuses had significant and
sizable impacts on prices. After 1998, those linkages between wages and prices
were lost."*

**For a simulation covering the modern period, the defensible Japanese
`wage_price_passthrough` is zero, and it is zero for a documented reason.** That
is not a missing value; it is a finding.

### GBR, CAN, and the fallback

Nothing found for the United Kingdom or Canada. The BCS footnote quoted in §1
asserts the UK wage→price link is precisely what has broken, which points the same
way as Japan, but it cites a speech and gives no number.

The advanced-economy fallback is unchanged from the previous round: **≈0.33**,
Europe, cumulative over three years — Boranova et al. (2019), IMF WP/19/280,
§III.A and Figure 3 panel 3. With its own published regime dependence: under 20%
post-2008, ~11% in low-inflation regimes.

---

## 5. What I checked that turned out to contain nothing usable

Recording these so nobody re-runs them. All were read, not skimmed.

**ECB Occasional Paper 232** — Nickel, Bobeica, Koester, Lis & Porqueddu (eds.),
*Understanding Low Wage Growth in the Euro Area and European Countries*,
September 2019. Fetched
`https://www.ecb.europa.eu/pub/pdf/scpops/ecb.op232~4b89088255.en.pdf`, HTTP 200.
This looks like the ideal source — 23 national central banks each estimating a
wage Phillips curve for their own country — and **it publishes no coefficients at
all.** Table 1 (p. 15) lists, per country, which wage measure, which slack measure
and which expectations measure each NCB chose, and nothing else. Chart 4 shows
average actual wage growth against a forecast *range* whose width depends on how
many specifications each NCB deemed plausible (*"from 4 to 255 by countries"*).
There is no parameter anywhere in the document.

**Bank of Japan Working Paper 23-E-4** — Fukunaga, Furukawa, Haba, Hogen, Kido,
Okubo, Suita & Takatomi (2023), *Wage Developments in Japan: Four Key Issues for
the Post-COVID-19 Wage Growth*. Fetched
`https://www.boj.or.jp/en/research/wps_rev/wps_2023/data/wp23e04.pdf`, HTTP 200.
The nearest miss in this whole exercise. Appendix 1 (p. 32) estimates *exactly*
the specification the engine wants — `π^w_t = c + ρπ^w_{t−1} + β₁UR_t + β₂UR_{t−1}
+ γ·prod_t + α·infl_t` — separately for **Japan, the United States and the euro
area**, 1980Q1–2022Q1 (1998Q2–2022Q1 for the euro area). It would supply
`wage_phillips_slope` and `wage_persistence` for two G7 countries in one
consistent frame. **The paper publishes only the Yellen-style contribution
decomposition in Figure 2, and never prints ρ, β₁, β₂, γ or α.** The only thing
said about the parameters is *"For all regions, absolute values of ρ̂ are less than
1, indicating that the contribution of each variable gradually decays."*

**Bank of Canada SDP 2019-8** — read in full. Every table (A-1 through A-5) is a
10-country panel with country fixed effects. There is no country breakdown
anywhere, and Chart 6 is a rolling-window panel estimate, not per-country. It
cannot supply a Canadian coefficient despite being a Bank of Canada paper about
wage Phillips curves.

**IMF WP/18/50** — read in full. Table 3 columns (4) and (8) are labelled
*"Averages of the estimates of country-specific wage Phillips curves"*, and
Figure 10 shows *"means of country-by-country estimation coefficients"* with
interquartile ranges. The country estimates exist; they are never printed. The
paper's own caution (footnote 19): *"The coefficients from the country-by-country
specifications are, however, less precisely estimated than the panel coefficients
due to smaller samples."*

**IMF WP/23/100**, *Has the Phillips Curve Become Steeper?* — surfaced in search
and read via reader proxy. It is a **sectoral** panel using the output gap, on
European countries, testing digitalisation and trade intensity as determinants of
slope. No unemployment, no wages, no country coefficients. Not applicable.

**OECD WP 854**, *What Drives Inflation in the Major OECD Economies* (2011) —
downloaded and read. Covers only the United States, Japan, the United Kingdom and
the euro area, mostly on the output gap, sample to mid-2010, and contains no unit
labour cost or wage term at all. Superseded for our purposes by WP 1579.

**Bulligan & Viviano (2017)**, *Has the wage Phillips curve changed in the euro
area?*, IZA Journal of Labor Policy — identified but not pursued. It covers DEU,
FRA, ITA, ESP with **time-varying** coefficients, i.e. charts, and would add
nothing beyond DNB WP 587 for the same three G7 countries.

---

# Plain answers

## Which countries have a complete set across all four?

**None of the seven, on any standard this project would accept.**

| | USA | GBR | DEU | FRA | ITA | JPN | CAN |
|---|---|---|---|---|---|---|---|
| `wage_phillips_slope` | ✅ 0.180 / 0.379 | ❌ | ⚠️ 0.421 (disowned) | ✅ 0.100 | ❌ n.s. | ⚠️ units unresolved | ❌ |
| `wage_persistence` | ❌ | ❌ | ✅ 0.511 | ✅ 0.818 | ✅ 0.771 | ⚠️ 0.30, n.s. | ❌ |
| `price_phillips_slope` | ✅ 0.11 / 0.29 | ❌ wrong sign in both sources | ⚠️ sources contradict | ✅ 1.00 / 0.49 | ✅ 0.37 / 0.15 | ✅ 0.69 / 1.09 | ⚠️ n.s. in OECD |
| `wage_price_passthrough` | ❌ no point estimate | ❌ | ✅ 0.4 | ❌ (highest, no number) | ❌ (no number) | ✅ 0 post-1998 | ❌ |

**Germany and Japan are the only two countries with a published number in every
row, and both fail on two of the four.**

- **Germany** is clean on `wage_persistence` (0.511) and has the only per-country
  `wage_price_passthrough` number in the G7 (0.4). It fails on the other two: the
  wage slope is the exact artefact its authors wrote the paper to debunk, and the
  two price-slope sources flatly contradict each other on Germany specifically
  (0.87\*\*\* vs 0.11 n.s.).
- **Japan** is clean on `price_phillips_slope` — both sources agree, and Japan is
  the steepest G7 country in both — and has a documented `wage_price_passthrough`
  of essentially zero after 1998, which is a finding rather than a gap. It fails
  on the wage block: the slope's units cannot be pinned down, and the persistence
  terms are not statistically distinguishable from zero.

If any single country is worth another hour, it is Japan, and the specific job is
resolving the Hoshi–Kashyap Table 2 units. That one answer would take Japan from
two of four to three of four, and possibly to four.

**France and Italy have three of four**, missing only `wage_price_passthrough`
(Italy also loses its wage slope to insignificance, so call it two and a half).
For both, ECB WP 2235 says the pass-through exists and is economically meaningful
— France's is the highest in the sample — it just never prints the number.

**The United Kingdom is the clearest negative result.** Its price Phillips curve
is wrong-signed and insignificant in both independent sources; the OECD refused to
run its non-linear specification on the UK at all; and no per-country wage slope,
persistence or pass-through exists. There is no honest way to put the UK in a
per-country scenario.

## So what should the scenario actually list?

Two options, and I would take the first.

**One advanced-economy parameter set for all four coefficients, with
`price_phillips_slope` optionally differentiated.** That is what the evidence
supports. The per-country price slopes from OECD WP 1579 Table 1 are the best
available differentiation and they cover all seven, but they must ship with the
significance markers and the sign convention visible — showing a reader "United
Kingdom: −0.30" without the note that a negative number under the OECD's
convention means the curve is upside-down would be actively misleading.

**Or: a Germany–France–Italy scenario only, using DNB WP 587 for the wage block.**
Three countries, one consistent specification, one sample, one wage measure. Add
the ECB WP 2235 0.4 for Germany's pass-through and note the other two as unquantified.
This is defensible but it excludes the United States, which is probably not the
product anyone wants.

What is *not* defensible is assembling seven countries by taking each coefficient
from whichever paper happens to publish it. Bonam et al. use year-over-year
negotiated wages with an EC unemployment gap on 1999–2016; Hooper–Mishkin–Sufi use
quarterly average hourly earnings with a CBO gap on 1988–2018; Hoshi–Kashyap use
four-quarter log changes in hourly earnings with a raw unemployment rate on
1998–2018. Those coefficients are not measuring the same thing, and lining them up
in a table would imply a comparability that does not exist.

## The one thing this round would change about the model

If the engine carries both `wage_phillips_slope` and `wage_persistence`, they must
come from the **same regression**. Bank of Canada SDP 2019-8 makes this concrete:
their own panel gives a slope of 0.36 with no persistence term and 0.13 with a
persistence term of 0.65, and *my arithmetic* shows those are the same long-run
response (0.13/0.35 = 0.371). Pairing the headline 0.36 with the headline 0.65 —
the obvious thing to do, since both are the paper's most-cited numbers — roughly
triples the long-run wage response to slack. The previous round's parameter set
takes 0.332 from the IMF (no persistence term in that specification) and 0.55 from
Jordà–Nechio (a different paper entirely), which has the same defect.

The clean pairs actually available:
- Bank of Canada SDP 2019-8, Table A-5 col. (3): slope 0.13, persistence 0.65, 10 AEs.
- DNB WP 587, Table 1: DEU 0.421 / 0.511, FRA 0.100 / 0.818, per country.

---

## Fetch notes for whoever repeats this

- `one.oecd.org/document/ECO/WKP(YYYY)NN/en/pdf` serves OECD Economics Department
  working papers directly with a browser user-agent — no proxy needed. This is a
  better route than `oecd.org` or `oecd-ilibrary.org`, both of which returned 403
  to WebFetch.
- `dnb.nl` returns **403** to curl with a browser user-agent, but
  `https://r.jina.ai/<url>` returns the paper as clean markdown with the
  regression tables intact, including standard errors.
- `federalreserve.gov/econres/feds/files/YYYYNNNpap.pdf` **404s for older FEDS
  papers**. The 2015 vintage lives at
  `federalreserve.gov/econresdata/feds/2015/files/2015042pap.pdf`.
- NBER, ECB, Bank of Canada and Bank of Japan all fetch fine with a browser
  user-agent. `imf.org` still needs the reader proxy, as before.
- **`r.jina.ai` rate-limits, and it fails with 403 — the same code `imf.org` and
  `dnb.nl` return when you hit them directly.** Re-checking my citation URLs in a
  loop, every proxied URL came back 403; the same URLs returned 200 forty-five
  seconds later. A 403 from the proxy means "wait", not "blocked". Space the
  requests out before concluding a document is unreachable.
- **Wide tables need coordinate extraction, not `pdftotext -layout`.** OECD WP
  1579's Annex Table B1 has sixteen numeric columns and `-layout` collapses them
  into an unalignable run. `pdftotext -f N -l N -bbox` emits per-word `xMin`,
  which lets you bucket values under their column headers. Always find a second
  check on the alignment — here, the Adj. R² row matching Table 1, plus the
  `4β/θ` identity reproducing every long-run coefficient.
- **`pdftotext` silently drops minus signs in some TeX-typeset PDFs.** Galí's NBER
  WP 15758 is one: the AR(2) process printed in the body as
  `u_t = 0.22 + 1.66·u_{t−1} 0.70·u_{t−2}` must have a negative second
  coefficient, and Table 2's unemployment coefficients come out unsigned in both
  `-layout` and `-bbox` extraction. Do not read signs off that paper's tables
  from extracted text. Verify against the prose, or open the PDF.

# Diffusion Project – Eight Blocked Research Questions (Status as of August 2026)

## Overview

This report addresses eight “blocked” questions in the diffusion database, each of which currently cannot be resolved using existing series alone and therefore needs external methodological or data evidence. For each question, it summarises relevant sources, whether loadable time series or methodological caveats exist, and provides a direct verdict in the sense required by the project’s schema (`indicator` vs `caveat`).[^1][^2][^3][^4]

The questions are treated in the order given in the prompt.

***

## 1. Have semiconductor prices really stopped falling, or only in nominal terms?

### Evidence on PPI bias and quality adjustment

Byrne, Oliner and Sichel’s work on semiconductor and microprocessor prices remains the central evidence that the standard BLS PPI for semiconductors (PCU334413334413 / NAICS 334413) understates true quality‑adjusted price declines. Their Federal Reserve working paper “How Fast Are Semiconductor Prices Falling?” constructs matched‑model and hedonic price indices for microprocessor units (MPUs) and shows that, after around 2006, the official PPI essentially flattens while a quality‑adjusted index continues to fall very rapidly. Their preferred hedonic index implies average annual MPU price declines of roughly 15–20 percent in the late 2000s and early 2010s, versus near‑zero change in the PPI.[^5][^6][^7][^8][^9]

Subsequent work and BLS responses confirm both the bias and partial corrections. BLS’s 2018 Monthly Labor Review article “A new approach for quality‑adjusting PPI microprocessors” documents a revised hedonic method for MPU quality adjustment, acknowledging that previous methods lagged the technology and tended to understate price declines, and reports that the new approach yields substantially faster price decreases than older PPI practice. More recent NBER and central‑bank work on semiconductor price measurement (e.g. Flamm’s “Measuring Moore’s Law” and related papers) also supports the conclusion that standard producer price indices mismeasure true performance‑adjusted prices and that hedonic indices imply lower prices than PPI by tens of percentage points cumulatively over a decade.[^10][^11][^12]

In terms of correction factors, Byrne–Oliner–Sichel’s estimates suggest that over 1995–2012 MPU quality‑adjusted prices fell at roughly double the rate implied by the official PPI, with the gap opening especially after about 2006. There is, however, no published extension of this specific hedonic semiconductor index to the 2019–2026 period; the evidence on bias therefore has to be carried forward qualitatively rather than via an explicit correction series.[^7][^8][^12]

### Alternative or research semiconductor price indices, 2019–2026

Several sources provide quality‑adjusted price‑performance trends for semiconductors and GPUs into the early 2020s, though usually as FLOP/s‑per‑dollar rather than a direct chip price index.

- Epoch AI’s “Trends in GPU price‑performance” and “Trends in machine learning hardware” assemble datasets of hundreds of GPUs and specialised ML accelerators and estimate that FLOP/s per dollar for ML‑relevant GPUs roughly doubles every 2.1–2.5 years over 2006–2021. This corresponds to annual real price declines for a given performance level of around 25–30 percent. The underlying data and regression outputs are downloadable via CSV and are accessible through Epoch’s hardware data documentation pages.[^13][^14][^15]
- Our World in Data republishes Epoch‑based GPU price‑performance series in an interactive “GPU price‑performance” chart, explicitly deflating prices to real US dollars and reporting FLOP/s per dollar improvements over time. The grapher dataset is downloadable as CSV via the OWID data interface and covers at least up to 2023.[^16]
- WSTS (World Semiconductor Trade Statistics) and SIA (Semiconductor Industry Association) publish monthly or quarterly average selling prices (ASPs) by product category as part of their historical billings reports, with data downloadable as Excel files. These ASP series are nominal revenues per unit rather than quality‑adjusted indices, but they can be combined with performance metrics to construct implicit price‑performance measures for specific segments, especially memory.[^17][^18]

To date there is no widely used, fully quality‑adjusted, official semiconductor price index covering 2019–2026 analogous to Byrne–Oliner–Sichel’s MPU index for earlier years; the available research indices are component‑specific (MPUs or GPUs) and typically end around 2021–2023.[^7][^13]

### Independent evidence on post‑2021 price behaviour

The nominal US PPI for semiconductor and related device manufacturing (PCU334413334413, index base Dec 1998 = 100) does show a flattening and slight uptick after 2021. After falling roughly 80 percent between 1990 and 2021, the index has hovered in the high‑20s to low‑30s range, with recent readings such as 30.1 in March 2026 and 29.0 in July 2026, versus values around 30–32 in 2021–2023. This is the pattern noted in the database’s `chip-prices` page.[^2]

Memory and GPU markets, however, show cycles rather than a sustained plateau. TrendForce and similar market analysts report DRAM and NAND contract prices rising sharply through 2025–2026 after the deep downturn of 2022–2023, with quarter‑on‑quarter gains of 50–90 percent at the peak and more moderate increases thereafter. These are nominal ASPs driven by supply‑demand swings and do not contradict long‑run quality‑adjusted price declines; they simply reflect a cyclical upswing.[^19][^20]

Epoch’s hardware work finds no evidence that long‑run FLOP/s‑per‑dollar improvement has stopped: across ML GPUs and accelerators, performance per dollar continues to improve at roughly 30 percent per year into the early 2020s, and Epoch’s later data‑insights pieces state that “performance per dollar has improved rapidly, and hardware at any given precision and fixed performance level becomes 30% cheaper each year.”[^14][^15]

### Verdict for Question 1

Given the continuing evidence of rapid improvements in FLOP/s per dollar for GPUs and ML accelerators, the earlier‑period hedonic MPU indices showing much steeper declines than the PPI, and the lack of any post‑2019 quality‑adjusted chip index showing an actual stop, the weight of evidence supports interpretation (a): real quality‑adjusted semiconductor prices are still falling and the nominal PPI flattening reflects measurement and inflation effects rather than a genuine halt. Confidence is moderate rather than absolute, because there is no single accepted 2019–2026 hedonic semiconductor index, but multiple hardware and GPU datasets point consistently to continued real price declines.[^15][^5][^13][^14]

For the database, this implies that either a general US PPI deflator (e.g. all‑industry producer price index) should be used to express semiconductor PPI in real terms, or, where possible, GPU price‑performance series should be ingested as separate `compute-price` indicators, while the `chip-prices` page carries an explicit caveat about quality‑adjustment bias.

***

## 2. Did the enterprise AI adoption survey question change between 2023 and 2024?

### Eurostat ICT usage in enterprises – AI question wording

Eurostat’s “ICT usage and e‑commerce in enterprises” survey is governed by a legally‑mandated model questionnaire and a compilers’ manual. The 2023 wave was the first to include a harmonised AI question across all Member States, with the compilers’ manual noting that the 2023 enterprise survey measured “use of cloud computing services, artificial intelligence and invoicing as well as data utilisation, sharing, analytics and trading.”[^3][^21]

National implementations (e.g. Austria, Cyprus, Spain) reproduce the Eurostat model questionnaire. Documentation for the 2023 model questionnaire, such as the Austrian standard documentation and national ICT usage survey materials, show that enterprises were asked whether they used at least one of several listed AI technologies, with options including text mining, speech recognition, image recognition, machine learning, and robotic process automation. Eurostat’s Statistics Explained article “Use of artificial intelligence in enterprises” for 2024 describes the same conceptual question: enterprises with 10 or more employees were counted as using AI if they used “at least one of the following AI technologies” and lists natural language processing, machine learning, and other functional categories.[^22][^23][^24][^25]

The 2025 Statistics Explained PDF explicitly states the definition used for the EU aggregate: “In 2025, 19.95% of enterprises in the EU, with 10 or more employees and self‑employed persons, used at least one of the following AI [technologies]…” followed by a list of AI categories that closely matches the 2024 list. There is no indication in these documents that the core AI use question or its answer options changed between 2023 and 2024; instead, Eurostat highlights that the share of EU enterprises using AI technologies rose from about 8 percent in 2023 to 13.5 percent in 2024, and to about 20 percent in 2025.[^26][^24][^27][^22]

### AI technologies list – additions or revisions

The compilers’ manual published in early 2024 describes the AI module as part of the 2023 survey, with detailed guidance on how national statistical institutes should translate the Eurostat model questions into national languages. It emphasises harmonised concept definitions and answer categories, including AI, cloud, and data analytics, and does not record any change in the AI technology list between 2023 and 2024.[^21]

Eurostat’s metadata for `isoc_e` (ICT usage in enterprises) and related SIMS documentation for specific countries focus on survey mode, sampling, and weighting over 2023–2025 and do not flag redefinitions of AI technology categories. The 2024 and 2025 Statistics Explained articles present AI technologies grouped by function rather than by underlying algorithm (e.g. “analysis of written language,” “machine learning,” “robot process automation”) and treat them as comparable across years.[^4][^28][^29][^24][^22]

On available evidence, there is no documented change in the AI technology list or question wording between the 2023 and 2024 Eurostat ICT enterprise surveys. Any subtle national tweaks are not visible in the harmonised EU metadata and would likely be treated as minor implementation variations rather than breaks in series.[^3][^21]

### OECD ICT Access and Usage by Businesses – Indicator G14_B

The OECD ICT Access and Usage by Businesses database (`DSD_ICT_B@DF_BUSINESSES`) includes indicator G14_B, defined as the percentage of enterprises using AI technologies. The SDMX metadata show that G14_B is an annual percentage of enterprises with 10 or more employees, with country coverage expanding over time but with a stable conceptual definition. The OECD’s Digital Economy reports and documentation reference this indicator as measuring enterprise AI adoption and do not indicate any definitional change or break in series after its introduction.[^30][^31]

Country coverage has improved over time as more national surveys adopt the AI module, but the underlying concept—use of AI technologies by enterprises—remains unchanged. OECD’s AI adoption numbers for 2023 and 2024 therefore reflect a genuine increase in reported use rather than a questionnaire change.[^30]

### Methodological notes on the 2023–2024 jump

Eurostat’s Statistics Explained article “Use of artificial intelligence in enterprises” for 2024 notes that “In 2024, 13.48% of EU enterprises used AI technologies… Compared with 2023, the use of AI technologies increased by 5.45 percentage points.” The article treats the increase as a substantive change in enterprise behaviour, not as a break in series, and does not mention any revision to question wording or AI technology lists.[^32][^22]

Subsequent Eurostat news releases in 2025 reiterate the upward trend, stating that “In 2025, 20.0% of EU enterprises with 10 or more employees used artificial intelligence (AI) technologies to conduct their business, showing a solid growth of 6.5 percentage points from 13.5% in 2024.” Again, these official communications treat the 2023–2024 jump as comparable and part of a continuous series.[^26]

### Verdict for Question 2

On the basis of available Eurostat model questionnaire documentation, the European business statistics compilers’ manual, and Statistics Explained notes, there is no clear evidence that the AI question or its list of technologies changed materially between 2023 and 2024. OECD’s G14_B indicator likewise appears to have a stable conceptual definition over 2020–2025.[^31][^22][^21][^30]

The 2023–2024 jump in reported enterprise AI use therefore appears **comparable with earlier years**, not a documented break in series, although the possibility of minor implementation changes at national level cannot be entirely excluded. For the diffusion database, this supports treating the jump as real diffusion while including a general caveat that question operationalisation is relatively new and may be subject to learning and national variations.

***

## 3. Has anything larger than a 5 × 10²⁶ FLOP training run happened since July 2025?

### Current Epoch AI datasets and update status

Epoch AI now maintains a large AI models database, with public documentation and downloadable CSV files covering “all AI models,” “notable AI models,” “large‑scale AI models,” and “frontier AI models.” The documentation notes that the notable‑models dataset contains thousands of models with metadata including estimated training compute in FLOP, publication dates, and organisations, and that the CSV downloads are updated regularly (e.g. late August 2026).[^33][^34][^35]

The specific notable‑models CSV (`notable_ai_models.csv`) is publicly downloadable and includes columns for model name, organisation, date, and estimated training compute. Frontier‑model subsets are available via `frontier_ai_models.csv`, which track models that represent the frontier at each point in time.[^36][^35]

### Largest known training runs and threshold crossing

Independent analyses using Epoch data and related sources suggest that frontier models surpassed the 1 × 10²⁶ FLOP threshold in 2025 and that training compute for the largest runs has continued to increase since. Epoch’s own data‑insights piece “Frontier open models may surpass 1e26 FLOP of training compute” estimates that the frontier open‑weight model trend scales at around 4.6–4.7× per year and crosses 1 × 10²⁶ FLOP in late 2025 or early 2026.[^37][^38]

Other aggregators and explainers, such as Frontier Milestones and various data hubs, summarise Epoch’s frontier compute series, noting that “frontier models passed 1e26 FLOP in 2025” and that the largest known runs have remained in that regime since, with projected 10²⁷ FLOP runs expected around 2026–2027 if historical scaling continues.[^39][^38]

However, public commentary and secondary analyses also note that for closed‑weight frontier models released after July 2025, official disclosures have become sparse. One FutureSearch overview points out that “Epoch’s public database offers no training‑compute estimates for closed frontier models released after July 2025, leaving the current record topped by Grok 4 at 5.0e26 FLOP (speculative) and GPT‑4.5 at 3.8e26 FLOP,” implying that the public record is incomplete and extrapolations beyond mid‑2025 rely heavily on modelling rather than direct disclosure.[^40]

### Growth rate of frontier training compute

Epoch’s methodology paper on open models and training‑compute thresholds, together with secondary write‑ups, converge on an estimated growth rate of about 4–5× per year in frontier training compute for open‑weight models, with a 90 percent confidence interval roughly between 3.6× and 6.1×. Frontier Milestones and similar trackers summarise this as “frontier training compute has grown ~4–5× per year; GPT‑4 (2023) was the first at 1e25 FLOP, and frontier models passed 1e26 FLOP in 2025.”[^38][^37]

This is consistent with earlier Epoch analyses and Stanford AI Index figures on training compute, and no recent study has claimed a clear slowdown in the annual multiplier. Rather, commentaries emphasise increasing physical and cost constraints and the possibility that the next order‑of‑magnitude (10²⁷ FLOP) may require new cluster architectures or power solutions, but do not claim that the scaling trend has stopped.[^41][^42][^43]

### Disclosure gaps and plateau vs data issues

Multiple commentaries stress that major labs have become less transparent about training compute for their highest‑end models. Epoch’s datasets rely on combinations of official statements, conference talks, technical appendices, and indirect inference (e.g. scaling laws, cluster size, training duration), and several recent frontier models lack direct compute estimates. The FutureSearch analysis noted above explicitly frames the absence of new record entries after July 2025 as a “missing record” problem rather than evidence that no larger runs occurred.[^44][^35][^40]

This aligns with broader observation in the policy and regulatory literature that closed‑weight frontier models increasingly withhold detailed training metrics, complicating governance mechanisms that rely on training‑compute thresholds.[^45]

### Verdict for Question 3

From the perspective of the diffusion database, the public Epoch notable‑models dataset as of late August 2026 still has July 2025 as the last dated clear record for a 5 × 10²⁶ FLOP training run; open‑weight trend analyses indicate that frontier open models likely exceeded 1 × 10²⁶ FLOP by late 2025 or early 2026, but specific post‑July‑2025 record‑holder entries are incomplete due to disclosure gaps.[^40][^37]

This means the correct statement is that **frontier training compute has almost certainly continued to grow at roughly 4–5× per year, but the public record of individual training runs is incomplete after mid‑2025**, and the apparent plateau in the database is a data‑availability issue rather than confirmed stagnation. For `epoch.training_compute_frontier`, ingestion should be refreshed from the latest Epoch CSV, but the indicator description must carry an explicit caveat that post‑2025 values are increasingly inferred and that closed‑weight labs may have carried out larger runs without publishing compute.[^43][^38]

***

## 4. How much of the US manufacturing construction boom is semiconductor fabs?

### Census manufacturing construction subcategories

The U.S. Census Bureau’s Value of Construction Put in Place (VIP) survey publishes monthly estimates of construction spending by sector, including total private manufacturing construction. Recent experimental “Monthly Subnational” tables released alongside the main C30 report provide more detailed breakdowns within private manufacturing, including subsectors such as “chemical,” “transportation equipment,” and “computer, electronic and electrical” manufacturing.[^46][^47][^48][^49]

The VIP tables for private non‑residential construction (e.g. `privsa.pdf`) list manufacturing as a major category and indicate that subcategory detail is available in supplementary spreadsheets. As of mid‑2026, Census has introduced subnational manufacturing tables that, according to methodological notes, include a “computer and electronic products” category, which would be the closest available proxy for semiconductor fabs and related electronics plants. These tables are in Excel format and provide monthly data in millions of dollars, seasonally adjusted annual rates where applicable; they are freely downloadable from the Census C30 data page.[^50][^48][^46]

A specific series ID for “computer and electronic products” within private manufacturing construction is not yet widely documented via FRED, but can be accessed through the Census time‑series API or experimental subnational tables by specifying the appropriate sector code.[^47][^48]

### Share of manufacturing construction represented by electronics

Public commentary and secondary analyses based on Census data indicate that construction spending on data centres and chip plants has grown extremely rapidly since 2021. Wolf Street, summarising Census data, reports that “construction spending on data centers soared by 34% year‑over‑year in March  to a seasonally adjusted annual rate (SAAR) of $50 billion, up by 437% since the beginning of 2021 and up by 688% since the beginning of 2018.” Although this is for data centres, not manufacturing, it suggests that IT‑related construction categories have expanded disproportionately.[^51]

ConstructConnect and CoStar reports further note that year‑to‑date U.S. spending on data centre projects started through June 2026 reached $81.5 billion, surpassing the full‑year 2025 total and more than tripling 2024. These figures cover a mixture of manufacturing‑like and commercial projects but reinforce the perception of an AI‑infrastructure boom.[^52][^53]

While precise shares for “computer and electronic products” within manufacturing construction over 2015–2026 require direct extraction from Census’s subcategory tables, the available commentary suggests that a large portion of the post‑2021 manufacturing construction surge is concentrated in chip plants, battery factories, and data‑centre‑adjacent facilities, rather than in traditional manufacturing sectors.[^51]

### Other data centre construction spending series

Beyond Census VIP, private sources such as CBRE, ConstructConnect, JLL, and CoStar publish regular reports on data centre construction pipelines, capacities under construction, and project spending. These are typically proprietary but summarised in free briefs: for instance, CBRE’s “North America Data Center Trends H1 2026” reports that primary market supply surged by 33.7 percent year‑over‑year, with vacancy falling to a record 1.4 percent. ConstructConnect’s data centre reports quantify construction starts and spending monthly, such as a June 2026 report noting that the median construction cost for large data centre projects stood at $570 per square foot, with an average of $859.[^54][^55][^56][^52]

These series are not official national accounts and would load into the diffusion project as `report_figure` caveats rather than as primary indicators, but they provide higher‑frequency context beyond BEA’s annual private fixed investment in data centre structures.

### Verdict for Question 4

Census’s VIP survey now appears to provide a loadable private manufacturing subcategory for “computer and electronic [products]” in experimental monthly subnational tables, with data in millions of dollars at SAAR and accessible via free Excel downloads or the Census API. Once the exact sector code and series ID are confirmed, this can be ingested alongside total private manufacturing construction (e.g. FRED’s `TLMFGCONS`) to quantify the share of manufacturing construction attributable to electronics and, by proxy, semiconductor fabs.[^48][^46]

Until that extraction is done, the qualitative conclusion is that a substantial share of the manufacturing construction boom is in computer, electronic, and data‑centre structures, but the database should treat this as a caveat and avoid precise percentages. Ingestion of the Census subcategory series would directly settle the question and allow the `the-buildings` page to state what portion of the boom turned when manufacturing construction began to decline.[^52][^51]

***

## 5. Is the fall in US information-sector employment AI, or the 2022 over-hiring correction?

### Layoff datasets with stated causes

Challenger, Gray & Christmas’ monthly job‑cut reports provide the most detailed breakdown of U.S. layoffs by reason, including categories for “Artificial Intelligence (AI)” or “automation.” Their December 2025 year‑end report notes that AI was first tracked as a distinct layoff reason in 2023 and that since then, AI has been cited in 71,825 job cut announcements, with 54,836 layoffs in 2025 explicitly attributed to AI.[^57][^58][^59]

Monthly reports for 2026 show that AI has increasingly become the leading cited reason for job cuts. The May 2026 report records 38,579 job cuts in that month attributed to AI, for a year‑to‑date total of 87,714 AI‑related layoffs. The June and July 2026 reports state that AI led all reasons for job cuts for the fourth and fifth consecutive month respectively, with 14,029 AI‑related cuts in June and 10,970 in July, and cumulative AI‑attributed layoffs exceeding 100,000 for the year.[^60][^61][^62]

These reports also show that broader categories like cost‑cutting, restructuring, and “market and economic conditions” account for larger absolute counts of job cuts, especially in 2025. Independent syntheses, such as American Default’s indicator on AI‑related job cuts, summarise Challenger’s data by reporting that AI‑attributed layoffs totalled 54,836 in 2025, likely understating true AI impact because many automation‑driven cuts are reported under broader reasons.[^63][^59][^64]

Other datasets, such as WARN notices aggregated at state level, generally do not code explicit reasons such as AI, and must be supplemented with textual analysis if the project wants to infer AI attribution; for now, Challenger provides the cleanest labelled counts.

### Research decomposing tech employment changes

As of mid‑2026 there is limited published research that explicitly decomposes post‑2022 technology‑sector employment changes into over‑hiring correction versus AI substitution using formal econometric methods. Most commentary in labour economics and business press frames the tech layoffs of 2023–2025 as driven primarily by correction of pandemic‑era over‑hiring, rising interest rates, and shifts in firm strategy, with AI playing an increasing but still secondary role.[^65][^66]

Challenger’s analysts themselves emphasise this narrative, stating that “Technology has been pivoting to both developing and implementing artificial intelligence much more quickly than any other industry. This coupled with over‑hiring over the last decade created a wave of job loss in the industry.” This indicates that both factors are material, but does not provide a quantitative decomposition.[^58]

Academic and Fed working papers on post‑pandemic labour market adjustment discuss tech‑sector layoffs and remote‑work rebalancing, but rarely isolate AI substitution as a separate causal channel at the sector level; detailed decomposition would require richer data than currently available.[^67]

### BLS subsector employment series (NAICS 5112 and 5182)

The BLS Current Employment Statistics (CES) program provides detailed industry employment series by NAICS code, with a published series list in `ce.series`. NAICS 5112 (software publishers) and 5182 (data processing, hosting, and related services) are both covered as subsectors within the information supersector, with series IDs following the standard CES format (e.g. `CEU6051120001` for all employees in NAICS 5112, seasonally adjusted).[^68][^66][^69][^70]

These series are available monthly from around 2003 onwards as thousands of employees, and are free to download via the BLS time‑series API or flat‑file downloads (`ce.data` sets). They can therefore be ingested as regular monthly observations into the diffusion database, allowing `sector-jobs` to separate the AI‑intensive subsectors from telecoms, publishing, and other information industries.[^69][^68]

### JOLTS hiring, quits, and job openings for Information

The Job Openings and Labor Turnover Survey (JOLTS) provides monthly estimates of job openings, hires, quits, and total separations by industry, including the information sector. JOLTS data are available via BLS flat files (`jl.txt`, `jt.txt`) and the JOLTS API, with series IDs encoding survey abbreviation, industry code, and data element (e.g. job openings, hires, quits).[^71][^72][^73][^74]

BLS publishes summary tables in monthly news releases showing job openings, hires, and separations by industry, where information can be extracted as a separate row. Economic Policy Institute and other analysts provide JOLTS‑based charts that highlight trends in quits and hiring rates for information, showing, for example, that quits rates have normalised from pandemic highs and that openings have cooled in line with broader labour markets.[^75][^76][^67]

These JOLTS series are free, downloadable, and suitable for ingestion as monthly flow indicators associated with the information sector.

### Verdict for Question 5

The available evidence supports a mixed interpretation: **the fall in US information‑sector employment from its 2022 peak reflects both correction of pandemic over‑hiring and growing AI‑driven substitution, but current data cannot cleanly disentangle the two.** Challenger’s labelled layoff data show a rapidly rising AI share of announced job cuts from 2023 onward, reaching over 50,000 AI‑attributed layoffs in 2025 and over 100,000 year‑to‑date in 2026, but broader cost‑cutting and restructuring categories still account for more layoffs overall.[^59][^62][^58][^60]

For the diffusion database, this means that the core `sector-jobs` finding—that information‑sector employment fell while output rose—should be accompanied by caveats citing Challenger’s AI layoff data and emphasising that over‑hiring correction is a major confounding factor. Ingesting BLS subsector employment (NAICS 5112, 5182) and JOLTS information‑sector flows would materially sharpen the analysis by showing where within information the decline is concentrated and whether hiring and openings patterns align with AI‑intensive subsectors.[^77][^68]

***

## 6. How much of BEA software investment is own-account, and does it move with programmer pay?

### Components of software investment and their shares

In the BEA national accounts, private fixed investment in software is decomposed into three components: prepackaged software, custom software, and own‑account software. Methodology papers and presentations on the estimation of software in the U.S. national accounts, such as “Estimation of Software in the U.S. National Accounts,” report that private custom and own‑account software together accounted for around $92.2 billion in a reference year, and later BEA summaries note that in 2017 private software investment totalled about $352.9 billion, consisting of $147.6 billion prepackaged, $141.1 billion custom, and $64.2 billion own‑account.[^78][^79][^80][^81]

These figures imply that own‑account software comprised roughly 18 percent of private software investment in 2017, with prepackaged and custom software making up the remainder. The shares vary over time but BEA’s tables show that own‑account software is consistently a significant but not dominant component.[^81]

### Methodology for estimating own-account software

BEA’s NIPA Handbook and related papers describe own‑account software investment as measured by the sum of production costs. Specifically, own‑account software is estimated as the compensation (wages and benefits) of software developers, computer programmers, and systems analysts engaged in in‑house software development, plus intermediate inputs and a markup for profits and overhead.[^82][^83][^79][^80]

Wasshausen’s and Robbins’ work on information processing equipment and software in the national accounts explains that BEA uses wage data for relevant occupations, multiplies by hours devoted to own‑account development, adds non‑labour costs using ratios derived from input–output tables, and applies a margin to reflect net operating surplus. The resulting estimate is deflated by software price indices to obtain real own‑account investment.[^83][^78]

### Publication of component splits as time series

BEA publishes the component breakdown of software investment in the fixed assets accounts and in supplementary tables, such as Table 5.6.5 “Private Fixed Investment in Intellectual Property Products by Type,” which includes software subcomponents. These tables provide annual nominal and real investment values for prepackaged, custom, and own‑account software, in millions of dollars, and are available as Excel downloads via BEA’s interactive data application.[^84]

NIPA tables accessible through BEA’s online system also allow users to retrieve annual or quarterly series for software components, though the exact table numbers can vary across revisions; BEA’s methodology documents point to specific tables for detailed breakdowns of intangible investment.[^85][^80]

### Critiques of own-account measurement and link to wages

Critiques of the own‑account software methodology focus on the extent to which measured investment tracks programmer wages rather than software output. BEA acknowledges that own‑account software estimates are built up from labour costs and therefore sensitive to changes in wage rates and occupational composition. External analyses of software and data treatment in national accounts note that own‑account measures may overstate investment growth if wage inflation outpaces real productivity improvements in software development, and that the growing importance of open‑source and non‑market software further complicates measurement.[^86][^81]

International comparisons, such as Statistics Canada’s discussion of software investment, similarly highlight that own‑account software estimates are constructed from labour costs of software professionals and thus will mechanically rise with wages unless adjusted for productivity. These critiques suggest that a significant fraction of measured own‑account software investment responds to wage changes rather than independent changes in software output, especially in periods of rising programmer pay.[^87]

### Verdict for Question 6

BEA clearly decomposes software investment into prepackaged, custom, and own‑account components and publishes annual time‑series splits in its fixed‑assets and NIPA tables. Own‑account software typically accounts for on the order of 15–25 percent of private software investment, based on published breakdowns for recent years.[^80][^81][^84]

Methodologically, own‑account software is estimated from programmer and systems‑analyst compensation plus inputs and margins, meaning that measured investment is mechanically linked to wage movements. Critiques and international practice confirm that this link can cause measured own‑account software investment to rise with programmer pay even if real software output growth is weaker.[^79][^83][^86][^87]

For the diffusion database, ingesting the BEA component splits as separate annual series would allow `software-not-steel` to state what fraction of software investment is own‑account and to add a caveat that a substantial portion of the boom reflects estimated in‑house development costs derived from wages rather than directly observed market transactions.

***

## 7. Did Eurostat revise its electricity consumption bands, and when?

### Consumption band definitions and legal basis

Eurostat’s electricity price statistics for non‑household consumers (`nrg_pc_205`) are governed by Regulation (EU) 2016/1952 and the implementing regulation 2017/2169, which establish a common framework for natural gas and electricity price statistics, including consumption‑band definitions. The dataset description on DBnomics and Eurostat’s metadata pages state that `nrg_pc_205` covers electricity prices for non‑household consumers on a biannual basis from 2007 onwards, with bands IA through IG defined by annual consumption thresholds in MWh.[^88][^89][^90][^91]

Regulation 2016/1952 and the implementing acts set out standard non‑household bands, with the highest band (IG) defined as consumption of 150,000 MWh or more per year. This is the definition used in Eurostat’s metadata and has been in place since the regulation’s application.[^92][^93]

### Methodological changes around 2017

The 2016 regulation replaced an earlier directive and was accompanied by methodological changes implemented around 2017, including harmonisation of tax and levy treatment and improvements in sampling of reporting firms. Eurostat’s quality reports on electricity and natural‑gas price statistics describe adjustments to legal basis and reporting but do not indicate fundamental changes to consumption‑band boundaries; instead, they emphasise the move to the new legal framework and improved comparability.[^93][^94][^88]

Metadata for electricity prices (`nrg_pc_204` and `nrg_pc_205`) explains the distinction between prices excluding taxes and levies, prices excluding recoverable taxes, and prices including all taxes, and notes that bands are stable from 2007 onwards.[^95][^96]

### Presence and continuity of band IG

DBnomics and Eurostat metadata explicitly describe `nrg_pc_205` as biannual electricity prices for non‑household consumers “from 2007 onwards,” with bands IA through IG present throughout the period. External compilers, such as fgeerolf’s Eurostat data pages, mirror this interpretation, showing prices by band and semester from 2007, with IG present across the entire window.[^90][^97][^91]

No Eurostat methodological notes or quality reports reviewed here warn that the consumption bands changed or that the series is not comparable across particular years; instead, they focus on tax components, sampling, and national implementation issues.[^94][^98]

### Verdict for Question 7

Available legal and metadata evidence indicates that **Eurostat has not revised the non‑household electricity consumption band boundaries (IA–IG) in a way that affects the 2007–2025 comparability of band IG**, and that band IG (≥150,000 MWh/year) has been present throughout the period covered by `nrg_pc_205`. There was a methodological change around 2017 tied to the new regulation, affecting legal basis and some aspects of reporting and tax treatment, but not the consumption‑band thresholds themselves.[^88][^93][^90][^94]

For the diffusion database, this means that the long‑run comparison between band IE and IG (e.g. discount narrowing from 39 percent to 15 percent) can be treated as comparable across the full window, with a caveat noting the 2016–2017 regulatory transition but stating explicitly that band definitions remained stable.

***

## 8. Is there a published estimate of when the US federal government started writing about AI?

### Existing counts of AI-related federal regulatory documents

Stanford HAI’s AI Index includes counts of AI‑related regulations and mentions in U.S. federal documents. The 2025 AI Index report’s policy and governance chapter reports that “In 2024, 59 AI‑related regulations were introduced—more than double the 25 recorded in 2023—and issued by twice as many agencies,” and notes that AI mentions across global legislative proceedings rose by over 20 percent year‑on‑year. Earlier AI Index chapters (e.g. 2024) record that AI‑related bills, regulations, and executive actions have increased markedly since the mid‑2010s.[^99][^100][^101][^102]

However, these counts focus on explicit AI regulatory actions and legislative mentions worldwide, and do not provide a year‑by‑year time series specifically for U.S. Federal Register documents going back to the early 2000s. They identify recent surges (post‑2016) rather than earlier structural breaks.[^101][^99]

Other tools, such as “AI Regulation Radar,” use the official Federal Register API to query documents mentioning “artificial intelligence” from specific regulators (SEC, CFTC, OCC, FDIC, Fed, CFPB, Treasury, FinCEN, FTC, NCUA) and provide live dashboards of AI‑related rulemaking. These systems track current activity but do not typically publish historical counts reaching back to 2012.[^103]

### Structural breaks or inflection points in AI mentions

The AI Index 2025 highlights a sharp recent increase in AI‑related federal regulations (doubling from 25 to 59 between 2023 and 2024) and notes sustained growth in legislative mentions globally, but does not discuss a structural break in 2012 specifically. Policy analysis pieces based on the AI Index and related data generally frame the rise in AI governance activity as accelerating after around 2016–2017, aligned with the wider public attention around deep learning, but this is more narrative than formally tied to Federal Register counts.[^102][^104][^105][^99]

No reviewed study explicitly reports a break in U.S. Federal Register AI mentions in 2012 or provides a time series that can be directly compared to the diffusion project’s internal keyword‑based count.

### Search terms and vocabulary vs substance

Studies that count AI‑related regulations typically rely on keyword searches (e.g. “artificial intelligence,” “machine learning,” “algorithmic decision‑making”) and often acknowledge that such counts can conflate vocabulary changes with substantive attention. The AI Index policy chapter, for example, comments on limitations of keyword‑based legislative tracking and notes that AI mentions may reflect both increased substantive concern and broader diffusion of AI language in policy discourse.[^106][^99]

Tools like AI Regulation Radar explicitly describe their search methodology and caution that counting documents that mention “artificial intelligence” captures only one dimension of regulatory engagement and may over‑ or under‑state substantive action depending on context.[^103]

### Linking deep learning breakthroughs to federal attention

There is a widely discussed narrative that breakthroughs in deep learning around 2012 (e.g. ImageNet) catalysed increased interest in AI across academia and industry, and later in government, but direct evidence linking the 2012 breakthroughs to a documented jump in federal regulatory documents is sparse. Most policy analyses focus instead on key milestones such as the 2016–2019 period of national AI strategies, the 2020 executive order on AI, and the 2023–2024 wave of AI‑related legislation and executive action.[^107][^108][^109]

### Verdict for Question 8

No identified external organisation currently publishes a detailed year‑by‑year count of AI‑related U.S. Federal Register documents extending back to the early 2000s, nor a formal estimate that the break occurred specifically in 2012. Existing sources (Stanford HAI AI Index, AI Regulation Radar, policy think‑tank reports) focus on the recent surge in AI regulation and mentions, particularly after 2016 and especially in 2023–2024, and acknowledge the limitations of keyword‑based counts.[^99][^106][^103]

For the diffusion database, this implies that the `when-noticed` page’s finding—that Federal Register AI‑related documents jump from low single digits per year to over twenty in 2012—is based on an internally constructed keyword count and currently lacks an independent external series for validation. The page should therefore explicitly frame its claim as “based on this project’s own keyword‑matching method” and include a caveat that keyword counts track vocabulary as much as substance and may be sensitive to changes in boilerplate language. If a future external series appears, it can be ingested as a `report_figure` with per‑year counts and compared to the internal measure.

---

## References

1. [Producer Price Index by Industry: Semiconductor and ... - FRED](https://fred.stlouisfed.org/series/PCU33443344) - Graph and download economic data for Producer Price Index by Industry: Semiconductor and Other Elect...

2. [Producer Price Index by Industry: Semiconductor and Related ...](https://fred.stlouisfed.org/series/PCU334413334413) - Graph and download economic data for Producer Price Index by Industry: Semiconductor and Related Dev...

3. [ICT usage in enterprises (isoc_e) - European Commission](https://ec.europa.eu/eurostat/cache/metadata/en/isoc_e_esms.htm)

4. [ICT usage in enterprises (isoc_e)](https://ec.europa.eu/eurostat/cache/metadata/EN/isoc_e_simsie_tr.htm)

5. [[PDF] How Fast are Semiconductor Prices Falling?](https://www.nber.org/system/files/working_papers/w21074/w21074.pdf) - The results from our preferred hedonic price index indicate that quality-adjusted MPU prices continu...

6. [[PDF] What is Happening to Semiconductor Prices?” David M. Byrne ...](http://old.iariw.org/papers/2013/ByrneAbstract.pdf) - this paper re-examines the measurement of quality-adjusted prices for MPUs for desktop PCs. hedonic ...

7. [How fast are semiconductor prices falling?](https://www.econstor.eu/bitstream/10419/280518/1/aei-ewp2014-06.pdf)

8. [The Fed - How Fast are Semiconductor Prices Falling?](https://www.federalreserve.gov/econres/feds/how-fast-are-semiconductor-prices-falling.htm) - David M. Byrne, Stephen D. Oliner, The Producer Price Index (PPI) semiconductor prices have barely b...

9. [How fast are semiconductor prices falling? | World Economic Forum](https://www.weforum.org/stories/emerging-technologies/how-fast-are-semiconductor-prices-falling/) - The World Economic Forum is an independent international organization committed to improving the sta...

10. [A new approach for quality-adjusting PPI microprocessors](https://www.bls.gov/opub/mlr/2018/article/a-new-approach-for-quality-adjusting-ppi-microprocessors.htm)

11. [[PDF] Measuring Moore's Law: Evidence from Price, Cost, and ... - NBER](https://www.nber.org/system/files/chapters/c13897/revisions/c13897.rev0.pdf)

12. [Measuring Moore's Law: Evidence from Price, Cost, and ...](https://ideas.repec.org/p/nbr/nberwo/24553.html) - “Moore’s Law” in the semiconductor manufacturing industry is used to describe the predictable histor...

13. [Trends in GPU price-performance](https://epoch.ai/publications/trends-in-gpu-price-performance) - Improvements in hardware are central to AI progress. Using data on 470 GPUs from 2006 to 2021, we fi...

14. [Trends in machine learning hardware](https://epoch.ai/publications/trends-in-machine-learning-hardware) - FLOP/s performance in 47 ML hardware accelerators doubled every 2.3 years. Switching from FP32 to te...

15. [Performance per dollar improves around 30% each year - Epoch AI](https://epoch.ai/data-insights/price-performance-hardware) - Epoch AI is a research institute investigating key trends and questions that will shape the trajecto...

16. [https://archive.ourworldindata.org/20260323-134357...](https://archive.ourworldindata.org/20260323-134357/grapher/gpu-price-performance.html) - An interactive visualization from Our World in Data.

17. [WSTS Home](https://www.wsts.org/)

18. [Historical Billings Report - WSTS](https://www.wsts.org/67/Historical-Billings-Report)

19. [DRAM Contract Price Apr. 2026 - TrendForce](https://www.trendforce.com/research/download/RP260430QO) - PC DRAM contract prices rose this quarter, but momentum slowed. High costs weakened PC sales, coolin...

20. [DRAM Cycle Mid-2026 Update: Pricing, Inventory & Peak Timing](https://www.useluminix.com/reports/industry-analysis/dram-cycle-position-analysis-peak-timing-indicators) - DRAM contract prices rose 58-63% QoQ in Q2 2026, down from the record 90-95% surge in Q1. The Q3 202...

21. [European businesses statistics compilers’ manual for ICT ...](https://op.europa.eu/en/publication-detail/-/publication/23d55b98-ba71-11ee-b164-01aa75ed71a1/language-en/) - Information and Communications Technologies (ICT) account for a significant part of EU productivity ...

22. [Statistics Explained](https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Use_of_artificial_intelligence_in_enterprises) - Use of artificial intelligence in enterprises

23. [Standard documentation ICT usage in enterprises](https://www.statistik.at/fileadmin/shared/QM/Standarddokumentationen/B_en/engl_std_b_ikt-einsatz_in_unternehmen_ab_2023.pdf)

24. [[PDF] Use of artificial intelligence in enterprises Statistics Explained](https://ec.europa.eu/eurostat/statistics-explained/SEPDF/cache/106920.pdf)

25. [INFOSOC_ETNSI_A_CY_2024_...](https://library.cystat.gov.cy/NEW/ICT_ENT-SIMS-2024-EN-291024.pdf)

26. [20% of EU enterprises use AI technologies](https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20251211-2) - DDN-20251211-2

27. [Digitalisation in Europe – 2025 edition - Interactive publications](https://ec.europa.eu/eurostat/web/interactive-publications/digitalisation-2025)

28. [Statistical processing](https://ec.europa.eu/eurostat/cache/metadata/EN/isoc_e_simsie_si.htm)

29. [ICT usage in enterprises (isoc_e) - European Commission](https://ec.europa.eu/eurostat/cache/metadata/EN/isoc_e_simsie_nl.htm)

30. [https://sdmx.oecd.org/public/rest/data/OECD.STI.DE...](https://sdmx.oecd.org/public/rest/data/OECD.STI.DEP,DSD_ICT_B@DF_BUSINESSES,/AUT+BEL+CZE+DNK+EST+FIN+FRA+DEU+GRC+HUN+IRL+ITA+KOR+LVA+LTU+LUX+NLD+NOR+POL+PRT+SVK+SVN+ESP+SWE+TUR+EU27+OECD+CAN.A.G14_B+B1_B.PT_ENT._T.S_GE10+S_GE100?startPeriod=2024&dimensionAtObservation=AllDimensions&format=csvfilewithlabels)

31. [OECD Digital Economy](https://www.oecd.org/content/dam/oecd/en/publications/reports/2024/05/oecd-digital-economy-outlook-2024-volume-1_d30a04c9/a1689dc5-en.pdf)

32. [Use of artificial intelligence_EUROSTAT](https://www.scribd.com/document/857711349/Use-of-artificial-intelligence-EUROSTAT) - In 2024, 13.48% of EU enterprises utilized AI technologies, with larger enterprises leading at 41.17...

33. [Data on AI Models](https://epoch.ai/data/ai-models) - Our public database, the largest of its kind, tracks over 3500 machine learning models from 1950 to ...

34. [AI Models Documentation – Downloads](https://epoch.ai/data/ai-models-documentation/downloads) - The AI Models dataset is a collection of machine learning models for research about trends in the hi...

35. [Epoch Data on AI Models](https://datahub.io/ai/epoch-data-on-ai-models) - Comprehensive database of over 2800 AI/ML models tracking key factors driving machine learning progr...

36. [notable AI models - Epoch AI](https://epoch.ai/data/notable_ai_models.csv)

37. [Frontier open models may surpass 1e26 FLOP of training compute ...](https://epoch.ai/data-insights/open-models-threshold) - Epoch AI is a research institute investigating key trends and questions that will shape the trajecto...

38. [Largest training compute - Frontier Milestones](https://frontiermilestones.org/agi/training-compute/) - The raw compute (floating-point operations) used to train the largest known model — the clearest sin...

39. [AI Training Compute Grows 4x Yearly, Next Record in ...](https://www.linkedin.com/posts/xi-fang_ai-scalinglaws-frontiermodels-activity-7488737112268124161-Loax) - Ten years ago, the biggest AI training run on record used ~4×10²⁰ FLOP. In 2025, the record hit 5×10...

40. [What was the training compute of the… - FutureSearch](https://futuresearch.ai/app/p/a/rsi-largest-training-compute) - Naively extrapolating the historical ~5x/year compute scaling trend would suggest a mid-2026 frontie...

41. [Artificial Intelligence Index Report 2025](https://hai-production.s3.amazonaws.com/files/hai_ai_index_report_2025.pdf)

42. [LLM Anatomy in 2026: 5 Counter-Intuitive Truths About Frontier AI Model Training](https://pasqualepillitteri.it/en/news/2023/llm-anatomy-2026-frontier-ai-training) - How are LLMs really trained in 2026? Chinchilla scaling laws, DPO/GRPO post-training, FineWeb2 and t...

43. [Computation used to train notable artificial intelligence systems](https://archive.ourworldindata.org/20260819-223747/grapher/computation-used-to-train-notable-artificial-intelligence-systems.html) - Computation is measured in total petaFLOP, which is 10¹⁵ floating-point operations. Estimated from A...

44. [AI Models Documentation – Overview](https://epoch.ai/data/ai-models-documentation) - The AI Models dataset is a collection of machine learning models for research about trends in the hi...

45. [[PDF] Trends in Frontier AI Model Count: A Forecast to 2028 - OpenReview](https://openreview.net/pdf?id=ZJDyzSR5iu) - We therefore forecast the number of models exceeding training compute thresholds in the coming years...

46. [Construction Spending - Data](https://www.census.gov/construction/c30/data/index.html)

47. [Construction Spending - U.S. Census Bureau](https://www.census.gov/construction/c30/c30index.html) - The Value of Construction Put in Place Survey (VIP) provides monthly estimates of the total dollar v...

48. [Construction Spending - Monthly Subnational](https://www.census.gov/construction/c30/monthlysubnational.html)

49. [MONTHLY CONSTRUCTION SPENDING, APRIL 2026](https://www.census.gov/construction/c30/pdf/release.pdf)

50. [[PDF] Value of Private Construction Put in Place - Seasonally Adjusted ...](https://www.census.gov/construction/c30/pdf/privsa.pdf)

51. [Construction Spending on Data Centers, Factories, Chip ...](https://wolfstreet.com/2026/05/07/construction-spending-on-data-centers-factories-chip-plants-powerplants-office-buildings-boom-at-one-end-bust-at-the-other/)

52. [Data center spending hits record in 2026 - CoStar](https://www.costar.com/article/1713855862/data-center-spending-hits-record-levels-in-2026)

53. [Data Center Construction Spending Surpasses $81B in 2026](https://finance.yahoo.com/real-estate/articles/data-center-construction-spending-surpasses-052716163.html) - US data center construction hit a record $81.5B by June 2026, surpassing 2025 as AI drives larger, c...

54. [US Data Center Construction Drops for First Time Since 2020](https://introl.com/blog/us-data-center-construction-drop-first-since-2020) - US data center capacity under construction fell to 5.99 GW from 6.35 GW. Power, moratoriums, and lab...

55. [August 2026 Data Center Report: Construction Starts Total $22.3 ...](https://news.constructconnect.com/august-2026-data-center-report-construction-starts-total-22.3-billion-second-highest-on-record) - The ConstructConnect Data Center Report tracks construction starts, costs, geography, and near-term ...

56. [North America Data Center Trends H1 2026](https://www.cbre.com/insights/books/north-america-data-center-trends-h1-2026) - U.S. data center vacancy hit a record low of 1.4% in H1 2026 as AI-driven demand absorbed supply fas...

57. [CHALLENGER REPORT](https://www.challengergray.com/wp-content/uploads/2026/02/CR126007123.pdf)

58. [CHALLENGER REPORT](https://www.challengergray.com/wp-content/uploads/2026/01/Challenger-Report-December-2025.pdf)

59. [AI-Related Job Cuts 2025: 7,600... — American Default](https://americandefault.org/indicators/the-ai-cut/) - AI-attributed layoffs: 54,836 in 2025 (Challenger). Job cuts where companies explicitly cited AI. Li...

60. [Challenger Report: Layoffs Fall, Hiring Picks Up; AI Leads ...](https://www.challengergray.com/blog/challenger-report-layoffs-fall-hiring-picks-up-ai-leads-for-fifth-straight-month/) - U.S.-based employers announced 33,429 job cuts in July 2026, the lowest monthly total in two years, ...

61. [Challenger Report: June Layoffs Cool to 45849, Down 53% From ...](https://www.challengergray.com/blog/challenger-report-june-layoffs-cool-to-45849-down-53-from-may-ai-leads-reasons-for-fourth-consecutive-month/) - Artificial Intelligence led all reasons for job cuts, with 14,029 announced during the month, or 31%...

62. [[PDF] May 2026 CHALLENGER REPORT](https://www.challengergray.com/wp-content/uploads/2026/06/Challenger-Report-May-2026.pdf) - In May, Artificial Intelligence (AI) led all reasons for job cuts for the third month in a row, with...

63. [[PDF] CHALLENGER REPORT October 2025](https://www.challengergray.com/wp-content/uploads/2025/11/Challenger-Report-October-2025.pdf) - AI has been cited for 48,414 job cuts this year. Market and Economic Conditions accounted for anothe...

64. [2025 Year-End Challenger Report: Highest Q4 Layoffs ...](https://www.challengergray.com/blog/2025-year-end-challenger-report-highest-q4-layoffs-since-2008-lowest-ytd-hiring-since-2010/) - Layoff plans by US-based employers soared in 2025 led primarily by the Federal Government and Techno...

65. [AI is leading to thousands of job losses, report finds - CBS News](https://www.cbsnews.com/news/ai-jobs-layoffs-us-2025/) - The advent of AI in the workplace is one factor behind a spike in layoffs this year, new labor data ...

66. [Year-end jobs report: Layoffs shot up, hiring plans are ...](https://www.cfo.com/news/year-end-jobs-report-layoffs-shot-up-hiring-plans-are-modest-Challenger-Gray-Christmas/809647/) - The number of jobs displaced by AI, along with federal government cuts, skyrocketed last year.

67. [JOLTS analysis | Economic Policy Institute](https://www.epi.org/indicators/jolts/) - The Job Openings and Labor Turnover Survey (JOLTS) tells us how many job openings there are each mon...

68. [CES Published Series - Bureau of Labor Statistics](https://www.bls.gov/web/empsit/cesseriespub.htm) - For information about NAICS in the CES program, see www.bls.gov/ces/naics/home.htm. For information ...

69. [download.bls.gov](https://download.bls.gov/pub/time.series/ce/ce.series)

70. [Industry Classification Overview : U.S. Bureau of Labor Statistics](https://www.bls.gov/ces/naics/) - NAICS conversions to CES series are based on the employment change from an old NAICS code to a new N...

71. [jl.txt](https://download.bls.gov/pub/time.series/jl/jl.txt)

72. [jt.txt](https://download.bls.gov/pub/time.series/jt/jt.txt)

73. [BLS JOLTS: The Federal Dataset That Measures Why Workers Quit](https://www.ai-analytics.org/writing/bls-jolts/) - JOLTS tracks job openings, hires, quits, layoffs, and other separations monthly by industry and regi...

74. [Job Openings and Labor Turnover Survey](https://catalog.data.gov/dataset/job-openings-and-labor-turnover-survey) - The Job Openings and Labor Turnover Survey (JOLTS) program provides national estimates of rates and ...

75. [Job Openings and Labor Turnover Survey News Release - 2026 ...](https://www.bls.gov/news.release/archives/jolts_08042026.htm)

76. [Table A. Job openings, hires, and total separations by ...](https://www.bls.gov/news.release/jolts.a.htm)

77. [Dataset of provider [BLS]](https://db.nomics.world/BLS/jt?tab=chart) - [jt] Job Openings and Labor Turnover Survey (JOLTS)

78. [[PDF] Estimation of Software in the U.S. National Accounts](https://www.bea.gov/sites/default/files/2018-05/Estimation-of-Software-in-the-US-National-Accounts.pdf) - BEA published estimate for private custom and own-account software investment of $92.2 billion.

79. [[PDF] Recognition of Business and Government Expenditures for Software ...](https://www.bea.gov/sites/default/files/papers/P2000-2.pdf)

80. [Chapter 6: Private Fixed Investment](https://www.bea.gov/resources/methodologies/nipa-handbook/pdf/chapter-06.pdf)

81. [[PDF] Open Source Software as Intangible Capital: Measuring the Cost ...](https://www.imf.org/-/media/files/conferences/2018/6th-stats-forum/session-3carol-robbinsopen-source-software-as-intangible-capitalmeasuring-the-cost-and-impact-of-fre.pdf) - BEA reports that private investment in software in 2017 was $352.9 billion dollars, composed of $147...

82. [nipa-handbook-all-chapters.pdf](https://www.bea.gov/sites/default/files/methodologies/nipa-handbook-all-chapters.pdf)

83. [[PDF] Information Processing Equipment and Software in the National ...](https://users.nber.org/~confer/2002/criws02/wasshausen.pdf) - This own-account investment is measured as the sum of production costs, which include employee compe...

84. [IO tables](https://sites.bu.edu/tpri/files/2026/04/software_output_worksheet.xlsx)

85. [Concepts and Methods of the U.S. National Income and Product ...](https://www.bea.gov/resources/methodologies/nipa-handbook/pdf/all-chapters.pdf)

86. [[PDF] Treatment of Data in National Accounts - Bureau of Economic Analysis](https://www.bea.gov/sites/default/files/2019-05/Paper-on-Treatment-of-Data-BEA-ACM.pdf)

87. [Common menu bar links](https://www150.statcan.gc.ca/n1/pub/13-605-x/2003001/concept/2001software-2001logiciel/4066089-eng.htm)

88. [Regulation (EU) 2016/ of the European Parliament and of the Council of 26 October 2016 on European statistics on natural gas and electricity prices and repealing Directive 2008/92/EC](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32016R1952)

89. [Commission Implementing Regulation (EU) 2017/2169](https://www.legislation.gov.uk/eur/2017/2169/2019-10-31/data.xht?view=snippet&wrap=true) - Regulation (EU) 2016/1952 establishes the common framework for producing comparable European statist...

90. [Eurostat/nrg_pc_205 on DBnomics](https://db.nomics.world/Eurostat/nrg_pc_205?offset=30&tab=chart) - Electricity prices for non-household consumers - bi-annual data (from 2007 onwards)

91. [Eurostat/nrg_pc_205 | DBnomics](https://db.nomics.world/Eurostat/nrg_pc_205?offset=10) - Electricity prices for non-household consumers - bi-annual data (from 2007 onwards)

92. [[PDF] REGULATION (EU) 2016/1952 of 26 October 2016 on European ...](https://www.derk.ba/DocumentsPDFs/EnZ-2016-1952-e.pdf) - This Regulation establishes a common framework for the development, production and dissemination of ...

93. [Regulation - 2016/1952 - EN](https://eur-lex.europa.eu/eli/reg/2016/1952/oj)

94. [[PDF] Quality report of European Union statistics on electricity and natural ...](https://ec.europa.eu/eurostat/documents/38154/42201/Quality+report+-+2022_v03.pdf)

95. [Data revision](https://ec.europa.eu/eurostat/cache/metadata/en/nrg_pc_204_sims.htm)

96. [Electricity prices (from 2007 onwards) - European Commission](https://ec.europa.eu/eurostat/cache/metadata/EN/nrg_pc_204_sims_lt.htm)

97. [Electricity prices for non-household consumers](https://fgeerolf.com/data/eurostat/nrg_pc_205.html)

98. [Natural gas price statistics Statistics Explained](https://ec.europa.eu/eurostat/statistics-explained/SEPDF/cache/45229.pdf)

99. [[PDF] CHAPTER 6: Policy and Governance - Stanford HAI](https://hai.stanford.edu/assets/files/hai_ai-index-report-2025_chapter6_final.pdf) - Artificial Intelligence. Index Report 2025. 5. The number of U.S. AI-related federal regulations sky...

100. [The 2025 AI Index Report | Stanford HAI](https://hai.stanford.edu/ai-index/2025-ai-index-report) - U.S. federal agencies introduced 59 AI-related regulations—more than double the number in 2023—and i...

101. [[PDF] Policy and Governance - Stanford HAI](https://hai-production.s3.amazonaws.com/files/hai_ai-index-report-2024_chapter_7.pdf)

102. [Policy and Governance | The 2025 AI Index Report - Stanford HAI](https://hai.stanford.edu/ai-index/2025-ai-index-report/policy-and-governance) - The number of U.S. AI-related federal regulations skyrockets. In 2024, 59 AI-related regulations wer...

103. [AI Regulation Radar](https://workwisesolutions.org/tools/ai-regulation-radar.html) - A live read on AI rulemaking across US financial regulators, computed daily from the Federal Registe...

104. [Governments are stepping up on AI: Stanford University's ...](https://aifray.com/governments-are-stepping-up-on-ai-stanford-universitys-ai-index-2025/)

105. [Stanford HAI’s 2025 AI Index Reveals Record Growth in AI Capabilities, Investment, and Regulation](https://www.businesswire.com/news/home/20250407539812/en/Stanford-HAIs-2025-AI-Index-Reveals-Record-Growth-in-AI-Capabilities-Investment-and-Regulation) - Today, the Stanford Institute for Human-Centered AI (HAI) released its 2025 AI Index report which pr...

106. [Taking Further Agency Action on AI](https://www.americanprogress.org/article/taking-further-agency-action-on-ai/) - This joint report from Governing for Impact and the Center for American Progress maps select agencie...

107. [EXECUTIVE ORDER](https://public-inspection.federalregister.gov/2020-27065.pdf?1607348735)

108. [[PDF] National Artificial Intelligence Research and Development Strategic ...](https://bidenwhitehouse.archives.gov/wp-content/uploads/2023/05/National-Artificial-Intelligence-Research-and-Development-Strategic-Plan-2023-Update.pdf)

109. [Safe, Secure, and Trustworthy Development and Use of Artificial Intelligence](https://www.federalregister.gov/documents/2023/11/01/2023-24283/safe-secure-and-trustworthy-development-and-use-of-artificial-intelligence) - Search, browse and learn about the Federal Register. Federal Register 2.0 is the unofficial daily pu...


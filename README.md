# Diffusion

**Is AI changing the economy?**

A public dashboard that tries to answer that honestly — including where the
answer is "we can't tell yet".

In economics, *technology diffusion* is how an innovation spreads through an
economy and shows up in measured output. In AI, diffusion models are a core
architecture. The name is the subject and the thesis at once.

Live at **https://trydiffusion.vercel.app**. The landing page is open; reading
the data needs a free account, because the readership is part of what this is
for.

The 1.1.0 intervention is pushed on `codex/diffusion-intervention`, not yet
confirmed in production. See the [release record](docs/research/release-current-status.md)
for the verified local/staging results and remaining deployment checks.

![The overview page](docs/screenshots/1-overview.jpg)

---

## The problem this is built against

There is no shortage of confident writing about AI and the economy. Almost none
of it shows its working, and most of it is arguing for something.

Diffusion is the opposite bet: gather the data, state what it does and does not
support, and make the reasoning inspectable. It is built for researchers and
students — and for me, because I kept wanting it while writing a master's
thesis on whether generative AI adoption had moved US industry productivity.
(It mostly hadn't, which I found more interesting than if it had.)

## The rules it holds itself to

These are the point of the project. Everything else is implementation.

**Numbers must remain traceable to their sources.** Charts use provider
observations, source-linked report extractions or explicitly labelled scenarios.
Research prose can be agent-drafted and agent-assessed. That is not human
editorial approval; the review record distinguishes those actors and retains
unresolved findings.

**Numerical summaries use fixed templates, not free-form generated prose.**
The 1.1.0 reader labels them *Automatically rendered from source-bound facts*.
Each fact binds its indicator, country, unit, period, values, source and provider
qualifications. Both lens and simulation readers validate cached text against
current facts before displaying it:

- `src/server/lib/narration-facts.js` accepts existing fact IDs and renders
  deterministic sentences. A valid number attached to the wrong country,
  unit, date or source is not valid evidence.
- `NarrationBlock` exposes the fact tuples, selected IDs and qualifications.
  Breaks and incompatible comparisons are withheld; projections and scenarios
  stay labelled.
- Old renderer versions, changed facts and tampered cached sentences are not
  shown. Narration generation needs no model credentials. Local integration
  verified five lens summaries and simulation narration; this does not assert
  that production has received the intervention.

These checks protect source/value bindings, not the accuracy of a publisher's
measurement, causal interpretation or a simulation's assumptions. See the
[typed narration record](docs/research/typed-narration-completion.md).

**What the data cannot show is a section, not a footnote.** Every question page
states its limits directly beneath its answer and above every chart. A page
with no caveat is usually a page that has not been thought about.

**Evidence strength is stated, including when it is insufficient.** Pages are
labelled `insufficient` / `suggestive` / `consistent` / `contested`. The
productivity question is marked **insufficient** — aggregate productivity
statistics are too noisy and too lagged to detect an effect this size this
early, so an absence of signal there is weak evidence of an absence of effect.
Saying so is the finding.

**Two registers, not one text with jargon added.** *Plain* states the finding.
*Technical* answers a different question: how it was measured, and where it
misleads.

**Prose and review are versioned.** Numbers update on ingestion; research
sentences do not follow automatically. Exact-content review bindings become
stale when their dependencies change. Agent disposition is shown separately
from human approval; the older `stale_questions` view alone cannot establish
editorial validity.

**Charts are not allowed to flatter.** One y-axis, always — no dual-axis
charts. Zero baseline by default; where an index scale genuinely needs a padded
floor, the chart says *"axis does not start at 0"* on its face. A gap in the
data breaks the line rather than drawing a straight segment across months
nobody collected. A chart that cannot be drawn honestly refuses to draw and says
why. The full list is enumerated, with the line implementing each,
in [`src/client/components/charts/HONESTY.md`](src/client/components/charts/HONESTY.md).

---

## How it is organised

Five **lenses** — classical economics subfields, in the order the causation is
supposed to run:

| Lens | The question underneath |
|---|---|
| Investment & Capital | What is being spent, and what it buys |
| Growth & Productivity | Whether any of it shows up in output |
| Labour Markets | Jobs, pay and who gets hired |
| Prices & Markets | What it costs, and what markets think |
| Policy & Regulation | What governments are actually doing |

Each lens reads as an article, not a container: the argument first, then the
prices it depends on, then the questions beneath it.

![A lens page](docs/screenshots/2-lens-investment-and-capital.jpg)

**23 active questions** sit under those lenses. Each one runs in the order an
argument runs — the finding, how confident and when it was last checked, what
it cannot show, the claim being tested, how this page measures it, the
evidence, and what other people have published. Seventeen more are drafted and
switched off with evidence gaps recorded. Being active is not a certificate of
causal identification or human review.

![A question page](docs/screenshots/3-question-claim-method-caveat.jpg)

Then the evidence, with a caption on every chart explaining why that series is
on that page:

![The evidence](docs/screenshots/4-the-evidence-hero-chart.jpg)

![Supporting series](docs/screenshots/5-supporting-series.jpg)

Every series is also browsable directly at `/data`, without going through an
argument, with its licence, attribution and publisher link. `/countries` lists
economies separately from aggregates and opens country-specific coverage.
Navigation preserves the selected country; missing data never silently falls
back to the US.

---

## The data

The September 11 staging checkpoint contains **101,157 stored observations
(including missing records), 187 active indicators and 99 economies**. These
are staging counts, not claims about the currently deployed database. The
[release record](docs/research/release-current-status.md) records their scope
and the latest verification. `npm run status:figures` remains a diagnostic
query report; its legacy README rewrite/check assumptions are not the 1.1.0
editorial completeness gate.

Sources include FRED, World Bank, DBnomics mirrors, SEC EDGAR, Epoch AI,
US Federal Register, LBMA, GDELT, OpenAlex, Census BTOS and news feeds.

Diffusion **links and cites; it does not redistribute**. Every source carries
its licence and attribution in the database, and the per-series page displays
both. Take the data from the publisher.

### Where the data is weak — stated plainly

- **Country coverage remains uneven.** Staging has 98 economies with more than
  six usable indicators, but much of that depth is shared macro context, not
  evidence of AI effects. Taiwan remains thin. Separate survey instruments and
  corporate filing mentions are not ranked as one comparable adoption rate.
- **Policy publication counts are not the stock of rules in force.** Chart and
  ticker explanations distinguish publications, proposals and legal status.
- **Provider availability is not guaranteed.** Bounded retries and GDELT
  complete-month recovery are implemented; 116 nonnull GDELT months run through
  August 2026 in staging. A successful Census-only hosted run does not verify
  the scheduled operation of all other providers.
- **Agent review is not human sign-off.** All 56 report figures and 422 points
  have individual source dispositions. Three IMF percentages remain unresolved
  against their printed endpoints. Qualitative findings are not encoded as
  zero, and studies with different outcomes are not a common effect-size scale.
  Source fidelity does not establish causal validity or replicate proprietary
  raw data and estimation code.

See the [claim review record](docs/research/claim-review-completion.md) and
[source reliability record](docs/research/source-reliability-completion.md).

---

## Stack

Node 24 (ESM) · Express 4 · Postgres 18 on Neon (`aws-eu-west-2`) · React 19 ·
Vite · Tailwind v4 · BoardUI · Recharts · TanStack Query · React Router on real
paths. Deployed on Vercel as one function, region `lhr1`, next to the database.

### Things worth looking at if you are reading the code

- **`src/client/components/charts/HONESTY.md`** — the chart rules enumerated,
  each naming the file and line that implements it, and each with a unit test.
  A rule that is counted but never written down cannot be handed over.
- **`scripts/check-tokens.js`** — a Tailwind class that does not exist does not
  throw, does not warn, and does not fail the build; it silently generates no
  CSS. Seven such classes shipped here and made the whole app look broken for
  weeks. This asserts the invariant nothing else will, and gates the build.
- **`scripts/check-contrast.js`** — every colour used as text or as a UI mark,
  checked against both card surfaces. `charts.css` had told people for months
  to run a validator that was never in the repo.
- **`src/server/lib/narration.js`** — the gate described above, and an honest
  account of what output-checking cannot catch.
- **`src/server/ingestion/runner.js`** — `finishRun` redacts credentials at the
  point of storage, because `/api/status` renders ingestion errors publicly and
  a request URL carrying an API key would otherwise be published.
- **`db/migrations/`** — checksum-locked; editing an applied migration throws.
  Each one opens with why it exists, not what it does.
- **`db/seeds/012_lenses.sql`** — `lens_tickers.why` explains, per placement,
  what a price is doing on that specific page. Copper on Investment argues
  about build-out; copper on Prices argues about markets. That per-placement
  rationale is why the table exists instead of a column on `indicators`.

---

## Running it

```bash
npm install
cp .env.example .env      # DATABASE_URL is the only one needed to boot
npm run db:migrate && npm run db:seed
npm run build             # public/ is build output and is gitignored
npm start                 # http://localhost:3000
```

For development, `npm run dev` runs Express on 3000 and Vite on 5173 together —
**open 5173**, which hot-reloads and proxies `/api` to Express.

### The seeds carry structure, not measurements

Worth knowing before you wonder why the charts are empty. **No seed file
inserts a row into `observations`** — check it with
`grep -l 'INSERT INTO observations' db/seeds/*.sql`, which returns nothing. The
seeds build the shape of the site: indicators, questions, lenses, ticker
placements, the report figures and their points, the financing events.

So a fresh clone renders the site, the navigation, the questions and the report
figures, and every FRED, DBnomics, World Bank, Epoch and LBMA chart is blank
until ingestion runs:

```bash
npm run ingest            # everything due
npm run ingest -- rss --force   # just the news
```

Some providers need credentials or identification: `FRED_API_KEY` and `SEC_USER_AGENT`,
which is not a key but a string naming you and your email — the SEC requires it
and rejects requests without one. Other adapters support public retrieval, but
provider access, limits and verification states must be checked rather than
inferred from the presence or absence of a key. See `.env.example` and the
[source reliability record](docs/research/source-reliability-completion.md).

### Gates

```bash
npm test                  # unit tests; the suite prints its own count
npm run check:tokens      # design tokens resolve
npm run check:contrast    # WCAG AA on both card surfaces
npm run check:routes      # every client route has a production rewrite
npm run check:data        # data integrity — needs a database
npm run check:charts      # no chart group draws more series than there are hues
npm run status:figures    # diagnostic query report; legacy docs checks are separate
node scripts/check-editorial-completeness.js             # exact-content offline gate
node scripts/check-editorial-completeness.js --database  # compare with configured database
npm run check:landing-assets  # content-versioned landing references
```

`npm run build` assigns content-versioned URLs to changed landing assets and runs tokens, contrast,
routes and the Vercel CSP check. Database checks need the intended database
configuration. Research discovery, structured evidence, source refresh and
bootstrap commands are documented in the
[research workflow guide](docs/research/research-workflow-completion.md).

---

## Licence

MIT, in [`LICENSE`](LICENSE) — and read the note under it before using anything
here. The licence covers the code and **cannot cover the data the code
retrieves**. Diffusion links and cites rather than redistributing; every source
carries its own licence and attribution in the `sources` table, and both render
on every series page. Those terms are the publishers' and they vary. Take the
data from the publisher, on the publisher's terms.

---

## Status

The existing site is live. The 1.1.0 intervention is on the feature branch;
its deployment is not yet confirmed. The [release record](docs/research/release-current-status.md)
separates local verification, hosted checks and production steps. Country
coverage and unresolved source findings remain visible rather than being
treated as complete evidence of AI's economic effects.

If you are an economist: I would genuinely value you telling me where the
comparisons are wrong. **Contact:**
[linkedin.com/in/joshuakhalili](https://www.linkedin.com/in/joshuakhalili/).

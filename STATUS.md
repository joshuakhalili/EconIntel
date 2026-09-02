# Diffusion — where things stand

Read this first in a new session. Say "read STATUS.md and catch me up" and Claude
will pick up from here without you re-explaining anything.

Last updated: 2026-09-02 (fifth pass — the site is deployed and live on Vercel +
Neon, the simulation layer landed, and the scheduled ingest has still never run).

**The one operational fact to read before anything else:** the site is live and
working, and its data is going stale, because the scheduled ingestion job has
failed on every run it has ever attempted. See
[Scheduled ingestion](#scheduled-ingestion--wired-and-it-has-never-once-succeeded).

## The project is now called Diffusion (was EconIntel)

In economics, *technology diffusion* is the term for how an innovation spreads
through an economy and shows up in measured output. In AI, diffusion models are
a core architecture. The name states the subject and the thesis at once.

The rename is done in code. **Two things still carry the old name and are
Phase 6 work:** the GitHub repo is still `joshuakhalili/EconIntel` (confirmed
2026-09-02), and the outbound `User-Agent` strings in the ingestion adapters
already point at `github.com/joshuakhalili/Diffusion`, which will 404 until the
repo is renamed. The contact email in those strings is correct and working,
which is what SEC EDGAR actually requires. The folder on disk is still
`~/Projects/EconIntel`.

`legacy/` still says EconIntel throughout. That is dead reference code kept
for behaviour that was tuned over time; it is loaded by nothing.

**The concept was substantially rethought on 2026-08-28.** The full decision
record — purpose, audience, the lens taxonomy replacement, the research layer,
the circular-financing feature, and what is deliberately deferred — is in
`CONCEPT-GRILL-LOG.md`. Read that before planning any new work; it is more
current than the sections below.

**Standing rule for this file:** nothing gets written here as a present-tense
fact ("X prevents Y", "the rule that governs Z") unless there's a code path
that actually enforces it right now. Schema and intent go under "What's NOT
built yet" or get an explicit "designed, not enforced" caveat — a grill session
on 2026-08-28 found the narration/grounding rule below stated as governing
fact with zero enforcing code behind it.

The same rule now applies to numbers. Every count in this file was taken from
the live database on 2026-09-02 rather than carried forward, because the fourth
pass found a figure here that was 2,766 too high with no explanation anywhere.
If you are quoting a number to anyone, re-run the query.

## The front end was rewritten in React — read this first

The hand-built `public/app.js` is gone. The front end is now React 19 + Tailwind
v4 + **BoardUI** components, built by Vite from `src/client/` into `public/`.

**`public/` is build output now and is gitignored.** Nothing in it is source.
If you edit a file there it will be destroyed by the next build. The old
hand-written files are kept in `legacy/` as the reference for behaviour that was
tuned over time; they are not loaded by anything and can be deleted once you are
confident nothing else needs porting.

**You must run a build before `npm start` shows anything**, because `public/`
starts empty on a fresh clone:

```
npm install
npm run build      # writes public/
npm start          # http://localhost:3000
```

For development use `npm run dev`, which runs Express on 3000 and Vite on 5173
together — open **5173**, which hot-reloads and proxies `/api` to Express.

Two things BoardUI assumes that are not true here, both handled without editing
its generated files so `npx boardui@latest init` can be re-run later:

- It is built for Next.js and expects `next/font` to define `--font-inter` and
  `--font-mono-source`. Those are defined in `src/client/styles/app.css`.
- Its dark mode keys off a `.dark` class, so the app uses that too rather than
  the old `data-theme` attribute.

**BoardUI's chart components are all paid**, as are its page templates. Charts
are **Recharts**. The free BoardUI set is still large (28 base components plus
Data Table, Sidebar, Settings Modal, Notification Center) — run
`npx boardui@latest list` to see it.

## What this project is

A public dashboard measuring AI's economic effect worldwide. Not a database
browser — organised as **lenses**, each containing questions, contextual price
tickers, and news.

Every answer is stored in two registers, plain and technical. **Only the plain
one is ever shown.** The Plain/Technical toggle was deleted on 2026-08-30: it
had never worked — `AppShell` read `{ register, setRegister }` from a provider
exposing `{ mode, setMode, isTechnical }`, and the segmented control was passed
react-aria's props under the wrong names, so no segment ever rendered selected
and clicking never touched state. The `*_expert` columns are still written and
still populated; nothing reads them. Every `*_expert` has a `*_plain` twin, so
the fallback is total rather than partial.

The orphaned `SegmentedControl` component that toggle used was deleted on
2026-09-02, having outlived it by three days. Its `--color-segmented-control-*`
tokens are still declared in `src/client/styles/theme.css` — that file is
BoardUI's generated token layer and is left alone by policy, so unused tokens
there are expected rather than leftovers to chase.

The five lenses are classical economics subfields, ordered the way the causation
is supposed to run: **Investment & Capital → Growth & Productivity → Labour
Markets → Prices & Markets → Policy & Regulation**. They replaced an earlier
mixed set (Money / Work / Infrastructure / Policy / Adoption) that mixed inputs,
outputs and mechanisms at the same level — see `CONCEPT-GRILL-LOG.md`.

## The LLM layer exists, and the rule is now enforced in code

**Built 2026-08-30.** This section replaces a note that had stood since the
project began saying the rule below was schema with nothing behind it.

The rule: an LLM is never asked to invent a number or a citation — it is handed
SQL-computed values and stored claims and asked to connect them in a sentence.

**`src/server/lib/narration.js` is the enforcement, and it works on the OUTPUT,
not the prompt.** A prompt that says "do not invent numbers" is a request, and
models honour it most of the time — which is the worst possible reliability
profile for a site whose whole claim is that its figures are real, because the
failure is rare, silent and looks like success. So `validate()` decides:

- **Every numeric token in the output must appear in the grounding.** Not
  rounded from it, not derived from it — in it. A value written to fewer
  decimals is accepted; a computed difference or percentage is not.
- **No URL, DOI, quotation, or phrase like "according to".** A citation is the
  one thing this model may never produce.
- **Every direction claim is checked against the data.** Added after the first
  working run wrote *"US graduate unemployment decreased slightly from 3.7% to
  3.8%"* — both figures real, both in the grounding, the sentence reading its
  own data backwards.

**It fails closed.** When nothing passes, no row is written and the page
renders without a paragraph. A missing summary costs a reader nothing; a
fabricated figure costs this project the only thing it has.

**Measured, not asserted** (`@cf/meta/llama-3.1-8b-instruct`): six generations
from the real prompt — 6 accepted. Four from a deliberately adversarial prompt
asking for percentage changes, historical context and source names — 4
rejected, catching `-3.7%` (arithmetic on two supplied levels), `2021`/`2022`/
`2023` (invented history) and three figures with no origin. 37 unit tests,
re-run 2026-09-02, all passing.

**Nothing in the web tier calls a model.** `scripts/generate-narrations.js`
writes them ahead of time; `getLens()` only ever SELECTs the cached row. So a
reader never waits on Workers AI and no request can exceed a function ceiling
because a model was slow. There are **8 narration rows** in the database.

**It renders labelled.** `NarrationBlock` sits below the ticker strip under the
heading "Written by a machine from the figures below", with the exact grounding
one click away. The guarantee is narrow and the component says so: the
arithmetic is checked, the sentence is not.

Known cosmetic inconsistency, not yet fixed: the ticker renders 28.99 as `29`
because `lib/format.js`'s `fmt()` applies its own rounding rule and ignores
`indicators.decimals`, while the narration uses the stored precision. Same
number, two appearances. Fixing it changes how every figure on the site
renders, so it is an editorial decision rather than a bug fix.

## The simulation layer

**Built 2026-08-31, tested, deployed, and dead in production.** It is the
largest feature in the codebase that this file has never mentioned, which is
its own kind of failure — a reader of STATUS.md would have had no idea it
existed.

What it is: a scenario page where a reader moves sliders (spending, horizon,
country) and watches a four-equation transmission chain run forward.

```
spending      → output         a fiscal multiplier, decaying over the horizon
output        → unemployment   Okun's law
unemployment  → wages          a wage Phillips curve, with persistence
wages         → prices         pass-through, plus a direct Phillips term
```

**The rule this feature exists to enforce: `src/server/lib/simulation.js`
contains no number of its own.** Every coefficient arrives as an argument, read
from `simulation_parameters`, where the schema refuses a row without a citation.
A hardcoded `0.8` in an equation is an uncited claim about the world wearing the
costume of an implementation detail, and no gate this project has could see it —
the schema cannot check a number that never reaches it. Search that file for a
numeric literal in an equation and you should find none.

An agent-based model was considered and rejected twice over: it cannot run
inside a 15s function with an 8s statement timeout behind it, and it would not
be more *true* — an ABM's outputs are only as good as behavioural rules we would
be choosing ourselves. A four-equation chain whose every coefficient traces to a
published estimate is a weaker model that is far easier to check, and being
checkable is the only property this project trades on. The model is linear, has
no expectations, no monetary policy reaction, no capacity constraint and no
feedback from prices back to output; each omission is wrong in a knowable
direction, and `scenario.caveat` is NOT NULL so the page has to say so.

What exists on disk and in the database:

- `db/migrations/0023_simulations.sql` — `simulation_scenarios`,
  `simulation_inputs`, `simulation_parameters`, `simulation_runs`, plus the
  `unrunnable_scenarios` view, which lists any scenario/country pair with zero
  parameters.
- `src/server/lib/simulation.js` — the engine.
- `src/server/repositories/simulations.js` — the queries.
- Four endpoints in `app.js`: `GET /api/simulations`, `/api/simulations/:slug`,
  `/api/simulations/:slug/run`, `/api/simulations/:slug/evidence`.
- `src/client/routes/SimulationPage.jsx`, lazily loaded at `/simulate/:slug`.
- `scripts/generate-simulation-narrations.js`.
- **32 tests**, all passing.

**And it is unreachable, because no scenario row has ever been seeded.**
`simulation_scenarios`, `simulation_inputs`, `simulation_parameters` and
`simulation_runs` all hold **0 rows** as of 2026-09-02. There is no seed file
for them — the migration creates the tables and nothing fills them. So
`/api/simulations` returns an empty list to anyone signed in, `/simulate/:slug`
has no valid slug to be given, and nothing in the nav links to it. **The whole
feature is one seed file away from being live, and that seed file is the
highest-value small job on the list.**

The narration script deserves one note before anyone writes that seed. A
scenario has as many states as its sliders have positions, and a narration is
keyed on a hash of the exact numbers it describes, so a slider moved one step is
a cache miss forever. The script therefore writes narrations for the **default
slider position only** — the state a reader arrives in — and every other
position renders without prose. That is deliberate: the alternative reads better
and is worse, generating unreviewed prose about numbers no gate has seen, in the
request path of a slider drag.

## The site is now two halves, served as one

**`landing/` is a cloned static site.** A hardened mirror of a Framer template
(`atmos-system.framer.website`), committed as source. It owns `/` and
`/legal/*`. Its build pipeline lives in `landing/docs/`: edit
`content_diffusion.py`, then
`bash docs/reset.sh && python3 docs/build-diffusion.py`. **Never hand-edit the
built HTML** — the build refuses to run twice and resets from the
`pristine-mirror` tag in `~/Projects/diffusion-landing`.

Every primary CTA reads **"Sign in to read"** and lands on `/login`, which shows
"Signed in as …" to anyone who already is. `/waitlist` and `/thanks` are
retired: nothing links to them, Express redirects both to `/login` and so does
`vercel.json`, because the waitlist page still rendered the template's invented
"1,200+ people on the waitlist".

**The two legal pages were the template's**, verbatim, describing environmental
sensors and paid subscriptions and making false claims about reader data — under
a form that asks for a name and an email. Both are rewritten, through the
content map like everything else. The `.framercms` blobs hold a second copy and
are never touched; they are also never fetched, which is why string replacement
is sufficient here.

**`src/client/` is the React app.** Everything else: lenses, questions, `/data`,
`/explore`, `/news`, `/pipeline`, `/simulate`.

Express serves both from one origin (`src/server/index.js`). They can share
`/assets` only because their filenames cannot collide — Framer content-hashes,
Vite emits `index-<hash>`.

## Sign-in

Reading the data needs a free account; the landing page stays public. Two
routes, **no password by either**: a name and an email (unverified — a
readership record, not a security check), or GitHub.

`readers_editor_must_be_verified` in the database refuses `is_editor` on any
non-GitHub identity. Editing rights are Joshua's alone, granted by hand in SQL,
and nothing in the app can set them.

Needs `SESSION_SECRET` in `.env` (already set locally, and set on Vercel).
`GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are optional — without them the
GitHub button is hidden and email sign-in still works.

The gate is live and working: `GET /api/simulations` on production returns
`{"error":"Sign in to read the data","signInUrl":"/login"}` to an anonymous
caller. `readers` holds **1 row**.

## The app is dark only

Light mode is deleted, not fixed. `atmos.css` is the whole token layer and
re-points BoardUI's neutral ramp, which is what every one of its ~60 surface
tokens resolves through. `index.html` hardcodes `class="dark"`.

Type matches the landing page: Inter Display (self-hosted from the same woff2
that page serves), Trispace for eyebrows, Fragment Mono for figures. **Trispace
and Fragment Mono are loaded by a `<link>` in `index.html`, not by an `@import`
in the CSS** — an `@import` is only valid at the top of a stylesheet, `atmos.css`
is imported third, and the minifier silently dropped it, so neither face was
ever requested in a production build for weeks. Nothing warned; the eyebrows
just rendered in the system mono.

Five lens pages, each with its own signature module in
`components/lens/LensSignature.jsx` — Prices shows the divergence, Investment a
materials board, Labour the disagreement, Growth adoption ranked, Policy the
rule counts. Per-lens accent in `lib/lensAccent.js` is **chrome only** and must
never draw a data series.

Question pages are built from the same pieces: hero band, eyebrows, the parent
lens's accent, prev/next through the lens. **The caveat sits in a full-width
band directly under the answer and above every chart** — an earlier version had
it last, after four charts, on a recessed surface, which is first-class in the
markup and a footnote to anyone reading.

## On GitHub, public, `main` is current

`react-rewrite` was fast-forward merged into `main`, and there is no longer a
"working vanilla version" anywhere; the React site *is* the site. Repo:
`github.com/joshuakhalili/EconIntel`, public, default branch `main`, **0 open
Dependabot alerts** (checked 2026-09-02).

Three remote branches: `main`, the merged `react-rewrite`, and
`claude/capabilities-workflow-questions-76ss3l`, which is not local work and is
not merged. The Dependabot `undici-7.29.0` branch this file used to mention no
longer exists; whether it was merged or closed was not established, but there
are no open alerts left behind it.

**Vercel deploys every push to `main` straight to production**, so `main` is not
a staging area — see the deploy section below.

**MIT licensed.** `LICENSE` at the repo root covers the code. The data is not
covered and cannot be — each source carries its own licence in the `sources`
table and it is shown on every series page. Cite and link; take the data from
the publisher.

## Stack

Node 24 ESM, Express 4, **Postgres on Neon, region `aws-eu-west-2` (London)**.
Front end is React 19 + Tailwind v4 + BoardUI, bundled by Vite; charts are
Recharts; data fetching is TanStack Query; routing is React Router on real paths
(Express has a catch-all so a deep link loads, and `vercel.json` has a rewrite
table that does the same job in production). Cloudflare Workers AI for the LLM
layer (free tier, 10k neurons/day) — key is in `.env`, never committed.

**This file said "Postgres 18.4 on Render (Frankfurt)" until 2026-09-02, and it
was the first line anyone read.** The database moved to Neon with the deploy;
`db/pool.js` picks `@neondatabase/serverless` off the `.neon.tech` host and the
local `.env` has pointed at Neon since. Nothing runs on Render — see below.

## Deployed and live

**https://diffusion-econintel.vercel.app** — checked 2026-09-02: `/` returns
200, `/healthz` returns 200 with
`{"ok":true,"database":"connected","latencyMs":110,"env":"production"}`.

This was the top item under "What's NOT built yet" in the last two passes of
this file. It is built.

- **`src/server/app.js` holds the application; `src/server/index.js` is a
  ~45-line listener.** `app.listen` used to run as an import side effect, so
  anything importing the routes opened a port. `api/index.js` re-exports the
  app for Vercel — **one function, not one per endpoint**, because the route
  order is load-bearing: `/api/me` is registered before the auth gate so a
  signed-out reader can ask whether they are signed in, `/healthz` sits
  outside it, and `/waitlist` is answered before `express.static`.
- **Region is `lhr1`**, pinned in `vercel.json`, next to a Neon database in
  `aws-eu-west-2`. Both are London. *(Earlier passes of this file said `fra1`;
  that was the plan, not the pin.)* `api/index.js` has `maxDuration: 15`.
- **`db/pool.js` picks its driver from the connection string.** A
  `.neon.tech` host gets `@neondatabase/serverless`; anything else keeps `pg`.
  Parsed, not substring-matched, so a password containing `.neon.tech` does
  not flip the transport. **The type parsers are applied to the CHOSEN
  driver** — Neon bundles its own `pg-types`, so setting them on `pg` while
  running on Neon registers on a registry nothing reads and every NUMERIC
  arrives as a string. That fails as plausible wrong numbers, not an error.
- **`DB_STATEMENT_TIMEOUT_MS`** — 30s is right for ingestion and wrong behind
  a function ceiling. Set 8000 on the web deployment; ingestion keeps 30s.
- **`scripts/build-static.js`** assembles `dist/`, because a CDN has no
  fall-through where Express had ordering. Both halves have an `index.html`;
  the app shell becomes `app.html` so the landing page keeps `/`. `docs/`,
  `.mirror-cache/` and the waitlist pages are not deployed.
- **Two build gates, both of which caught something on their first run.**
  `check:routes` compares `App.jsx` to the rewrite list — on Express an
  unknown path falls through to the shell, so a missing rewrite 404s only in
  production and only on a hard load. `check:vercel` regenerates the CSP from
  the served HTML and fails when `vercel.json` disagrees.
- **A post-deploy smoke test**, `.github/workflows/smoke.yml`, which is the
  third gate and the only one that tests what a reader actually gets. Two
  deploys went out broken while every local gate was green: a syntax error in
  `app.js` that no test imported, and every app route returning the landing
  page's 404 because `cleanUrls: true` strips `.html` while the rewrites
  pointed at `/app.html` — build green, function healthy, database connected,
  `/overview` saying "Page not found". The second could not be caught locally
  at all: Express resolves those paths with a catch-all, the CDN resolves them
  with a rewrite table, and only one of those is what a reader gets. It fires
  on `deployment_status` rather than `push`, because on push the deployment
  does not exist yet and the job would test the previous version and report
  green. Smoke has passed on every run since 2026-08-31.

**Nothing deploys to Render, and the database is not there either.** Earlier
passes of this file said "Render still hosts only the database" and "the failing
web service is still there"; neither is true. What remains is a zombie web
service that **builds successfully and then dies on startup** — its start
command is `node server.js`, there is no `server.js` in this repo (the entry is
`src/server/index.js`, which is also `package.json`'s `main` and `start`), so it
exits with `MODULE_NOT_FOUND` every time. It is being deleted. It serves no
traffic and holds no data; the only thing it produces is failure email.

## What's built and working

All counts below taken from the live Neon database on **2026-09-02**.

- **Schema:** 32 tables and 12 views in `public` — 44 relations, which is where
  the "44 tables" figure people quote comes from. Latest migration is
  `0023_simulations.sql`; seeds run to `033_place_data_gap_series.sql`.
- **Data: 75,915 observations.** 140 indicators declared, **137 of which have
  any observations** — the other three are the declared-but-uncomputed ones
  listed under "Known broken things". 50 countries in the table, 49 with any
  observation, but see the country note below before quoting either number.
  By source: FRED 29,627 · LBMA 29,488 · DBnomics 8,424 · World Bank 7,488 ·
  Federal Register 411 · Epoch AI 349 · GDELT 116 · SEC EDGAR 12. That sums
  exactly to 75,915, so nothing is orphaned.
  The `sources` table holds **25 rows**, but only those 8 have ever produced an
  observation. The rest produce *documents* (7 RSS feeds and the Fed, 343
  articles) or nothing at all (Copernicus and NASA GIBS are declared for a
  phase-3 satellite job that does not exist yet).
- **Documents: 1,273.** OpenAlex 930 (the academic corpus, landed 2026-08-27),
  RSS 321 across seven feeds, Federal Reserve 22.
- **Lens layer:** 5 lenses, each with a thesis (plain + technical), a ticker
  strip (each price states *why* it's on that specific lens — copper means
  something different on Money vs Infrastructure), and lens-filtered news via a
  stored search query per lens (deterministic, not model-classified).
- **Question layer: 40 questions, of which 11 are active** and reach a reader.
  Each active one has hero/supporting/context charts, a stored answer in both
  registers, and a caveat as a first-class section — not a footnote. The other
  29 are drafted and switched off; see "What's NOT built yet".
- **Front end — rebuilt as an editorial site, not a dashboard.** Ten routes:
  overview (`/` and `/overview`), login, lens, question, **the data browser
  (`/data`) and per-series detail (`/data/:id`)**, chart-builder (`/explore`),
  news, pipeline/status, and simulation (`/simulate/:slug`, currently
  unreachable — see the simulation section). Context drawer: click a point on
  any chart → news and events from that period.
  - **Lens and question pages read as articles** — heading, thesis as prose,
    then the claim being tested, how it is measured, the evidence, and what
    others have published. Caveat sits directly under the answer, above every
    chart.
  - **`/data` makes every series reachable without going through an argument**,
    and the detail page is the only place licence and attribution have ever
    been shown, despite being recorded for every source since 0002.
  - **No country filter anywhere, deliberately.** The catalogue reaches 49
    countries and one of them has real depth: the USA carries 63 distinct
    indicators, Japan 16, the UK 14, China 14, Australia 13, Korea 11, Canada
    and Germany 10 each — and 19 of the 49 carry six or fewer. A country
    control would promise a comparison the data cannot support.
    *(This changes when more data lands.)*
  - Identity: the landing page's, exactly — near-black surfaces, one blue
    accent, Inter Display headings. The chrome stays quiet because nine
    colours already carry meaning (six chart hues + the direction trio) and
    every vivid brand hue collided with one of them.
    *(The warm-neutral, vermilion, Instrument Serif identity this file used to
    describe was replaced when the app went dark. `app.css` still carries that
    `@theme` block; `atmos.css` overrides all of it at runtime.)*
- **Mobile:** no rail and no bottom tab bar — `TopNav` is a floating pill with
  a sheet below `md`. 44px touch targets. `manifest.json` + PWA icons so
  "Add to Home Screen" works.
- **Security:** audited 2026-08-28, before the first public push. See the
  dedicated section below.
- **Chart palette re-validated** against BoardUI's surfaces with the dataviz
  validator. Dark mode needed its own steps because BoardUI's dark card is
  lighter than the old one — see the note in `src/client/styles/charts.css`,
  which records the numbers and the command to re-run.
- **Report figures, on the pages.** 56 charts and 422 data points read out of
  ten report PDFs, each with the page and the verbatim line it came from, and
  each saying on its face that it is a survey, a model result or a scenario
  rather than a measurement. `FigureChart` draws them as bars **and has no
  option for a truncated axis** — a bar encodes its length, so cutting the axis
  rescales the claim itself and no disclosure repairs that.
  `scripts/load-report-figures.js` is the gate between the extraction JSON in
  `docs/extraction/` and the database; placement is editorial and is never
  inferred.
- **News cards carry the publisher's mark**, stored as a data: URI by
  `scripts/fetch-source-icons.js` and never linked — an `<img>` pointing at
  ft.com would tell seven news organisations who reads this site, and the CSP
  forbids it. Six of eight resolved; the FT 403s everything and the Fed serves
  only an oversized ICO, so both show the name alone.
- **The style system.** A named motion vocabulary in `atmos.css` — `.rise`,
  `.rise-sm`, `.stagger`, `.lift`, `.tint`, the sheet trio, `.marquee-track` —
  taken from the landing page's own compiled CSS (400ms,
  `cubic-bezier(.44, 0, .56, 1)`, 50px travel, 100ms delay) rather than
  invented. No animation library: `motion` is installed but tree-shaken out,
  and importing it would add 120-180kB to the largest thing this site ships to
  do work that is four CSS rules. Reduced motion is a closed list of eight
  selectors, never a blanket reset.
- **Filled question cards**, `#2f61f7` with white text, per-lens hue on the
  ring. The per-lens FILL cannot be built — white on the five accents measures
  2.52, 1.48, 1.52, 2.30 and 2.85 to one, and darkening them until white works
  lands two of them within ΔE 0.08 of chart hues. `check-contrast` now tests
  the fill surfaces, so changing the hex turns the build red.
- **News as a bento** (six tiles, period six on a six-column grid, so the
  collapse step and the layout period are the same number by construction) and
  the literature list collapsed, both through one `Collapsible` primitive.
- **Prices carries a scrolling marquee**; tapping any ticker opens a blue sheet.
- **Policy & Regulation is a register of documents** — RULE / EXECUTIVE /
  PROPOSED as ledger rows ordered by how hard each is to undo, with
  enforceability as literal visual weight.
- **23 circular-financing events and 59 entities**, the first rows the `events`
  table has ever held, from a Perplexity deep-research table of 33 deals. Nine
  were rejected — six for dead source URLs — and the reasons are recorded in
  `docs/financing/decisions.json`. `event_citations.publisher_class`
  distinguishes a filing from a newsletter, which `confidence_tier` could not.
  **The diagram must draw from `investment_edges`, never `monthly_investment`:**
  an investment and the cloud commitment tied to it point opposite ways, so
  that view's total is meaningless by construction.
- **The last three dashboards are pages.** `/pipeline` was four stat tiles and
  three BoardUI tables answering the wrong question — it listed which
  INTEGRATIONS were configured, a fact about the server's `.env`. It is now a
  provenance register ordered by contribution, with each source's share of the
  data drawn as literal width, and licence on every row. The organising fact:
  **FRED and LBMA carry 78% of every observation on this site.** Dropping the
  BoardUI Table took that route's chunk from 195 kB to 7.6 kB. `/data` and
  `/explore` keep their structure and move onto the site's own surfaces, with
  a shared `PageHero`.
- **Circular financing, on the Investment lens.** Five arrangements where money
  leaves as capital and returns as revenue — Microsoft $13bn into OpenAI
  against $250bn of Azure commitments back; Amazon $13bn into Anthropic against
  $104bn; NVIDIA $2.1bn into CoreWeave against $6.3bn buying capacity back.
  **What counts as circular is not "money went both ways"** — that test misses
  NVIDIA/CoreWeave entirely, where NVIDIA is the payer on all three edges. The
  test is on the KIND of leg: a pair joined by both a capital leg and a
  commercial one. Not a node graph, and **no total is computed anywhere**,
  because the two sides face in opposite economic directions.
- **Routes are code-split.** From the 2026-09-02 build output: the always-loaded
  pair is `index` (211 kB) + `AppShell` (143 kB), and the 353 kB chart chunk is
  its own file that only pages which chart pull in. Down from a 994 kB first
  load before the split. Every route except the overview is `lazy()`; the
  overview stays statically imported because every landing-page CTA leads
  there, so splitting it would spend the saving on a round trip before anything
  rendered. `App.jsx` is the only place `@/routes/*` may be imported — import
  one from a component and it is pulled back into the main chunk silently, with
  no error and no size warning to explain why the bundle grew.
- **161 tests passing** across 35 suites (`npm test`, 2026-09-02). Mostly
  backend; `src/client/lib/format.test.js` is still the only front-end suite,
  covering number and unit formatting. There are no component or route tests.
- **Five build gates**, all green as of 2026-09-02: `npm test`,
  `check:tokens` (every Tailwind utility and runtime `var()` resolves to a real
  token — the guard built after seven nonexistent classes silently generated no
  CSS for weeks), `check:contrast` (WCAG AA), `check:routes` and
  `check:vercel`. `npm run build` runs all but the tests.
- **A README** that leads with the project's rules rather than its stack, and
  states the data weaknesses in the open. Five screenshots in
  `docs/screenshots/`.

## Scheduled ingestion — wired, and it has never once succeeded

`.github/workflows/ingest.yml`, 05:40 UTC daily plus manual dispatch. Actions
rather than Vercel Cron: the GDELT job runs for minutes against a 15s function
ceiling, and a failed Actions run emails and puts a red X on the repo with no
code written.

**Every scheduled run has failed.** Checked 2026-09-02 against the run history:
31 Aug, 1 Sep and 2 Sep, all `failure`, all dead in about 20 seconds. The cause
is in the log and it is one line —

```
Missing required environment variable DATABASE_URL
    at required (src/server/config.js:22)
```

— because **the repository has no Actions secrets set**. `gh secret list`
returns nothing. Nothing about the workflow is wrong; it has never been given a
database to write to. Setting the secrets is written up step by step in
`~/Desktop/DIFFUSION-HANDOVER.md`, and it is a five-minute job that unblocks
every number on the site.

The consequence, measured on 2026-09-02 as the latest period each source has
any observation for:

| Source           | Latest data  | Observations |
|------------------|--------------|--------------|
| LBMA             | 2026-08-28   | 29,488 |
| FRED             | 2026-08-25   | 29,627 |
| Federal Register | 2026-08-01   | 411 |
| GDELT            | 2026-08-01   | 116 |
| SEC EDGAR        | 2026-01-01   | 12 |
| Epoch AI         | 2025-07-09   | 349 |
| World Bank       | 2025-01-01   | 7,488 |
| DBnomics         | *see note*   | 8,424 |

News is stale on the same clock: the newest article in `documents` is dated
2026-08-29.

Read that table with the cadences in mind rather than as eight equal failures.
World Bank is annual and Epoch AI is irregular, so their dates are close to
normal; FRED and LBMA are daily-to-monthly and are the ones visibly drifting.
The right comparison is each indicator's OWN `refresh_interval`, which is
exactly what `scripts/ingestion-summary.js` computes — it writes a job summary
reporting rows written per job and what is stale against its own interval. It
found on its first run that FRED and LBMA had not ingested since 25 August, and
that is still true a week later.

**DBnomics has no meaningful "latest".** Its `max(period_start)` is 2027-03-31,
which is not fresh data — it is the RBA publishing empty future periods, and
the AMECO forecast years. See "Two data problems the new provenance page
surfaced" below.

## What's NOT built yet

In rough priority order:

1. **Set the Actions secrets.** Above. Smallest job on this list, largest
   effect, and until it is done everything below it is being built on data that
   stops in August.
2. **Seed the simulation scenarios.** The engine, the API, the page, the
   narration script and 32 tests all exist and all pass; there are zero
   scenario rows, so the whole feature is invisible. Needs a seed file in
   `db/seeds/` creating at least one scenario with its `simulation_inputs`,
   its per-country `simulation_parameters` (every one carrying a citation —
   the schema will refuse otherwise) and its `caveat`. Check
   `SELECT * FROM unrunnable_scenarios` afterwards; it lists any scenario /
   country pair that has no parameters and would therefore fail at run time.
3. **Country coverage — the known structural gap.** The catalogue reports 50
   countries and that number flatters it badly. The USA has 63 distinct
   indicators; Japan is next at 16; **19 of the 49 countries with any data
   carry six or fewer**, mostly the same World Bank annual series (~26 points
   each, 2000–2025). So the gap is not missing countries, it is missing
   *depth* — the fix is more series for the handful of countries that already
   have some breadth (UK, Japan, Australia, China, Korea, Canada, Germany),
   not more flags. The DBnomics adapter already reaches 93 statistical
   agencies through one code path and is the obvious route. **No country filter
   or comparison UI exists, deliberately**, and none should be built before the
   data supports the comparison it would imply.
4. **The reports are read, and nothing in them has been checked by a person.**
   Ten of the twelve cited reports have been extracted twice over: prose
   takeaways with page references (0014), and **56 chartable figures with 422
   data points** (0019, seeded by `023_report_figures.sql`), each carrying
   the verbatim line it came from. Every one lands as `figure_source =
   'extracted'` and renders saying nobody has verified it.
   `SELECT * FROM unreviewed_figures` and `SELECT * FROM unreviewed_takeaways`
   are the two worklists, and working through them is the highest-value thing
   Joshua can do that nobody else can.
   **Accenture and EY have no PDF** in `~/Desktop/Consulting reports on ai (for
   econ intel)/` — ten files, and those two are not among them. They stay
   citation-only until the PDFs land.
   `theory`, `method`, `strength` and `last_reviewed` are populated on all 11
   active questions. **That prose is Claude-drafted and Joshua has not reviewed
   the economics yet** — `productivity` most of all. `stale_questions` lists
   pages whose prose has not been reviewed in six months.
5. **The circular-financing diagram.** The data landed on 2026-08-30 — 23 events
   and 59 entities — so what is missing is the drawing, not the rows. It is
   the one feature the events table was built for (Nvidia → OpenAI → Oracle →
   Nvidia). Read from `investment_edges`; see the warning above about
   `monthly_investment`.
6. **News images.** Publisher marks are done (see above); article images are
   not. Six of the eight feeds carry an `<enclosure>` or an `og:image`, but
   hotlinking one tells that publisher who reads this site — the same objection
   that made the logos data: URIs — so this needs storing, not linking.
7. **Twenty-nine more questions, drafted and switched off.**
   `024_new_questions.sql` (9) and `025_more_questions.sql` (20) seed them with
   `is_active = false` and `last_reviewed` NULL, so they reach no reader. Note
   `stale_questions` filters on `is_active` and therefore does NOT list them;
   the worklist is `SELECT id, lens_id, question, strength FROM questions WHERE
   NOT is_active`. The reasoning is in `docs/questions-proposal.md` and
   `docs/questions-proposal-2.md`. Activating one is a single UPDATE — after
   checking its answer against the series.

   Lens totals if all were activated: investment 9, growth 8, labour 8,
   prices 8, regulation 7.

## Security

Audited 2026-08-28, before the first push of this branch. **The GitHub repo is
public**, so anything committed is published immediately.

Verified clean:

- **Secrets have never entered git history.** `.env` is gitignored and was
  never committed; all 30k added lines across the 34 unpushed commits were
  scanned against the pre-commit hook's own patterns with zero hits;
  `.env.example` holds only empty fields and a localhost placeholder. The hook
  is active (`core.hooksPath = .githooks`) and is shape-based rather than a
  list of provider names, which had already gone stale twice.
- **SQL injection surface is zero.** Every query is parameterised, including
  the optional filters, which use `$1::text IS NULL OR …` rather than
  assembling SQL strings. No `ORDER BY` is caller-controlled.
- **XSS surface is minimal.** No `dangerouslySetInnerHTML` or `innerHTML`
  anywhere in the client, so React escapes all rendered content — which matters
  because news headlines come from third-party RSS. Both external links carry
  `rel="noopener noreferrer"`.
- **Every endpoint has a bounded cost** (observations capped at 20k rows,
  `/api/series` at 12 series, documents at 200), and the pool sets
  `statement_timeout`, so no request can run away.
- **Zero vulnerabilities** in production dependencies (`npm audit --omit=dev`).
- Error messages are hidden in production, `x-powered-by` is disabled.

Fixed in the fourth pass:

- **`ingestion_runs.error_message` is served publicly by `/api/status` and was
  stored unredacted.** `HttpError` redacts its own message, but only some
  failures are `HttpError`s — a native fetch `TypeError`, a pg error, or
  anything a future adapter throws arrived unfiltered, and a request URL
  carrying `api_key=` in one of those would have been rendered on a public
  page. Redaction now happens in `finishRun`, at the point of storage, so the
  guarantee holds for every error type rather than depending on every throw
  site getting it right.
- **Response security headers added** (`src/server/lib/security.js`): CSP,
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, and HSTS in production only. The CSP hashes the inline
  scripts **computed at boot from the served `index.html`** (seven of them, as
  `check:vercel` confirms on every build), rather than a hash pasted into
  source that would drift silently the moment anyone edited that script.
  `style-src` deliberately keeps `'unsafe-inline'` because Recharts renders
  through React's `style` prop.
- **CORS is now a deliberate decision, not a default.** Open CORS plus cookie
  auth is how a read API becomes a CSRF hole, which this file warned about
  before there was any auth to make it real. The policy in `app.js` keys off
  whether auth is configured: with auth on, `credentials` is granted and the
  origin must be in `ALLOWED_ORIGINS` (`config.auth.allowedOrigins`) — and an
  **empty** allowlist rejects every cross-origin caller rather than defaulting
  to open, which is the correct direction to fail. With auth off (a dev machine
  with no `SESSION_SECRET`) it stays open and credential-less, because there is
  no cookie to steal. **So `ALLOWED_ORIGINS` must be set on the deployment** for
  any future cross-origin caller to work; same-origin requests, which is
  everything the site itself does, are unaffected either way.

Known gap, deliberately deferred:

- **No rate limiting.** In-process limiting is close to useless on serverless,
  where each instance keeps its own counters, so this belongs at the edge —
  Vercel's firewall or a KV-backed limiter. Bounded query cost and
  `statement_timeout` are what currently limit the damage. Now that the site is
  actually deployed this has moved from "Phase 6 deploy work" to a live gap.

## Known broken things

- **`derived.policy_investment_stance` and `derived.policy_regulation_stance`**
  — indicators exist, no computation defined yet. Confirmed 2026-09-02: they
  and `derived.datacentre_investment` are the only three of 140 indicators with
  zero observations. The recommendation on the table is to RETIRE them the way
  `derived.datacentre_investment` was retired in `008_policy_effects.sql`,
  rather than build a classifier: producing them would be this project's first
  LLM call site, and the governing rule (never invent a number, only connect
  stored values) is designed for narration. A stance classifier does the
  inverse — it PRODUCES `investment_score = -37` with no stored value behind
  it. Not yet done either way.
- **Census BTOS is not an integration and never was.** `describeIntegrations()`
  in `config.js` listed it as ready whenever `CENSUS_API_KEY` was set, so
  `npm start` advertised a source that cannot run under any circumstance: BTOS
  is published as downloadable spreadsheets, not as an API product — checked
  against the live Census catalogue, all 1,798 datasets, zero matches for
  "btos", "business trends", "outlook survey" or "artificial intelligence" —
  and `runner.js` has no census handler. Removed from the readiness list on
  2026-09-02. `ingestion/sources/census-btos.js` stays on disk: the argument
  for the source still stands (it measures the causal middle term — what share
  of real firms use AI — where everything else here measures an input or a
  lagging output), and its banner carries the full evidence. Getting it would
  mean parsing published spreadsheets on a schedule, which is a different job.
  Ember, EIA, BLS and Copernicus are still listed and are in a milder version
  of the same position: keys are read, no adapter exists yet.

**GDELT is fixed.** `derived.ai_news_volume` holds 116 monthly observations,
the first it has ever had. It was broken three ways, none of them the
"try again from a different network" this file used to suggest:

1. Node applies its own ~10s connect ceiling underneath
   `AbortSignal.timeout(120_000)`, invisible to it, reported as bare
   `fetch failed`. Fixed with an undici Agent — but note the obvious form of
   that fix is worse than the bug: Node's global `fetch` validates
   `dispatcher` against its own bundled undici and rejects one from
   node_modules with `UND_ERR_INVALID_ARG`, instantly. `slowConnect` in
   `lib/http.js` swaps the fetch implementation as well as the dispatcher.
2. `ECONNRESET` was not in the retryable set, so it arrived as an untyped
   TypeError, fell through the `[429, 502, 504]` check, and killed the job on
   the first attempt — the retry ladder had never once run.
3. The nine-year window is too large and reset every time. Now fetched in
   one-year chunks, deduplicated at the seams.

## Recent findings worth knowing about

The RSS news pipeline had **never actually run on a schedule** — it existed,
had tests, but nothing in the ingestion runner called it. `npm run ingest -- rss`
matched no indicator (news isn't an "indicator"), printed nothing, and exited 0
— reporting success while doing nothing. Fixed in commit `c8ca282`. First real
run pulled in 73 new articles. If the news feed still looks thin, run:

```
npm run ingest -- rss --force
```

That failure mode — a job reporting success while doing nothing — is the one
this project keeps hitting, and it is worth naming: the ingest workflow above
fails loudly, which is strictly better and is why it was built on Actions.

## The CSP was blocking the entire landing page

From 2026-08-28 to 2026-08-30, and nothing reported it.

`securityHeaders` built `script-src` by scanning `public/index.html` only.
That file is Vite output with one `<script src>`, so the scan returned
nothing, the header went out as a bare `script-src 'self'` — and it was
applied to **every** response, including the Framer landing page and its seven
executable inline scripts. All seven were blocked. One of them is `animator`,
the entrance-animation engine for the whole front door.

Proven rather than inferred: the scripts were present in the DOM while
`window.animator` and `window.process`, top-level globals set by two different
inline scripts, were both `undefined`.

Nothing caught it because a blocked inline script reports to the browser
console and never to the server, and the page still renders — it just sits in
its pre-animation state, which looks like a design choice. The old test
asserted a hash was present OR absent and argued in a comment that absent was
"the stronger result, not a regression"; it passed green throughout.

**Also fixed:** `/docs/mirror.py` and `/.mirror-cache/pages/index.html` were
both returning 200 to anyone — the clone pipeline in full, and a working copy
of the original Framer template still carrying the template's own copy.
Express's `dotfiles: 'ignore'` does not cover the second; it applies to the
final path segment only.

## Two data problems the new provenance page surfaced

1. **AMECO is the European Commission's FORECAST database**, and its later
   years are projections. UK total factor productivity carries 96.77 for 2027
   — a real number, drawn on a chart, with nothing saying it is a forecast.
   `db/seeds/029_mark_projections.sql` marks it `value_status = 'projected'`,
   a column that has existed since 0003 and been NULL on every row.
   **That records it; it does not fix it.** `/api/series` does not select
   `value_status` and `SeriesChart` has no notion of it, so nothing a reader
   sees has changed. Wiring it through — most likely as the dashed treatment
   `SeriesChart` already uses for series that could not be rebased — is the
   next chart-honesty job. The date rule also cannot catch AMECO's 2026
   forecast, because 2026 is already in the past; doing better needs a vintage
   column that does not exist.
2. **The RBA publishes empty future periods.** Rows out to 2027-03-31 with a
   NULL value. Nothing was ever drawn from them, so the charts were right; the
   coverage claim was wrong, because `max(period_start)` counted them. Four
   queries now filter on `value IS NOT NULL`. It is still why the DBnomics row
   in the staleness table above has no usable "latest" date.

## `useReveal` was hiding content silently

Fixed 2026-08-30 and worth knowing about, because the failure mode is
invisible. It read `ref.current` on its first effect run and returned early
when null, with `[revealed]` as its only dependency — which does not change
when a ref attaches. **Any component that returns `null` while its data loads
never got an observer and stayed at `opacity-0` forever.** No error, no
warning; the content is in the DOM and screen readers read it. A callback ref
replaced the `useRef`.

## How to pick this up

```
cd ~/Projects/EconIntel
npm run dev                  # Express :3000 + Vite :5173 — open 5173
npm run build && npm start   # production build, served on :3000
npm test                     # 161 tests, should all pass
npm run build                # runs check:tokens, check:contrast, check:routes, check:vercel
npm run check:data           # 9 data-integrity checks (NOT a staleness report)
node scripts/ingestion-summary.js   # what is stale, against each indicator's own interval
npm run ingest -- rss --force   # refresh news by hand (the schedule is broken — see above)
```

Live site: **https://diffusion-econintel.vercel.app** · health:
`/healthz` · the database is Neon, `aws-eu-west-2`.

Then just talk to Claude about what you want next — the simulation seed, the
Actions secrets, country depth, the financing diagram, whatever. This file plus
`git log` plus the code itself is the full picture; there's no other hidden
state anywhere.

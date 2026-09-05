"""
Every string this site says, as data.

The build script applies this once to a pristine mirror. Nothing here is
applied by hand and nothing is edited in the built HTML — the rebuild loop is
`bash docs/reset.sh && python3 docs/build-diffusion.py`, so this file is the
only place copy exists.

ORDER MATTERS. The build sorts by key length descending before substituting,
because a shorter key that is a substring of a longer one will otherwise
corrupt it. The skill's own record of this going wrong: "Studio Owner" became
"About Owner" because "Studio" was replaced first.

FOUR SURFACES. The same string lives in index.html, in nine JS chunks, in
assets/data/searchIndex-*.json, and in the CMS blobs. The build covers the
first three. The blobs hold a second copy of the two legal documents and are
never touched — they are addressed by byte offset, and rewriting one shifts
every later offset. They are also never requested: a cold load of
/legal/privacy-policy makes 36 network requests and none is for a .framercms
file, so the copy that reaches a reader is the one in the markup and the
chunks. Both are rewritten below.

WHAT IS DELIBERATELY REMOVED RATHER THAN REPLACED
-------------------------------------------------
The template ships invented proof, and the rule is remove rather than invent:

  - "Sofia Novak · Climate Analyst" and her stock headshot. Diffusion has no
    team. A fabricated colleague on a site whose entire pitch is not
    overstating things is the worst possible thing to leave in.
  - "1,284 people on the waitlist" and three stock avatars. There is no
    waitlist and there are no signups.
  - Every invented figure — 42.1 g/kWh, 1.8k MW, +4.8%, 98/100 A+,
    2032-2048, +18% EU Central, 124/89/8 MW. Where a number appears in the
    replacement below it is a real one, and the comment says where it came
    from and when it was read.
  - support@atmos.com and contact@atmos.com, and the owner's personal Gmail
    that briefly replaced them. No email address is published anywhere on this
    site now; the contact route is CONTACT_URL below. A plain-text mailto on a
    public page is harvested within days, and the address that starts
    receiving it is one person's personal inbox with no way to hand it off.
  - The AI-assistant chat panel. Diffusion has no assistant, and mocking one
    up would be claiming a feature that does not exist. That subtree is
    repurposed to show a real question page instead.
  - The footer "Follow Us" column, which links to the TEMPLATE AUTHOR's
    personal Instagram, X, Threads and LinkedIn while presenting them as the
    product's socials.

FIGURES, ALL READ FROM THE DATABASE ON 2026-09-03
  75,934 observations · 134 series with data · 17 sources · 44 countries
  AI adoption by firms, Eurostat/OECD 2025: Denmark 42.0%, Finland 37.8%,
  Poland 8.4%. 16 of 44 countries have any adoption survey, 28 have none.
  Contested questions: 4. Institutional reports cited: 10, across 9 publishers.
  Every one of those queries is written out beside the string that uses it, so
  a later reader can re-run it rather than trust this paragraph.

TWO STRINGS, TWO MEANINGS
-------------------------
The template reuses the same copy in different components — "42.1 g/kWh" is
both a stats-card figure and a globe tile, "Get instant alerts" is both a
feature row and a rule. A flat dict cannot express that: whichever value is
written wins in both places, silently. That is not hypothetical; it shipped
Denmark's 2025 AI adoption as "73,847". PAIRED at the bottom of this file
handles those, anchored on the neighbouring string, and REPLACEMENTS now
REFUSES to build when one key is defined in two groups.
"""

# ---------------------------------------------------------------------------
# Brand
# ---------------------------------------------------------------------------

BRAND = {
    "Atmos": "Diffusion",
    "atmos": "diffusion",
}

# ---------------------------------------------------------------------------
# Where this site lives, and how to reach the person who runs it
# ---------------------------------------------------------------------------
#
# THE HOST IS DECLARED ONCE. Every place a hostname appears — the canonical
# tag, og:url, robots.txt's Sitemap line, every <loc> in sitemap.xml, the
# absolute links into the app, and Framer's own runtime siteCanonicalURL inside
# the bundle — reads it from SITE_ORIGIN. Buying a real domain later is a
# one-line change here, not a hunt through eight HTML files and two generators.
#
# It was a hunt: build-diffusion.py used to hardcode diffusion.observer into
# the sitemap and overwrite whatever docs/detach.py had written, so passing the
# right --domain to detach.py did not even fix it. diffusion.observer has no
# DNS record, and a canonical tag pointing at a host that does not resolve is
# the strongest available instruction to a search engine not to index the site
# that is actually being served.
SITE_ORIGIN = "https://trydiffusion.vercel.app"

# The host the mirror was detached onto and which the pristine-mirror commit
# still carries. build-diffusion.py rewrites every occurrence of it to
# SITE_ORIGIN and then asserts that no canonical or og:url on any page names
# anything else, so this cannot rot back.
STALE_ORIGIN = "https://diffusion.observer"

# What sitemap.xml advertises. /404, /waitlist and /thanks are deliberately
# absent: the first should never be indexed and the other two are retired
# routes that Express redirects to /login.
SITEMAP_PATHS = ("/", "/legal/privacy-policy", "/legal/terms-of-service")

# THE CONTACT ROUTE IS A PROFILE, NOT AN ADDRESS.
#
# The template shipped contact@atmos.com and support@atmos.com. Those were
# repointed at the owner's personal Gmail, which put a harvestable plain-text
# address on a public page in four places — including a privacy policy that
# invites people to write in, so the volume was intended. The address is out of
# every shipped file; the contact route everywhere (footer, FAQ, both legal
# pages) is this profile.
#
# CONTACT_TEXT is the VISIBLE text and CONTACT_URL the href, and they have to
# be set separately because Framer stores them in two different places: the
# SSR markup carries the anchor, and the hydration payload further down the
# same file carries the child text as its own value. Setting only one of them
# produced the state two separate audits reported in opposite directions — the
# file said one thing and the browser showed another.
CONTACT_URL = "https://www.linkedin.com/in/joshuakhalili/"
CONTACT_TEXT = "Joshua Khalili on LinkedIn"

# The hero's scroll-revealed statement, in one place because it lives on two
# surfaces that need it byte-identical: the JS chunk holds it as a single
# string, and the SSR markup holds it one <span> per word. See WORD_REVEAL.
HERO_STATEMENT = (
    "Diffusion gathers what is actually measured about AI and the economy: "
    "investment, output, jobs, prices, policy. Every figure comes from a named "
    "public source. Every page states what its data cannot show."
)

# ---------------------------------------------------------------------------
# Header, hero, and the scroll-revealed statement
# ---------------------------------------------------------------------------

HERO = {
    # The template's "System active" is a status claim with nothing behind it.
    #
    # THE DATE IS NOT DECORATION. This pill renders in the header a few pixels
    # from a clock component that ticks in real time, and an undated counter
    # next to a running clock tells the reader the counter is live. It is not:
    # it is static copy, and it was wrong by 26 series and 2,087 observations
    # before anyone noticed. Until the pill reads from /api/status it carries
    # the same "as of" date as the stats card further down the page, and the
    # two are updated together.
    "System active": "134 series · 17 sources · 3 Sep 2026",

    # Every primary CTA — the header button and the ones dotted through the
    # page. The template points them at a waitlist; there is nothing to wait
    # for, but reading does need a free account, and a button labelled
    # "Browse the data" that lands on a sign-in form is a small bait and
    # switch. This says what happens AND why, in three words, and it points at
    # /login rather than /overview so a signed-out reader is not bounced
    # through a 401 to get there.
    #
    # A reader who is already signed in is not sent back to a form: /login
    # renders "Signed in as … → Start reading" for them. One door, correct in
    # both states.
    "Join waitlist": "Sign in to read",
    "Join the waitlist to get early access and see how global systems behave in real time.":
        "Every series behind this site, with its source, its licence, and a link back to the publisher.",
    "Get early access to Atmos": "Every series, browsable",
    "exploring real-time global data": "reading the evidence",

    "Unified system for global environment": "Is AI changing the economy?",

    # The word-by-word scroll reveal. Written to land its last clause on the
    # reveal, because that is the sentence the animation exists to deliver.
    #
    # THIS KEY ONLY REACHES THE JS CHUNK AND THE SEARCH INDEX, where the
    # sentence is one string. In the SSR markup it is one <span> per word at
    # three breakpoints, so this key cannot match there and never did — which
    # is why the shipped HTML still read "Diffusion is a unified system for
    # global infrastructure. We connect climate, emissions, energy…" months
    # after this line was written. WORD_REVEAL at the bottom of the file
    # rebuilds those spans from the same sentence.
    "Atmos is a unified system for global infrastructure. We connect climate, emissions, energy, and regional data into one evolving layer that reflects how systems behave in real time.":
        HERO_STATEMENT,
}

# ---------------------------------------------------------------------------
# How it works
# ---------------------------------------------------------------------------

HOW_IT_WORKS = {
    "How it works": "How to read this",
    "Manage your climate data from source to insights":
        "From a named source to a stated finding",
    "Collect data, process it through analysis, and surface key metrics you can track.":
        "Each question shows the claim being tested, how this page measures it, and where it fails.",

    "Data Collection": "Named sources",
    # Eight publishers carry the statistical series and nine more carry the
    # reading list; seventeen sources hold anything at all. The previous
    # wording said "and nineteen others", which counted every row in the
    # sources table including eight that have never returned a single
    # observation or document.
    #   select count(*) from sources s
    #    where exists (select 1 from indicators i join observations o
    #                    on o.indicator_id = i.id
    #                   where i.source_id = s.id and i.is_active)
    #       or exists (select 1 from documents d where d.source_id = s.id);
    #   -> 17   (8 with series, 9 documents-only)   read 2026-09-03
    "Collect emissions and environmental data from sensors, infrastructure, and external sources in real time.":
        "Eight publishers behind the series — FRED, the World Bank, DBnomics, SEC EDGAR, Epoch AI, the US Federal Register, GDELT and the LBMA — and nine news and research feeds behind the reading list. Every series links back to its publisher with its licence stated.",

    "System Analysis": "Stated reasoning",
    "Analyze environmental performance, detect patterns, and monitor system behavior continuously.":
        "Not just the answer. The mechanism being claimed, the measurement used, and the confound that would break it.",

    "Live Metrics": "Evidence strength",
    "Carbon Output": "Insufficient",
    "Energy Usage": "Suggestive",
    "Emission Trends": "Consistent",
    "Climate Signals": "Contested",
}

# ---------------------------------------------------------------------------
# Demo — was an AI assistant, now a real question page
# ---------------------------------------------------------------------------

DEMO = {
    "AI Assistant": "A question page",
    "Interact with your data and get answers instantly":
        "Read the argument, then check the data",
    "Ask questions, explore patterns, and understand energy, emissions, and systems.":
        "Every claim sits directly above the series it rests on. Follow it in either direction.",

    # App-window chrome
    "Climate Intelligence": "Labour Markets",
    "version 2.1": "evidence: contested",
    "Overview": "Overview",
    "Live Data": "Lenses",
    "Analytics": "Questions",
    "Reports": "The data",
    "Assistant": "News",
    "Settings": "Sources",

    # The chat exchange becomes the actual shape of a question page: the
    # question, the answer, and the caveat that has to travel with it.
    "What is the current energy distribution across sources in North America?":
        "Is the bottom rung disappearing?",
    "North America shows a balanced but solar-led energy distribution across its energy infrastructure.":
        "These series say not yet. But several studies measuring at a finer grain say otherwise, and the likeliest reconciliation is that this page is asking at the wrong resolution.",
    "Energy grid activity as of Mar 2026": "Enterprises using AI, 2025",
    "Solar Farm #04": "Denmark",
    "124 MW": "42.0%",
    "Offshore Wind": "Finland",
    "89 MW": "37.8%",
    "Hydro Station": "Poland",
    "8 MW": "8.4%",
    "Would you like me to generate a detailed report based on this data?":
        "What this does not show: a national youth unemployment rate averages away an effect concentrated in a few exposed occupations.",
    "Ask about climate insights...": "Every figure links to its source",
    # "on 29 August 2026" was true of nothing. Each question carries its own
    # review date and they are spread across a week, so the honest form is the
    # oldest of them — the weakest guarantee, not the flattering one:
    #   select min(last_reviewed), max(last_reviewed) from questions
    #    where is_active;   -> 2026-08-28 .. 2026-09-02   read 2026-09-03
    "Data is updated in real time": "Prose on every question rechecked since 28 August 2026",
}

# ---------------------------------------------------------------------------
# Features — three blocks
# ---------------------------------------------------------------------------

FEATURES = {
    # 1 — was "Unified System"
    "Unified System": "Five lenses",
    "Bring all your data together into one clear system":
        "Five lenses, in the order the causation is supposed to run",
    "Combine your data from different sources into one place you can actually use.":
        "Money is spent, output does or does not rise, jobs change, prices move, governments respond.",
    # THE TEMPLATE CARD HAS THREE ROWS AND THE SITE HAS FIVE LENSES.
    # The heading above promises five and the component cannot grow a fourth
    # slot without breaking hydration, so the last row carries the remaining
    # two by name. All five are now on the page, in causal order, and the
    # heading is true. Names and sublines are the lenses table's own:
    #   select sort_order, name, subtitle from lenses order by sort_order;
    #   -> Investment & Capital / Growth & Productivity / Labour Markets /
    #      Prices & Markets / Policy & Regulation        read 2026-09-03
    "Connect all data sources": "Investment & Capital",
    "Sync data from multiple systems": "What is being spent, and what it buys",
    "Work as one team": "Growth & Productivity",
    "Share insights and act faster": "Whether any of it shows up in output",
    "Catch issues early": "Labour, Prices & Markets, Policy & Regulation",
    "Spot anomalies before they grow": "Jobs and pay, what it costs, and what governments are doing",

    # THE FOUR FIGURES AND THE DATE MOVE TOGETHER. The date is not a
    # disclaimer, it is the thing that makes four static numbers honest, and
    # the header pill above carries the same one. Read 2026-09-03:
    #   select count(*) from observations;                     -> 75934
    #   select count(*) from indicators where is_active;        -> 134
    #     (every active indicator has at least one observation, checked as
    #      count(distinct o.indicator_id) over active indicators -> 134)
    #   sources holding at least one observation or document;   -> 17
    #   select count(*) from countries where not is_aggregate;  -> 44
    #     (all 44 carry observations; the six aggregate rows — World, EU,
    #      Euro area, OECD, High income, Low & middle income — are not
    #      countries and are not counted as such)
    "Unified system overview": "What this site holds",
    "Real-time metrics across all connected sources.":
        "Read from the database on 3 September 2026.",
    "42.1 g/kWh": "75,934",
    "Carbon intensity": "Observations",
    "1.8k MW": "134",
    "Energy usage": "Series with data",
    "2032-2048": "17",
    "Net zero target": "Sources",
    "98 / 100": "44",
    "Compliance score": "Countries",

    # 2 — was a fabricated colleague. Now the literature layer.
    "Team Workflow": "The literature",
    "Work together across teams and regions in real time":
        "What other people have found, and where they disagree",
    #   select count(distinct source_title), count(distinct publisher)
    #     from report_figures;   -> 10 titles, 9 publishers   read 2026-09-03
    # (the IMF appears twice with two different reports, which is why the two
    # counts differ and why both are given)
    "Collaborate on data, share insights and align decisions across your entire organization.":
        "Ten institutional and consulting reports from nine publishers, cited and linked. Labelled by who produced it, never ranked.",

    # THE THREE SUB-LINES ARE NOT DECORATION EITHER. Each of these six rows is
    # a title and a description, and only the titles were ever mapped — so a
    # careful sentence about how disagreement is handled was followed by
    # "Keep everyone aligned with the same data", which is SaaS filler about a
    # product this is not. Six template sentences, six replacements.
    "Share insights across teams": "Cited, never redistributed",
    "Keep everyone aligned with the same data":
        "Figures are quoted and linked back to the report. Nothing is rehosted.",
    "Collaborate in real time": "Labelled by kind, not by rank",
    "Work together without delays or silos":
        "A consultancy survey and a central bank paper are both shown, and named as what they are.",
    "Align decisions faster": "Marked where it disagrees with us",
    "Turn insights into action instantly":
        "A source that contradicts the page it sits on stays on that page, saying so.",

    # THE CITED CLAIM AND THE PAGE NUMBER COME OUT OF report_figures, NOT OUT
    # OF A SENTENCE SOMEBODY LIKED.
    #
    # This card used to read "US employment for software developers aged 22–25
    # fell close to 20% from its 2022 peak", cited to "p. 221". Neither exists:
    #   select id from report_figures where page_ref like '%221%';   -> 0 rows
    #   ... where quote/title/subtitle/note ilike '%developer%';
    #       -> one row, a productivity quote, not that claim
    # The eight Stanford HAI rows run p. 181 to p. 225. The row below is real:
    #   select publisher, source_title, page_ref, title, question_id
    #     from report_figures
    #    where id = 'hai-workforce-reductions-observed-vs-expected';
    #   -> Stanford HAI | The 2026 AI Index Report — Economy chapter
    #      | p. 55 (report p. 225)
    #      | Headcount cuts attributed to AI: observed versus expected
    #      | jobs                                          read 2026-09-03
    # and the question it is filed against is contested:
    #   select question, strength from questions where id = 'jobs';
    #   -> Is the exposed sector shrinking? | contested
    #
    # "Not yet checked by a person" is true of it and of every other row:
    #   select figure_source, count(*) from report_figures group by 1;
    #   -> extracted 56    (there is no 'reviewed' row at all)
    "Sofia Novak": "Stanford HAI",
    "Climate Analyst": "The 2026 AI Index Report — Economy chapter",
    "Region": "Filed against",
    "EU Central (Western Europe)": "Is the exposed sector shrinking? — contested",
    "Responsibility": "Figure",
    # BOTH SPELLINGS OF THE AMPERSAND ARE NEEDED, and only the raw one was
    # here. The markup escapes it as &amp; and the chunk that re-renders the
    # same node writes a raw &, so the single raw key fixed the chunk and left
    # "Emission monitoring &amp; reporting" sitting in the HTML — which is what
    # a crawler, and any reader before 1.7 MB of JS lands, actually gets.
    "Emission monitoring & reporting":
        "Headcount cuts attributed to AI: observed against expected, by business function, 2025",
    "Emission monitoring &amp; reporting":
        "Headcount cuts attributed to AI: observed against expected, by business function, 2025",
    "View activity": "Read it",
    "Message": "p. 55 (report p. 225)",
    "Assign task": "Not yet checked by a person",
    # The rendered header is lowercase "Team member"; the capitalised key that
    # sat here matched nothing, which is why a cited institution was still
    # labelled as a colleague on a one-person project. "Open profile" was not
    # in the map at all.
    "Team member": "Source",
    # The capitalised spelling is not a duplicate of the line above: it is the
    # stock portrait's alt attribute, alt="Team Member", which the quoted-string
    # rule reaches and the >node< rule does not. Dropping it would put "Team
    # Member" back into the markup of a one-person project.
    "Team Member": "Source",
    "Open profile": "Report",

    # 3 — was "Early Alerts". Now the contested state.
    #   select strength, count(*) from questions where is_active group by 1;
    #   -> consistent 8, insufficient 7, contested 4, suggestive 4
    #                                                       read 2026-09-03
    # It said three. A reader who follows that into the app finds four, in
    # about thirty seconds, on the site whose whole proposition is that its
    # counts can be checked.
    "Early Alerts": "When sources disagree",
    "Detect potential issues before they impact your operations":
        "Four pages are marked contested, and that is the finding",
    "Stay ahead of risks by identifying anomalies and unusual patterns as they emerge.":
        "Where credible sources reach opposite conclusions, the disagreement is reported rather than resolved.",
    "Monitor unusual patterns": "Evidence strength on every page",
    "Track unexpected changes in your data":
        "Consistent, suggestive, insufficient or contested, printed beside the answer.",
    # "Get instant alerts" is this row's title. It is ALSO the fourth rule's
    # title in CAPABILITIES, and a flat map cannot give one key two values —
    # so the rule silently inherited this one and shipped the wrong heading.
    # The rule's own value now lives in PAIRED, anchored on its description.
    "Get instant alerts": "Insufficient is a valid answer",
    "Be notified as soon as something shifts":
        "When the series cannot separate the answers, the page says so instead of picking one.",
    "Act before it escalates": "Contested is stated, not smoothed over",
    "Respond early and reduce impact":
        "Averaging two opposite findings into a middle number would be the dishonest option.",

    "Monitoring": "Contested",
    "Emissions spike detected": "Sources disagree",

    # THE NOTIFICATION CARD IS THREE TEXT NODES, NOT ONE SENTENCE.
    #
    # The flat sentence below is real — it is what the search index holds — but
    # in the markup and in the chunk the same sentence is split, because
    # "+18% in EU Central (Frankfurt)" is styled in its own <span> and ", " in
    # another. So the whole-sentence key matched the search index, which nobody
    # reads, and never matched the card, which is the first thing a reader
    # sees: an invented +18% carbon-intensity figure presented as a live alert,
    # directly above a section headed "The rules are the point" whose first
    # rule is "No number is written by a model".
    #
    # The three fragments are keyed separately and the flat key is kept in step
    # with them, so all four surfaces say the same thing. The ", " between them
    # is left alone: two characters is far too generic to be a key, and it is
    # already the separator the replacement wants.
    #
    # Both halves of the claim are rows in report_figures against question
    # 'jobs' ("Is the exposed sector shrinking?", strength contested):
    #   PwC, 2026 Global AI Jobs Barometer, p. 20 — "Firm headcount growth
    #     since 2018, most vs least AI-exposed companies"
    #   IMF, Bridging Skill Gaps for the Future, p. 20 — "Estimated employment
    #     shortfall in AI-exposed occupations five years after AI skills appear
    #     locally"                                          read 2026-09-03
    "Carbon intensity increased by ": "On whether AI-exposed jobs are shrinking, ",
    "+18% in EU Central (Frankfurt)": "PwC and the IMF point opposite ways",
    "driven by industrial output over the last 24 hours.":
        "so the page shows both and stays marked contested.",
    "Carbon intensity increased by +18% in EU Central (Frankfurt), driven by industrial output over the last 24 hours.":
        "On whether AI-exposed jobs are shrinking, PwC and the IMF point opposite ways, so the page shows both and stays marked contested.",
}

# ---------------------------------------------------------------------------
# Capabilities
# ---------------------------------------------------------------------------

CAPABILITIES = {
    "Core Capabilities": "The rules",
    "Everything you need to manage your climate data":
        "The rules are the point. Everything else is implementation",
    "Monitor, analyze and respond across your entire infrastructure in real time":
        "Four constraints this site holds itself to, whether or not anyone checks",

    # FOUR RULES, EACH A TITLE AND A DESCRIPTION. Two of the four template
    # strings here are shared with the features section above, so neither can
    # be written in this dict — see PAIRED at the bottom of the file:
    #
    #   rule 1's description is "Sync data from multiple systems", which the
    #     lens list also uses, so the rule rendered as "No number is written by
    #     a model / What is being spent, and what it buys"
    #   rule 4's title is "Get instant alerts", which the contested block also
    #     uses, so the rule rendered under a heading already used 1,700px
    #     higher up: "Insufficient is a valid answer"
    #
    # Both are anchored in PAIRED on their neighbour in this section, which is
    # unique to it. Adding either one back here is now a build failure rather
    # than a silent overwrite.
    "Connect all sources": "No number is written by a model",
    "Understand patterns": "Caveats are sections, not footnotes",
    "Turn raw data into clear, useful insights": "Stated under the answer and above every chart.",
    "Monitor in real time": "Evidence strength is always stated",
    "Track changes across all systems": "Including when it is insufficient.",
    "Respond to issues without delay": "One y-axis. Zero baseline. Gaps break the line.",
}

# ---------------------------------------------------------------------------
# Global signals — the globe section
# ---------------------------------------------------------------------------

GLOBAL_STATS = {
    "Global Signals": "Where it has spread",
    "Understand what’s happening across the planet":
        "Technology diffusion, where anyone has measured it",
    # 2017, not 2021: the ten Eurostat series run 2021-2025 but the six OECD
    # ones start in 2017, and the "16 measured" tile below counts all sixteen.
    #   select min(period_start), max(period_start) from observations
    #    where indicator_id like '%.ai_any.%';   -> 2017-01-01 .. 2025-01-01
    "Track emissions, energy and system activity in real time across regions":
        "The share of firms using AI, 2017 to 2025, from national statistical surveys",

    # THESE THREE ARE THE TILE LABELS ONLY. Their values are in PAIRED, because
    # the template uses the same two strings for the stats-card figures higher
    # up the page — which is how "73,847 — Denmark, 2025" and "111 — Poland,
    # 2025" came to be printed as national AI adoption rates under a heading
    # promising national statistical surveys.
    "Carbon emissions": "Denmark, 2025",
    "Industrial output": "Finland, 2025",
    "Energy demand": "Poland, 2025",

    #   select count(distinct default_country_iso3) from indicators
    #    where (id like 'eurostat.ai_any.%' or id like 'oecd.ai_any.%')
    #      and exists (select 1 from observations o
    #                   where o.indicator_id = indicators.id);   -> 16
    #   select count(*) from countries where not is_aggregate;   -> 44
    #                                                       read 2026-09-03
    "EU Central": "measured",
    "US West": "of 44 countries",
    "Asia Pacific": "annual surveys",
    "+18% emissions": "16",
    "Stable grid": "28 unmeasured",
    # Not "4 points deep". Four is the Eurostat series' depth; across all
    # sixteen countries it runs from one point to six:
    #   select min(n), max(n) from (select count(*) n from observations
    #     where indicator_id like '%.ai_any.%' group by indicator_id) t;
    #   -> 1 (United Kingdom, 2020 only) .. 6 (South Korea, 2019-2024)
    "+9% surge": "1 to 6 points",
    "Active regions": "Eurostat and OECD enterprise surveys",
}

# ---------------------------------------------------------------------------
# FAQ
# ---------------------------------------------------------------------------

FAQ = {
    "Answers to common questions about Atmos": "What this is, and what it is not",
    "Clear answers on data collection, analysis, and how climate insights are generated.":
        "How the data is gathered, how the claims are made, and where both fall short.",

    "How is climate data collected?": "Where does the data come from?",
    # Seventeen, counted the same way as the stats card and the header pill —
    # sources holding at least one observation or document, read 2026-09-03.
    # It said twenty-four, which was every row in the sources table including
    # eight that have never returned anything.
    "Data is gathered from sensors, infrastructure systems, and external providers, then unified into a single real-time stream.":
        "From seventeen public sources — FRED, the World Bank, DBnomics, SEC EDGAR, Epoch AI, the US Federal Register and others. Nothing is redistributed: every series links back to its publisher with its licence stated, so you can take the data on the publisher's terms rather than trusting a chart here.",

    "How often is the data updated?": "How often does it update?",
    "Data is continuously updated in real time, reflecting live changes across regions and systems.":
        "Ingestion runs nightly. The prose does not — numbers move on their own and sentences do not follow them, so every page shows the date a person last checked its writing against its data.",

    "What kind of data can I track?": "Is any of this written by AI?",
    "You can monitor emissions, energy usage, industrial activity, and environmental signals across multiple regions.":
        "No figure is. Every number is computed in SQL from a named source, and every claim is written by a person and dated. Where a takeaway from an outside report was read out of the document by a machine, the page says so and gives the page number so you can check it.",

    "How does the platform generate insights?": "What does 'contested' mean?",
    "The system analyzes incoming data, detects patterns, and highlights meaningful changes you can act on.":
        "That credible sources reach opposite conclusions, and the disagreement is the finding. Four pages currently carry it. The alternative — picking whichever result is tidier — is the thing this site exists not to do.",

    "Can I connect my own data sources?": "Can I use the data?",
    "Yes, you can integrate your own systems and combine them with external data for a complete view.":
        "Take it from the publisher, on their terms — each one's licence is shown on its series page. The code is MIT and the whole project is open source.",

    "Is the data reliable?": "Where is this weakest?",
    "Data is validated and processed from multiple sources to ensure accuracy and consistency.":
        "Country coverage. One country has real depth; thirteen of the forty-four carry six annual World Bank series and nothing else, and only the United States carries more than sixteen. Policy is thin. Occupation-level employment, which is what several questions actually need, is largely missing. All of that is stated on the pages it affects rather than hidden.",

    "Didn’t find what you were looking for?": "Found something wrong?",
    "Reach out and we’ll help you get the answers you need.":
        "If you are an economist and a comparison here is unsound, that is the most useful thing you could tell me.",
}

# ---------------------------------------------------------------------------
# Closing CTA and footer
# ---------------------------------------------------------------------------

CTA = {
    "Get Started": "Start here",
    "Start exploring global climate data today": "Start with a question",

    "Global system overview": "Enterprises using AI",
    "Energy, emissions, and system data in one view.":
        "Share of firms with 10 or more employees, by country.",
    # Both spellings, for the same reason as "Emission monitoring & reporting"
    # above: the markup writes &amp; and the chunk writes a raw &. The raw key
    # alone fixed the chunk and left "Scope 1 &amp; 2 Emissions" in the HTML.
    "Scope 1 & 2 Emissions": "Adoption, 2021–2025",
    "Scope 1 &amp; 2 Emissions": "Adoption, 2021–2025",
    "Real-time metrics from global sensor networks.":
        "Eurostat Community Survey on ICT usage in enterprises.",
}

FOOTER = {
    "Get in touch": "Get in touch",
    "Reach out for access, questions, or partnerships.":
        "Corrections, questions, or a series this should be using and is not.",
    # The footer's own contact link. Was "Email", pointing at a mailto.
    "Contact Us": CONTACT_TEXT,
    "Explore": "Read",
    "Follow Us": "Project",
    "Legal": "Legal",
    "Home": "Home",
    "About": "The data",
    "Features": "Lenses",
    "FAQ": "FAQ",
    "© 2026 Atmos. All rights reserved.":
        "© 2026 Diffusion. Code is MIT. Data belongs to its publishers.",
    "Created by": "Built by",
    "Liana Tudakova": "Joshua Khalili",
    # The template's "Follow Us" column linked to the author's personal
    # accounts. Repurposed as the project's own links.
    "Instagram": "Sign in",
    "Threads": "The lenses",
    "LinkedIn": "LinkedIn",
    "X": "Source on GitHub",

    # THE VISIBLE TEXT OF EVERY CONTACT ANCHOR. Four of them: the FAQ's, the
    # footer's, and one at the end of each legal document. The href is a
    # separate string and lives in LINKS.
    #
    # These keys reach BOTH renderings of that anchor — the SSR markup, where
    # the address is a text node between tags, and the Framer hydration
    # payload, where it is a quoted child inside a <script>. The payload form
    # is escaped as \"contact@atmos.com\", and build-diffusion.py's short-key
    # rule used to require a bare quote on both sides, so it matched the markup
    # and missed the payload. React then patched the DOM to the payload's
    # value on hydration: the file said one thing and the browser showed
    # another, which is why one audit reported the page showing
    # contact@atmos.com and another reported it showing the Gmail. Both were
    # right about different renderings of the same anchor.
    "support@atmos.com": CONTACT_TEXT,
    "contact@atmos.com": CONTACT_TEXT,
}

# ---------------------------------------------------------------------------
# The two legal documents
# ---------------------------------------------------------------------------
#
# WHY THESE HAD TO BE REWRITTEN RATHER THAN LEFT
#
# The template ships a real-looking Privacy Policy and Terms of Service for
# Atmos, and the mirror published them verbatim under Diffusion's wordmark.
# They described a different product — environmental sensors, connected
# infrastructure, paid subscriptions — and, worse, they made false statements
# about how a reader's data is handled: usage analytics, device information,
# sharing with "analytics partners". None of that is true here, and it was
# sitting under a sign-in form that asks real people for their name and email.
#
# A privacy policy is a representation to a reader. Publishing someone else's
# is worse than publishing none. So every sentence below is a true statement
# about what this site actually does, checked against src/server/lib/auth.js
# and db/migrations/0016_readers.sql.
#
# The headings and the section numbering are the template's and are kept, so
# the page structure is unchanged and only the claims move.
#
# WHY THIS IS SAFE TO DO AS STRING REPLACEMENT
#
# The docstring at the top of this file warns that the legal documents also
# live in the two .framercms blobs, which are addressed by byte offset and
# cannot be rewritten in place. They are also never fetched: a network trace of
# a cold load of /legal/privacy-policy makes 36 requests and not one of them is
# for a .framercms file. The text is in the SSR markup and in the chunks, both
# of which this build already covers.

LEGAL = {
    # ---- Both documents ----
    "Version 2.8": "Version 1.1",
    "Version 2.6": "Version 1.1",
    "Mar 28, 2026": "Sep 4, 2026",

    # ---- Privacy Policy ----
    "Privacy Policy - Atmos": "Privacy Policy — Diffusion",

    "Atmos (“we”, “our”, or “us”) respects your privacy and is committed to "
    "protecting your information. This Privacy Policy explains how data is "
    "collected, used, and securely safeguarded when using the Atmos platform, "
    "website, and related services, including any interactions with our tools "
    "and features and technologies.":
        "Diffusion is run by one person and holds two pieces of information "
        "about you: a name and an email address, typed into a sign-in form. "
        "This page says what happens to them. It is short because very little "
        "happens to them.",

    "We may collect the following types of information:":
        "This is the complete list, not a summary of it:",
    "Information you provide directly, such as your name, email address, and "
    "account details.":
        "The name and the email address you type into the sign-in form.",
    "Environmental and system data processed through integrations, sensors, "
    "and connected infrastructure.":
        "Nothing else. No analytics, no tracking pixels, no advertising "
        "identifiers, no third-party scripts.",
    "Usage data, including interactions with the platform, device "
    "information, and analytics.":
        "No record of what you read, no device fingerprint, and no IP address "
        "log kept against your account.",
    "Communications with our team, including support requests and feedback.":
        "Anything you choose to send me, which is read by one person.",

    "Your information is used to:":
        "The address is used for exactly one thing, and here is the honest "
        "version of it:",
    "Provide and improve environmental monitoring and analytics.":
        "To know roughly who the work reaches. That is the entire reason an "
        "account exists.",
    "Deliver insights, dashboards, and system performance data.":
        "To reply, if you write in with a correction.",
    "Operate, maintain, and optimize the Atmos platform.":
        "You will not be emailed otherwise. There is no mailing list, no "
        "newsletter and no product announcement.",
    "Communicate updates, support responses, and important notifications.":
        "The address is never verified, so it is a visitor record rather than "
        "a credential, and it protects nothing.",
    "Ensure security, stability, and compliance with applicable laws.":
        "Nothing behind the sign-in is private — it is public statistics from "
        "public sources — so there is nothing here for an account to guard.",

    "Our processing principles:": "In full:",
    "Data is processed to provide accurate environmental insights and system "
    "analysis.":
        "The row is stored in a Postgres database and read by nobody but the "
        "person who runs the site.",
    "We do not sell identifiable personal data to third parties.":
        "Nothing is sold, rented, traded or shared. Not in aggregate either.",
    "Data processing is limited to what is necessary to operate and improve "
    "the platform.":
        "Nothing is inferred, scored, enriched or joined against any other "
        "source.",

    "We may share data only with:":
        "Nobody. Named individually, so this cannot be read generously:",
    "Trusted service providers, including hosting, analytics, and "
    "infrastructure partners.":
        "The database host stores the row, because it stores every row. There "
        "is no analytics provider, because there are no analytics.",
    "Legal authorities, if required by law or regulation.":
        "A lawful order would be complied with. There would be very little to "
        "hand over.",
    "All partners are required to protect your data and use it only for the "
    "services they provide.":
        # Was a Google Fonts disclosure until 4 Sep 2026. The app now self-hosts
        # Trispace and Fragment Mono (src/client/static-assets/fonts/), so the
        # disclosure became a false statement in a legal document — over-disclosure
        # is still a false statement, and this list is headed "Named individually,
        # so this cannot be read generously".
        "No external service is loaded by any page here. The typefaces are served "
        "from this site rather than from Google Fonts, which is a change from an "
        "earlier version of this policy: nothing about your visit reaches a third "
        "party.",

    "We implement industry-standard security measures to protect your "
    "information. However, no system can guarantee complete security, and we "
    "cannot ensure absolute protection of transmitted data.":
        "No password is set, sent, hashed or stored by either sign-in route, "
        "so there is nothing here that could be stolen and replayed against "
        "another site. A session is a signed cookie rather than a stored "
        "token. What is held is a name and an unverified email address, and no "
        "system can promise perfect security of even that.",

    "Depending on your location, you may have the right to:":
        "Wherever you are, and without having to cite a regulation:",
    # No longer "Email and ask": there is no published address to email. The
    # contact link at the end of this document is the route.
    "Access, update, or delete your personal data.":
        "Ask what is stored under your address, or ask for it to be deleted, "
        "using the contact link at the end of this page. It will be, and you "
        "will get a reply saying so.",
    "Request restriction or portability of your data.":
        "There is no processing to restrict, and the portable version of your "
        "record is a name and an email address.",
    "Withdraw consent for certain data processing activities.":
        "Signing out and not coming back also works.",

    "If you have questions about this Privacy Policy or your data, contact us "
    "at: ":
        "Questions about any of this, or about what is stored under your "
        "address: ",

    # ---- Terms of Service ----
    # The tab title only. The page's own <h1> lives in a CMS field the build
    # does not reach, and it says "Terms of Service" — so the title matches it
    # rather than improving on it.
    "Terms of Service - Atmos": "Terms of Service — Diffusion",

    "These Terms of Service (“Terms”) govern your access to and use of the "
    "Atmos platform, website, and related services. By using Atmos, you agree "
    "to these Terms and fully accept responsibility for your use of the "
    "platform and services.":
        "Diffusion is a free, public, open-source dashboard run by one person. "
        "There is nothing to buy and nothing to subscribe to, so these terms "
        "are mostly a description of what the site is rather than a contract "
        "you are being held to.",

    "You agree to use Atmos only for lawful purposes and in accordance with "
    "these Terms.":
        "Read it, quote it, disagree with it in public. No permission needed.",
    "You may not misuse, disrupt, or attempt to gain unauthorized access to "
    "the platform.":
        "Do not attack the server or try to reach other readers' accounts. "
        "There is nothing in them, but still.",
    "You are responsible for maintaining the confidentiality of your account.":
        "There is no password to keep confidential.",
    "You agree to provide accurate information when creating an account.":
        "A real name and a real address are appreciated. Neither is checked.",

    "We may update, modify, or discontinue parts of the platform at any time:":
        "This is one person's project, and it may change or stop:",
    "Access to certain features may require a subscription.":
        "Nothing here costs money, and no part of it is held back for a paid "
        "tier.",
    "We reserve the right to suspend or terminate access if these Terms are "
    "violated.":
        "An account used to attack the site will be removed.",

    "Data and content": "3. Data and content",
    "You retain ownership of the data you provide to Atmos.":
        "The economic data on this site belongs to the statistical agencies "
        "that publish it, not to Diffusion. Each source carries its own "
        "licence, and that licence is shown on every series page.",
    "By using the platform, you grant us the right to process your data to "
    "provide and improve the service.":
        "Cite and link the publisher. For anything that matters, take the "
        "numbers from them rather than from here.",
    "You are responsible for ensuring that you have the right to use and "
    "share any data submitted.":
        "The code is MIT licensed and on GitHub. Do what you like with it.",

    "All platform content, design, and functionality are the property of "
    "Atmos.":
        "The written analysis is its author's. The page design is adapted from "
        "a commercial template under that template's own licence.",
    "You may not copy, reproduce, or distribute any part of the platform "
    "without permission.":
        "The institutional reports cited in the literature sections belong to "
        "their publishers. They are linked and quoted, never redistributed.",

    "5. Subscriptions and billing": "5. Money",
    "Some features may require a paid subscription.":
        "There is no subscription, no paid tier and no trial.",
    "Subscription fees are billed according to your selected plan.":
        "No card is asked for and no payment is processed anywhere on this "
        "site.",
    "We may change pricing with reasonable notice.":
        "If that ever changes it will be said plainly and in advance, not by "
        "quietly editing this page.",
    "Payments are non-refundable unless required by law.":
        "There is nothing to refund.",

    "Atmos is provided “as is” without warranties of any kind.":
        "Diffusion is provided as is, with no warranty.",
    "We do not guarantee that the platform will be uninterrupted or "
    "error-free.":
        "Data is ingested from public sources automatically and can be wrong, "
        "stale or misattributed. Where a page knows its evidence is weak, it "
        "says so on the page.",
    "Insights and analytics are provided for informational purposes only.":
        "Nothing here is investment, financial or policy advice. It is a "
        "reading of published statistics.",

    "We may update these Terms from time to time.":
        "These may change. The version and date at the top say when they last "
        "did.",
    "Continued use of the platform means you accept the updated Terms.":
        "Nothing is being agreed to that costs you anything.",

    "If you have questions about these Terms, contact us at: ":
        "Corrections, questions, or a series this should be using and is not: ",
}

# ---------------------------------------------------------------------------
# Page titles and meta
# ---------------------------------------------------------------------------

META = {
    "Atmos — Climate Data Platform": "Diffusion — Is AI changing the economy?",
    "You’re on the list — Atmos": "Thanks — Diffusion",
    "Thanks for joining Atmos": "Thanks for reading",
    "We’ll notify you as soon as Atmos launches. Follow for updates.":
        "If you spotted something wrong, that is genuinely the most useful thing you could send.",
    "You’re in": "Noted",
    "Page not found — Atmos": "Page not found — Diffusion",
    "The page you’re looking for doesn’t exist or may have been moved.":
        "This page does not exist, or it moved when the site was reorganised.",
    "Go back home": "Back to the start",

    # ---- Meta descriptions -------------------------------------------------
    #
    # Every one of these was still the template's, on every page, including the
    # home page — so the one sentence a search engine would print under this
    # site described a real-time climate and energy platform with a waitlist.
    # They are invisible on the page, which is exactly why they survived four
    # passes of checking the visible copy.
    "Atmos is a real-time climate and energy data platform. Early access "
    "available via waitlist.":
        "Artificial intelligence's measurable effect on the world economy, "
        "read through five lenses and built only from official statistics. "
        "Every number links back to the agency that published it.",
    "Privacy policy and terms for Atmos.":
        "What Diffusion stores about a reader — a name and an email address, "
        "nothing else — and the terms of using the site.",
    "Request early access to Atmos. Enter your email to join the waitlist.":
        "Diffusion is free and public. There is no waitlist.",
    # The retired waitlist page's own title. It is redirected to /login and
    # nobody can reach it, but leaving one "Atmos" in the mirror means the next
    # person to grep for it finds a hit and has to work out whether it matters.
    "Join Atmos — Early Access": "Sign in — Diffusion",
    "Your request was received. We’ll notify you when Atmos becomes "
    "available.":
        "Diffusion is free and public, and already open to read.",

    # The runtime page title on the two legal pages, composed in a template
    # literal: `${cmsTitle} - Atmos`. Because "Atmos" sits inside an
    # interpolation rather than as a whole quoted string, the delimited
    # short-key rule correctly refuses to touch it, and the SSR <title> this
    # map does fix gets overwritten on hydration. Replaced with enough
    # surrounding syntax to be unambiguous.
    "} - Atmos`,viewport:`width=device-width`":
        "} — Diffusion`,viewport:`width=device-width`",
}

# ---------------------------------------------------------------------------
# Everything, in one map. The build sorts by key length descending.
# ---------------------------------------------------------------------------

_GROUPS = (
    ("HERO", HERO), ("HOW_IT_WORKS", HOW_IT_WORKS), ("DEMO", DEMO),
    ("FEATURES", FEATURES), ("CAPABILITIES", CAPABILITIES),
    ("GLOBAL_STATS", GLOBAL_STATS), ("FAQ", FAQ), ("CTA", CTA),
    ("FOOTER", FOOTER), ("LEGAL", LEGAL), ("META", META), ("BRAND", BRAND),
)

# A KEY DEFINED IN TWO GROUPS IS A BUILD FAILURE, NOT A PREFERENCE.
#
# This used to be a setdefault, described as "first writer wins". What it
# actually did was throw the second value away without saying so. Exactly one
# key was defined twice — "Get instant alerts", in FEATURES and again in
# CAPABILITIES — and the consequence was that the section headed "Four
# constraints this site holds itself to" rendered its fourth rule under a
# heading used 1,700px further up the page, while the heading it should have
# had appeared in no shipped file at all. A map that silently discards half of
# what it is told is worse than no map.
#
# A string that genuinely needs two different values in two components cannot
# be expressed here at all. That is what PAIRED is for.
#
# (Ordering is still first-listed-first for the pass itself: BRAND is last so
# that it never rewrites the brand name inside a longer phrase. That safety
# comes from sorting by key length in build-diffusion.py, not from this loop.)
REPLACEMENTS = {}
_OWNER = {}
_CLASHES = []
for _name, _group in _GROUPS:
    for _k, _v in _group.items():
        if _k in REPLACEMENTS:
            _CLASHES.append((_k, _OWNER[_k], REPLACEMENTS[_k], _name, _v))
            continue
        REPLACEMENTS[_k] = _v
        _OWNER[_k] = _name

if _CLASHES:
    raise SystemExit(
        "content_diffusion.py: %d replacement key(s) defined in two groups.\n"
        "Only one value can ever reach the page, so the other is dead copy.\n"
        "If the two really are different components that need different text, "
        "move one of them into PAIRED and anchor it on a neighbouring string.\n"
        % len(_CLASHES)
        + "".join(
            "  %r\n      %s -> %r\n      %s -> %r  (discarded)\n"
            % (k, g1, v1, g2, v2) for k, g1, v1, g2, v2 in _CLASHES
        )
    )

# ---------------------------------------------------------------------------
# The giant wordmark
# ---------------------------------------------------------------------------
#
# The wordmark is an SVG whose viewBox width IS the text's advance width — the
# template's 1125.62 at 254px matches "Atmos" measured in Hooskai Chamfered
# Square to within 0.06%. `framer-fit-text` does NOT recompute it on mount, so
# a longer word simply overflows and clips. "Diffusion" is 1.55x the width of
# "Atmos", which is why the first build rendered "DIFFUS".
#
# Widths below were measured in the browser with the real font loaded, at each
# of the four sizes the template uses, with the -0.03em tracking applied:
#
#   const c = document.createElement('canvas').getContext('2d');
#   c.font = '254px "Hooskai Chamfered Square"';
#   c.measureText('Diffusion').width + (-0.03 * 254) * ('Diffusion'.length - 1)
#
# Heights are unchanged — the cap height did not move.

WORDMARK_VIEWBOX = {
    "0 0 1125.62 178": "0 0 1735 178",   # hero band, 254px
    "0 0 1129.65 179": "0 0 1742 179",   # footer, 255px
    "0 0 744.04 118": "0 0 1148 118",    # tablet, 168px
    "0 0 332.25 53": "0 0 512 53",       # mobile, 75px
}

# ---------------------------------------------------------------------------
# Where the links actually go
# ---------------------------------------------------------------------------
#
# Every call to action in the template points at /waitlist — five on the home
# page, one on each of the others. That is correct for a product that has not
# shipped and wrong for one where the whole site is already there. Repointed at
# the thing each button is actually offering.
#
# The template author's own links go too. They are hidden by content.css so
# hydration does not break, but the hrefs are still in the markup and still
# resolve, so they are repointed as well rather than merely covered up.
#
# WHY THE LINKS INTO THE APP ARE ABSOLUTE URLS AND NOT PATHS
#
# This is the one decision in this file that looks wrong and is not, so it is
# written down rather than left to be rediscovered.
#
# Framer's client router resolves EVERY href beginning with "/", "." or "#"
# against its own route table, and an unmatched path does not fall through — it
# falls back to the home route (`Si()` in framer.*.mjs ends `let f=i['/']; if(f)
# return {routeId:f.routeId…}`). So an anchor written href="/login" is rendered
# as href="./" and the sign-in link lands on the front page. The router knows
# only "/", "/waitlist", "/thanks", "/legal/:slug" and "/404"; nothing else can
# be expressed as a path.
#
# A previous attempt at this fix put "/login" here. It rebuilt cleanly, the
# static HTML was correct, and the link still went to "/" in a browser, because
# the check read the markup and the router rewrites on mount. An absolute URL on
# another origin is the only shape the router leaves alone — which is exactly
# why the template's author reached for absolute URLs in the first place.
#
# The cost is that the production domain is named here. assets/js/nav.js pays it
# back: it catches the click and re-issues it against whatever origin the page
# is being served from, so localhost and production behave identically and only
# a reader with JavaScript disabled is sent to the absolute URL.

# The landing page and the app are one deployment, so this is SITE_ORIGIN
# rather than a second copy of the same hostname. Named separately because the
# two are different facts that happen to coincide today: if the app ever moves
# behind its own host, this is the line that changes.
APP_ORIGIN = SITE_ORIGIN

# Every app path the landing page links into. nav.js is generated from this list,
# so the two cannot drift.
APP_PATHS = ("/login", "/overview", "/data")

LINKS = {
    # The primary CTA in the SSR markup. Only half the fix: the same buttons are
    # re-rendered from the chunk as a page link rather than a URL, which is what
    # CHUNK_PATCHES deals with. Kept because the markup is what a reader without
    # JavaScript, and every crawler, actually gets.
    '"/waitlist"': '"' + APP_ORIGIN + '/login"',

    # The footer's "Project" column. The template author's four personal socials
    # were relabelled in FOOTER as the project's own links, but only two of them
    # became external links; "Sign in" and "The lenses" name pages of this site
    # and have to arrive there. That they all pointed at the source repository
    # was the single worst thing on the front page: the primary sign-in
    # affordance opened someone's source code.
    "https://www.instagram.com/liana.tudakova/": APP_ORIGIN + "/login",
    "https://www.threads.com/@liana.tudakova": APP_ORIGIN + "/overview",
    "https://x.com/liana_tme": "https://github.com/joshuakhalili/EconIntel",
    "https://www.linkedin.com/in/liana-tme/": "https://www.linkedin.com/in/joshuakhalili/",
    "https://lunaui.co": "https://github.com/joshuakhalili/EconIntel",

    # The contact anchors' hrefs — footer, FAQ, and one per legal document.
    # FOOTER above replaces the visible text; the mailto: is a separate string
    # and needs its own entry, which is how the one link on the site that
    # invites a correction spent a while pointing at the template author's
    # support desk. It now goes to a profile rather than an address: a
    # plain-text mailto on a public page is harvested within days, and a
    # privacy policy that invites people to write in means the volume is
    # intended. There is no mailto: left behind either — removing the visible
    # address and leaving it in the href would publish it just as effectively.
    "mailto:contact@atmos.com": CONTACT_URL,
    "mailto:support@atmos.com": CONTACT_URL,

    # "Built in Framer" is fair attribution and stays. Its href was not
    # attribution: it carried the template author's Google Ads campaign ids and
    # a gclid, so every click credited someone else's ad spend and handed
    # Google a referral from this site.
    #
    # BOTH SPELLINGS ARE NEEDED. The markup escapes the separators as &amp;; the
    # chunk that re-renders the same anchor on mount writes raw &. Only the
    # escaped one was here, so the pass fixed the HTML and the ads URL came
    # straight back on hydration — visible in the DOM, invisible to any check
    # that reads the built file.
    "https://www.framer.com/?utm_source=google&amp;utm_medium=adwords"
    "&amp;utm_campaign=22283959360_172357934061"
    "&amp;utm_content=746821181196_framer_e_c_g&amp;gad_source=1"
    "&amp;gad_campaignid=22283959360"
    "&amp;gbraid=0AAAAAC3AKQU5Xc1UzR3PUe2mHBnm_iGbp"
    "&amp;gclid=CjwKCAjwrNrQBhBjEiwAoR4VOw9CRaI3zfldSqN_asliID8KFd4DeJWbDvOy3KKKZLqIZCBOrcWv6RoCw-YQAvD_BwE":
        "https://www.framer.com",
    "https://www.framer.com/?utm_source=google&utm_medium=adwords"
    "&utm_campaign=22283959360_172357934061"
    "&utm_content=746821181196_framer_e_c_g&gad_source=1"
    "&gad_campaignid=22283959360"
    "&gbraid=0AAAAAC3AKQU5Xc1UzR3PUe2mHBnm_iGbp"
    "&gclid=CjwKCAjwrNrQBhBjEiwAoR4VOw9CRaI3zfldSqN_asliID8KFd4DeJWbDvOy3KKKZLqIZCBOrcWv6RoCw-YQAvD_BwE":
        "https://www.framer.com",
}

# WHY THERE IS NO LONGER A NAV_LINKS TABLE
#
# It held two entries, '"#3356954461"' -> '"/overview"' and '"#1175957644"' ->
# '"/data"', described as the header's own nav anchors. They were not anchors.
# Both ids are SVG symbol references — <use href="#3356954461"/> — and the pass
# rewrote them into <use href="/overview"/>, which asks the browser to fetch an
# external SVG document from an app route. The result was two icons that failed
# to resolve until hydration replaced them, and a 404 on /overview and /data on
# every single page load, sitting in the console next to the real errors.
#
# The header's actual nav anchors are Home, The data, Lenses and FAQ, and they
# are in-page hashes on the landing page itself. They were never touched by this
# table and do not need to be.
NAV_LINKS = {}

# ---------------------------------------------------------------------------
# Edits to Framer's own bundle, as opposed to its content
# ---------------------------------------------------------------------------
#
# These are code, not copy, and they exist because the thing they fix cannot be
# reached from the HTML. Applied to assets/js/*.mjs only, and EVERY ONE MUST
# MATCH — the build fails if one does not. That rule is the point of the table:
# the previous version of this file carried a link entry that read correctly and
# silently matched nothing for weeks, and a content map that can no-op quietly
# is worse than no content map.
#
# Both keys contain minified identifiers. If Framer's bundler renames one,
# the build will stop and say which key went stale; re-derive it by searching
# assets/js/script_main.*.mjs for the surrounding text quoted in each comment.

CHUNK_PATCHES = {
    # The three "Sign in to read" buttons. In the markup they are an href that
    # LINKS can reach; in the chunk they are a page link — a webPageId resolved
    # against the route table on mount, which is why they came back as
    # ./waitlist however the HTML was written, and went to the reader through
    # the 302 that exists to catch old bookmarks. e63xbjJOI is the retired
    # waitlist page. The other occurrences of that id are scopeIds and the route
    # table itself, so the whole link literal is matched, not the id.
    "{href:{webPageId:`e63xbjJOI`},implicitPathVariables:void 0}":
        "{href:`" + APP_ORIGIN + "/login`,implicitPathVariables:void 0}",

    # Framer's on-page editor bootstrap, left in the clone. It resolves an
    # EditorBar component by importing https://framer.com/edit/init.mjs on every
    # page load, which then imports a chunk from app.framerstatic.com.
    #
    # It had been written off as harmless because it was seen failing. Checked on
    # 3 Sep 2026 it does not fail: both URLs answer 200, so this was two requests
    # to a third party and their code running on the front page of a site whose
    # whole claim is that you can see where everything came from. Whether it
    # errors on any given day is not the point.
    #
    # detach.py claims this in its docstring and only removes the localStorage
    # hook in the markup; the import is in the chunk. Fixed here rather than
    # there because detach.py runs before the pristine-mirror baseline, so a fix
    # in it would only take effect on a full re-mirror, while this pass runs
    # after every reset.
    #
    # Turning the ternary's test into a constant leaves the IIFE in the branch
    # that is never taken, so the import is never evaluated and nothing is cut
    # out of the middle of minified code. detach.py neutralises the badge loader
    # the same way, with `false&&`.
    "EditorBar:T===void 0?void 0:": "EditorBar:!0?void 0:",

    # Framer's router reads this at runtime to build absolute URLs — share
    # links, and anything else that needs to name the site. It still said
    # atmos-system.framer.website, the TEMPLATE AUTHOR's Framer site, in
    # assets/js/script_main.*.mjs. It is not a link in the markup, so neither
    # LINKS nor the host rewrite over canonical tags would ever have found it,
    # and a rebuild left it every time.
    #
    # Re-derive by grepping assets/js/script_main.*.mjs for `siteCanonicalURL`
    # if this key ever goes stale.
    "siteCanonicalURL:`https://atmos-system.framer.website`":
        "siteCanonicalURL:`" + SITE_ORIGIN + "`",
}

# ---------------------------------------------------------------------------
# Nodes removed rather than rewritten, by CSS selector.
# ---------------------------------------------------------------------------
#
# Hidden, not deleted. A structural edit breaks React hydration, and when
# hydration fails Framer discards the SSR markup and reverts the whole page to
# template content — which would put the stock headshots back.

HIDE_CSS = """/* Written by docs/build-diffusion.py.

   Invented proof the template ships, and the template author's own links.
   Hidden rather than removed: deleting nodes breaks hydration, and a failed
   hydration reverts the entire page to template content. */

/* The template author's personal socials, presented as the product's. */
a[href*="instagram.com/liana"],
a[href*="threads.com/@liana"],
a[href*="linkedin.com/in/liana"],
a[href*="x.com/liana_tme"],
a[href*="lunaui.co"] {
  display: none !important;
}

/* The Legal column's third link is "404", pointing at the 404 page. That is
   the template designer listing every page they made, not a document anyone
   needs. The 404 page itself stays — it is what a mistyped URL lands on.

   Matched on the ENDING, not the exact value: the markup ships href="/404" and
   Framer rewrites it to "./404" on hydration, so an exact selector hides it
   until the page finishes loading and then stops. */
a[data-framer-name="Footer"][href$="/404"] {
  display: none !important;
}

/* The avatar beside "Built by Joshua Khalili" was the template author's
   headshot. Hiding the image alone left its container's ring — an empty circle
   next to the name, which reads as a broken image rather than as no image. */
figure:has(img[src*="DFzG1yXny0N4VBIJify9JjzxUVE"]) {
  display: none !important;
}

/* The stats card's status glyphs. Four figures, four decorations, none of
   them measuring anything: a red up-arrow beside the observation count, a
   chevron beside the series count, an icon beside sources, and a green "A+"
   beside the country count — that last one was the template's "98 / 100
   Compliance score" badge. An arrow claims a trend nobody computed and a
   grade grades nothing.

   Matched on the component's authored name and on the fact that the "A+" is
   the one rich-text block in the card with no data-framer-name of its own;
   the numbers and their labels are named "Text" and "Title". Framer's
   generated class names change on re-mirror, these two attributes do not. */
div[data-framer-name="Stats Card"] svg[role="presentation"],
div[data-framer-name="Stats Card"] div[data-framer-component-type="RichTextContainer"]:not([data-framer-name]) {
  display: none !important;
}

/* Stock portraits: a fabricated colleague and three fabricated signups. */
img[src*="VQmBGVY3RVR2vigsT6z5YPHg"],
img[src*="nZdCFW8odfx2dC37xGKQgC7dE"],
img[src*="gq0nsTnXYqxuMaKwCGBuligAiMM"],
img[src*="pULw97g0NbmYBdnrSAKemRBqzE"],
img[src*="DFzG1yXny0N4VBIJify9JjzxUVE"] {
  display: none !important;
}
"""

# ---------------------------------------------------------------------------
# The other half of the absolute-URL decision
# ---------------------------------------------------------------------------
#
# Appended to assets/js/nav.js by the build rather than written into it, because
# nav.js is harden.py's file and lives in the pristine-mirror commit: reset.sh
# restores it from that commit, so anything hand-added to it disappears on the
# next rebuild. Same reasoning as legal/index.html and sitemap.xml further down
# build-diffusion.py.
#
# Appended rather than given its own file so that all of this page's click
# handling is in one place, and so there is no second request and no question
# about which of two capture-phase listeners registered first.

NAV_APP_LINKS_JS = """

/* Appended by docs/build-diffusion.py.

   Framer's router cannot express a link to a page it does not own, so the
   links into the app carry an absolute production URL — see the long note in
   docs/content_diffusion.py above LINKS. That is right for a reader with no
   JavaScript and wrong for everyone else: on localhost it would leave the
   machine, and on any preview deployment it would jump to production. So the
   click is caught here and re-issued against whatever origin is actually
   serving the page.

   This handler deliberately claims links marked target="_blank", which the one
   above skips. The footer component opens external links in a new tab, and
   these stopped being external the moment they started pointing at our own app;
   a sign-in link that opens a second tab is a bug, not a preference. A modified
   click is still left alone, so cmd-click opens the absolute URL — production —
   which is correct there and merely surprising on localhost. */
var APP_ORIGIN = "%(origin)s";
var APP_PATHS = %(paths)s;

document.addEventListener("click", function (e) {
  if (e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  var a = e.target && e.target.closest && e.target.closest("a[href]");
  if (!a) return;
  var url;
  try {
    url = new URL(a.getAttribute("href"), location.href);
  } catch (err) { return; }
  if (url.origin !== APP_ORIGIN && url.origin !== location.origin) return;
  if (APP_PATHS.indexOf(url.pathname) === -1) return;
  e.stopPropagation();
  e.preventDefault();
  window.location.assign(url.pathname + url.search + url.hash);
}, true);

/* ── "Read it" on the literature card ──────────────────────────────────────
   M-43 asked for this label to be an anchor to the source URL that already
   sits in report_figures.source_url. It cannot become one in the markup: the
   label ships as a bare <p>, and reshaping a node is exactly what HIDE_CSS's
   header warns against — Framer hydration fails on a DOM that does not match
   its payload, and a failed hydration reverts the WHOLE page to the template's
   content. Trading a dead label for an ATMOS page is not a fix.

   So it is wired at runtime, after hydration, where the DOM is already settled
   and nothing downstream re-reads it. The URL is not a figure — it is the
   citation stored against
   report_figures.hai-workforce-reductions-observed-vs-expected, page ref
   "p. 55 (report p. 225)", read from the database on 4 Sep 2026. */
var CITATION_URL = "https://hai.stanford.edu/ai-index/2026-ai-index-report/economy";

function wireCitationLink() {
  var nodes = document.querySelectorAll("p, span, div");
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    if (n.children.length !== 0) continue;
    if ((n.textContent || "").trim() !== "Read it") continue;
    if (n.dataset && n.dataset.citationWired === "1") continue;
    if (n.dataset) n.dataset.citationWired = "1";
    n.setAttribute("role", "link");
    n.setAttribute("tabindex", "0");
    n.setAttribute("title", "Stanford HAI, AI Index 2026 — Economy chapter");
    n.style.cursor = "pointer";
    n.style.textDecoration = "underline";
    var go = function (e) {
      e.preventDefault();
      window.open(CITATION_URL, "_blank", "noopener,noreferrer");
    };
    n.addEventListener("click", go);
    n.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") go(e);
    });
    return true;
  }
  return false;
}

/* Hydration replaces nodes, so try again a few times rather than once. */
(function () {
  var tries = 0;
  var t = setInterval(function () {
    tries += 1;
    if (wireCitationLink() || tries > 20) clearInterval(t);
  }, 250);
})();
""" % {
    "origin": APP_ORIGIN,
    "paths": "[" + ", ".join('"%s"' % p for p in APP_PATHS) + "]",
}

# ---------------------------------------------------------------------------
# One template string, two components, two meanings
# ---------------------------------------------------------------------------
#
# REPLACEMENTS is a flat dict, so a key can carry exactly one value. The
# template does not respect that: it reuses the same copy in components that
# now say different things. Three consequences shipped.
#
#   "42.1 g/kWh" and "1.8k MW" are the first two figures on the stats card AND
#   the first and third tiles of the globe. Mapping them to the database
#   counters printed "73,847 — Denmark, 2025" and "111 — Poland, 2025" under a
#   heading reading "The share of firms using AI, from national statistical
#   surveys". 73,847 was the observation count and 111 the series count.
#   Neither is a share of anything. The right figures were forty lines up the
#   same page, in the question-page mock.
#
#   "Get instant alerts" is a feature row AND the fourth rule.
#   "Sync data from multiple systems" is a lens subtitle AND the first rule's
#   description.
#
# Each entry here is (anchor, old, new). `old` is replaced ONLY where it falls
# within PAIR_WINDOW characters of `anchor`, in either direction; every other
# occurrence is left for REPLACEMENTS. So the pair runs first, takes the copy
# it owns, and the flat map picks up what is left.
#
# WHY ANCHOR ON THE NEIGHBOUR AND NOT ON THE MARKUP. The obvious alternative
# is to put the enclosing tag in the key. It does not survive: the globe tile
# renders as <h5> on desktop, <h6> on tablet and <p> on mobile, and the mobile
# variant shares its style preset with the stats card, so tag-and-preset
# distinguishes neither reliably. The neighbouring string does, on every
# surface — in the markup the label sits in the sibling node, and in the chunk
# both are props of the same component call.
#
# EVERY ENTRY MUST MATCH AT LEAST ONCE OR THE BUILD FAILS, and the build
# prints, per entry, how many it took and how many occurrences it deliberately
# left outside the window.
#
# THE WINDOW IS SIZED FROM MEASUREMENT, NOT FROM TASTE. Every distance from an
# occurrence to its own anchor, measured across index.html and the page chunk
# on 2026-09-03: 84, 87, 88, 88, 91, 115, 115, 148, 341, 503, 505, 508, 513,
# 514, 1050. Every distance from an occurrence belonging to the OTHER
# component: 15533 and up. 4000 sits in the middle of a gap of an order of
# magnitude, so neither a markup reshuffle nor a re-mirror is likely to move an
# occurrence across it without the counts printed by the build changing first.
#
# ALL SIX STRINGS BELOW ARE THE TEMPLATE'S OWN, so this table only applies to
# a tree that has been reset to the pristine mirror. That is the only supported
# rebuild path anyway — see the header of build-diffusion.py.
PAIR_WINDOW = 4000

PAIRED = (
    # The globe's three country tiles. Eurostat's own 2025 figures, one
    # decimal place, exactly as the series stores them:
    #   select indicator_id, period_start, value from observations
    #    where indicator_id in ('eurostat.ai_any.DNK','eurostat.ai_any.FIN',
    #                           'eurostat.ai_any.POL')
    #      and period_start = '2025-01-01';
    #   -> DNK 42.03   FIN 37.82   POL 8.36            read 2026-09-03
    #   (indicators.decimals = 1 for all three, so 42.0 / 37.8 / 8.4)
    ("Carbon emissions",  "42.1 g/kWh", "42.0%"),
    ("Industrial output", "+4.8%",      "37.8%"),
    ("Energy demand",     "1.8k MW",    "8.4%"),

    # Capabilities rule 4's title. "Respond to issues without delay" is rule
    # 4's description and appears nowhere else on the site.
    ("Respond to issues without delay", "Get instant alerts",
     "Charts are not allowed to flatter"),

    # Capabilities rule 1's description. "Connect all sources" is rule 1's
    # title; the lens list's near-identical "Connect all data sources" is a
    # different string and is not matched by it.
    ("Connect all sources", "Sync data from multiple systems",
     "Computed in SQL from a named series, and dated where it is prose."),
)

# ---------------------------------------------------------------------------
# The hero statement, which the markup stores one word at a time
# ---------------------------------------------------------------------------
#
# Framer's scroll reveal needs each word in its own inline-block so it can be
# faded in separately, so the SSR markup holds the sentence as 28 <span>s —
# each containing the word twice, once dimmed and once bright and absolutely
# positioned over it — repeated at all three breakpoints. No whole-sentence
# key can match that, and none ever did: the HERO entry for this sentence
# reached the JS chunk and the search index only, and the shipped HTML went on
# describing a climate and emissions platform. That is the copy a crawler
# reads, and the copy a reader sees before 1.7 MB of JavaScript lands.
#
# So the spans are regenerated rather than substituted: the build joins each
# run of them, looks the sentence up here, and rewrites the run word by word
# using the styles it found on the first span, so nothing but the words moves.
#
# BOTH SPELLINGS OF THE FIRST WORD ARE LISTED. On a pristine mirror the run
# begins "Atmos"; on a tree where the brand pass has already run it begins
# "Diffusion". The same sentence comes out either way, so the map is correct
# for a rebuild and for a tree that is part-way through one.
WORD_REVEAL = {
    "Atmos is a unified system for global infrastructure. We connect climate, "
    "emissions, energy, and regional data into one evolving layer that "
    "reflects how systems behave in real time.": HERO_STATEMENT,

    "Diffusion is a unified system for global infrastructure. We connect "
    "climate, emissions, energy, and regional data into one evolving layer "
    "that reflects how systems behave in real time.": HERO_STATEMENT,
}

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
first three; the blobs hold only the two legal documents and are handled
separately, because they are addressed by byte offset and rewriting them
shifts every later offset.

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
  - support@atmos.com and contact@atmos.com.
  - The AI-assistant chat panel. Diffusion has no assistant, and mocking one
    up would be claiming a feature that does not exist. That subtree is
    repurposed to show a real question page instead.
  - The footer "Follow Us" column, which links to the TEMPLATE AUTHOR's
    personal Instagram, X, Threads and LinkedIn while presenting them as the
    product's socials.

FIGURES, ALL READ FROM THE DATABASE ON 2026-08-29
  73,847 observations · 111 series with data · 24 sources · 44 countries
  AI adoption by firms, Eurostat/OECD: Denmark 24%→42%, Finland 16%→38%,
  Poland 3%→8% over 2021-2025. 16 of 44 countries have any adoption survey.
"""

# ---------------------------------------------------------------------------
# Brand
# ---------------------------------------------------------------------------

BRAND = {
    "Atmos": "Diffusion",
    "atmos": "diffusion",
}

# ---------------------------------------------------------------------------
# Header, hero, and the scroll-revealed statement
# ---------------------------------------------------------------------------

HERO = {
    # The template's "System active" is a status claim with nothing behind it.
    # These two numbers are stable enough for static copy and both are true.
    "System active": "111 series · 24 sources",

    # Every primary CTA. The template points them at a waitlist; there is
    # nothing to wait for — the site is the product and it is already there.
    "Join waitlist": "Browse the data",
    "Join the waitlist to get early access and see how global systems behave in real time.":
        "Every series behind this site, with its source, its licence, and a link back to the publisher.",
    "Get early access to Atmos": "Every series, browsable",
    "exploring real-time global data": "reading the evidence",

    "Unified system for global environment": "Is AI changing the economy?",

    # The word-by-word scroll reveal. Written to land its last clause on the
    # reveal, because that is the sentence the animation exists to deliver.
    "Atmos is a unified system for global infrastructure. We connect climate, emissions, energy, and regional data into one evolving layer that reflects how systems behave in real time.":
        "Diffusion gathers what is actually measured about AI and the economy — investment, output, jobs, prices, policy. Every figure comes from a named public source. Every page states what its data cannot show.",
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
    "Collect emissions and environmental data from sensors, infrastructure, and external sources in real time.":
        "FRED, the World Bank, DBnomics, SEC EDGAR, Epoch AI and nineteen others. Every series links back to its publisher with its licence stated.",

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
    "Data is updated in real time": "Prose last checked against the data on 29 August 2026",
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
    "Connect all data sources": "Investment & Capital",
    "Sync data from multiple systems": "What is being spent, and what it buys",
    "Work as one team": "Growth & Productivity",
    "Share insights and act faster": "Whether any of it shows up in output",
    "Catch issues early": "Labour Markets",
    "Spot anomalies before they grow": "Jobs, pay, and who gets hired",

    "Unified system overview": "What this site holds",
    "Real-time metrics across all connected sources.":
        "Read from the database on 29 August 2026.",
    "42.1 g/kWh": "73,847",
    "Carbon intensity": "Observations",
    "1.8k MW": "111",
    "Energy usage": "Series with data",
    "2032-2048": "24",
    "Net zero target": "Sources",
    "98 / 100": "44",
    "Compliance score": "Countries",

    # 2 — was a fabricated colleague. Now the literature layer.
    "Team Workflow": "The literature",
    "Work together across teams and regions in real time":
        "What other people have found, and where they disagree",
    "Collaborate on data, share insights and align decisions across your entire organization.":
        "Twelve institutional and consulting reports, cited and linked. Labelled by who produced it, never ranked.",
    "Share insights across teams": "Cited, never redistributed",
    "Collaborate in real time": "Labelled by kind, not by rank",
    "Align decisions faster": "Marked where it disagrees with us",

    "Sofia Novak": "Stanford HAI",
    "Climate Analyst": "AI Index 2026, Economy chapter",
    "Region": "Stance",
    "EU Central (Western Europe)": "Disagrees with this page",
    "Responsibility": "Finding",
    "Emission monitoring & reporting": "US employment for software developers aged 22–25 fell close to 20% from its 2022 peak",
    "View activity": "Read it",
    "Message": "p. 221",
    "Assign task": "Not yet checked by a person",
    "Team Member": "Source",

    # 3 — was "Early Alerts". Now the contested state.
    "Early Alerts": "When sources disagree",
    "Detect potential issues before they impact your operations":
        "Three pages are marked contested, and that is the finding",
    "Stay ahead of risks by identifying anomalies and unusual patterns as they emerge.":
        "Where credible sources reach opposite conclusions, the disagreement is reported rather than resolved.",
    "Monitor unusual patterns": "Evidence strength on every page",
    "Get instant alerts": "Insufficient is a valid answer",
    "Act before it escalates": "Contested is stated, not smoothed over",

    "Monitoring": "Contested",
    "Emissions spike detected": "Sources disagree",
    "Carbon intensity increased by +18% in EU Central (Frankfurt), driven by industrial output over the last 24 hours.":
        "PwC finds headcount growing fastest at the most AI-exposed firms. The IMF finds employment falling in exposed occupations. Different methods, opposite results — both are on the page.",
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

    "Connect all sources": "No number is written by a model",
    "Understand patterns": "Caveats are sections, not footnotes",
    "Turn raw data into clear, useful insights": "Stated under the answer and above every chart.",
    "Monitor in real time": "Evidence strength is always stated",
    "Track changes across all systems": "Including when it is insufficient.",
    "Get instant alerts": "Charts are not allowed to flatter",
    "Respond to issues without delay": "One y-axis. Zero baseline. Gaps break the line.",
}

# ---------------------------------------------------------------------------
# Global signals — the globe section
# ---------------------------------------------------------------------------

GLOBAL_STATS = {
    "Global Signals": "Where it has spread",
    "Understand what’s happening across the planet":
        "Technology diffusion, where anyone has measured it",
    "Track emissions, energy and system activity in real time across regions":
        "The share of firms using AI, 2021 to 2025, from national statistical surveys",

    "Carbon emissions": "Denmark, 2025",
    "Industrial output": "Finland, 2025",
    "Energy demand": "Poland, 2025",
    "EU Central": "measured",
    "US West": "of 44 countries",
    "Asia Pacific": "annual surveys",
    "+18% emissions": "16",
    "Stable grid": "28 unmeasured",
    "+9% surge": "4 points deep",
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
    "Data is gathered from sensors, infrastructure systems, and external providers, then unified into a single real-time stream.":
        "From twenty-four public sources — FRED, the World Bank, DBnomics, SEC EDGAR, Epoch AI, the US Federal Register and others. Nothing is redistributed: every series links back to its publisher with its licence stated, so you can take the data on the publisher's terms rather than trusting a chart here.",

    "How often is the data updated?": "How often does it update?",
    "Data is continuously updated in real time, reflecting live changes across regions and systems.":
        "Ingestion runs nightly. The prose does not — numbers move on their own and sentences do not follow them, so every page shows the date a person last checked its writing against its data.",

    "What kind of data can I track?": "Is any of this written by AI?",
    "You can monitor emissions, energy usage, industrial activity, and environmental signals across multiple regions.":
        "No figure is. Every number is computed in SQL from a named source, and every claim is written by a person and dated. Where a takeaway from an outside report was read out of the document by a machine, the page says so and gives the page number so you can check it.",

    "How does the platform generate insights?": "What does 'contested' mean?",
    "The system analyzes incoming data, detects patterns, and highlights meaningful changes you can act on.":
        "That credible sources reach opposite conclusions, and the disagreement is the finding. Three pages currently carry it. The alternative — picking whichever result is tidier — is the thing this site exists not to do.",

    "Can I connect my own data sources?": "Can I use the data?",
    "Yes, you can integrate your own systems and combine them with external data for a complete view.":
        "Take it from the publisher, on their terms — each one's licence is shown on its series page. The code is MIT and the whole project is open source.",

    "Is the data reliable?": "Where is this weakest?",
    "Data is validated and processed from multiple sources to ensure accuracy and consistency.":
        "Country coverage. One country has real depth; most carry six annual World Bank series and nothing else. Policy is thin. Occupation-level employment, which is what several questions actually need, is largely missing. All of that is stated on the pages it affects rather than hidden.",

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
    "Scope 1 & 2 Emissions": "Adoption, 2021–2025",
    "Real-time metrics from global sensor networks.":
        "Eurostat Community Survey on ICT usage in enterprises.",
}

FOOTER = {
    "Get in touch": "Get in touch",
    "Reach out for access, questions, or partnerships.":
        "Corrections, questions, or a series this should be using and is not.",
    "Contact Us": "Email",
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

    "support@atmos.com": "joshuakhalili20@gmail.com",
    "contact@atmos.com": "joshuakhalili20@gmail.com",
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
}

# ---------------------------------------------------------------------------
# Everything, in one map. The build sorts by key length descending.
# ---------------------------------------------------------------------------

REPLACEMENTS = {}
for _group in (
    HERO, HOW_IT_WORKS, DEMO, FEATURES, CAPABILITIES,
    GLOBAL_STATS, FAQ, CTA, FOOTER, META, BRAND,
):
    for _k, _v in _group.items():
        # First writer wins: BRAND is applied last and must not overwrite a
        # longer phrase that happens to contain the brand name.
        _REPL = REPLACEMENTS.setdefault(_k, _v)

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

/* Stock portraits: a fabricated colleague and three fabricated signups. */
img[src*="VQmBGVY3RVR2vigsT6z5YPHg"],
img[src*="nZdCFW8odfx2dC37xGKQgC7dE"],
img[src*="gq0nsTnXYqxuMaKwCGBuligAiMM"],
img[src*="pULw97g0NbmYBdnrSAKemRBqzE"],
img[src*="DFzG1yXny0N4VBIJify9JjzxUVE"] {
  display: none !important;
}
"""

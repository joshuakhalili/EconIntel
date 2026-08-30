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
    # The template's "Follow Us" column linked to the author's personal
    # accounts. Repurposed as the project's own links.
    "Instagram": "Sign in",
    "Threads": "The lenses",
    "LinkedIn": "LinkedIn",
    "X": "Source on GitHub",

    "support@atmos.com": "joshuakhalili20@gmail.com",
    "contact@atmos.com": "joshuakhalili20@gmail.com",
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
    "Version 2.8": "Version 1.0",
    "Version 2.6": "Version 1.0",
    "Mar 28, 2026": "Aug 30, 2026",

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
        "Anything you choose to send by email, which is read by one person.",

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
        "Google Fonts serves two typefaces to your browser, which means Google "
        "sees that request. That is the only external service any page here "
        "loads, and it is told nothing about you.",

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
    "Access, update, or delete your personal data.":
        "Email and ask what is stored under your address, or ask for it to be "
        "deleted. It will be, and you will get a reply saying so.",
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

REPLACEMENTS = {}
for _group in (
    HERO, HOW_IT_WORKS, DEMO, FEATURES, CAPABILITIES,
    GLOBAL_STATS, FAQ, CTA, FOOTER, LEGAL, META, BRAND,
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

LINKS = {
    # The primary CTA. Reading requires an account — free, but a login — so it
    # points at the sign-in page rather than straight at the data.
    '"/waitlist"': '"/login"',

    "https://x.com/liana_tme": "https://github.com/joshuakhalili/EconIntel",
    "https://www.threads.com/@liana.tudakova": "https://github.com/joshuakhalili/EconIntel",
    "https://www.linkedin.com/in/liana-tme/": "https://www.linkedin.com/in/joshuakhalili/",
    "https://www.instagram.com/liana.tudakova/": "https://github.com/joshuakhalili/EconIntel",
    "https://lunaui.co": "https://github.com/joshuakhalili/EconIntel",
}

# Anchors in the template's own nav, repointed at real routes. Kept apart from
# LINKS because these are in-page hashes in the source and become real
# navigation here.
NAV_LINKS = {
    '"#3356954461"': '"/overview"',
    '"#1175957644"': '"/data"',
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

/* Stock portraits: a fabricated colleague and three fabricated signups. */
img[src*="VQmBGVY3RVR2vigsT6z5YPHg"],
img[src*="nZdCFW8odfx2dC37xGKQgC7dE"],
img[src*="gq0nsTnXYqxuMaKwCGBuligAiMM"],
img[src*="pULw97g0NbmYBdnrSAKemRBqzE"],
img[src*="DFzG1yXny0N4VBIJify9JjzxUVE"] {
  display: none !important;
}
"""

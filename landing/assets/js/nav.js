/* Written by docs/harden.py.

   Framer's client-side router tries to render the next page from the current
   page's prefetch cache. When the next page needs collection data the cache
   does not hold, the CMS asks for a byte range, which only Framer's own CDN
   serves. Every page here is a complete document, so a normal page load is both
   correct and cheaper.

   Relative hrefs (./projects/thing) are also resolved against the page's own
   slash-less path, so the site behaves the same whether the host adds a
   trailing slash or not. */
document.addEventListener("click", function (e) {
  if (e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  var a = e.target && e.target.closest && e.target.closest("a[href]");
  if (!a) return;
  var href = a.getAttribute("href");
  if (!href || href.indexOf("#") !== -1) return;
  if (a.target && a.target !== "_self") return;
  var target;
  if (href.charAt(0) === "/") {
    target = href;
  } else if (href.charAt(0) === ".") {
    var here = location.pathname.replace(/\/$/, "");
    var dir = here.slice(0, here.lastIndexOf("/") + 1) || "/";
    try {
      target = new URL(href, location.origin + dir).pathname;
    } catch (err) { return; }
  } else {
    return;
  }
  e.stopPropagation();
  e.preventDefault();
  window.location.assign(target);
}, true);


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
var APP_ORIGIN = "https://trydiffusion.vercel.app";
var APP_PATHS = ["/login", "/overview", "/data"];

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

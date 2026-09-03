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
var APP_PATHS = ["/login", "/overview"];

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

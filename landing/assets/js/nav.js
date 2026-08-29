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

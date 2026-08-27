// The GA4 tag, as an inline snippet for <head> — see Base.astro.
//
// Google's own copy-paste snippet is two tags: an `async` <script src=…> for
// gtag.js, and an inline block that queues `js` and `config` onto dataLayer for
// the library to drain once it arrives. This is that, with one difference: the
// <script src=…> is created from the inline block instead of being written into
// the markup, so the hostname test below can decide whether to request it AT ALL
// rather than loading the library everywhere and hoping nothing is recorded.
//
// WHY THE HOSTNAME TEST. SITE.analytics.hosts explains the reasoning at length;
// the short version is that the fortnight either side of the DNS cutover is
// spent reading this property to find out whether the port kept its traffic,
// while §6 of the README has the whole site being walked by hand on a
// *.pages.dev preview. Those hits land in the same reports and cannot be told
// apart afterwards. Cheaper to never send them.
//
// It is a test on `location.hostname`, not on `import.meta.env.PROD`, because
// PROD is true for every production build including the ones served from
// localhost:4322 by `npm run preview` and from a preview deployment. The thing
// being distinguished is where the page is being SERVED, which is a runtime
// fact, so it is tested at runtime.
//
// The queue is pushed before the library is appended, which is the order
// Google's snippet uses too — `gtag()` only ever writes to an array, and
// gtag.js drains whatever it finds there when it loads. Nothing is lost if the
// request is slow, and nothing is sent twice if it fails.

/**
 * Build the inline GA4 bootstrap.
 *
 * @param id    GA4 measurement ID, e.g. `G-65ZYPYCLQE`.
 * @param hosts Hostnames the tag is allowed to load on. An empty list would
 *              disable it everywhere, which is what `analytics.ga4: null`
 *              already says more clearly — pass a real list.
 */
export const ga4Snippet = (id: string, hosts: readonly string[]) => `
(function () {
  if (${JSON.stringify(hosts)}.indexOf(location.hostname) === -1) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", ${JSON.stringify(id)});
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(${JSON.stringify(id)});
  document.head.appendChild(s);
})();
`;

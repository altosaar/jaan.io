// A different portrait in the tab every day.
//
// public/favicons/ holds one line-drawn face per portrait the faceglyph
// pipeline was fed (see scripts/gen-favicons.mjs, which writes both those files
// and src/data/favicons.ts). This module decides which one a visitor sees.
//
// WHY THE CLIENT PICKS, AND NOT THE SERVER. The site is `output: "static"` on
// Cloudflare Pages: every page is a file on a CDN, built once and served
// unchanged for weeks. There is no request-time hook to vary a <link> in, short
// of putting a Pages Function in front of /favicon.svg — a function invocation
// on every page view, plus a route that `astro dev` does not serve, to choose
// an icon. A dozen bytes of inline script does the same job with no runtime.
//
// The visitor's own clock is also the better clock: "today" turns over at
// midnight where they are, not at midnight UTC.
//
// WHY THE SCHEME IS PICKED HERE TOO, AND NOT BY THE SVG. Every glyph carries an
// `@media (prefers-color-scheme: dark)` rule, and in Chrome and Firefox that is
// enough. Safari ignores it — WebKit bug 199134, open since 2019 and still NEW
// as of June 2026 — so a Safari visitor in dark mode would get the Estonian blue
// glyph on a dark tab strip, around 2.5:1, which is the one outcome the two
// colours exist to avoid. The fix is to stop asking the renderer: this script
// reads the preference itself and points the <link> at a file that is only ever
// one colour. scripts/gen-favicons.mjs writes both, `<slug>.svg` and
// `<slug>-dark.svg`.
//
// It also fixes a smaller thing everywhere else. Chrome resolves the media query
// once and does not re-run it, so switching the system theme leaves the old
// colour in the tab until a reload; re-pointing the <link> on a `change` event
// updates it in place.
//
// WHAT NO-JS GETS: public/favicon.svg, the composite of every portrait, wired
// up in a <noscript> in Base.astro. That one still leans on the media query,
// because with no script there is nothing to choose with — Chrome and Firefox
// get both schemes, Safari gets blue. That is the floor, and it only applies to
// a Safari user in dark mode with JavaScript off.
//
// The <noscript> is also deliberately the only <link rel=icon type=image/svg+xml>
// in the static markup — declare the composite unconditionally and a browser
// with JS on would fetch it, paint it, and then fetch today's glyph over the
// top, which is both a wasted request and a visible flicker in the tab.

import { FAVICON_GLYPHS } from "../data/favicons.ts";

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * How far to walk through the list per day.
 *
 * Not `random()`, and not `day % n` either. Picking independently at random
 * repeats and skips — with a dozen-odd glyphs you would see the same face two
 * days running about once a fortnight, while some portrait goes a month
 * unshown. Stepping by 1 covers the set evenly but reads as a rota: the same
 * faces in the same order, forever.
 *
 * A step COPRIME with the list length gives both. It is a full cycle — every
 * portrait appears exactly once before any repeats — but it lands far from
 * where it started each day, so the order reads as arbitrary. Starting the
 * search at n/φ is the standard low-discrepancy choice: the golden ratio is the
 * hardest number to approximate with a fraction, so it is the step least likely
 * to fall into a short visible pattern.
 */
function stride(n: number): number {
  const start = Math.max(1, Math.round(n / 1.618));
  for (let i = 0; i < n; i++) {
    const s = ((start + i - 1) % n) + 1;
    if (gcd(s, n) === 1) return s;
  }
  return 1;
}

/**
 * The picker, as source for an `is:inline` <script> in <head>.
 *
 * Everything it needs is baked in at build time — the list and the step — so it
 * is one date lookup, one media query and one appendChild, with no fetch and
 * nothing to await. It runs in <head> before the parser reaches <body>, which is
 * why the tab never shows anything but the day's face.
 *
 * `getTimezoneOffset()` converts the UTC epoch to a LOCAL day number: the value
 * is the minutes to add to local time to get UTC, so subtracting it shifts the
 * clock onto the visitor's wall time before the day is taken. `(x % n + n) % n`
 * guards the one case that would otherwise 404 — a device clock set before 1970
 * gives a negative day.
 *
 * The <link> is REPLACED on a scheme change rather than having its href
 * reassigned. Chrome re-fetches on either, but Safari has historically not
 * noticed an href mutated in place, and Safari is the browser this whole path
 * exists for; removing and re-appending is what every browser treats as a new
 * icon. `addEventListener` is feature-detected because the older
 * `addListener` spelling is all some still-shipping WebViews have, and a missing
 * listener only costs the live update, not the initial pick.
 */
export const FAVICON_PICKER = ((glyphs: readonly string[]) =>
  `(function(){` +
  `var g=${JSON.stringify(glyphs)},n=g.length,s=${stride(glyphs.length)},` +
  `t=new Date(),d=Math.floor((t.getTime()-t.getTimezoneOffset()*6e4)/864e5),` +
  `b="/favicons/"+g[((d*s%n)+n)%n],` +
  `m=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)"),l;` +
  `function p(){` +
  `if(l&&l.parentNode)l.parentNode.removeChild(l);` +
  `l=document.createElement("link");l.rel="icon";l.type="image/svg+xml";` +
  `l.href=b+(m&&m.matches?"-dark":"")+".svg";` +
  `document.head.appendChild(l)}` +
  `p();` +
  `if(m&&m.addEventListener)m.addEventListener("change",p);` +
  `})()`)(FAVICON_GLYPHS);

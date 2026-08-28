// A different portrait in the nav on every refresh.
//
// public/nav-morph.svg is one endless SMIL loop through every face in the set,
// and the nav renders it inside an <img>. That is deliberate — an <img> is the
// only way to keep ~200 KB of path data out of every page's markup — but it also
// seals the file off: no script of ours runs inside it, and no stylesheet of
// ours reaches it. The one thing still under the page's control is the bytes it
// is built from. So this fetches those bytes, rewrites a single attribute, and
// hands the result back to the same <img> as a blob.
//
// The rewrite is `begin="0s"` → `begin="-77s"`. The animation has
// repeatCount="indefinite", so a negative begin means "this loop started 77
// seconds ago" and the browser opens it already 77 seconds in. Pick an offset
// where a portrait is holding still and the mark opens on that portrait, at
// rest, with its full hold ahead of it. scripts/gen-favicons.mjs reads those
// offsets out of the animation's own schedule into src/data/nav-morph.ts.
//
// WHY A REWRITE AND NOT A SEEK. `svg.setCurrentTime()` does this in one line,
// but only on an SVG the page can reach into: inline, or in an <object>.
// Inlining puts the whole morph in the markup of every page, and an inline
// <svg>'s <style> is a real stylesheet — its bare `path { … }` rule would
// restyle every path in the document. An <object> contains that, but fetches
// regardless of `display: none`, so it would have to be script-inserted anyway;
// it buys nothing here and hands the SVG a script context it does not have now.
//
// WHY NOT ONE FILE PER STARTING FACE. That is the zero-JS answer, and the files
// differ by one attribute — ~200 KB apiece, some 3 MB of near-identical
// generated files committed, to save a fetch of a file the page downloads
// anyway.
//
// WHY NOT THE SERVER. Same answer as the favicon, and for the same reason: the
// site is `output: "static"` on a CDN, so a per-request rewrite means a Pages
// Function sitting in front of the asset — an invocation on every page view,
// on a route `astro dev` does not serve. See src/lib/favicon.ts.
//
// WHEN IT RUNS. Below 1024px the mark IS the home link, on screen from the
// first paint, so the upgrade happens immediately. Above it the mark is hidden
// behind the wordmark until someone hovers (see the reveal in chrome.css), so
// the fetch waits for that first hover — a desktop visitor who never points at
// the name never spends the ~22 KB, which is the same bargain the <picture>
// this replaced was making, just paid at a moment instead of a width. The
// listener fires on focus too, so a keyboard reveal is not left with the still.
//
// A NEW PORTRAIT EVERY TIME IT COMES OUT. The file is fetched once and kept as
// text; each reveal gets its own blob built from it with a fresh offset, so the
// mark is never twice the same face and never picks up mid-dissolve where it
// left off. The rebuild is triggered by the track finishing its collapse — a
// `transitionend` for `width` that lands on zero — and not by the hover that
// follows it. That ordering is the point: swapping an <img>'s src replaces what
// it is showing, and doing that on the way OUT would change the face in front of
// someone. Done on the way in, it happens behind the wordmark with a full second
// of hidden time before anyone sees the result, decode included.
//
// Re-entering mid-retreat therefore keeps the face it had, because the collapse
// never finished. That is the honest reading of it: the mark did not go away, so
// it did not come back.
//
// WHAT REDUCED MOTION AND NO-JS GET: whatever the <img> already has, which is
// public/nav-still.svg — the composite of every portrait, at nav weight. This
// script checks for `prefers-reduced-motion` and leaves it alone, so a visitor
// who asked not to see motion never downloads the morph at all. That check is
// the reason the still is the markup default: an outer stylesheet cannot stop
// SMIL inside an <img>, so not upgrading is the only way to honour the
// preference, and the file it declines to upgrade FROM has to be the one that
// is already correct. On desktop that visitor still gets the reveal — the mark
// arrives instead of sliding, and it is the composite rather than the morph.

import { MORPH_FRAME_OFFSETS } from "../data/nav-morph.ts";

/**
 * The upgrade, as source for an `is:inline` <script> beside the <img>.
 *
 * The width test duplicates the `@media (max-width: 1024px)` block in
 * chrome.css that shows the mark outright, and has to keep matching it — it is
 * the difference between fetching now and fetching on hover. Two places, both
 * commented, both pointing at SITE.features.navMorph.
 *
 * `t` is the fetched file, kept so a reveal costs a string join rather than a
 * request; `f` guards the fetch so pointerenter and focus — which one visitor
 * can easily trigger together — cannot start two of them.
 *
 * `p` is the blob URL currently on screen, revoked only once its REPLACEMENT has
 * loaded. Revoking on swap instead would pull the bytes out from under an image
 * the browser has not finished decoding.
 *
 * `c` is the portrait showing now, and the next pick is drawn uniformly from the
 * OTHER ones. Plain `Math.random()` hands back the same index about one reveal
 * in twenty, and the one thing a re-cast must never look like is not having
 * happened: the mark slides away and returns on the same face, and the feature
 * reads as broken rather than unlucky. Drawing from n-1 and stepping over the
 * current index keeps every other portrait equally likely — this is not the
 * favicon's full-cycle stride, because a reveal is a moment rather than a
 * rotation and nobody is owed a turn.
 *
 * Every capability it needs is tested first, and the fetch has a `catch`: on a
 * browser without Blob URLs, or an offline second visit, the nav keeps the still
 * rather than an empty box. Nothing here is awaited by anything else.
 */
export const NAV_MORPH_SCRIPT = ((offsets: readonly number[]) =>
  `(function(){` +
  `if(!window.matchMedia||!window.fetch||!window.URL||!URL.createObjectURL||!window.Blob)return;` +
  `if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;` +
  `var i=document.querySelector("img.nav-morph");if(!i)return;` +
  `var o=${JSON.stringify(offsets)},t=null,f=false,p=null,c=-1;` +
  // Build a fresh blob from the cached text, starting on a random portrait —
  // any of them the first time, any but the current one after that.
  `function s(){` +
  `var k=Math.floor(Math.random()*(o.length-(c<0?0:1)));` +
  `if(c>=0&&k>=c)k++;` +
  `c=k;` +
  `var b='begin="-'+o[k]+'s"',` +
  `n=URL.createObjectURL(new Blob([t.split('begin="0s"').join(b)],{type:"image/svg+xml"})),` +
  `q=p;p=n;` +
  `i.addEventListener("load",function(){if(q)URL.revokeObjectURL(q)},{once:true});` +
  `i.src=n}` +
  // Fetch once, then hand off to s() for this and every later reveal.
  `function e(){` +
  `if(t||f)return;f=true;` +
  `fetch("/nav-morph.svg").then(function(r){return r.text()}).then(function(x){t=x;s()})` +
  `.catch(function(){f=false})}` +
  `if(matchMedia("(max-width: 1024px)").matches){e();return}` +
  `var m=i.parentNode,a=m&&m.parentNode;if(!a)return;` +
  `a.addEventListener("pointerenter",e);a.addEventListener("focus",e,true);` +
  // The track has finished collapsing: out of sight, so re-cast it.
  `m.addEventListener("transitionend",function(v){` +
  `if(t&&v.target===m&&v.propertyName==="width"&&!parseFloat(getComputedStyle(m).width))s()` +
  `})` +
  `})()`)(MORPH_FRAME_OFFSETS);

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
// WHAT REDUCED MOTION AND NO-JS GET: whatever the <img> already has, which is
// public/nav-still.svg — the composite of every portrait, at nav weight. This
// script checks for `prefers-reduced-motion` and leaves it alone, so a visitor
// who asked not to see motion never downloads the morph at all. That check is
// the reason the still is the markup default rather than a <source>: an outer
// stylesheet cannot stop SMIL inside an <img>, so not upgrading is the only way
// to honour the preference, and the file it declines to upgrade FROM has to be
// the one that is already correct.

import { MORPH_FRAME_OFFSETS } from "../data/nav-morph.ts";

/**
 * The upgrade, as source for an `is:inline` <script> beside the <img>.
 *
 * The width test duplicates the `@media (max-width: 1024px)` block in
 * chrome.css that reveals the mark, and has to keep matching it: above that
 * width the mark is hidden and the morph must not be fetched. (The <picture>
 * beside this carries the same figure as its complement, 1025px. Three places,
 * all commented, all pointing at SITE.features.navMorph.)
 *
 * Every capability it needs is tested first, and the fetch has a `catch`: on a
 * browser without Blob URLs, or an offline second visit, the nav keeps the still
 * rather than an empty box. Nothing here is awaited by anything else.
 */
export const NAV_MORPH_SCRIPT = ((offsets: readonly number[]) =>
  `(function(){` +
  `if(!window.matchMedia||!window.fetch||!window.URL||!URL.createObjectURL||!window.Blob)return;` +
  `if(!matchMedia("(max-width: 1024px)").matches)return;` +
  `if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;` +
  `var i=document.querySelector("img.nav-morph");if(!i)return;` +
  `var o=${JSON.stringify(offsets)},` +
  `b='begin="-'+o[Math.floor(Math.random()*o.length)]+'s"';` +
  `fetch("/nav-morph.svg").then(function(r){return r.text()}).then(function(t){` +
  `var u=URL.createObjectURL(new Blob([t.split('begin="0s"').join(b)],{type:"image/svg+xml"}));` +
  `i.addEventListener("load",function(){URL.revokeObjectURL(u)},{once:true});` +
  `i.src=u` +
  `}).catch(function(){})` +
  `})()`)(MORPH_FRAME_OFFSETS);

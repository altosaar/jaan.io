// Generate the site's favicons from the bear artwork.
//
//   node scripts/gen-logo.mjs [path-to-bear.svg]
//
// The source is a vector of Nuna Parr's sculpture "Dancing Bear" (attribution
// lives in src/site.config.ts and renders in the footer).
//
// THE FAVICONS ARE THE ONLY PLACE THE MARK APPEARS. This script used to also
// emit src/components/Logo.astro for the header; the header now carries a plain
// wordmark, so that component is gone and nothing here writes into src/.
//
// The artwork is a solid silhouette: unclassed path(s) with no fill attribute,
// so they inherit the default black. Any internal openings are counter-wound
// subpaths within the same path, so the fill rule handles them — there is
// nothing to composite and no second colour to track.
//
// The one thing this script exists to prevent: an Illustrator re-export can
// arrive as a two-tone drawing instead — a <style> block of .cls-N fill rules
// where a full-canvas white PLATE is the classed path and the animal is the
// unclassed one. That reads as "the classed path is the body", which is
// backwards, and renders a pale square with a bear knocked out of it. If that
// shape ever comes back, the guard below stops the build rather than letting it
// ship, and `git log -- scripts/gen-logo.mjs` has the version that handled it.

import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const SRC =
  process.argv[2] ?? "/Users/me/Library/CloudStorage/Dropbox/design/260813-jaan.io-bear/bear.svg";

/** Estonian blue — the favicon's bear against light browser chrome. */
const FAVICON_INK = "#0030DE";

/**
 * The bear against dark browser chrome. #0030DE is a dark blue and measures
 * about 2.5:1 on a dark tab strip, so it fills in to a smudge at 16px; white is
 * legible on both but wrong on light chrome. An SVG favicon can carry its own
 * media query, so it picks per scheme rather than compromising on one colour.
 */
const FAVICON_INK_DARK = "#ffffff";

/**
 * Background for the APPLE TOUCH ICON only — the favicon itself is transparent.
 *
 * iOS does not honour transparency in a home-screen icon: it composites the
 * icon onto black, which would put #0030DE at roughly 2.5:1 and turn the bear
 * into a dark smudge on a dark tile. Every other icon here is transparent and
 * sits on whatever the browser's tab strip provides.
 */
const TOUCH_ICON_BG = "#ffffff";

const svg = readFileSync(SRC, "utf8");

const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
if (!viewBox) throw new Error(`${SRC}: no viewBox`);

if (/<style[\s>]/.test(svg) && /fill\s*:/.test(svg)) {
  throw new Error(
    `${SRC}: this export carries a <style> block with fill rules — the two-tone ` +
      `plate-and-bear shape, not the silhouette this script expects. Read the note at ` +
      `the top of scripts/gen-logo.mjs before changing anything.`,
  );
}

// Keep every path that actually paints. `fill="none"` slivers are trace leftovers.
const bear = [...svg.matchAll(/<path([^>]*?)\/>/g)]
  .filter((m) => !/fill="none"/.test(m[1]))
  .map((m) => m[1].match(/\sd="([^"]*)"/)?.[1])
  .filter(Boolean);

if (!bear.length) throw new Error(`${SRC}: no paintable <path> found`);
console.log(`${bear.length} path(s) → the bear silhouette`);

// ── The favicon ──────────────────────────────────────────────────────────────
// Transparent, so the bear sits on whatever the browser's tab strip provides,
// and scheme-aware: an SVG favicon carries its own <style>, and the media query
// resolves against the browser's theme. Fill comes from CSS rather than a
// `fill` attribute, because a presentation attribute would win over the rule
// and the dark case would silently never apply.
const faviconSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">` +
  `<style>` +
  `path{fill:${FAVICON_INK}}` +
  `@media(prefers-color-scheme:dark){path{fill:${FAVICON_INK_DARK}}}` +
  `</style>` +
  bear.map((d) => `<path d="${d}"/>`).join("") +
  `</svg>`;
writeFileSync("public/favicon.svg", faviconSvg + "\n");
console.log(`wrote public/favicon.svg (transparent, ${FAVICON_INK} / ${FAVICON_INK_DARK} dark)`);

// The PNG fallback cannot carry a media query, so it takes the light-scheme
// colour: it is only reached by clients too old for an SVG favicon, and those
// are far likelier to be on light chrome.
//
// Rasterised from an explicitly-filled copy rather than the file above —
// librsvg's handling of prefers-color-scheme is not something to depend on for
// a build artifact.
//
// `background` on resize is explicit rather than relied upon: sharp's SVG
// rasteriser defaults to a transparent canvas, but resize() fills any
// letterboxing with the background colour, and that default is black.
const faviconFlat =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">` +
  bear.map((d) => `<path fill="${FAVICON_INK}" d="${d}"/>`).join("") +
  `</svg>`;
await sharp(Buffer.from(faviconFlat), { density: 600 })
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile("public/favicon.png");
console.log("wrote public/favicon.png (transparent, light-scheme colour)");

// The touch icon keeps a solid background — see TOUCH_ICON_BG above.
const touchSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">` +
  `<rect width="100%" height="100%" fill="${TOUCH_ICON_BG}"/>` +
  bear.map((d) => `<path fill="${FAVICON_INK}" d="${d}"/>`).join("") +
  `</svg>`;
await sharp(Buffer.from(touchSvg), { density: 600 })
  .resize(180, 180)
  .png()
  .toFile("public/apple-touch-icon.png");
console.log(`wrote public/apple-touch-icon.png (on ${TOUCH_ICON_BG})`);

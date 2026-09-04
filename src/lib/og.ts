import { CARD, cardPath, PORTRAIT_PATH, PORTRAIT_SIZE } from "./og-card.mjs";

// Social share images (Open Graph / Twitter) for iMessage, WhatsApp, Slack, etc.
//
// THREE KINDS, in the order a page reaches for them:
//
//   1. Its own picture. A post names one as `ogImage` in its frontmatter; the
//      five that carried an `image.feature` banner on the Jekyll site do.
//      Rendered by Astro's Sharp service into the 1200 × 630 CARD.
//   2. Its mark, drawn on a card. Every post has a line-art `thumb`, and every
//      visualization has a generated SVG mark; scripts/gen-og-cards.mjs draws
//      each one large on the site's own black and writes public/og/**.png, so a
//      link to a specific piece previews as that piece rather than as the site.
//   3. The portrait below. Everything else — /about, /writing, /projects,
//      /images, the home page — shares one face.
//
// The upstream template picked the sitewide image from the photo gallery. On a
// personal site that should be the person, not a rotating photo from the
// portfolio: a link to jaan.io that previews as a stranger's portrait is
// confusing, and a share image that changes between builds makes previews
// inconsistent across the places a link has already been pasted. The eyes-open
// frame specifically: it is the resting frame of the home page's two-frame
// portrait, so a shared link previews as the face the page settles on.
//
// It is drawn by scripts/gen-og-cards.mjs, alongside the generated cards, and
// NOT by Astro's image service. That is a deliberate move: an imported asset
// handed to `getImage()` ships as /_astro/portrait-open.<hash>.jpeg, and a
// content hash in an og:image URL means every preview already cached by a
// crawler — in a thread, a DM, a tweet — starts 404ing the next time the image
// or the encoder settings change. PORTRAIT_PATH is fixed. The reasoning is
// written out in full beside it in og-card.mjs.
export const featured = {
  src: PORTRAIT_PATH,
  title: "Jaan Altosaar",
  // Used verbatim as <meta property="og:image:alt">.
  alt: "Jaan Altosaar, smiling in a floral shirt against blurred greenery.",
};

/**
 * The square the portrait is rendered into, per side.
 *
 * A square rather than the 1.91:1 Facebook documents: square previews LARGE in
 * iMessage, WhatsApp and Slack, which is where a link to a personal site
 * actually gets pasted, and the platforms that want a wider crop take one.
 *
 * Nothing requires the shape to be the same on every page — a crawler reads the
 * dimensions off each page's own tags, and pages here disagree about them on
 * purpose. The routes that carry a picture or a chart use CARD (og-card.mjs)
 * instead, where the width is what makes the picture readable; that argument
 * does not apply to a face.
 *
 * 1536 is the ceiling this source supports. portrait-open.webp is 1571×1600, so
 * a square crop cannot exceed 1571 without inventing pixels — and Astro's Sharp
 * service resizes `withoutEnlargement`, so asking for more would silently emit
 * something smaller than the og:image:width/height this file also feeds, which
 * is worse than asking for less. If the portrait is ever re-exported larger,
 * this can go up with it; there is headroom, since the largest thing any
 * platform stores is around 2048px.
 */
// Re-exported from og-card.mjs so the script that DRAWS the portrait and the
// tags that DESCRIBE it cannot disagree about its size — the same bargain
// CARD already makes for the generated cards.
export const OG_SIZE = PORTRAIT_SIZE;

/**
 * JPEG quality for the share images Astro renders — the portrait, and the five
 * posts that bring their own photograph.
 *
 * High, because these are fetched by a crawler once and then re-encoded by
 * every platform that shows them — whatever is handed over is the master they
 * degrade from, so artifacts baked in here survive into every preview. At 1536²
 * with the encoder settings in astro.config.mjs the portrait lands around
 * 550 KB, comfortably inside the tightest limit anyone publishes (Twitter and
 * LinkedIn both cap at 5 MB; Facebook at 8 MB), and a 1200 × 630 card is a
 * third of that.
 *
 * Quality 100 is not "better" here in any way that reaches a viewer: it triples
 * the file for detail no platform's own re-encode preserves.
 */
export const OG_QUALITY = 95;

/**
 * Everything <head> needs to describe one share image.
 *
 * Assembled per route and handed to Base.astro as its `share` prop. `type` is
 * spelled out rather than inferred from the extension, because it becomes
 * og:image:type and a crawler takes that at its word.
 */
export interface ShareImage {
  /** Root-relative or already absolute; Base.astro resolves it against `site`. */
  src: string;
  width: number;
  height: number;
  type: "image/jpeg" | "image/png";
  alt: string;
}

/**
 * The card generated from a post's `thumb` or a visualization's mark.
 *
 * Callers check the PNG exists before using this and fall back to the portrait
 * if it does not — which is the state of a fresh checkout where the cards have
 * not been generated, and of any checkout where `npm run viz` has not run. A
 * missing card must degrade to the portrait, never to a 404 in someone's
 * message thread.
 */
export const cardImage = (
  kind: "articles" | "visualizations",
  name: string,
  alt: string,
): ShareImage => ({
  src: cardPath(kind, name),
  width: CARD.width,
  height: CARD.height,
  type: "image/png",
  alt,
});

export { CARD, CARD_DIR, cardPath } from "./og-card.mjs";

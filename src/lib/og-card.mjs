// The generated share cards — the numbers, shared by the two things that must
// agree about them.
//
// PLAIN .mjs, AND THAT IS THE POINT. scripts/gen-og-cards.mjs draws the cards
// in Node with Sharp, and src/lib/og.ts writes the <meta> tags that describe
// them; if either invented its own dimensions, a crawler would lay out the card
// against numbers the file does not have. Its sibling og.ts cannot be the home
// for these, because it imports a .webp and so only resolves inside the Astro
// build. Nothing here imports anything, so both sides can read it.
//
// `npm run audit` measures the shipped PNGs against the shipped tags, so a
// drift between the two is a build failure rather than a broken preview.

/**
 * The 1.91:1 landscape card.
 *
 * 1200 × 630 is the size Facebook, LinkedIn and Slack all document, and it
 * clears Twitter's 2:1 summary_large_image comfortably. It is also the shape a
 * chart or a photograph actually needs — see the note on OG_SIZE in og.ts for
 * why the sitewide portrait is square instead.
 */
export const CARD = { width: 1200, height: 630 };

/**
 * The palette the cards are drawn in: `--bg` and `--text` from
 * src/styles/tokens.css.
 *
 * Copied rather than parsed out of the stylesheet — Sharp runs outside the
 * browser and has no cascade to resolve custom properties against. They are the
 * site's own black and its body ink, so a card reads as a piece of the page the
 * link goes to. The marks themselves carry no colour of their own: the
 * visualization SVGs are drawn entirely in `currentColor`, and the article
 * thumbs are black line art the site renders with `filter: invert(1)`
 * (see .article__mark in src/pages/articles.astro) — so both have to be told
 * what colour to be, and this is where they are told.
 */
export const CARD_INK = { bg: "#000000", fg: "#e2e2e2" };

/**
 * The box the mark is drawn inside, as a fraction of the card.
 *
 * ONE BOX FOR BOTH FAMILIES, and every mark is fitted INSIDE it — never cropped,
 * never stretched — so an 8:5 chart lands 768 × 454 and a square icon lands
 * 454 × 454 without either needing to know what the other is. What makes that
 * work is that gen-og-cards.mjs trims each mark to its own ink first: these
 * arrive with wildly different amounts of empty margin baked into their frames
 * (grethumb.png is 400 × 400 around a 245 × 200 drawing; the New York mark
 * carries the whole projection's bounding box around a city that occupies its
 * right half), and fitting an untrimmed mark means sizing and centring the
 * frame rather than the picture.
 *
 * The remaining ~18% margin is what stops a card reading as a cropped
 * screenshot. It is generous rather than tight because the marks are line art
 * with no padding of their own once trimmed.
 */
export const CARD_MARK = { width: 0.64, height: 0.72 };

/** Where the cards are written under public/, which is also their URL prefix. */
export const CARD_DIR = "/og";

/**
 * The URL of one generated card.
 *
 * `name` is a post's slug or a visualization's `thumb` basename — the key
 * gen-og-cards.mjs writes under. Keyed by the POST SLUG rather than by the
 * thumb's filename because a post's frontmatter names its thumb with a relative
 * path that Astro turns into an `ImageMetadata` with no way back to the
 * original file: the slug is the only stable identifier both sides can compute.
 */
export const cardPath = (kind, name) => `${CARD_DIR}/${kind}/${name}.png`;

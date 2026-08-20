import portrait from "../assets/portrait-open.webp";

// Social share image (Open Graph / Twitter) for iMessage, WhatsApp, Slack, etc.
//
// The upstream template picked this from the photo gallery. On a personal site
// the share image should be the person, not a rotating photo from the portfolio:
// a link to jaan.io that previews as a stranger's portrait is confusing, and a
// share image that changes between builds makes previews inconsistent across
// the places a link has already been pasted.
//
// Base.astro renders this through Sharp at OG_SIZE using `fit: "cover"` and
// `position: "attention"` (Sharp's saliency crop, which keeps the face in frame
// when squaring a non-square source). It is wired into <head> unconditionally
// and takes no prop, so every page on the site shares one share image; the SEO
// audit checks that this stays true.
// The eyes-open frame specifically: it is the resting frame of the home page's
// two-frame portrait, so a shared link previews as the face the page settles on.
export const featured = {
  image: portrait,
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
 * 1536 is the ceiling this source supports. portrait-open.webp is 1571×1600, so
 * a square crop cannot exceed 1571 without inventing pixels — and Astro's Sharp
 * service resizes `withoutEnlargement`, so asking for more would silently emit
 * something smaller than the og:image:width/height this file also feeds, which
 * is worse than asking for less. If the portrait is ever re-exported larger,
 * this can go up with it; there is headroom, since the largest thing any
 * platform stores is around 2048px.
 */
export const OG_SIZE = 1536;

/**
 * JPEG quality for the share card.
 *
 * High, because this is a single image fetched by a crawler once and then
 * re-encoded by every platform that shows it — whatever is handed over is the
 * master they degrade from, so artifacts baked in here survive into every
 * preview. At 1536² with the encoder settings in astro.config.mjs this lands
 * around 550 KB, comfortably inside the tightest limit anyone publishes
 * (Twitter and LinkedIn both cap at 5 MB; Facebook at 8 MB).
 *
 * Quality 100 is not "better" here in any way that reaches a viewer: it triples
 * the file for detail no platform's own re-encode preserves.
 */
export const OG_QUALITY = 95;

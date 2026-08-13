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
// when squaring a non-square source).
// The eyes-open frame specifically: it is the resting frame of the home page's
// two-frame portrait, so a shared link previews as the face the page settles on.
export const featured = {
  image: portrait,
  title: "Jaan Altosaar",
  // Used verbatim as <meta property="og:image:alt">.
  alt: "Jaan Altosaar, smiling in a floral shirt against blurred greenery.",
};

// 1200×1200 is the canonical high-res OG size and displays large on iMessage and
// WhatsApp.
export const OG_SIZE = 1200;

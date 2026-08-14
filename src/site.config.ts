// ─────────────────────────────────────────────────────────────────────────────
// SITE — everything that makes this site *this* site.
//
// This is the first file to edit when rebranding. Name, description, navigation,
// social links, structured data, and the on/off switches for the optional
// features all live here. Nothing below this file needs editing to rebrand: the
// layout, header, mobile menu, and footer all read from `SITE`.
//
// What is deliberately NOT here (it lives outside the Astro build):
//   • the canonical origin — `site:` in astro.config.mjs
//   • the sitemap line   — public/robots.txt
//   • colors, fonts, spacing — src/styles/tokens.css
//   • the favicons       — public/favicon.svg, favicon.png, apple-touch-icon.png
//     (the bear mark appears ONLY there; the header is a plain wordmark)
// ─────────────────────────────────────────────────────────────────────────────

/** A navigation or footer link. Set `external` to open in a new tab safely. */
export interface SiteLink {
  label: string;
  href: string;
  external?: boolean;
}

export const SITE = {
  // ── Identity ───────────────────────────────────────────────────────────────
  /** Used in <html lang> and as the base for the title template. */
  lang: "en",
  /** Open Graph locale, e.g. "en_US", "en_GB", "de_DE". */
  locale: "en_US",
  /** Appended to every page title as " | {name}" — see src/layouts/Base.astro. */
  name: "JAAN ALTOSAAR",
  /** Fallback <meta name="description"> for pages that don't set their own. */
  description: "Machine learning for health & science.",
  /** Browser UI tint on mobile. Usually --bg from tokens.css, or a shade of it. */
  themeColor: "#000000",

  // ── Fonts ──────────────────────────────────────────────────────────────────
  // Preloaded in <head>. Must match the @font-face src URLs in
  // src/styles/fonts.css — see the swap recipe at the top of that file.
  //
  // Only the files EVERY page needs belong here; a preload the page does not go
  // on to use is pure wasted bandwidth, and the browser warns about it.
  //   • HankenGrotesk-latin — the content face (--font-display, --font-body)
  //   • Inter — the chrome face (--font-chrome): nav, mobile menu, footer
  // Deliberately absent: HankenGrotesk-latin-ext, which its unicode-range
  // fetches only when an accented character actually appears, and Fraunces,
  // which no role token names any more.
  //
  // `npm run fonts:check` fails the build if this list and the roles disagree.
  fonts: ["/fonts/HankenGrotesk-latin.woff2", "/fonts/Inter.woff2"],

  // ── Navigation ─────────────────────────────────────────────────────────────
  // One source of truth. The header, the mobile menu, and the footer all read
  // from here, so adding a page means editing this block and nothing else.
  //
  nav: {
    /** Header links, shown to the right of the logo on desktop. */
    header: [
      { label: "Images", href: "/images" },
      { label: "About", href: "/about" },
    ] as SiteLink[],
    /**
     * The single emphasized header link, rendered as a button (.nav-btn in
     * src/styles/chrome.css, accent-filled by default).
     */
    headerCta: { label: "Articles", href: "/articles" } as SiteLink | null,

    /** Links inside the mobile slide-over menu. */
    mobile: [
      { label: "Images", href: "/images" },
      { label: "About", href: "/about" },
    ] as SiteLink[],
    /** The mobile menu's two call-to-action buttons. First is primary. */
    mobileCtas: [
      { label: "Articles", href: "/articles" },
      { label: "Get in touch", href: "mailto:j@jaan.io" },
    ] as SiteLink[],

    /** Footer link columns. Add or remove a column by adding or removing an array. */
    footer: [
      [
        { label: "Articles", href: "/articles" },
        { label: "Images", href: "/images" },
        { label: "About", href: "/about" },
      ],
    ] as SiteLink[][],
  },

  // ── The /about/ rail ───────────────────────────────────────────────────────
  // The tag rail in that page's left gutter (Toc.astro with `links` instead of
  // headings). Its own list rather than a slice of `social` below: the labels
  // are addressed to a reader mid-sentence ("email me", not "Email"), and it is
  // a deliberate shortlist — Flickr is in `social` and `sameAs` but not here.
  //
  // The X link keeps its twitter.com URL. It still resolves, it is the one
  // already asserted in `sameAs`, and rewriting a URL search engines have
  // associated with this person buys nothing.
  contact: [
    { label: "email me", href: "mailto:j@jaan.io" },
    { label: "github", href: "https://github.com/altosaar", external: true },
    { label: "linkedin", href: "https://www.linkedin.com/in/jaanaltosaar", external: true },
    { label: "x", href: "https://twitter.com/thejaan", external: true },
  ] as SiteLink[],

  // ── Social & contact ───────────────────────────────────────────────────────
  // Rendered as the footer's second column. Overlaps `sameAs` below on purpose:
  // this list is what humans click, `sameAs` is what search engines read.
  social: [
    { label: "Email", href: "mailto:j@jaan.io" },
    { label: "GitHub", href: "https://github.com/altosaar", external: true },
    { label: "Twitter", href: "https://twitter.com/thejaan", external: true },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/jaanaltosaar", external: true },
    { label: "Flickr", href: "https://www.flickr.com/photos/thejaan/", external: true },
  ] as SiteLink[],

  // ── Footer tail ────────────────────────────────────────────────────────────
  footer: {
    /** Legal/terms links, shown above the copyright. */
    legal: [] as SiteLink[],
    /** Rendered as "© {copyright} {current year}". */
    copyright: "Jaan Altosaar",
    /** Optional sign-off line. Set to "" to omit. */
    madeWith: "Brooklyn, New York",
    /**
     * Attribution for the bear artwork, which is now the FAVICON and nothing
     * else — the header carries a plain wordmark. The credit still belongs on
     * the site: the favicon is served on every page and shown in every tab.
     *
     * It renders in the footer, so it appears on every route except the home
     * page, whose single-screen composition drops the footer entirely (see
     * `footer` in src/layouts/Base.astro). Set to null to omit.
     */
    credit: {
      prefix: "Logo:",
      label: "Nuna Parr, Dancing Bear",
      href: "https://feheleyfinearts.com/themes-in-inuit-art-the-bear/",
    } as { prefix: string; label: string; href: string } | null,
  },

  // ── Structured data (JSON-LD) ──────────────────────────────────────────────
  // Emitted on every page by src/layouts/Base.astro so search and AI engines
  // know who publishes this site.
  schema: {
    /** schema.org type: "Organization", "NGO", "Person", "LocalBusiness", … */
    type: "Person",
    /** Path to the logo image used in structured data (absolutized at build). */
    logo: "/favicon.png",
    /** Optional — drop the line if the site isn't geographically scoped. */
    areaServed: "",
    /** Profile URLs that identify this same entity elsewhere. */
    sameAs: [
      "https://github.com/altosaar",
      "https://twitter.com/thejaan",
      "https://www.linkedin.com/in/jaanaltosaar",
      "https://www.flickr.com/photos/thejaan/",
      "https://www.onefact.org/",
    ],
  },

  // ── Feature switches ───────────────────────────────────────────────────────
  // Everything here can be turned off without touching any other file.
  features: {
    /**
     * The scrolling stats ticker across the top of the header.
     * Removed on this site — SiteHeader.astro no longer renders one and
     * src/data/stats.* was never copied over. Kept false for clarity.
     */
    ticker: false,
    /**
     * Shuffle the gallery into a new random order on every build.
     * Off (default) → items appear in the `order` set in each Markdown file.
     */
    randomizeGallery: false,
    /**
     * Pick a random gallery photo for the social share (Open Graph) image.
     * Off here: the share image is the portrait in src/lib/og.ts, not a
     * gallery photo, so this switch is inert. See that file.
     */
    randomizeOgImage: false,
  },
} as const;

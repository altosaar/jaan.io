import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
// Vendored, not an npm dependency — see the header of that file for why.
import deleteUnusedImages from "./src/integrations/delete-unused-images/index.js";

export default defineConfig({
  // Canonical production origin — used to build absolute URLs (e.g. the social
  // share image) at build time.
  site: "https://jaan.io",
  output: "static",
  // ── READ THIS BEFORE TOUCHING THESE TWO LINES ───────────────────────────────
  // The site serves slash-less URLs: /about, not /about/. Chosen deliberately
  // (2026-08-14) in the knowledge of what follows.
  //
  // WHAT THIS COSTS. jaan.io has served `permalink: /:title/` since 2013 and
  // earns 20–30k organic visits/month on those URLs. Every indexed URL ends in
  // a slash — https://jaan.io/what-is-variational-autoencoder-vae-tutorial/ —
  // and the live S3 bucket 302s the bare form TO the slashed form. This config
  // reverses that arrow, so at DNS cutover every ranking URL becomes a 301
  // source rather than a 200. That is survivable — Google follows 301s and
  // consolidates signals — but it is a real, one-way change to every URL the
  // site is known by, and it is why public/_redirects carries an explicit rule
  // instead of trusting the host to guess.
  //
  // WHAT MAKES IT SAFE. `format: "file"` emits about.html, which Cloudflare
  // Pages serves at /about; the redirect rule sends /about/ → /about with a
  // 301. @astrojs/sitemap reads `trailingSlash` from here, so the sitemap
  // follows automatically, and Base.astro's canonical builder strips the .html
  // so canonical, og:url, and sitemap all agree on the slash-less form.
  // `npm run audit` fails the build if any of them drift apart.
  trailingSlash: "never",
  build: { format: "file" },
  // Emits sitemap-index.xml + sitemap-0.xml from `site`, listing every static
  // route (testimonials aren't routes, so they're correctly absent). Referenced
  // from public/robots.txt.
  // sitemap first; the image pruner runs last (astro:build:done) so it scans the
  // fully-emitted dist. It only ever deletes from build.assets (_astro/) and only
  // image-extension files, keeping any whose hashed basename appears anywhere in
  // the scanned corpus — so referenced derivatives (and the getImage() og JPEG)
  // survive; only the unreferenced full-res originals Astro copies "just in case"
  // are removed. checkExtensions is widened past the .html/.css/.js default to
  // cover every reference surface (sitemap XML, JSON-LD/manifest) as insurance.
  integrations: [
    sitemap(),
    deleteUnusedImages({
      checkExtensions: [
        ".html",
        ".css",
        ".js",
        ".mjs",
        ".xml",
        ".svg",
        ".json",
        ".webmanifest",
        ".txt",
      ],
    }),
  ],
  // Math is rendered at BUILD time, not in the browser. The Jekyll site loaded
  // KaTeX 0.11 plus auto-render from a CDN and ran renderMathInElement over the
  // whole document on load — ~280KB of blocking JS and a visible flash of raw
  // "$\mathcal{L}$" before it swapped in. remark-math parses the delimiters and
  // rehype-katex emits the final HTML, so the shipped page has no math JS at all.
  //
  // remark-math treats single `$…$` as inline math, matching the old site's
  // configuration. That means a lone `$` in prose ("$300k+") becomes math — see
  // the note at the top of each ported post.
  // `markdown.processor` rather than the older top-level markdown.remarkPlugins /
  // rehypePlugins / smartypants keys — those are deprecated in Astro 6 and print
  // a warning on every build.
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
      // smartypants restores the punctuation kramdown applied on the old site.
      // dashes:"oldschool" is required, not cosmetic: the default only maps
      // `--` to an em dash and leaves `---` untouched, which is the exact
      // sequence these posts use ("a simple model of magnets---the Ising
      // model---"). oldschool gives kramdown's mapping — `---` em, `--` en.
      smartypants: { dashes: "oldschool" },
    }),
  },
  server: {
    host: true,
  },
  image: { responsiveStyles: true },
});

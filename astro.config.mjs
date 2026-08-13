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
  // ── DO NOT CHANGE WITHOUT READING THIS ──────────────────────────────────────
  // jaan.io has served `permalink: /:title/` since 2013 and earns 20–30k organic
  // visits/month on those URLs. Every indexed URL ends in a slash
  // (https://jaan.io/what-is-variational-autoencoder-vae-tutorial/), and the old
  // S3 bucket 302s the bare form to the slashed form.
  //
  // The template this design came from used `trailingSlash: "never"` +
  // `format: "file"`. Inheriting that would have silently changed the canonical
  // URL of every ranking page. `format: "directory"` emits slug/index.html so
  // the live URLs are reproduced byte-for-byte, and @astrojs/sitemap reads
  // `trailingSlash` from here, so the sitemap matches automatically.
  trailingSlash: "always",
  build: { format: "directory" },
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

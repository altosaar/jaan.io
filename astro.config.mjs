import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeMermaid from "./src/lib/rehype-mermaid.mjs";
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
    // ```mermaid IS NOT HIGHLIGHTED, IT IS RENDERED. Shiki runs before any user
    // rehype plugin in @astrojs/markdown-remark's pipeline, so without this
    // exclusion src/lib/rehype-mermaid.mjs would be handed a tree of coloured
    // <span>s and would have to reassemble the diagram source out of them.
    // Excluded, the fence reaches it as one text node.
    //
    // `syntaxHighlight` stays at the top level rather than moving inside
    // `processor` below: unified() carries the plugin lists and the typography
    // switches, and everything else — this, and shikiConfig — is still read
    // from here. "math" is the built-in default and has to be restated, since
    // naming the key replaces the list rather than adding to it.
    syntaxHighlight: { type: "shiki", excludeLangs: ["math", "mermaid"] },
    processor: unified({
      remarkPlugins: [remarkMath],
      // Order matters between these two only in that they never see the same
      // node: rehype-katex rewrites the spans remark-math produced, and
      // rehype-mermaid rewrites a code fence, which remark-math is not allowed
      // to look inside. That is the reason the diagram is a FENCE and not raw
      // HTML — it is nothing but dollar signs ("$60", "$3,000", "$200M") and
      // this site parses single `$…$` as inline maths.
      rehypePlugins: [rehypeKatex, rehypeMermaid],
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
  image: {
    responsiveStyles: true,
    // Encoder settings for the built-in Sharp service. Astro only lets a
    // component pass `quality` through getImage()/<Image>; everything else about
    // the encode is set here, once, and spread into Sharp's options for that
    // format (a per-call `quality` still wins over anything named here).
    //
    // The JPEG block exists for ONE image: the Open Graph share card, which is
    // the only thing on the site Sharp emits as JPEG — the gallery is all WebP,
    // and dist/images/*.jpg are copied verbatim out of public/. Both settings
    // matter for a photograph of a face:
    //
    //   chromaSubsampling  Sharp defaults to 4:2:0, which stores colour at half
    //                      resolution in both axes, and it does NOT switch off
    //                      automatically at high quality. On this portrait —
    //                      saturated florals against dark green — 4:2:0 smears
    //                      the colour edges. Turning it off is worth about
    //                      1.2 dB PSNR, more than the jump from quality 80 to 90.
    //   mozjpeg            Better trellis quantisation: at a fixed quality it is
    //                      both smaller and closer to the source than libjpeg.
    //                      Slower, which is irrelevant for one image per build.
    service: {
      entrypoint: "astro/assets/services/sharp",
      config: { jpeg: { chromaSubsampling: "4:4:4", mozjpeg: true } },
    },
  },
});

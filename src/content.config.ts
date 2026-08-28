import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

// Non-empty, whitespace-trimmed string — so a blank CMS field fails the build
// loudly instead of shipping empty text. The message names the offending field.
const filled = (field: string) => z.string().trim().min(1, `${field} must not be empty`);

// Long-form pages (about, papers, consulting, …). Each is a Markdown file in
// src/content/pages/ — the filename is the URL (about.md → /about/). `title` is
// the short, page-specific part only; Base.astro appends " | Jaan Altosaar" so
// the site name + separator live in one place.
const pages = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/pages" }),
  schema: z.object({
    title: filled("title"),
    description: filled("description"),
    navMode: z.enum(["ticker", "static"]).default("static"),
  }),
});

// Blog posts. THE FILENAME IS THE URL and those URLs are load-bearing: jaan.io
// has served them since 2013 and they carry the site's organic search traffic.
// A rename is a redirect, not a rename. Case is significant too — see below.
const posts = defineCollection({
  loader: glob({
    pattern: "*.md",
    base: "./src/content/posts",
    // Use the filename verbatim as the id. The default generateId slugifies,
    // which lowercases, and several of the old Jekyll slugs carry capitals
    // (an "…-AI" suffix, for one). Lowercasing them produces a URL that builds
    // and looks right while 404-ing against the one Google has indexed —
    // a silent failure. Jekyll's `:title` preserved case, so this must too.
    generateId: ({ entry }) => entry.replace(/\.md$/, ""),
  }),
  schema: ({ image }) =>
    z
      .object({
        title: filled("title"),
        description: filled("description"),
        // Original publication date. Preserved from the Jekyll `_posts/` filename
        // so the feed and any future archive keep their historical order.
        //
        // Orders /writing, and is printed as a bare YEAR under each article's
        // own headline (src/pages/[slug].astro). The full date rides along in the
        // <time datetime> attribute, so machines still get the day.
        date: z.coerce.date(),
        // When the post was last MEANINGFULLY revised — a correction, a new
        // section, a rewritten passage. Optional, and deliberately not derived
        // from git or from the file's mtime.
        //
        // Not derived, because every one of these files has been touched in
        // 2026 by the port: share images added, marks wired up, SEO warnings
        // cleared. None of that is something a reader would find if they came
        // back. A date stamped from mtime would say "there is something new
        // here" on nine posts and be telling the truth about two, which is a
        // worse signal than no date at all — the point of showing it is that it
        // can be trusted.
        //
        // So it is set by hand, and only when a reader would notice. It is
        // shown beside the year on the post (src/pages/[slug].astro) and
        // becomes <updated> in the Atom feed (src/pages/feed.xml.ts), which is
        // what tells a feed reader to resurface the piece.
        updated: z.coerce.date().optional(),
        // The little line-art mark beside the post in the /writing list, carried
        // over from the Jekyll site's `image.thumb`. Optional: a post without one
        // simply lists without a mark (see writing.astro), which is better than
        // blocking a new post on commissioning an icon.
        //
        // TRIM IT TO ITS INK BEFORE COMMITTING IT. Every mark on the site is
        // drawn inside a fixed box (src/components/IndexMark.astro) and scaled to
        // fit, so any transparent margin left in the file is margin INSIDE that
        // box, and the mark reads small next to one that has none. The set these
        // arrived as ran from 27% to 65% of its own frame and the /writing
        // column looked accordingly ragged. Nothing checks this, because it is a
        // property of the artwork rather than of the markup:
        //
        //   npx sharp-cli --input thumb.png --output thumb.png trim
        //
        // It is ALSO this post's share image when `ogImage` below is not set:
        // scripts/gen-og-cards.mjs draws it large on the site's black and
        // [slug].astro points og:image at the result. So a post with a mark and no
        // photograph still previews as itself rather than as the site.
        thumb: image().optional(),
        // The picture a link to this post previews as, in iMessage, WhatsApp,
        // Slack, Facebook, LinkedIn — anywhere the URL gets pasted.
        //
        // The Jekyll site's `image.feature`, which was only ever a CSS background
        // behind the headline (the og tags in _includes/head.html were commented
        // out, so the old site had no share image at all). The five posts whose
        // banner survives at a usable resolution now name it here; the rest fall
        // back to their `thumb` on a card, and a post with neither falls back to
        // the portrait. See src/lib/og.ts for the whole ladder.
        //
        // Cropped to 1200 × 630 with Sharp's saliency crop, so anything roughly
        // landscape works and nothing has to be pre-cut to fit.
        ogImage: image().optional(),
        // Alt text for it. REQUIRED whenever ogImage is set — see the refine
        // below. It becomes og:image:alt, which is what a screen reader announces
        // in place of the preview and is the one part of a share card that is not
        // decorative.
        ogImageAlt: filled("ogImageAlt").optional(),
      })
      // Enforced here rather than in the layout, because the layout's only options
      // would be to ship an unlabelled card or to fail at render time on a page
      // that looks fine. This fails at content-load with the file named.
      .refine((post) => !post.ogImage || post.ogImageAlt, {
        message: "a post with `ogImage` must also set `ogImageAlt` — it becomes og:image:alt",
        path: ["ogImageAlt"],
      }),
});

export const collections = { pages, posts };

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
    z.object({
      title: filled("title"),
      description: filled("description"),
      // Original publication date. Preserved from the Jekyll `_posts/` filename
      // so the feed and any future archive keep their historical order.
      //
      // Orders /articles, and is printed as a bare YEAR under each article's
      // own headline (src/pages/[slug].astro). The full date rides along in the
      // <time datetime> attribute, so machines still get the day.
      date: z.coerce.date(),
      // The little line-art mark beside the post in the /articles list, carried
      // over from the Jekyll site's `image.thumb`. Optional: a post without one
      // simply lists without a mark (see articles.astro), which is better than
      // blocking a new post on commissioning an icon.
      thumb: image().optional(),
    }),
});

export const collections = { pages, posts };

import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

// Non-empty, whitespace-trimmed string — so a blank CMS field fails the build
// loudly instead of shipping empty text. The message names the offending field.
const filled = (field: string) => z.string().trim().min(1, `${field} must not be empty`);

// An optional text field where "present but blank" is treated as absent, so a
// bare `caption:` line left behind by a hand edit is not a build error.
const optionalText = z.preprocess(
  (value) =>
    value == null || (typeof value === "string" && value.trim() === "") ? undefined : value,
  z.string().trim().min(1).optional(),
);

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
  schema: z.object({
    title: filled("title"),
    description: filled("description"),
    // Original publication date. Preserved from the Jekyll `_posts/` filename
    // so the feed and any future archive keep their historical order.
    date: z.coerce.date(),
  }),
});

// The photo gallery shown in the carousel (Carousel.astro). One Markdown file
// per photo.
//
// `alt` is required and authored per photo. Alt text describes THIS image to
// someone who can't see it, so it can't be generated from a title — write what
// is in the frame, and don't start with "Image of".
//
// `title` and `caption` are OPTIONAL here (the upstream template required
// both). This is a portrait series: the people in these frames are private
// individuals, not case studies, and inventing names or captions for them would
// be worse than showing the photograph on its own. Carousel.astro renders the
// caption block only when at least one of the two is present.
const gallery = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/gallery" }),
  schema: ({ image }) =>
    z.object({
      title: optionalText,
      caption: optionalText,
      alt: filled("alt"),
      // Optional CSS object-position for the cropped photo, e.g. "50% 30%".
      // Absent, empty, or blank all mean "centered" (Carousel.astro falls back
      // to "50% 50%").
      focusPosition: z.preprocess(
        (value) =>
          value == null || (typeof value === "string" && value.trim() === "") ? undefined : value,
        z
          .string()
          .trim()
          .regex(
            /^\d{1,3}% \d{1,3}%$/,
            'Photo focus must be blank, or two percentages like "50% 30%" (horizontal then vertical).',
          )
          .optional(),
      ),
      image: image(),
      // Lower numbers sort first; the 2nd entry is the default carousel highlight.
      order: z.number().int().nonnegative().default(100),
    }),
});

export const collections = { pages, posts, gallery };

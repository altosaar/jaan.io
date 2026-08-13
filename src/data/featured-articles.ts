// The articles featured on the home page, in the order they appear.
//
// This is a hand-curated list, not "the N most recent posts": the home page is
// the one place worth choosing what someone reads first, and publication date is
// a poor proxy for that. Reordering this array reorders the grid.
//
// Each `blurb` is written FOR THE HOME PAGE and is deliberately separate from
// the post's own `description` frontmatter. That field is the meta description —
// it is written for search results and link previews, has to stand alone out of
// context, and is length-constrained. These are a sentence of invitation to a
// reader already on the page, so they get their own voice.
//
// `slug` is the post's filename without `.md`, which is also its URL. It is
// checked against the posts collection at build time in src/pages/index.astro,
// so a typo or a renamed post fails the build rather than shipping a dead card.

export interface FeaturedArticle {
  /** Filename of a post in src/content/posts, without the `.md`. */
  slug: string;
  /** One or two sentences shown under the title on the home page. */
  blurb: string;
}

export const FEATURED_ARTICLES: FeaturedArticle[] = [
  {
    slug: "what-is-variational-autoencoder-vae-tutorial",
    blurb:
      "Deep learning and probability describe the same model in two different vocabularies. This walks through both — encoder and decoder, then inference and likelihood — until the translation is obvious.",
  },
  {
    slug: "how-does-physics-connect-machine-learning",
    blurb:
      "A lattice of magnets, solved twice: once with physics intuition, once with the variational principle. The second route is the one that scales to modern inference.",
  },
  {
    slug: "food2vec-augmented-cooking-machine-intelligence",
    blurb:
      "What happens when you train word embeddings on recipes instead of sentences. Ingredients that cook well together end up near each other — explore the map and see which cuisines overlap.",
  },
];

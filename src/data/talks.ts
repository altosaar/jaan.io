// The /talks index, newest first.
//
// Ported from the Jekyll site's _data/talks.yml, rendered by _layouts/talks.html.
// Three entries, and all three are slide decks for papers that also appear on
// /papers — which is not duplication to collapse. The papers page answers "what
// did this person write"; this one answers "where has this person been asked to
// speak", and those are different claims. The old site made both and kept both
// URLs, so both are kept here.
//
// The decks themselves are in public/talks/, at the filenames the Jekyll site
// served them under, because those URLs are live and linked from elsewhere.
import type { ImageMetadata } from "astro";

import proximity from "../assets/papers/talk-proximity.png";
import operator from "../assets/papers/talk-operator.png";
// The food2vec mark is already in the repo as an article thumb — it is the mark
// on the food2vec post — so it is imported from there rather than copied to a
// second filename that would then have to be kept in step with the first.
import food2vec from "../assets/thumbs/food2vec-icon.png";

export interface Talk {
  /** Stable id. Names the entry's anchor, so /talks#food2vec links to one talk. */
  slug: string;
  title: string;
  /** Filename in public/talks/. */
  slides: string;
  /** Of the first time it was given — the list is ordered by this. */
  year: number;
  /**
   * Where it was given. Inline HTML, rendered with `set:html`; the old site
   * wrote these as Markdown and ran them through Liquid's `markdownify` for the
   * sake of the links. Authored source, like the rest of this file.
   */
  where: string;
  mark: ImageMetadata;
}

export const TALKS: Talk[] = [
  {
    slug: "proximity-variational-inference",
    title: "Proximity Variational Inference",
    slides: "2017_Altosaar_Proximity-Variational-Inference_slides.pdf",
    year: 2017,
    where:
      'Imperial College London <a href="https://wp.doc.ic.ac.uk/sml/">Statistical Machine Learning Group</a>, NIPS <a href="https://approximateinference.org/">Approximate Inference Workshop</a> Spotlight, <a href="https://intelligence.org/colloquium-series/">Machine Intelligence Research Institute</a>, and Bloomberg <a href="https://www.techatbloomberg.com/post-topic/data-science/">Machine Learning Group</a>.',
    mark: proximity,
  },
  {
    slug: "food2vec",
    title: "food2vec — Augmented Cooking with Machine Intelligence",
    slides: "2017_Altosaar_food2vec_slides.pdf",
    year: 2017,
    where:
      'Invited talks at <a href="https://www.nytimes.com/">The New York Times</a> and <a href="https://barabasi.com/">Northeastern University</a>.',
    mark: food2vec,
  },
  {
    slug: "operator-variational-inference",
    title: "Operator Variational Inference",
    slides: "2016_Altosaar_Operator-Variational-Inference-Imperial_slides.pdf",
    year: 2016,
    // The Machine Learning Group is NOT a link. Its site
    // (wp.doc.ic.ac.uk/mlg/) now bounces the public to a WordPress login, so
    // the link went to a password prompt rather than to the group. The name is
    // still the fact worth stating, so the name stays and the link goes.
    where: "Imperial College London, Machine Learning Group.",
    mark: operator,
  },
];

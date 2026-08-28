// The /papers index, newest first.
//
// Ported from the Jekyll site's `_papers/` collection, one Markdown file per
// paper, rendered by _layouts/papers.html. A .ts file rather than a content
// collection for the same reason src/data/projects.ts is one: a collection in
// src/content/ is for things with a BODY, and none of these has one. Every
// field below was frontmatter on the old site.
//
// WHAT IS NOT HERE:
//
//   • The BibTeX. It lives in src/data/bibtex/<slug>.bib and is read by
//     src/pages/papers.astro. Not because it is large, but because it does not
//     survive being a JavaScript string: the spin-ice entry's title contains
//     `${\mathrm{Dy}}_{2}…`, and in a template literal `${` opens an
//     interpolation while `\m` collapses to `m`. The failure is silent — the
//     file parses, and the citation someone pastes into their own paper comes
//     out subtly wrong. A .bib file is also what the reader is being handed, so
//     it may as well be what is stored.
//
//   • The PDFs. public/papers/ and public/talks/, at the filenames the Jekyll
//     site served them under, because those URLs are live and linked from
//     elsewhere. `pdf` and `slides` below are filenames within those folders.
//
// ── SIX THINGS FIXED IN THE PORT ─────────────────────────────────────────────
// All six were live bugs on jaan.io, not decisions to preserve. The last two
// are link rot rather than typos, and both were verified against the servers
// rather than assumed — the details are at the entries themselves:
//
//   1. `representations` pointed its PDF at whitney-2020-evaluatiing-… — three
//      i's. The file has always been spelled correctly, so that link 404'd.
//   2. `operator-variational-inference` carried CoFactor's ACM id as its `link`
//      (…citation.cfm?id=2959182), so "URL" on the Operator VI entry opened a
//      different paper. Replaced with the NIPS proceedings URL its own BibTeX
//      already gave.
//   3. `proximity-variational-inference` carried Noisin's slides as its own
//      (adjidieng.github.io/Papers/noisin_slides.pdf). The real ones were
//      sitting unlinked in talks/; they are linked now. Noisin's entry keeps
//      that URL, where it is correct.
//   4. Slides were written three different ways — a bare filename, a rooted
//      /talks/… path, and an absolute URL — and the template prefixed "/talks/"
//      to all of them, producing /talks//talks/… and /talks/https://…. `slides`
//      is now always a filename in public/talks/ and `slidesUrl` always an
//      external link, so the two cannot be confused.
//   5. `thesis` carried a ProQuest URL in its `arxiv` field, which both labelled
//      the link wrongly and pointed at a host ProQuest has since retired.
//   6. `word-embedding-music` linked a Google Slides deck that has been deleted.
//
// Every remaining external link on this page and on /talks was checked; the
// rest answer, including several that return 401/403 to a script because they
// block robots. Those are left alone.

import type { ImageMetadata } from "astro";

import fishMusic from "../assets/papers/fish-music.png";
import musicmapper from "../assets/papers/musicmapper.png";
import correlatedLda from "../assets/papers/correlated-lda.png";
import spinIce from "../assets/papers/spin-ice.png";
import wordEmbeddingMusic from "../assets/papers/word-embedding-music.png";
import cofactor from "../assets/papers/cofactor.png";
import operatorVi from "../assets/papers/operator-variational-inference.png";
import proximityVi from "../assets/papers/proximity-variational-inference.png";
import noisin from "../assets/papers/noisin.png";
import clinicalbert from "../assets/papers/clinicalbert.png";
import thesis from "../assets/papers/thesis.png";
import representations from "../assets/papers/representations.png";
import recommending from "../assets/papers/recommending-interesting-writing.png";
import rankfromsets from "../assets/papers/rankfromsets.png";

export interface Paper {
  /**
   * Stable id. Names the mark in src/assets/papers/, the BibTeX in
   * src/data/bibtex/, and the entry's anchor on the page — so /papers#noisin
   * links to one paper.
   */
  slug: string;
  title: string;
  /** Author list as printed, in the order the paper prints it. */
  authors: string;
  /** Journal, conference or workshop, as it should read in a citation. */
  venue: string;
  year: number;
  /**
   * One line, in the first person the old site used: what question the paper
   * asks, not what it achieved. This is the sentence someone skimming reads.
   */
  blurb: string;
  /**
   * Anything that happened AROUND the paper — press, invited talks, a front
   * page. Optional, and absent on most.
   *
   * Inline HTML, rendered with `set:html`. The old site ran this field through
   * Liquid's `markdownify` for the sake of the links in it; the links are
   * written as anchors here instead, which is one less thing in the pipeline.
   * Safe because this file is authored source — the same trust as the rest of
   * the repo — and it is worth being explicit that nothing in it comes from
   * anywhere else.
   */
  note?: string;
  /** Filename in public/papers/. */
  pdf?: string;
  /** The publisher's page for the paper. */
  link?: string;
  arxiv?: string;
  doi?: string;
  code?: string;
  /** Filename in public/talks/ — slides hosted here. */
  slides?: string;
  /** Slides hosted somewhere else. Mutually exclusive with `slides`. */
  slidesUrl?: string;
  /** A recorded talk about the paper. */
  talk?: string;
  /** Something running that you can go and use. */
  demo?: string;
  mark: ImageMetadata;
}

export const PAPERS: Paper[] = [
  {
    slug: "rankfromsets",
    title: "RankFromSets: Scalable Set Recommendation with Optimal Recall",
    authors: "J. Altosaar, R. Ranganath, and W. Tansey",
    venue: "Stat",
    year: 2021,
    blurb:
      "A recommendation modeling framework applied to food recommendation and recommending arXiv papers.",
    note: 'Press: <a href="https://blogs.cuit.columbia.edu/postdocsociety/2021/06/16/the-hungry-algorithm/">Columbia University Postdoc Society Blog</a>',
    pdf: "altosaar-2021-rankfromsets-scalable-set-recommendation-with-optimal-recall.pdf",
    link: "https://onlinelibrary.wiley.com/doi/full/10.1002/sta4.363",
    doi: "https://doi.org/10.1002/sta4.363",
    code: "https://github.com/altosaar/rankfromsets",
    mark: rankfromsets,
  },
  {
    slug: "recommending-interesting-writing",
    title:
      "Recommending Interesting Writing using a Controllable, Explanation-Aware Visual Interface",
    authors: "R. Bansal, J. Olmstead, U. Bram, R. Cottrell, G. Reder, J. Altosaar",
    venue:
      "Workshop on Interfaces and Human Decision Making for Recommender Systems, ACM Conference on Recommender Systems",
    year: 2020,
    blurb: "Recommendation system for longform journalism deployed on the AWS Lambda free tier.",
    pdf: "bansal-2020-recommending-interesting-writing-using-a-controllable-explanation-aware-visual-interface.pdf",
    link: "https://ceur-ws.org/Vol-2682/short2.pdf",
    code: "https://github.com/the-browser/recommending-interesting-writing",
    demo: "https://the-browser.github.io/recommending-interesting-writing/",
    talk: "https://www.youtube.com/watch?t=8974&v=6uO2KwjCgXE",
    mark: recommending,
  },
  {
    slug: "representations",
    title: "Evaluating representations by the complexity of learning low-loss predictors",
    authors: "W. F. Whitney, M. J. Song, D. Brandfonbrener, J. Altosaar, K. Cho",
    venue: "arXiv",
    year: 2020,
    blurb: "A framework to compare pre-trained representations for downstream tasks.",
    // Spelled correctly — see fix 1 at the top of this file.
    pdf: "whitney-2020-evaluating-representations-by-the-complexity-of-learning-low-loss-predictors.pdf",
    arxiv: "https://arxiv.org/abs/2009.07368",
    code: "https://github.com/willwhitney/reprieve",
    mark: representations,
  },
  {
    slug: "thesis",
    title:
      "Probabilistic Modeling of Structure in Science: Statistical Physics to Recommender Systems",
    authors: "J. Altosaar",
    venue: "Ph.D. Thesis, Princeton University",
    year: 2020,
    blurb: "It is time to go to the hooding.",
    pdf: "altosaar-2020-thesis.pdf",
    link: "https://arks.princeton.edu/ark:/88435/dsp0170795b57k",
    // No `arxiv`. The old site put a ProQuest URL in that field
    // (pqdtopen.proquest.com/doc/2429005276.html), which rendered a link
    // labelled "arXiv" that went somewhere else — and ProQuest has since
    // retired that host, which now answers 521. A thesis has no arXiv entry;
    // the PDF above and the Princeton ARK are the two places to get it.
    code: "https://github.com/altosaar/thesis",
    slides: "altosaar-2020-thesis-slides-probabilistic-modeling-of-structure-science.pdf",
    mark: thesis,
  },
  {
    slug: "clinicalbert",
    title: "ClinicalBERT: Modeling Clinical Notes and Predicting Hospital Readmission",
    authors: "K. Huang, J. Altosaar, R. Ranganath",
    venue: "ACM Conference on Health, Inference, and Learning",
    year: 2020,
    blurb: "Using language models to predict hospital readmission.",
    note: 'Press: <a href="https://venturebeat.com/2019/04/11/ai-predicts-hospital-readmission-rates-from-clinical-notes/">VentureBeat</a>',
    pdf: "huang-2020-clinicalbert.pdf",
    arxiv: "https://arxiv.org/abs/1904.05342",
    mark: clinicalbert,
  },
  {
    slug: "noisin",
    title: "Noisin: Unbiased Regularization for Recurrent Neural Networks",
    authors: "A. Dieng, R. Ranganath, J. Altosaar, D. Blei",
    venue: "ICML",
    year: 2018,
    blurb: "You dropout, we noisin'.",
    pdf: "2018_icml_dieng-ranganath-altosaar-blei_noisin.pdf",
    link: "https://proceedings.mlr.press/v80/dieng18a.html",
    arxiv: "https://arxiv.org/abs/1805.01500",
    slidesUrl: "https://adjidieng.github.io/Papers/noisin_slides.pdf",
    mark: noisin,
  },
  {
    slug: "proximity-variational-inference",
    title: "Proximity Variational Inference",
    authors: "J. Altosaar, R. Ranganath, D. Blei",
    venue: "AISTATS",
    year: 2018,
    blurb: "Preventing poor local optima in variational inference.",
    note: "Invited talks at Imperial College London, NIPS Approximate Inference Workshop Spotlight, Machine Intelligence Research Institute, and Bloomberg Machine Learning Group.",
    pdf: "2018_aistats_altosaar-ranganath-blei_proximity-variational-inference.pdf",
    link: "https://proceedings.mlr.press/v84/altosaar18a.html",
    arxiv: "https://arxiv.org/abs/1705.08931",
    code: "https://github.com/altosaar/proximity_vi",
    // Its own slides — see fix 3 at the top of this file.
    slides: "2017_Altosaar_Proximity-Variational-Inference_slides.pdf",
    mark: proximityVi,
  },
  {
    slug: "operator-variational-inference",
    title: "Operator Variational Inference",
    authors: "R. Ranganath, J. Altosaar, D. Tran, D. Blei",
    venue: "NIPS",
    year: 2016,
    blurb: "New divergences for variational inference.",
    pdf: "2016_Ranganath-Altosaar-Tran-Blei_OperatorVI.pdf",
    // The NIPS proceedings, not CoFactor's — see fix 2 at the top of this file.
    link: "https://dl.acm.org/citation.cfm?id=3157096.3157152",
    arxiv: "https://arxiv.org/abs/1610.09033",
    slides: "2016_Altosaar_Operator-Variational-Inference-Imperial_slides.pdf",
    mark: operatorVi,
  },
  {
    slug: "cofactor",
    title: "Factorization meets the item embedding",
    authors: "D. Liang, J. Altosaar, L. Charlin, and D. Blei",
    venue: "Recommender Systems",
    year: 2016,
    blurb: "Word embeddings for recommender systems.",
    pdf: "2016_Liang-Altosaar-Charlin-Blei_CoFactor.pdf",
    link: "https://dl.acm.org/citation.cfm?id=2959182",
    code: "https://github.com/dawenl/cofactor",
    talk: "https://www.youtube.com/watch?v=jE-IwDxFhAA",
    mark: cofactor,
  },
  {
    slug: "word-embedding-music",
    title:
      "Word embedding models applied to classical music recover the circle of fifths in embedding space",
    authors: "E. Bell, J. Altosaar",
    venue: "ICML Music Discovery Workshop",
    year: 2016,
    blurb: "Word embeddings applied to classical music.",
    pdf: "2016_Bell-Altosaar_word2vec-Music.pdf",
    link: "https://sites.google.com/site/ml4md2016/program",
    code: "https://github.com/eamonnbell/music-mining",
    // No `slidesUrl`. The old site pointed at a Google Slides deck that has
    // since been deleted — docs.google.com answers 410 Gone for it, which is
    // HTTP's own way of saying it is not coming back. Dropped rather than
    // shipped as a "Slides" link that leads to an error page.
    mark: wordEmbeddingMusic,
  },
  {
    slug: "spin-ice",
    title: "Refrustration and Competing Orders in a Spin Ice Material",
    authors:
      "P. Henelius, T. Lin, M. Enjalran, Z. Hao, J. G. Rau, J. Altosaar, F. Flicker, T. Yavors'kii, and M. J. P. Gingras",
    venue: "Phys. Rev. B",
    year: 2016,
    blurb:
      "We showed a pyrochloric oxide, considered to be a classical system, has quantum behavior.",
    note: 'Featured on the <a href="https://journals.aps.org/prb/kaleidoscope/prb/93/2/024402">PRB front page</a>.',
    pdf: "2015_Henelius-Lin-Enjalran-Hao-Rau-Altosaar-Flicker-Yavorskii-Gingras_Refrustration.pdf",
    link: "https://journals.aps.org/prb/abstract/10.1103/PhysRevB.93.024402",
    arxiv: "https://arxiv.org/abs/1512.05361",
    doi: "https://doi.org/10.1103/PhysRevB.93.024402",
    code: "https://github.com/altosaar/CumulantExpander",
    mark: spinIce,
  },
  {
    slug: "correlated-lda",
    title:
      "Fast, Flexible Models for Discovering Topic Correlation across Weakly-Related Collections",
    authors: "J. Zhang, A. Gerow, J. Altosaar, J. Evans, R. J. So",
    venue: "EMNLP",
    year: 2015,
    blurb: "Goal: model how words are used differently in arts versus sciences.",
    pdf: "2015_Zhang-Gerow-Altosaar-Evans-So_Correlated-LDA.pdf",
    link: "https://aclweb.org/anthology/papers/D/D15/D15-1179/",
    arxiv: "https://arxiv.org/abs/1508.04562",
    doi: "https://doi.org/10.18653/v1/D15-1179",
    code: "https://github.com/iceboal/correlated-lda",
    mark: correlatedLda,
  },
  {
    slug: "musicmapper",
    title:
      "MusicMapper: Interactive 2D representations of music samples for in-browser remixing and exploration",
    authors: "E. Benjamin, J. Altosaar",
    venue: "New Interfaces For Musical Expression",
    year: 2015,
    blurb: "MusicMappr: let anyone make a beat in 30 seconds in their browser.",
    note: 'Interview and live demo featured on <a href="https://www.thewire.co.uk/in-writing/interviews/play-the-musicmappr-sampling-app">The Wire</a> magazine.',
    pdf: "2015_Benjamin-Altosaar_MusicMapper.pdf",
    link: "https://dl.acm.org/citation.cfm?id=2993860",
    code: "https://github.com/fatsmcgee/MusicMappr",
    demo: "https://www.youtube.com/watch?v=mvD6e1uiO8k",
    mark: musicmapper,
  },
  {
    slug: "fish-music",
    title: "Sonification of Fish Movement Using Pitch Mesh Pairs",
    authors: "A. Mercer-Taylor, J. Altosaar",
    venue: "New Interfaces For Musical Expression",
    year: 2015,
    blurb: "Can we convey how fish move using generative music and computer vision?",
    pdf: "2015_Mercer-Taylor-Altosaar_Fish-Music.pdf",
    link: "https://dl.acm.org/citation.cfm?id=2993785",
    code: "https://github.com/andrewjmt/fishmusic",
    demo: "https://www.youtube.com/watch?v=HzsFGQyIpuc",
    mark: fishMusic,
  },
];

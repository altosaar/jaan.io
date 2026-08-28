import type { ImageMetadata } from "astro";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";

/** One slide. Usually built from a `gallery` entry — see src/pages/index.astro. */
export interface CarouselItem {
  img: ImageMetadata;
  /**
   * Alt text for the photo, authored per image. Required: alt describes THIS
   * picture to someone who can't see it, which is not something a title can
   * stand in for. Pass "" only for a genuinely decorative image.
   */
  alt: string;
  /**
   * Shown under the photo, and used to build the panel's accessible names.
   * Optional: a photo may stand on its own with no name attached to it. When
   * both `title` and `caption` are absent the caption block is not rendered.
   */
  title?: string;
  /** The short line under the title. Optional — see `title`. */
  caption?: string;
  /** Rendered Markdown body — the reveal panel. Omit for a plain image slide. */
  Body?: AstroComponentFactory;
  /** CSS object-position for a cropped photo, e.g. "50% 30%". */
  focusPosition?: string;
}

/**
 * Accessible names for the carousel's controls. Every string is optional and
 * falls back to a generic English default. `{title}` is replaced with the
 * item's title; `{n}` and `{total}` are replaced in `counter`.
 *
 * Override these to match what the carousel is actually showing — "Next photo"
 * reads better than "Next slide" in a photography gallery.
 */
export interface CarouselLabels {
  /** Accessible name for the carousel itself, used only when `heading` is unset. */
  carousel?: string;
  prev?: string;
  next?: string;
  /** Accessible name of the button that opens an item's panel. */
  open?: string;
  /** Accessible name of the panel's close button. */
  close?: string;
  /** Accessible name of the panel region itself. */
  region?: string;
  /** The live "N of M" position readout. */
  counter?: string;
}

export interface CarouselProps {
  items: CarouselItem[];
  /**
   * Prefix for this carousel's generated element ids (heading, viewport, panels).
   * Give a second carousel on the same page its own `id` so they don't collide.
   */
  id?: string;
  /** "natural" keeps each photo's aspect ratio; "square" crops to a square. */
  variant?: "natural" | "square";
  /** Desaturate the photos. */
  grayscale?: boolean;
  /** Render the expandable panel for items that have a Body. */
  enablePopup?: boolean;
  /** Section heading. Omitted → the section has no visible heading. */
  heading?: string;
  /**
   * Run the photo strip the full width of the viewport, edge to edge, instead
   * of stopping at the content column. The header stays in the chrome column,
   * so the arrows still line up with the site nav above them.
   */
  fullBleed?: boolean;
  /**
   * Show the visible "N of M" readout. Turning it off hides only the element —
   * `labels.counter` is still used for each slide's accessible name, so the
   * position is announced whether or not it is drawn.
   */
  showCounter?: boolean;
  /**
   * How far Arrow/Home/End reach.
   *
   * "section" (default) — only while focus is inside the carousel, which in
   * practice means after tabbing or clicking into it. Correct when the carousel
   * is one block among others: Home/End still take the visitor to the top and
   * bottom of the page, where they expect them to.
   *
   * "page" — from anywhere on the document, with no focus needed. Use it only
   * when the carousel IS the page, because it takes Home/End away from the
   * document and a second carousel on the same page would answer the same keys.
   */
  keyboard?: "section" | "page";
  /** Photo size in px at each breakpoint (height for "natural", side for "square"). */
  sizePx?: { mobile: number; desktop: number };
  labels?: CarouselLabels;
}

/** Defaults for every string the carousel speaks. Merged with `labels`. */
export const DEFAULT_CAROUSEL_LABELS: Required<CarouselLabels> = {
  carousel: "Carousel",
  prev: "Previous slide",
  next: "Next slide",
  open: "Read more about {title}",
  close: "Close details for {title}",
  region: "More about {title}",
  counter: "{n} of {total}",
};

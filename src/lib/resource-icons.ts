// The glyphs on the resource links under each paper — see src/pages/papers.astro.
//
// Drawn here rather than pulled from an icon set. The Jekyll page these come
// from used Font Awesome and Academicons, which meant two webfonts and a
// stylesheet from a CDN for what is, in the end, seven line drawings; this site
// preloads two fonts in total (see SITE.fonts) and a third for icons would cost
// more than the icons are worth.
//
// The drawing rules are the site's, not an icon set's, so these belong beside
// the external-link arrow in src/pages/projects.astro rather than beside each
// other: a 16px box, one path, `fill: none`, `currentColor` at 1.4, and NO
// stroke-linecap or stroke-linejoin — SVG's defaults are `butt` and `miter`,
// which is a flat end and a sharp corner, and naming either as "round" is what
// puts a radius on a mark that has none.
//
// Each icon is a SINGLE `d` with several subpaths rather than several elements,
// because that is all any of them needs and it keeps this readable as a table.
//
// A .ts file rather than the component's own frontmatter, so `ResourceIconName`
// can be imported as a type by the page that builds the link rows. Astro
// components export a component, not a type.
export const RESOURCE_ICONS = {
  /** A page with its corner turned. */
  pdf: "M3.5 14.5v-13H9l3.5 3.5v9.5zM9 1.5V5h3.5",
  /** An open book. */
  arxiv:
    "M8 4.5v9M8 4.5C8 3.6 5.9 2.5 2.5 2.5v9c3.4 0 5.5 1.1 5.5 2M8 4.5c0-.9 2.1-2 5.5-2v9c-3.4 0-5.5 1.1-5.5 2",
  /** Angle brackets. */
  code: "M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5",
  /** A board on a stand. */
  slides: "M2 2.5h12v8H2zM8 10.5v3M5.5 13.5h5",
  /** A play triangle in a frame. */
  video: "M2 3.5h12v9H2zM6.5 6.5 10.5 9l-4 2.5z",
  /** An arrow leaving a box — the same idea as the external mark on /projects. */
  demo: "M8.5 2.5h-6v11h11v-6M9.5 2.5h4v4M13.5 2.5 7.5 8.5",
  /** Braces, which is what a BibTeX entry looks like from across the room. */
  bibtex:
    "M6 1.5c-1.5 0-2 .6-2 2V5c0 1-.5 2-1.5 2 1 0 1.5 1 1.5 2v1.5c0 1.4.5 2 2 2M10 1.5c1.5 0 2 .6 2 2V5c0 1 .5 2 1.5 2-1 0-1.5 1-1.5 2v1.5c0 1.4-.5 2-2 2",
} as const;

export type ResourceIconName = keyof typeof RESOURCE_ICONS;

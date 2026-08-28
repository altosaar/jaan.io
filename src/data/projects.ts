// The /projects index, in the order it is read.
//
// Two kinds of entry, and the difference is the href:
//
//   • A set that lives on this site — /visualizations today.
//   • A link to something published somewhere else, which is what the Jekyll
//     site's /projects/ was made of. Those open in a new tab and carry the
//     project's own mark; see the note on `icon` below.
//
// A .ts file rather than a content collection, matching src/data/visualizations.ts
// and src/data/gallery.ts. The collections in src/content/ are for things with a
// BODY — a post, a long-form page — and every one of these entries is two
// strings and a link. A Markdown file per project would be four lines of
// frontmatter above an empty document, and it would put the icon import a step
// further from the thing that renders it.

import type { SvgComponent } from "astro/types";
// Upstream's own icon, from the plugin repo
// (~/projects/petrograph/vendor/obsidian-microlite/icon.svg). Copied as-is but
// for two Illustrator leftovers removed — the XML prolog and `id="Layer_1"`,
// which would otherwise be inlined into every /projects page as a live element
// id that nothing on this site put there.
//
// Imported as a COMPONENT, not as an image. Astro inlines an imported .svg into
// the page and forwards props onto the root element, which is the whole point
// here: this mark is drawn in the page's own text colour, and an SVG loaded
// through <img> is a separate document that inherits neither colour nor custom
// properties from the page around it. Through <img> the icon would resolve to
// its default black and vanish against this site's background. (The same
// reasoning is written out at greater length in src/pages/visualizations.astro,
// which inlines its chart marks for the same reason.)
//
// The file itself carries no `fill` on any of its shapes, so the fill
// src/components/IndexMark.astro sets on the box is inherited by every polygon,
// path and rect in it.
import MicroliteIcon from "../assets/projects/microlite.svg";
// One frame of the clock that site IS, held still.
//
// notonspotify.jaan.io deals every track a different clock face, from the forty
// mirrored from clocks.dev (public domain — see that repo's README). This is
// `tria`, the plainest of the sixteen it actually uses: three sides of a
// triangle, each filled from its own corner — one for the hour, one for the
// minute, one for the second. A still frame is the honest mark for it, because
// a still frame is what a clock looks like at any instant; the site's own
// arrangement, where the "hour" is your place in the playlist and the minutes
// and seconds are the running track, is the sentence beside it, not the
// drawing.
//
// REDRAWN RATHER THAN EXPORTED, and the weights are not the face's own. Its
// unfilled sides are a 0.42-unit hairline, which lands under a third of a pixel
// in a 3.25rem box and simply is not there; the three filled runs are lifted
// with it so the hierarchy between them survives the same shrinking. The
// geometry — the corners, and how far along each side its own run reaches — is
// carried over exactly.
//
// TWO PAINT ATTRIBUTES IT CANNOT DO WITHOUT, unlike the icon above:
//
//   • `fill="none"` on the root. This drawing is strokes, and the triangle is a
//     CLOSED path; the `fill: currentColor` IndexMark sets on the box would
//     otherwise inherit straight into it and flood the mark into a solid
//     wedge. (A presentation attribute loses to a CSS rule but beats an
//     INHERITED value, which is what that fill is by the time it arrives here.)
//   • `stroke="currentColor"`, for the opposite reason: `stroke` starts at
//     `none`, so there is nothing up the tree to inherit and the box's colour
//     never reaches a stroked shape by itself. With it named once on the root
//     it inherits to every path, and the mark follows the theme and lights with
//     the row like the others.
//
// AND A FIRST PATH THAT DRAWS NOTHING, which is what makes the mark hoverable.
// IndexMark hands its shapes `pointer-events: visiblePainted` — a pointer
// counts as over a shape only where that shape is actually PAINTED — and every
// shape here is a stroke one to four units wide, which at this size is one to
// three pixels. The row lights from a hover on its mark, and the target was
// four hairlines: the pointer sat inside the triangle, on the drawing as far as
// anyone reading the page is concerned, and nothing happened. So the triangle
// is repeated once as a shape that paints nothing at all (`stroke="none"`, and
// `fill` is already `none` from the root) carrying `pointer-events: fill` —
// SVG's own way of saying the INTERIOR is a target whatever the fill is set to.
// The hover target becomes the silhouette of the drawing, which is what it
// looked like all along. Inline `style` rather than an attribute, because a
// presentation attribute loses to IndexMark's rule and this has to win it.
import NotOnSpotifyIcon from "../assets/projects/notonspotify.svg";
// The Trash Club raccoon — and the ONE MARK ON THIS PAGE THAT IS NOT AN SVG.
//
// plgcleanup.org's own mascot (its src/assets/raccoon-maple.webp), which arrives
// as a full-colour cartoon: a rust-brown raccoon with a white belly and black
// outlines. Two things had to happen to it before it could sit in this column.
//
// IT WAS CONVERTED TO INK ON TRANSPARENCY, with ImageMagick: composited onto
// white, desaturated, and NEGATED, so the result's alpha is the original's
// DARKNESS — black outlines and pupils come through solid, the brown body at
// about half, the white belly at nothing. IndexMark then paints that alpha in
// the page's own colour like any other mark, so the raccoon follows the theme
// and takes the accent when the row lights.
//
// Negating rather than masking the silhouette is the whole point: a mask over
// the file's OWN alpha would have been the outline of a raccoon filled solid —
// no face, no stripes, no tail, a blob. Taking the drawing's darkness as the
// alpha keeps every line in it.
//
// AND IT WAS TRIMMED to its ink (296 x 242 -> 253 x 221) for the reason written
// out on `thumb` in src/content.config.ts: transparent margin left in the file
// is margin inside the fixed box, and the mark reads small beside one that has
// none.
//
// Imported as an IMAGE, not as a component like the two above — it is raster,
// so it goes through Astro's pipeline and reaches IndexMark as a `mask` URL.
// Same route the /writing thumbs take; see the note there.
import RaccoonMark from "../assets/projects/trash-club-raccoon.png";

export interface Project {
  /**
   * Root-relative for a set on this site, absolute for one that is not.
   *
   * Which of the two it is decides the external treatment — the new tab and the
   * arrow beside the headline. Derived from the href rather than carried as a
   * flag, so the two cannot disagree.
   */
  href: string;
  title: string;
  /** One or two sentences. Says what the thing IS, not that it is interesting. */
  description: string;
  /**
   * The project's own mark, imported from src/assets/projects/*.svg.
   *
   * Optional. An entry without one — and without `vizMark` or `maskMark`
   * below — still begins where every other entry's headline begins: /projects
   * holds the mark column open with a margin on the link, so the row lines up
   * without pretending there is a mark in it. Nothing is drawn there and
   * nothing is clickable there — on those rows only the text is the link. See
   * `.project__link--unmarked` in src/pages/projects.astro.
   *
   * Better than blocking a listing on redrawing someone else's logo.
   */
  icon?: SvgComponent;
  /**
   * The slug of a /visualizations entry whose generated mark stands in as this
   * entry's icon. An alternative to `icon`, not an addition to it.
   *
   * Those marks are build output, not committed source: the loaders in
   * viz/src/thumbs draw them and scripts/build-visualizations.mjs writes them to
   * public/visualizations/thumbs (gitignored). So they cannot be `import`ed the
   * way the file above is — /projects reads the SVG off disk and inlines it, the
   * same as /visualizations does with the same files.
   *
   * A SLUG rather than the thumb's filename, because the two are not the same
   * thing (two ACS sub-pages would collide on a flat filename) and this way the
   * mapping stays in src/data/visualizations.ts, where it already lives.
   */
  vizMark?: string;
  /**
   * A raster mark, painted as a shape rather than placed as a picture — the
   * third and last way an entry can carry an icon, and an alternative to the
   * two above rather than an addition to either.
   *
   * For a mark that arrives as a drawing instead of as a logo. It must already
   * be INK ON TRANSPARENCY and trimmed to that ink: IndexMark uses the file's
   * alpha as a mask over the page's colour, so whatever is opaque in it is what
   * gets drawn. See the note on the import at the top of this file for how
   * one gets made.
   */
  maskMark?: ImageMetadata;
}

export const PROJECTS: Project[] = [
  {
    href: "/visualizations",
    title: "Visualizations",
    description:
      "Interactive views of large datasets from healthcare, the census microdata, city properties, vital signs.",
    vizMark: "american-community-survey",
  },
  {
    href: "https://community.obsidian.md/plugins/microlite",
    title: "Microlite",
    description:
      "An Obsidian plugin for context engineering via diffs — life logging with large language models.",
    icon: MicroliteIcon,
  },
  {
    // No mark: there is no logo for this one, and inventing one would be
    // inventing someone else's. The row still starts where every other row's
    // headline starts, and the empty column beside it is not part of the link
    // — see `.project__link--unmarked` in src/pages/projects.astro.
    href: "https://interactionprinciples.github.io/",
    title: "Interaction Principles",
    description:
      "With a friend, we created these principles because we wanted to talk to others about them, revise them, and discover new ones.",
  },
  {
    href: "https://notonspotify.jaan.io",
    title: "Not on Spotify",
    description:
      "In service of excellent music not on Spotify. Please send me any more you've found :)",
    icon: NotOnSpotifyIcon,
  },
  {
    href: "https://plgcleanup.org",
    title: "Trash Club",
    description:
      "Claude and I made this website and help maintain community infrastructure for the neighborhood group I volunteer at; they are fantastic.",
    maskMark: RaccoonMark,
  },
];

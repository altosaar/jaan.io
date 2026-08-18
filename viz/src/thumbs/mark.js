// Shared machinery for the /visualizations index marks.
//
// Each sibling `*.svg.js` is a Framework data loader: Framework runs it and
// captures stdout as the file's contents, so these render Observable Plot in
// Node (via jsdom) and print the SVG. They are declared in dynamicPaths, which
// is what makes Framework build them even though no page here imports them.
// See https://observablehq.com/framework/embeds — "Exported files".
//
// EACH MARK IS A MINIATURE OF ITS CHART, not a decorative stand-in. Same mark
// type, same stacking, same category order, same pinned domains, same opening
// state — a bar chart's mark is bars, an area chart's is an area, and the map's
// is the map. The extracts in data/ are cut to match (see
// scripts/make-thumb-data.mjs), so the only things dropped are the ones that
// cannot survive the size:
//
//   • Axes, ticks, labels, titles, legends. At 128 × 80 type is illegible and
//     the row already carries the words.
//   • Colour. Everything is `currentColor`, so a mark inherits the page's text
//     colour and follows the theme instead of baking in a grey. A categorical
//     fill scale becomes a spread of opacities, which keeps a stack readable as
//     a stack.
import { JSDOM } from "jsdom";
import * as Plot from "@observablehq/plot";
import { csvParse, autoType } from "d3-dsv";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// 8:5. Close to the proportions the charts are drawn at — the ACS and
// healthcare plots are about 850 × 500 with their legends — so the
// distributions keep their shape instead of being squashed into a letterbox. It
// also gives the map, which is nearly square, most of the frame.
export const WIDTH = 128;
export const HEIGHT = 80;

// Every chart bins its log x at twenty bins per decade, and the extracts carry
// each bin's lower edge, so a bar runs from its own edge to the next.
export const BIN = 10 ** (1 / 20);

const here = dirname(fileURLToPath(import.meta.url));

/** Read one of the committed extracts from src/thumbs/data. */
export const load = (name) => csvParse(readFileSync(join(here, "data", name), "utf8"), autoType);

/** Read one as base64, for the two marks carried as a PNG mask. */
export const loadBase64 = (name) => readFileSync(join(here, "data", name)).toString("base64");

/**
 * The categories in the order the extract lists them — which is the order the
 * chart stacks them in, because the SQL emits them that way.
 */
export const order = (rows) => [...new Set(rows.map((d) => d.k))];

/**
 * Opacity standing in for a categorical colour.
 *
 * Stepping by the golden ratio rather than ramping evenly: an even ramp over
 * nineteen sectors puts adjacent bands four percent apart, which is invisible,
 * and the stack reads as one flat mass. Stepping by an irrational fraction
 * keeps neighbours far apart while still covering the range evenly.
 */
export const shade = (domain) => {
  const rank = new Map(domain.map((k, i) => [k, i]));
  return (d) => 0.28 + 0.68 * (((rank.get(d.k) ?? 0) * 0.618033988749895) % 1);
};

/** Tidy and print an SVG element. */
function print(svg) {
  // Plot emits a scoped <style> carrying `--plot-background: white` plus type
  // rules for text. These marks have no text, and the white would sit under a
  // transparent mark on a black page, so it goes.
  svg.querySelector("style")?.remove();
  svg.removeAttribute("class");
  svg.removeAttribute("font-family");
  svg.removeAttribute("font-size");
  svg.removeAttribute("text-anchor");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  // Decorative: the title beside it says everything this says. Marked as such so
  // a screen reader does not announce an unnamed graphic on every row.
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  // Hoist the colour. Plot writes fill="currentColor" onto every element it
  // draws — 22 bytes apiece, and these marks have hundreds. The root already
  // carries it, so the children can inherit. Elements that deliberately differ
  // state their own value and are untouched: only the literal string is removed.
  svg.setAttribute("fill", "currentColor");
  for (const el of svg.querySelectorAll('[fill="currentColor"]')) el.removeAttribute("fill");

  // Drop stack segments too short to see. A stacked histogram of nineteen
  // sectors over fifty bins is 950 rectangles, and in most bins all but a
  // handful of sectors contribute a sliver well under a tenth of a pixel. They
  // cannot be seen at any zoom this mark is displayed at, and they were two
  // thirds of the file. Removing a rect does not move the ones around it —
  // Plot has already resolved every stack position into absolute coordinates —
  // so the picture is unchanged.
  for (const el of svg.querySelectorAll("rect[height]")) {
    if (parseFloat(el.getAttribute("height")) < 0.25) el.remove();
  }

  // Round to 2dp. Plot emits full float precision — 43.29411764705882 — which
  // at this size is a dozen digits past what a pixel can show, and on the
  // denser marks was most of the file.
  process.stdout.write(svg.outerHTML.replace(/\d+\.\d{3,}/g, (n) => String(+(+n).toFixed(2))));
}

/**
 * Render Plot marks to stdout as a standalone SVG.
 *
 * Anything in `spec` is merged over the defaults, so a mark can set a scale or
 * a margin — but the axes stay off unless deliberately turned back on, which
 * none of them do.
 */
export function emit(spec) {
  print(
    Plot.plot({
      document: new JSDOM("").window.document,
      width: WIDTH,
      height: HEIGHT,
      margin: 0,
      style: { background: "transparent", overflow: "visible" },
      ...spec,
      x: { axis: null, ...spec.x },
      y: { axis: null, ...spec.y },
    }),
  );
}

/** Print raw SVG content, for the marks Plot cannot draw. */
export function emitRaw(body) {
  const dom = new JSDOM(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${body}</svg>`,
    { contentType: "image/svg+xml" },
  );
  print(dom.window.document.documentElement);
}

/**
 * A greyscale PNG painted in `currentColor`.
 *
 * The glucose heatmap and the New York parcel map are rasters, and at the
 * resolution needed to look like the real thing they ran to hundreds of
 * kilobytes as SVG rectangles. Carried as a PNG in a data URI they are a few
 * kB. Used as a MASK over a plain currentColor rectangle rather than drawn
 * directly, so the raster still takes its colour from the page the way every
 * other mark does.
 *
 * `image-rendering: pixelated` matches vg.raster's own setting on the glucose
 * plot: these are coarse grids, and smoothing them would invent detail.
 */
export const maskedRaster = ({ id, png, x, y, width, height }) =>
  `<defs><mask id="${id}">` +
  `<image href="data:image/png;base64,${png}" x="${x}" y="${y}" width="${width}" height="${height}"` +
  ` preserveAspectRatio="none" style="image-rendering:pixelated"/>` +
  `</mask></defs>` +
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" mask="url(#${id})"/>`;

export { Plot };

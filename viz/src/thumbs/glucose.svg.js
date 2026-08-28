// charts/glucose.js is two linked views stacked vertically — a raster heatmap
// of glucose against time, and a bar chart of hospitalization counts by
// diagnostic category — so the mark is both, at the 550:300 height ratio and
// with the margins the page lays them out in.
//
// The heatmap arrives as a PNG mask rather than as SVG rects: see maskedRaster
// in mark.js for why. Its greys already encode vg.opacityDomain([0, 10]) with
// vg.opacityClamp(true), rescaled for the coarser grid.
import { emitRaw, load, loadBase64, maskedRaster, WIDTH, HEIGHT } from "./mark.js";
import { max } from "d3-array";

// The page's proportions: the raster plot is 550 tall and the bar plot 300, and
// the margins are given in px against a 1063-wide plot. Kept as fractions so
// the mark is the same layout at a sixteenth of the size — including the wide
// left margin the bar chart reserves for its category labels, which is a large
// part of what that panel looks like.
const TOTAL = 550 + 300;
const rasterH = (550 / TOTAL) * HEIGHT;
const barsH = (300 / TOTAL) * HEIGHT;
const px = (v) => (v / 1063) * WIDTH;

const bars = load("glucose-categories.csv");
const peak = max(bars, (d) => d.y);

// vg.barX with sort {y: "-x", limit: 15}: fifteen bars, longest first.
const barTop = rasterH + (5 / TOTAL) * HEIGHT;
const barArea = barsH - ((5 + 35) / TOTAL) * HEIGHT;
const barLeft = px(300);
const step = barArea / bars.length;

const rows = bars
  .map((d, i) => {
    const w = ((WIDTH - barLeft) * d.y) / peak;
    const h = Math.max(0.6, step * 0.8);
    return `<rect x="${barLeft.toFixed(2)}" y="${(barTop + i * step).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}"/>`;
  })
  .join("");

emitRaw(
  maskedRaster({
    id: "viz-mask-glucose",
    png: loadBase64("glucose-raster.png"),
    x: px(35),
    y: (20 / TOTAL) * HEIGHT,
    width: WIDTH - px(35) - px(20),
    height: rasterH - ((20 + 30) / TOTAL) * HEIGHT,
  }) + rows,
);

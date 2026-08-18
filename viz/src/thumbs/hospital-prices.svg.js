// charts/hospital-prices.js — a log-log scatter of listed minimum against
// listed maximum charge for every procedure NYU Langone publishes, with the red
// diagonal marking where one would cost every insurer the same.
//
// All 27,151 points, as a raster rather than as circles: at 128 x 80 they are
// a density, not a set of marks, and 2.6 kB of PNG beats 104 kB of <circle>.
//
// The diagonal needs no geometry. Both axes carry the same log domain, so the
// line x = y runs exactly corner to corner whatever the box's aspect.
import { emitRaw, loadBase64, maskedRaster, WIDTH, HEIGHT } from "./mark.js";

emitRaw(
  maskedRaster({
    id: "viz-mask-charges",
    png: loadBase64("hospital-prices.png"),
    x: 0,
    y: 0,
    width: WIDTH,
    height: HEIGHT,
    smooth: true,
  }) +
    // The one mark in the set drawn in a colour. Reading this cloud means
    // reading it AGAINST this line — the distance from it is the whole finding
    // — so it has to stay separable from the points rather than becoming
    // another grey.
    `<line x1="0" y1="${HEIGHT}" x2="${WIDTH}" y2="0" stroke="#e5484d" stroke-width="1"/>`,
);

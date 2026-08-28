// charts/hospital-prices.js — a log-log scatter of listed minimum against
// listed maximum charge for every procedure NYU Langone publishes.
//
// All 27,151 points, as a raster rather than as circles: at 128 x 80 they are a
// density, not a set of marks, and 2.6 kB of PNG beats 104 kB of <circle>.
//
// The chart's red x = y reference line is NOT drawn here. Every mark in this
// set is monochrome `currentColor` so the row follows the page's text colour,
// and one mark carrying a colour the other seven do not broke that. The line is
// what the CHART is read against; the mark only has to be recognisable as that
// chart, and the cloud's shape — a dense diagonal band with a long spray above
// it — does that on its own.
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
  }),
);

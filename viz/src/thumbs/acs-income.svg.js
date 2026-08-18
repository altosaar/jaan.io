// charts/acs-income.js — stacked rectY by sector, log x pinned to
// [2200, 1000000], y axis hidden. The page opens on the most recent year (the
// slider starts at years.length - 1), so that is the year the mark draws.
import { emit, load, order, shade, BIN, Plot } from "./mark.js";

const rows = load("acs-historical.csv");
const domain = order(rows);

emit({
  x: { type: "log", domain: [2_200, 1_000_000] },
  marks: [
    Plot.rectY(rows, {
      x1: "x",
      x2: (d) => d.x * BIN,
      y: "y",
      z: "k",
      order: domain,
      fillOpacity: shade(domain),
    }),
  ],
});

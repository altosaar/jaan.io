// charts/acs-new-york.js via IncomeBySectorNewYork — stacked rectY by sector,
// log x pinned to [5000, 500000]. The page opens on the first area in the
// picker (Connecticut — Lower Connecticut River Valley) in the most recent
// year, and the mark draws that opening state rather than an aggregate.
import { emit, load, order, shade, BIN, Plot } from "./mark.js";

const rows = load("acs-nyc-area.csv");
const domain = order(rows);

emit({
  x: { type: "log", domain: [5_000, 500_000] },
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

// charts/synthetic-healthcare-data.js — stacked rectY of payments by insurance
// type, log x pinned to [100, 300000], y axis hidden. Same chart, same domain,
// same stack order; the three colours become three opacities.
import { emit, load, order, shade, BIN, Plot } from "./mark.js";

const rows = load("healthcare-payments.csv");
const domain = order(rows);

emit({
  x: { type: "log", domain: [100, 300_000] },
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

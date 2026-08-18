// charts/acs-new-york.js via IncomeByRaceNewYork — the same chart as its
// sibling with the same pinned domain, stacked by self-reported race in the
// fixed ORDER_RACES order instead of by sector. Same opening area and year.
//
// It resembles the sector mark because the two pages resemble each other: same
// data, same axes, same bars, one column swapped. Making them look different
// would be inventing a distinction the site does not have.
import { emit, load, order, shade, BIN, Plot } from "./mark.js";

const rows = load("acs-nyc-race.csv");
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

// charts/acs-2022.js draws TWO charts on one page — income by sector as stacked
// bars, rent by region as a stacked area — so the mark shows both, one above
// the other, in the order the page presents them.
import { emitRaw, load, order, shade, BIN, WIDTH, HEIGHT, Plot } from "./mark.js";
import { JSDOM } from "jsdom";

const document = new JSDOM("").window.document;
const GAP = 6;
const PANEL = (HEIGHT - GAP) / 2;

const panel = (marks, extra) =>
  Plot.plot({
    document,
    width: WIDTH,
    height: PANEL,
    margin: 0,
    x: { type: "log", axis: null, ...extra },
    y: { axis: null },
    style: { background: "transparent" },
    marks,
  });

const income = load("acs-2022-income.csv");
const incomeDomain = order(income);
const rent = load("acs-2022-rent.csv");
const rentDomain = order(rent);

const top = panel([
  Plot.rectY(income, {
    x1: "x",
    x2: (d) => d.x * BIN,
    y: "y",
    z: "k",
    order: incomeDomain,
    fillOpacity: shade(incomeDomain),
  }),
]);

// areaY with a monotone curve, as on the page — the rent chart is the one
// smooth thing in the set and that difference is worth keeping.
const bottom = panel([
  Plot.areaY(rent, {
    x: "x",
    y: "y",
    z: "k",
    order: rentDomain,
    curve: "monotone-x",
    fillOpacity: shade(rentDomain),
  }),
]);

emitRaw(
  `<g>${top.innerHTML}</g><g transform="translate(0,${PANEL + GAP})">${bottom.innerHTML}</g>`,
);

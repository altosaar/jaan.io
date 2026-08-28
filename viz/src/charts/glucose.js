// Millions of glucose readings across 300k hospitalizations of 150k people.
//
// Ported from jaan.li/glucose. This is the one page here that is not Observable
// Plot: it is Mosaic (@uwdata/vgplot), which pushes the aggregation down into
// DuckDB and cross-filters the two views against each other. Selecting bars in
// the diagnostic-category chart filters the heatmap; brushing the heatmap
// filters the bars.
//
// On a Framework page you get `vg` for free — the `sql` front matter wires a
// coordinator to the page's default DuckDB client. An exported module has no
// front matter, so the coordinator is built here against our own client.
import * as vgplot from "npm:@uwdata/vgplot";
import { DuckDBClient } from "npm:@observablehq/duckdb";
import { FileAttachment } from "observablehq:stdlib";

// Both plots are laid out against this width. Mosaic sizes a plot at
// construction and the two share a live selection, so re-creating them on
// resize would drop whatever the reader had brushed. The original was fixed at
// this width too; the Astro page scrolls it horizontally on narrow screens
// rather than rebuilding it.
const WIDTH = 1063;

export async function GlucoseCrossfilter() {
  const db = await DuckDBClient.of({
    glucose_full: FileAttachment("../data/glucose_full.parquet"),
  });

  const coordinator = new vgplot.Coordinator();
  const vg = vgplot.createAPIContext({ coordinator });
  coordinator.databaseConnector(vgplot.wasmConnector({ duckdb: db._db }));

  const $filter = vg.Selection.crossfilter();
  const $highlight = vg.Selection.single();

  const heatmap = vg.plot(
    vg.frame({ fill: "black" }),
    vg.raster(vg.from("glucose_full", { filterBy: $filter }), {
      x: "time",
      y: "glucose",
      fill: vg.argmax("route", "count"),
      fillOpacity: vg.sum("count"),
      width: 2016,
      height: 300,
      imageRendering: "pixelated",
    }),
    vg.intervalXY({ as: $filter }),
    vg.colorDomain(vg.Fixed),
    vg.colorScheme("observable10"),
    vg.opacityDomain([0, 10]),
    vg.opacityClamp(true),
    vg.yLabel("↑ Glucose (mg/dL)"),
    vg.yDomain([40, 350]),
    vg.yTickFormat("s"),
    vg.xScale("utc"),
    vg.xLabel(null),
    // No xDomain. The original pinned it to `vg.xDomain(948844800000,
    // 993366720000)` — 2000-01-26 to 2001-06-24 — but the data in this parquet
    // runs from 2105-10-05 to 2214-12-24, because MIMIC-IV date-shifts every
    // patient timeline forward into the 2100s. That window therefore selects
    // nothing at all; it is a domain left over from some earlier extract.
    // (It was also a two-argument call, which Mosaic ignores — it wants an
    // array — so the original page rendered the derived domain anyway. Dropping
    // it makes what happens and what is written down agree.)
    vg.width(WIDTH),
    vg.height(550),
    vg.margins({ left: 35, top: 20, bottom: 30, right: 20 }),
  );

  const categories = vg.plot(
    vg.barX(vg.from("glucose_full", { filterBy: $filter }), {
      x: vg.sum("count"),
      y: "route",
      fill: "route",
      sort: { y: "-x", limit: 15 },
    }),
    vg.toggleY({ as: $filter }),
    vg.toggleY({ as: $highlight }),
    vg.highlight({ by: $highlight }),
    vg.colorDomain(vg.Fixed),
    vg.xLabel("Hospitalization Major Diagnostic Category Counts"),
    vg.xTickFormat("s"),
    vg.yLabel(null),
    vg.width(WIDTH),
    vg.height(300),
    vg.marginTop(5),
    vg.marginLeft(300),
    vg.marginBottom(35),
  );

  const root = document.createElement("div");
  root.className = "viz viz--wide";
  root.style.minWidth = `${WIDTH}px`;
  root.append(heatmap, categories);
  return root;
}

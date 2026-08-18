// Every price NYU Langone Tisch publishes, minimum against maximum.
//
// Ported from payless.health — the One Fact Foundation's hospital price
// transparency site. That page renders a declarative Mosaic spec
// (docs/public/specs/yaml/nyu-langone.yaml, fetched and handed to parseSpec by
// docs/.vitepress/theme/Example.vue); this is the same dashboard written
// against the vgplot API directly, the way charts/glucose.js is, so the whole
// project has one way of building a Mosaic view rather than two.
//
// THE YAML IS THE SOURCE OF TRUTH. Every mark, input, domain, scale and label
// below is transcribed from it. If that spec changes, this has to change.
//
// The one thing that is not transcribed is the pixel size: the spec is 590×350
// for a narrower column than this site's. The aspect ratio is kept and scaled
// up to fill the measure here, which is a container decision rather than a
// change to the chart.
import * as vgplot from "npm:@uwdata/vgplot";
import { DuckDBClient } from "npm:@observablehq/duckdb";
import { FileAttachment } from "observablehq:stdlib";

// 820 × 486 keeps the spec's 590 × 350 proportions.
const WIDTH = 820;
const HEIGHT = 486;

export async function HospitalPrices() {
  const db = await DuckDBClient.of({
    charges: FileAttachment("../data/nyu-langone-charges.parquet"),
  });

  // The spec's inline `dd` dataset: two points that draw the line where a
  // hospital's minimum and maximum price for a procedure would be equal.
  // Mosaic marks read from tables, so the literal becomes one.
  await db.query(
    `CREATE OR REPLACE TABLE dd AS
     SELECT * FROM (VALUES (1000.0, 1000.0), (10000000.0, 10000000.0)) t(u, v)`,
  );

  const coordinator = new vgplot.Coordinator();
  const vg = vgplot.createAPIContext({ coordinator });
  coordinator.databaseConnector(vgplot.wasmConnector({ duckdb: db._db }));

  // One selection driven by all three controls — the payor menu, the
  // description search and the brush — so they compose rather than override
  // each other. Mosaic does not apply a clause back to the client that raised
  // it, so brushing the scatter filters the table without filtering away the
  // points being brushed.
  const $query = vg.Selection.intersect();

  const payor = vg.menu({
    label: "Insurance maximum",
    as: $query,
    from: "charges",
    column: "name_maximum",
  });

  const search = vg.search({
    label: "description",
    as: $query,
    from: "charges",
    column: "description",
    type: "contains",
  });

  const scatter = vg.plot(
    vg.dot(vg.from("charges", { filterBy: $query }), {
      x: "min_charge",
      y: "max_charge",
      opacity: 0.5,
      fill: "name_minimum",
      r: 2,
    }),
    vg.regressionY(vg.from("charges", { filterBy: $query }), {
      x: "min_charge",
      y: "max_charge",
    }),
    vg.intervalXY({ as: $query, brush: { fillOpacity: 0, stroke: "currentColor" } }),
    // The diagonal. A procedure priced the same for every insurer sits on it;
    // how far a point is from it is how much the price varies by who is paying.
    vg.lineY(vg.from("dd"), { x: "u", y: "v", stroke: "red" }),
    vg.margins({ left: 60, top: 20, right: 60 }),
    vg.xyDomain(vg.Fixed),
    vg.width(WIDTH),
    vg.height(HEIGHT),
    vg.xDomain([0.001, 3_000_000]),
    vg.yDomain([0.001, 3_000_000]),
    vg.xLabel(
      'Listed minimum rate ($, logarithmic; "k" refers to thousands and M refers to millions) →',
    ),
    vg.yLabel(
      '↑ Listed maximum rate ($, logarithmic; "k" refers to thousands and M refers to millions)',
    ),
    vg.xGrid(false),
    vg.yGrid(false),
    vg.xScale("log"),
    vg.yScale("log"),
  );

  const table = vg.table({
    from: "charges",
    filterBy: $query,
    maxWidth: WIDTH,
    columns: [
      "billing_code",
      "description",
      "min_charge",
      "max_charge",
      "name_minimum",
      "name_maximum",
    ],
    // Wider than the spec's 60 for the first column: these widths size the
    // fixed table layout, and the heading "billing_code" is longer than any
    // code under it.
    width: {
      billing_code: 110,
      description: 260,
      min_charge: 100,
      max_charge: 100,
      name_minimum: 145,
      name_maximum: 145,
    },
  });

  const root = vg.vconcat(vg.hconcat(payor, search), vg.vspace(10), scatter, vg.vspace(5), table);
  root.classList?.add("viz", "viz--mosaic");
  return root;
}

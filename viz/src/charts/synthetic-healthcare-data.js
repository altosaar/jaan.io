// Payment distributions by insurance type — 1.2M people, AHRQ synthetic data.
//
// Ported from jaan.li/synthetic-healthcare-data. The chart is unchanged; the
// hero, the prose and the links now live in the Astro page that imports this.
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import { DuckDBClient } from "npm:@observablehq/duckdb";
import { FileAttachment, resize } from "observablehq:stdlib";

// Fixed rather than derived from the data: these three are the whole domain,
// and hard-coding them keeps the legend in a stable order (and stable colours)
// no matter what the query happens to return first.
const ORDER = ["Commercial", "Medicaid", "Medicare"];

export async function PaymentChart() {
  const db = await DuckDBClient.of({
    data: FileAttachment("../data/insurance_plan_payment_histogram.parquet"),
  });
  // `count` is a bigint in the parquet. Arrow hands those back as JS BigInt,
  // and Plot's "sum" reducer adds them to a Number accumulator, which throws.
  // Casting in SQL is the cheapest place to fix it.
  const payments = await db.query(
    `SELECT Payment, CAST(count AS DOUBLE) AS count, Insurance FROM data`,
  );

  return resize((width) =>
    Plot.plot({
      width,
      marginLeft: 60,
      // Log x with a fixed domain. Payments run over four orders of magnitude,
      // and pinning the domain stops the axis from rescaling around outliers.
      x: { type: "log", domain: [100, 300_000] },
      y: { axis: null },
      color: { legend: "swatches", columns: 1, domain: ORDER },
      marks: [
        Plot.rectY(
          payments,
          Plot.binX(
            { y: "sum" },
            {
              x: "Payment",
              y: "count",
              fill: "Insurance",
              order: ORDER,
              // 90 log-spaced bins. d3.ticks over log10 then raised back out,
              // so the bins are even on screen rather than even in dollars.
              thresholds: d3.ticks(Math.log10(1), Math.log10(1_000_000), 90).map((d) => 10 ** d),
              tip: { format: { x: ",.3r" } },
            },
          ),
        ),
      ],
    }),
  );
}

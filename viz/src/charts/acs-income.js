// American Community Survey, 2000–2022 — income by sector, scrubbed by year.
//
// Ported from jaan.li/american-community-survey/income. The year slider was a
// Framework `Generators.input` on a page that re-ran its query block on every
// change; here that loop is explicit (see reactive() in util.js).
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import * as Inputs from "npm:@observablehq/inputs";
import { DuckDBClient } from "npm:@observablehq/duckdb";
import { FileAttachment, resize } from "observablehq:stdlib";
import { reactive, column, rows } from "./util.js";

export async function IncomeBySectorHistorical() {
  const db = await DuckDBClient.of({
    data: FileAttachment("../data/income-histogram-historical.parquet"),
  });

  const years = column(await db.query(`SELECT DISTINCT year FROM data ORDER BY year`), "year");

  // Sector order is fixed to the most recent year and then left alone. Letting
  // it re-sort per year would recolour the whole chart mid-drag, which makes
  // the thing the slider exists to show — how the ranking shifts — impossible
  // to see. This is what the original did too.
  const mostRecentYear = years[years.length - 1];
  const orderSectors = rows(
    await db.query(`
      SELECT sector, SUM(income * count) / SUM(count) AS mean_income
      FROM data
      WHERE year = ${mostRecentYear}
      GROUP BY sector
      ORDER BY mean_income DESC
    `),
  ).map((d) => d.sector);

  // The slider indexes INTO `years` rather than running over the year range.
  // There is no 2020 in this data — the Census Bureau published no standard
  // one-year sample for it — and a slider over 2000…2022 lets you land on a
  // year that returns no rows and draws an empty chart. The original tried to
  // handle that with `validate`, which marks the input invalid but does not
  // stop it taking the value. Indexing makes the gap unreachable instead.
  const yearInput = Inputs.range([0, years.length - 1], {
    step: 1,
    value: years.length - 1,
    width: 150,
  });
  // Drop the spinbox half of Inputs.range; it would show the index, not the
  // year. The readout in reactive() shows the year.
  yearInput.querySelector("input[type=number]")?.remove();

  const selectedYear = () => years[yearInput.value];

  return reactive([{ control: yearInput, label: () => String(selectedYear()) }], async () => {
    const income = await db.query(`
      SELECT income, count, sector FROM data
      WHERE year = ${selectedYear()}
    `);
    return resize((width) =>
      Plot.plot({
        width,
        marginLeft: 60,
        // Domain fixed across every year so the distributions are comparable
        // as the slider moves — the whole point of the control.
        x: { type: "log", domain: [2_200, 1_000_000] },
        y: { axis: null },
        color: { legend: "swatches", columns: 6, domain: orderSectors },
        marks: [
          Plot.rectY(
            income,
            Plot.binX(
              { y: "sum" },
              {
                x: "income",
                y: "count",
                fill: "sector",
                order: orderSectors,
                thresholds: d3
                  .ticks(Math.log10(2_000), Math.log10(1_000_000), 40)
                  .map((d) => 10 ** d),
                tip: { format: { x: ",.3r" } },
              },
            ),
          ),
        ],
      }),
    );
  });
}

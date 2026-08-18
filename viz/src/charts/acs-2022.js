// American Community Survey, 2022 — income by sector, and rent by region.
//
// Ported from jaan.li/american-community-survey/. Two independent charts off
// two small parquet files, no controls, no DuckDB — the parquet is decoded
// straight to an Arrow table and handed to Plot.
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import { FileAttachment, resize } from "observablehq:stdlib";

/** Income per year, binned on a log scale, stacked by sector of employment. */
export async function IncomeBySector() {
  const income = await FileAttachment("../data/income-histogram.parquet").parquet();

  // Sectors ordered by mean income, descending — so the legend reads as a
  // ranking and the stack order is stable across renders.
  const orderSectors = d3.groupSort(
    income,
    (v) => -d3.sum(v, (d) => d.income * d.count) / d3.sum(v, (d) => d.count),
    (d) => d.sector,
  );

  return resize((width) =>
    Plot.plot({
      width,
      marginLeft: 60,
      x: { type: "log" },
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
                .map((d) => +(10 ** d).toPrecision(3)),
              tip: true,
            },
          ),
        ),
      ],
    }),
  );
}

/** Monthly rent, binned on a log scale, stacked by region of the US. */
export async function RentByRegion() {
  const rent = await FileAttachment("../data/rent-histogram.parquet").parquet();

  // Ascending here, unlike income above — the original ordered regions from
  // cheapest to most expensive, and the area stack reads bottom-up.
  const orderRegions = d3.groupSort(
    rent,
    (v) => d3.sum(v, (d) => d.rent * d.count) / d3.sum(v, (d) => +d.count),
    (d) => d.region,
  );

  return resize((width) =>
    Plot.plot({
      width,
      marginLeft: 60,
      x: { type: "log" },
      color: { legend: "swatches", columns: 6, domain: orderRegions },
      marks: [
        Plot.areaY(
          rent,
          Plot.binX(
            { y: "sum" },
            {
              x: "rent",
              y: "count",
              fill: "region",
              order: orderRegions,
              thresholds: d3
                .ticks(Math.log10(100), Math.log10(10_000), 50)
                .map((d) => +(10 ** d).toPrecision(3)),
              tip: true,
              curve: "monotone-x",
            },
          ),
        ),
      ],
    }),
  );
}

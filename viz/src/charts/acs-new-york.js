// American Community Survey, 2005–2022, New York–Newark–Jersey City CBSA.
//
// Two visualizations that differ only in what they colour by, so they share
// everything here: /american-community-survey/new-york-area splits income by
// SECTOR of employment, /american-community-survey/income-by-race splits the
// same income by self-reported RACE. Both scrub by year and by PUMA (public
// use microdata area).
//
// Both datasets are past Cloudflare Pages' 25 MiB per-file ceiling — 45 MB and
// 24.6 MB — so they are served from R2 and read over HTTP range requests
// rather than baked in as FileAttachments. See config.js.
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import * as Inputs from "npm:@observablehq/inputs";
import { DuckDBClient } from "npm:@observablehq/duckdb";
import { resize } from "observablehq:stdlib";
import { remote } from "./config.js";
import { reactive, column, rows } from "./util.js";

// The five states the New York–Newark–Jersey City CBSA reaches into. The data
// carries FIPS state codes and no state names, and the original page hard-coded
// this map rather than shipping a lookup table for five rows.
//
// prettier-ignore — the keys stay quoted. These are FIPS codes, which are
// two-character strings with a significant leading zero ("09" is Connecticut),
// and they arrive from DuckDB as strings. Letting four of the five be unquoted
// numbers while "09" alone keeps its quotes reads as an inconsistency rather
// than as one homogeneous set of codes.
// prettier-ignore
const STATE_NAMES = {
  "09": "Connecticut",
  "34": "New Jersey",
  "36": "New York",
  "42": "Pennsylvania",
  "44": "Rhode Island"
};

// Race categories, ordered so the largest groups sit at the bottom of the
// stack. Fixed rather than data-derived: the set is stable across every year
// and PUMA, and a derived order would recolour the chart as you scrub.
const ORDER_RACES = [
  "Other",
  "Two or More",
  "Native Hawaiian and Other Pacific Islander",
  "American Indian or Alaska Native",
  "Asian",
  "Alaska Native",
  "American Indian",
  "Black or African American",
  "White",
];

/** Every PUMA in the data, labelled "State — Area", sorted by state then area. */
async function pumaDetails(db) {
  const details = rows(await db.query(`SELECT DISTINCT puma, puma_name, state_code FROM data`)).map(
    (d) => ({
      puma: d.puma,
      stateCode: d.state_code,
      label: `${STATE_NAMES[d.state_code]} — ${String(d.puma_name).replace("PUMA", "").trim()}`,
    }),
  );

  details.sort((a, b) => {
    const byState = STATE_NAMES[a.stateCode].localeCompare(STATE_NAMES[b.stateCode]);
    return byState !== 0 ? byState : a.label.localeCompare(b.label);
  });
  return details;
}

/**
 * Build the shared year + PUMA scrubber and the chart under it.
 *
 * @param {object} opts
 * @param {string} opts.file        dataset filename in the R2 bucket
 * @param {string} opts.by          column to colour and stack by
 * @param {string[]} [opts.order]   fixed category order; omit to rank by mean income
 * @param {number} opts.columns     legend columns
 */
async function incomeExplorer({ file, by, order, columns }) {
  const db = await DuckDBClient.of({ data: remote(file) });

  const years = column(await db.query(`SELECT DISTINCT year FROM data ORDER BY year`), "year");
  const pumas = await pumaDetails(db);

  // Ranked once against the most recent year when no fixed order is given, for
  // the same reason ORDER_RACES is a constant: a per-year sort would repaint
  // the chart on every step of the slider.
  const mostRecentYear = years[years.length - 1];
  const domain =
    order ??
    rows(
      await db.query(`
        SELECT ${by}, SUM(income * count) / SUM(count) AS mean_income
        FROM data
        WHERE year = ${mostRecentYear}
        GROUP BY ${by}
        ORDER BY mean_income DESC
      `),
    ).map((d) => d[by]);

  // Indexes into `years` rather than spanning the year range: 2020 is absent
  // from this data (no standard one-year Census sample was published for it),
  // and a plain 2005…2022 slider would let you stop on a year that returns no
  // rows. See the same note in acs-income.js.
  const yearInput = Inputs.range([0, years.length - 1], {
    step: 1,
    value: years.length - 1,
    width: 150,
  });
  yearInput.querySelector("input[type=number]")?.remove();

  const pumaInput = Inputs.select(pumas, {
    label: "Area",
    value: pumas[0],
    format: (d) => d.label,
  });

  // No readout on the area picker: a <select> already shows its own value, and
  // the original's big heading above it just said the same thing twice. The
  // year slider does need one — its value is otherwise invisible.
  return reactive(
    [{ control: pumaInput }, { control: yearInput, label: () => String(years[yearInput.value]) }],
    async () => {
      const { puma, stateCode } = pumaInput.value;
      const year = years[yearInput.value];
      // Parameterized rather than interpolated: `puma_name` is free text from
      // the Census and the original built this string by hand. Nothing here is
      // user-supplied, but a quoted identifier from a data file still has no
      // business being pasted into SQL.
      const income = await db.query(
        `SELECT income, count, ${by} FROM data
         WHERE year = ? AND puma = ? AND state_code = ?`,
        [year, puma, stateCode],
      );

      return resize((width) =>
        Plot.plot({
          width,
          marginLeft: 60,
          // Fixed domain: the comparison across years and areas is the point,
          // and an auto domain would rescale under every change.
          x: { type: "log", domain: [5_000, 500_000] },
          y: { axis: null },
          color: { legend: "swatches", columns, domain },
          marks: [
            Plot.rectY(
              income,
              Plot.binX(
                { y: "sum" },
                {
                  x: "income",
                  y: "count",
                  fill: by,
                  order: domain,
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
    },
  );
}

/** Income by sector of employment, by year and PUMA. */
export const IncomeBySectorNewYork = () =>
  incomeExplorer({
    file: "income-histogram-historical-new-york-area.parquet",
    by: "sector",
    columns: 6,
  });

/** The same income, split by self-reported race. */
export const IncomeByRaceNewYork = () =>
  incomeExplorer({
    file: "income-histogram-historical-new-york-area-by-race.parquet",
    by: "race",
    order: ORDER_RACES,
    columns: 1,
  });

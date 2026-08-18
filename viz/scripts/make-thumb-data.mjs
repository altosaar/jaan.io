// Regenerate the extracts the /visualizations index marks are drawn from.
//
//   node scripts/make-thumb-data.mjs        (from viz/)
//
// NOT part of any build. This is a one-off, run by hand when a source dataset
// changes, and its output is committed. That is the point: the marks are small
// decorative drawings, and making the site build depend on a 45 MB parquet, a
// 101 MB tile archive, an R2 bucket, or a checkout of ../jaan.li in order to
// draw one would be a bad trade. The loaders in src/thumbs/ read only what this
// writes.
//
// EVERY EXTRACT MIRRORS ITS CHART. The binning, the domains, the category order
// and the opening state below are copied from the corresponding module in
// src/charts/, so each mark is a miniature of its chart rather than an
// impression of it. Change a chart's thresholds or x domain and change them
// here too.
//
// Requires the DuckDB CLI (`brew install duckdb`) and, for the datasets that
// live in R2, a jaan.li checkout — set JAAN_LI if it is not ../../jaan.li.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, openSync, readSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PMTiles } from "pmtiles";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { greyPNG } from "./png.mjs";

const vizRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(vizRoot, "src", "thumbs", "data");
const local = join(vizRoot, "src", "data");
const jaanli = join(resolve(vizRoot, process.env.JAAN_LI ?? "../../jaan.li"), "src");

mkdirSync(out, { recursive: true });

const q = (sql) =>
  execFileSync("duckdb", ["-csv", "-c", sql], { encoding: "utf8", maxBuffer: 1 << 28 });

const report = (name, detail, bytes) =>
  console.log(`  ${name.padEnd(28)} ${detail.padStart(12)}  ${(bytes / 1024).toFixed(1)} kB`);

function write(name, sql) {
  const csv = q(sql);
  writeFileSync(join(out, name), csv);
  report(name, `${csv.trim().split("\n").length - 1} rows`, csv.length);
}

const P = (dir, f) => join(dir, f).replaceAll("'", "''");

// Every chart bins on a log x using d3.ticks over log10, and in all of them that
// lands on a step of 0.05 — twenty bins per decade. Written once so the marks
// cannot drift from the charts by a rounding of the binning.
const BINS = 20;
const logBin = (col) => `pow(10, floor(log10(${col}) * ${BINS}) / ${BINS})`;

console.log("thumbnail data:");

// ── Payments by insurance type ───────────────────────────────────────────────
// charts/synthetic-healthcare-data.js: stacked rectY on a log x pinned to
// [100, 300000], stacked Commercial → Medicaid → Medicare. Rows are emitted in
// stack order so the loader can take the order from the file.
write(
  "healthcare-payments.csv",
  `COPY (
     SELECT Insurance AS k, ${logBin("Payment")} AS x, sum(count) AS y
     FROM '${P(local, "insurance_plan_payment_histogram.parquet")}'
     WHERE Payment BETWEEN 100 AND 300000
     GROUP BY 1, 2
     ORDER BY CASE Insurance WHEN 'Commercial' THEN 1 WHEN 'Medicaid' THEN 2 ELSE 3 END, x
   ) TO '/dev/stdout' (FORMAT CSV)`,
);

// ── ACS 2022: income by sector, and rent by region ───────────────────────────
// charts/acs-2022.js. Income stacks by sector ordered on mean income descending,
// rent by region ascending — which is what the two d3.groupSort calls do there.
write(
  "acs-2022-income.csv",
  `COPY (
     WITH ord AS (
       SELECT sector, sum(income * count) / sum(count) AS mean
       FROM '${P(local, "income-histogram.parquet")}' GROUP BY 1
     )
     SELECT k, x, y FROM (
       SELECT d.sector AS k, ${logBin("d.income")} AS x, sum(d.count) AS y, any_value(o.mean) AS m
       FROM '${P(local, "income-histogram.parquet")}' d JOIN ord o USING (sector)
       WHERE d.income BETWEEN 2000 AND 1000000
       GROUP BY 1, 2
     ) ORDER BY m DESC, x
   ) TO '/dev/stdout' (FORMAT CSV)`,
);
write(
  "acs-2022-rent.csv",
  `COPY (
     WITH ord AS (
       SELECT region, sum(rent * count) / sum(count) AS mean
       FROM '${P(local, "rent-histogram.parquet")}' GROUP BY 1
     )
     SELECT k, x, y FROM (
       SELECT d.region AS k, ${logBin("d.rent")} AS x, sum(d.count) AS y, any_value(o.mean) AS m
       FROM '${P(local, "rent-histogram.parquet")}' d JOIN ord o USING (region)
       WHERE d.rent BETWEEN 100 AND 10000
       GROUP BY 1, 2
     ) ORDER BY m, x
   ) TO '/dev/stdout' (FORMAT CSV)`,
);

// ── Two decades of incomes ───────────────────────────────────────────────────
// charts/acs-income.js opens on the most recent year — the slider's initial
// value is years.length - 1 — with sectors ordered by mean income in that year.
// So the mark is that year, not a summary across all of them.
write(
  "acs-historical.csv",
  `COPY (
     WITH src AS (SELECT * FROM '${P(local, "income-histogram-historical.parquet")}'),
     latest AS (SELECT max(year) AS y FROM src),
     ord AS (
       SELECT sector, sum(income * count) / sum(count) AS mean
       FROM src WHERE year = (SELECT y FROM latest) GROUP BY 1
     )
     SELECT k, x, y FROM (
       SELECT d.sector AS k, ${logBin("d.income")} AS x, sum(d.count) AS y, any_value(o.mean) AS m
       FROM src d JOIN ord o ON o.sector = d.sector
       WHERE d.year = (SELECT y FROM latest) AND d.income BETWEEN 2200 AND 1000000
       GROUP BY 1, 2
     ) ORDER BY m DESC, x
   ) TO '/dev/stdout' (FORMAT CSV)`,
);

// ── Glucose ──────────────────────────────────────────────────────────────────
// charts/glucose.js is two stacked views and the mark shows both: the raster
// heatmap above, the diagnostic-category bars below, at the 550:300 height ratio
// the page lays them out in.
//
// The raster goes out as a PNG rather than as CSV — see the note in png.mjs.
const GX = 128;
const GY = 42;
{
  const csv = q(
    `COPY (
       WITH src AS (SELECT * FROM '${P(local, "glucose_full.parquet")}'),
       b AS (SELECT min(epoch(time)) AS lo, max(epoch(time)) AS hi FROM src)
       SELECT
         least(${GX - 1}, floor((epoch(time) - b.lo) / (b.hi - b.lo) * ${GX}))::INT AS gx,
         least(${GY - 1}, floor((glucose - 40) / 310.0 * ${GY}))::INT AS gy,
         sum(count) AS n
       FROM src, b WHERE glucose BETWEEN 40 AND 350
       GROUP BY 1, 2
     ) TO '/dev/stdout' (FORMAT CSV)`,
  );

  // vg.opacityDomain([0, 10]) with vg.opacityClamp(true): ten readings in one of
  // the plot's own raster cells is full opacity. The plot rasters at 2016 × 300,
  // so a cell here covers many of those, and the threshold scales by the ratio
  // of cell areas to reproduce the density of the original rather than a
  // saturated block.
  const scale = ((2016 / GX) * 300) / GY;
  const grey = new Uint8Array(GX * GY);
  for (const line of csv.trim().split("\n").slice(1)) {
    const [gx, gy, n] = line.split(",").map(Number);
    // Glucose counts up from 40 mg/dL; PNG rows count down from the top.
    grey[(GY - 1 - gy) * GX + gx] = Math.round(255 * Math.min(1, n / (10 * scale)));
  }
  const png = greyPNG(grey, GX, GY);
  writeFileSync(join(out, "glucose-raster.png"), png);
  report("glucose-raster.png", `${GX}×${GY}`, png.length);
}

// The lower panel: vg.barX of summed count by route, sorted descending, top 15.
write(
  "glucose-categories.csv",
  `COPY (
     SELECT route AS k, sum(count) AS y
     FROM '${P(local, "glucose_full.parquet")}'
     GROUP BY 1 ORDER BY y DESC LIMIT 15
   ) TO '/dev/stdout' (FORMAT CSV)`,
);

// ── The two New York ACS pages (the datasets that live in R2) ────────────────
// Both open on pumas[0] — the first area once sorted by state then label, which
// is Connecticut's Lower Connecticut River Valley — in the most recent year.
// The marks show exactly that opening state.
if (!existsSync(jaanli)) {
  console.error(`\nSkipping the two New York ACS extracts: no jaan.li source at ${jaanli}`);
} else {
  const acs = join(jaanli, "american-community-survey", "data");
  const nyc = P(acs, "income-histogram-historical-new-york-area.parquet");
  const race = P(acs, "income-histogram-historical-new-york-area-by-race.parquet");

  // charts/acs-new-york.js sorts on state name then on the full label. State 09
  // is Connecticut, which sorts first of the five, and the label sort within it
  // is reproduced by ordering on the name with the "PUMA" prefix stripped.
  const pick = (file) => `
    SELECT puma, state_code FROM '${file}'
    WHERE state_code = '09'
    ORDER BY trim(replace(puma_name, 'PUMA', '')) LIMIT 1`;

  write(
    "acs-nyc-area.csv",
    `COPY (
       WITH src AS (SELECT * FROM '${nyc}'),
       latest AS (SELECT max(year) AS y FROM src),
       chosen AS (${pick(nyc)}),
       ord AS (
         SELECT sector, sum(income * count) / sum(count) AS mean
         FROM src WHERE year = (SELECT y FROM latest) GROUP BY 1
       )
       SELECT k, x, y FROM (
         SELECT d.sector AS k, ${logBin("d.income")} AS x, sum(d.count) AS y, any_value(o.mean) AS m
         FROM src d
         JOIN chosen c ON c.puma = d.puma AND c.state_code = d.state_code
         JOIN ord o ON o.sector = d.sector
         WHERE d.year = (SELECT y FROM latest) AND d.income BETWEEN 5000 AND 500000
         GROUP BY 1, 2
       ) ORDER BY m DESC, x
     ) TO '/dev/stdout' (FORMAT CSV)`,
  );

  // Race stacks in the fixed ORDER_RACES list from the chart, not by mean
  // income, so the rows are emitted in that order.
  write(
    "acs-nyc-race.csv",
    `COPY (
       WITH src AS (SELECT * FROM '${race}'),
       latest AS (SELECT max(year) AS y FROM src),
       chosen AS (${pick(race)}),
       ord(name, rank) AS (VALUES
         ('Other', 1), ('Two or More', 2),
         ('Native Hawaiian and Other Pacific Islander', 3),
         ('American Indian or Alaska Native', 4), ('Asian', 5), ('Alaska Native', 6),
         ('American Indian', 7), ('Black or African American', 8), ('White', 9))
       SELECT k, x, y FROM (
         SELECT d.race AS k, ${logBin("d.income")} AS x, sum(d.count) AS y,
                any_value(o.rank) AS m
         FROM src d
         JOIN chosen c ON c.puma = d.puma AND c.state_code = d.state_code
         JOIN ord o ON o.name = d.race
         WHERE d.year = (SELECT y FROM latest) AND d.income BETWEEN 5000 AND 500000
         GROUP BY 1, 2
       ) ORDER BY m, x
     ) TO '/dev/stdout' (FORMAT CSV)`,
  );
}

// ── New York real estate ─────────────────────────────────────────────────────
// Every tax lot in New York City, rasterised.
//
// The lots are read straight out of the PMTiles archive the map itself serves,
// so this is those 850,000 parcels and not a stand-in. Every lot is far smaller
// than one pixel at this size, which is why it is a raster: what that map looks
// like from far enough away is the FOOTPRINT of the tax lots — solid where the
// city is built, empty over water, parks, rail yards and runways — and a
// coverage grid reproduces exactly that.
const tiles = join(
  jaanli,
  "data",
  "new_york_real_estate_MapPLUTO_data_min_zoom_0_max_zoom_g.pmtiles",
);
if (!existsSync(tiles)) {
  console.error(`Skipping the New York parcel raster: no ${tiles}`);
} else {
  const MW = 192;
  const MH = 120; // 8:5, the mark's aspect

  // FRAMED ON THE DATA, not on the map's opening viewport.
  //
  // The map opens at centre [-74, 40.7], zoom 12.5, and rasterising exactly
  // that puts the parcels in the right-hand half of the frame with the left
  // half empty — because the left half is New Jersey, which MapPLUTO does not
  // cover. On the live map that emptiness is legible: the Protomaps basemap is
  // still under it, so you can see it is Jersey City with no lots drawn. The
  // mark has no basemap, so the same crop reads as a picture that failed to
  // load. Framing the whole extent instead says what the page says it shows —
  // every tax lot in New York City — and fills the frame doing it.
  const world = 256 * 2 ** 20; // web mercator world pixels, at an arbitrary zoom
  const toX = (lon) => ((lon + 180) / 360) * world;
  const toY = (lat) => {
    const s = Math.sin((lat * Math.PI) / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world;
  };

  const fd = openSync(tiles, "r");
  const pm = new PMTiles({
    getKey: () => tiles,
    async getBytes(offset, length) {
      const buf = Buffer.alloc(length);
      readSync(fd, buf, 0, length, offset);
      return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + length) };
    },
  });
  const header = await pm.getHeader();
  const z = header.maxZoom;

  // The archive's own bounds, fitted into the mark's box with its aspect kept —
  // New York is very nearly square in mercator, so it sits letterboxed rather
  // than stretched. Padded by 2% so the Bronx and Staten Island are not flush
  // against the edge.
  const bx0 = toX(header.minLon);
  const bx1 = toX(header.maxLon);
  const by0 = toY(header.maxLat);
  const by1 = toY(header.minLat);
  const scale = Math.min(MW / (bx1 - bx0), MH / (by1 - by0)) * 0.96;
  const spanX = MW / scale;
  const spanY = MH / scale;
  const x0 = (bx0 + bx1) / 2 - spanX / 2;
  const y0 = (by0 + by1) / 2 - spanY / 2;

  const tileOf = (px, py) => [Math.floor((px / world) * 2 ** z), Math.floor((py / world) * 2 ** z)];
  const [tx0, ty0] = tileOf(Math.max(x0, bx0), Math.max(y0, by0));
  const [tx1, ty1] = tileOf(Math.min(x0 + spanX, bx1), Math.min(y0 + spanY, by1));

  // Accumulate lot AREA per cell rather than counting lots: a cell holding one
  // warehouse and a cell holding forty row houses are both built up, and area
  // says so where a count would not.
  const cover = new Float64Array(MW * MH);
  let lots = 0;
  for (let tx = tx0; tx <= tx1; tx++) {
    for (let ty = ty0; ty <= ty1; ty++) {
      const tile = await pm.getZxy(z, tx, ty);
      if (!tile) continue;
      const layer = new VectorTile(new PbfReader(new Uint8Array(tile.data))).layers[
        "dataMapPLUTO24v1_wgs84"
      ];
      if (!layer) continue;
      for (let i = 0; i < layer.length; i++) {
        for (const ring of rings(layer.feature(i).toGeoJSON(tx, ty, z).geometry)) {
          // Shoelace area and centroid, in world pixels. A tax lot is far
          // smaller than a cell, so dropping it whole into the cell its centroid
          // falls in is well within the resolution of the picture.
          let a = 0;
          let cx = 0;
          let cy = 0;
          for (let j = 0, n = ring.length - 1; j < n; j++) {
            const ax = toX(ring[j][0]);
            const ay = toY(ring[j][1]);
            const bx = toX(ring[j + 1][0]);
            const by = toY(ring[j + 1][1]);
            const f = ax * by - bx * ay;
            a += f;
            cx += (ax + bx) * f;
            cy += (ay + by) * f;
          }
          if (!a) continue;
          const gx = Math.floor((cx / (3 * a) - x0) / (spanX / MW));
          const gy = Math.floor((cy / (3 * a) - y0) / (spanY / MH));
          if (gx < 0 || gy < 0 || gx >= MW || gy >= MH) continue;
          cover[gy * MW + gx] += Math.abs(a / 2);
          lots++;
        }
      }
    }
  }

  // A cell reads as built up well before it is wall-to-wall lot: streets, yards
  // and setbacks mean even the densest blocks cover a fraction of their cell.
  // The 0.28 is what makes the built area read solid rather than as a faint
  // wash, matching a map whose parcels are drawn at fill-opacity 0.7.
  const cell = (spanX / MW) * (spanY / MH);
  const grey = new Uint8Array(MW * MH);
  for (let i = 0; i < cover.length; i++) {
    grey[i] = Math.round(255 * Math.min(1, cover[i] / (cell * 0.28)));
  }
  const png = greyPNG(grey, MW, MH);
  writeFileSync(join(out, "nyc-parcels.png"), png);
  report("nyc-parcels.png", `${lots} lots`, png.length);
}

/** Every linear ring in a GeoJSON polygon geometry. */
function* rings(geometry) {
  if (geometry.type === "Polygon") yield* geometry.coordinates;
  else if (geometry.type === "MultiPolygon") for (const p of geometry.coordinates) yield* p;
}

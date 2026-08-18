# viz/ — the charts behind /visualizations

This is an [Observable Framework](https://observablehq.com/framework) project
used **only as a module bundler**. It builds no pages. Each file in
`src/charts/` is compiled to a standalone ES module under
`dist/charts/<name>.js` — Framework calls these
[exported modules](https://observablehq.com/framework/embeds) — which the Astro
pages in `../src/pages/visualizations/` import at runtime and append to the DOM.

Everything a reader sees around a chart (headline, standfirst, prose, source
note, header, footer) is Astro, using jaan.io's own tokens. Everything inside
the chart comes from here.

## Why keep Framework in the loop

Seven of these pages came from `jaan.li`, a full Framework site, and the eighth
from `payless.health`; all were written against Framework's or Mosaic's
primitives: `FileAttachment`, `DuckDBClient`,
`resize`, `Inputs`, and Mosaic's `vg`. Framework's build bakes file resolutions
into the module, self-hosts every npm dependency, and preloads the transitive
import graph. Reproducing duckdb-wasm's worker and wasm plumbing under Vite is
the genuinely fiddly part of doing this by hand; this is the job the tool
advertises, so it does it.

The emitted modules use **relative** imports (`../_npm/…`, `../../_file/…`), so
the whole `dist/` tree can be mounted at any prefix without rebuilding.

## Building

`scripts/build-visualizations.mjs` writes the charts to **`public/visualizations/`**,
and `npm run build` runs it **before** `astro build`.

That target is deliberate. Building into `dist/` after Astro finishes also works
for production — but then the chart modules exist only in a production build,
and `astro dev` 404s every one of them, so every page in dev shows its error
state ("This chart could not be loaded") as though the chart itself were broken.
Astro copies `public/` into `dist/` verbatim, so building there means dev and
production serve identical files from identical URLs.

```sh
npm run dev     # builds the charts if public/visualizations is missing, then astro dev
npm run viz     # force a rebuild after editing a chart module
npm run build   # charts, then astro build
```

`public/visualizations/` is generated output: gitignored, prettier-ignored, and
cleared at the start of every build so a renamed chart cannot leave a stale
module behind.

`npm run viz:dev` starts Framework's own preview server, which is the fastest
way to iterate on a chart module in isolation.

## What the build script does

`scripts/build-visualizations.mjs` is not just a copy:

1. **Repoints DuckDB's wasm binaries at jsDelivr and deletes them from the
   tree.** They are 40 MB and 36 MB — Cloudflare Pages refuses any single file
   over 25 MiB, so they cannot ship. jsDelivr serves the identical files, from
   the same package version, with `access-control-allow-origin: *`.
2. **Fails the build** if anything is still over 25 MiB, rather than letting
   `wrangler pages deploy` discover it after a long upload.
3. **Swaps the data host** when `VIZ_DATA_BASE` is set — see below.

## The three datasets that live in R2

Everything under 20 MB is a `FileAttachment` in `src/data/`, baked and hashed by
Framework. Three files are too big for that:

| File                                                               | Size   | Used by              |
| ------------------------------------------------------------------ | ------ | -------------------- |
| `new_york_real_estate_MapPLUTO_data_min_zoom_0_max_zoom_g.pmtiles` | 101 MB | New York real estate |
| `income-histogram-historical-new-york-area.parquet`                | 45 MB  | ACS → New York area  |
| `income-histogram-historical-new-york-area-by-race.parquet`        | 25 MB  | ACS → income by race |

They are served from an R2 bucket instead, referenced through `remote()` in
`src/charts/config.js`. This is not purely a workaround for the file-size cap:
DuckDB-wasm reads remote parquet over **HTTP range requests**, so filtering to
one year and one microdata area pulls the row groups it needs rather than the
whole 45 MB file. PMTiles is a range-request format for the same reason. Both
are faster this way than as baked attachments.

### One-time bucket setup

```sh
npx wrangler r2 bucket create jaan-io-data
```

Then, in the Cloudflare dashboard, attach the custom domain **`data.jaan.io`**
to the bucket (R2 → jaan-io-data → Settings → Public access → Custom domains).
That hostname is what `DATA_BASE` in `src/charts/config.js` points at; change
one and change the other.

`data.jaan.io` and `jaan.io` are different origins, so the bucket needs a CORS
policy. Allowing the `Range` request header and exposing `Content-Range`,
`Content-Length` and `ETag` is the part that matters — without those, DuckDB and
PMTiles fall back to fetching whole files, or fail outright:

```json
[
  {
    "AllowedOrigins": ["https://jaan.io"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["range", "if-match"],
    "ExposeHeaders": ["content-range", "content-length", "etag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Uploading the data

The files are not in this repo. They come from the `jaan.li` source tree:

```sh
SRC=../../jaan.li/src
npx wrangler r2 object put jaan-io-data/new_york_real_estate_MapPLUTO_data_min_zoom_0_max_zoom_g.pmtiles \
  --file "$SRC/data/new_york_real_estate_MapPLUTO_data_min_zoom_0_max_zoom_g.pmtiles" \
  --content-type application/octet-stream --remote

npx wrangler r2 object put jaan-io-data/income-histogram-historical-new-york-area.parquet \
  --file "$SRC/american-community-survey/data/income-histogram-historical-new-york-area.parquet" \
  --content-type application/vnd.apache.parquet --remote

npx wrangler r2 object put jaan-io-data/income-histogram-historical-new-york-area-by-race.parquet \
  --file "$SRC/american-community-survey/data/income-histogram-historical-new-york-area-by-race.parquet" \
  --content-type application/vnd.apache.parquet --remote
```

### Running all seven before the bucket exists

```sh
npm run viz:local   # copies the three files out of ../jaan.li, rebuilds against localhost
npm run dev
```

`scripts/stage-viz-data.mjs` puts them in `public/_viz-data/` and rebuilds the
modules with `VIZ_DATA_BASE=http://localhost:4321/_viz-data`. Same code path,
same HTTP range requests, different host. Set `JAAN_LI` if that checkout is not
beside this repo, and `VIZ_PORT=4322` to check a `npm run preview` build instead.

`public/_viz-data/` is gitignored and **must not be deployed** — every file in it
is over the Pages limit, which is why they belong in R2. `npm run build` stages
nothing, so a production build never picks them up; re-run `npm run viz:local`
after any `npm run viz` or `npm run build`, since both rebuild the modules
against the production R2 host.

## Adding a chart

1. Write `src/charts/<name>.js` exporting a function that returns a DOM node.
2. Add `/charts/<name>.js` to `dynamicPaths` in `observablehq.config.js` — a
   module not listed there is not built, because there is no page here to pull
   it in.
3. Add `<VizEmbed module="<name>" export="<Fn>" />` to an Astro page.
4. Add the page to `src/data/visualizations.ts` so it appears on the index, with
   a `thumb` naming its mark.
5. Add `src/thumbs/<thumb>.svg.js` and list `/thumbs/<thumb>.svg` in
   `dynamicPaths` too — see "The index thumbnails" below.

## The index marks

The small drawing beside each entry on `/visualizations` is the same mechanism
as the chart modules, in its other form: `src/thumbs/*.svg.js` are Framework
**data loaders**, listed in `dynamicPaths`, whose stdout _is_ the file. Framework
runs them at build time, so each writes a finished `.svg` to
`public/visualizations/thumbs/`, and `src/pages/visualizations.astro` reads those
off disk and inlines them.

**Each mark is a miniature of its chart, not a decorative stand-in.** Same mark
type, same stacking, same category order, same pinned domains, same opening
state. A stacked histogram's mark is a stacked histogram; the two-chart ACS page
gets two panels, bars over a smooth area, in the order the page shows them; the
glucose page's mark is its heatmap over its category bars at the same 550:300
ratio and with the same margins; the map's mark is the map. The ACS pages'
marks resemble each other because those pages resemble each other — same data,
same axes, same bars, one column swapped — and inventing a distinction the site
does not have was the mistake this replaced.

Only two things are dropped, because neither survives the size:

- **Axes, ticks, labels, titles, legends.** At 128 × 80 type is illegible and the
  row already carries the words.
- **Colour.** Everything is `currentColor`, so a mark inherits the page's text
  colour and follows the theme instead of baking in a grey. A categorical fill
  scale becomes a spread of opacities — stepped by the golden ratio rather than
  ramped evenly, since an even ramp over nineteen sectors puts neighbours four
  percent apart and the stack reads as one flat mass.

  **No exceptions.** The hospital-charges mark briefly kept its chart's red x=y
  reference line, on the reasoning that the cloud is read against it. One mark
  carrying a colour the other seven do not is worse than the line is good: the
  row is a set, and the set is monochrome. `grep -ohE '#[0-9a-fA-F]{3,8}|rgb\(' 
dist/thumbs/*.svg` should return nothing.

Inlined rather than `<img src="…">`, which is what the Framework docs show. An
SVG loaded through `<img>` is a separate document: it inherits no colour and no
custom properties, so `currentColor` would resolve to black and the marks would
vanish on a black page. The files are still published at their own URLs and can
be hotlinked.

### The two rasters

The glucose heatmap and the New York parcel map are images, not vectors, and are
carried as greyscale PNGs in a data URI used as an SVG `<mask>` over a plain
`currentColor` rectangle — so they stay theme-aware like everything else.
`scripts/png.mjs` is a 40-line encoder; this is the only image work in the
project and it did not seem worth a native dependency.

The parcel raster is read **straight out of the PMTiles archive the map itself
serves**: 929,600 lots, decoded from the vector tiles and accumulated by lot area
into a coverage grid. Every lot is far smaller than a pixel at this size, so what
the map looks like from far enough away is the footprint of the tax lots — solid
where the city is built, empty over water, parks, rail yards and runways.

It is framed on the whole dataset rather than on the map's opening viewport
(centre `[-74, 40.7]`, zoom 12.5). That crop puts the parcels in the right-hand
half with the left half empty, because the left half is New Jersey and MapPLUTO
does not cover it. On the live map that emptiness is legible — the Protomaps
basemap is still under it — but the mark has no basemap, so the same crop reads
as an image that failed to load.

### Size

`print()` in `mark.js` strips Plot's scoped `<style>`, hoists the repeated
`fill="currentColor"` onto the root, drops stack segments under 0.25 px tall, and
rounds coordinates to two decimals. That is not fussiness: a stacked histogram of
nineteen sectors over fifty bins is 950 rectangles, and in most bins all but a
few contribute an invisible sliver. Together these take the set from 236 kB to
about 160 kB, roughly 31 kB over the wire once the page is compressed. Dropping a
rect does not move its neighbours — Plot has already resolved every stack
position into absolute coordinates — so the picture is unchanged.

### Regenerating the data

The loaders read committed extracts in `src/thumbs/data/` rather than the source
datasets. This is deliberate: a mark is a small decorative drawing, and making
the site build depend on a 45 MB parquet, a 101 MB tile archive, an R2 bucket, or
a checkout of `../jaan.li` to draw one would be a bad trade.

```sh
node scripts/make-thumb-data.mjs    # from viz/
```

Run by hand when a source dataset changes; the output is committed. It needs the
DuckDB CLI, and a `jaan.li` checkout for the datasets that live in R2 (set
`JAAN_LI` if it is not `../../jaan.li`). It skips what it cannot find rather than
failing.

**The binning, domains, category order and opening state in that script are
copied from the matching module in `src/charts/`.** Change a chart's thresholds
or its x domain and change them there too, or the mark stops being a picture of
the chart.

// Where the data files that are too big to ship with the site actually live.
//
// Cloudflare Pages refuses any single file over 25 MiB, and three of these
// datasets are well past it — the MapPLUTO tileset is 101 MB on its own. They
// are served from an R2 bucket on a custom domain instead. See viz/README.md
// for the bucket setup and the upload commands.
//
// This is not purely a workaround. DuckDB-wasm reads remote parquet over HTTP
// range requests, so `SELECT … WHERE year = 2019` off an R2 URL pulls the row
// groups it needs rather than the whole 45 MB file, which is strictly better
// than the baked FileAttachment it replaces. Same for PMTiles, which is a
// range-request format by design.
//
// Everything under 20 MB stays a FileAttachment in src/data/ — baked, hashed,
// and immutable, which is the thing Framework is good at.
export const DATA_BASE = "https://data.jaan.io";

/** URL of a dataset hosted in the R2 bucket. */
export const remote = (name) => `${DATA_BASE}/${name}`;

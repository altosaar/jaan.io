// Observable Framework, used ONLY as a module bundler.
//
// This project builds no pages. Every visualization on jaan.io/visualizations
// is a normal Astro page carrying the site's own type, colour and chrome; the
// only thing that comes from here is the chart itself, as an "exported module"
// (https://observablehq.com/framework/embeds) that the Astro page imports and
// appends.
//
// Why keep Framework in the loop at all, rather than importing Plot and DuckDB
// straight into an Astro client script? Because the pages being ported are
// written against Framework's primitives — FileAttachment, DuckDBClient,
// resize, Inputs — and Framework's build bakes file resolutions, self-hosts
// every npm dependency, and preloads the transitive import graph. Reproducing
// duckdb-wasm's worker/wasm plumbing under Vite is the fiddly part of doing
// this by hand, and this is exactly the job the tool advertises.
//
// The emitted modules use RELATIVE imports (../_npm/…, ../../_file/…), so the
// whole dist/ tree can be mounted at any prefix. `base` is set anyway because
// it is what the URLs actually are.
export default {
  root: "src",
  base: "/visualizations/",

  // One entry per exported module. A module NOT listed here is not built —
  // there is no page in this project to pull it in.
  dynamicPaths: [
    "/charts/synthetic-healthcare-data.js",
    "/charts/new-york-real-estate.js",
    "/charts/glucose.js",
    "/charts/acs-2022.js",
    "/charts/acs-income.js",
    "/charts/acs-new-york.js",

    // The index thumbnails: Observable Plot rendered to SVG at build time by
    // the data loaders in src/thumbs/, one per visualization. Framework calls
    // these "exported files" — the same dynamicPaths mechanism as the modules
    // above, but the loader's stdout IS the file. src/pages/visualizations.astro
    // reads them off disk and inlines them.
    "/thumbs/synthetic-healthcare-data.svg",
    "/thumbs/new-york-real-estate.svg",
    "/thumbs/glucose.svg",
    "/thumbs/american-community-survey.svg",
    "/thumbs/acs-income.svg",
    "/thumbs/acs-new-york-area.svg",
    "/thumbs/acs-income-by-race.svg",
  ],
};

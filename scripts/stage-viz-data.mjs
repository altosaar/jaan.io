// Stage the three R2-hosted datasets locally, so all seven visualizations work
// before the R2 bucket exists.
//
//   npm run viz:local     # then: npm run dev
//
// Copies the files out of the jaan.li checkout into public/_viz-data/ and
// rebuilds the chart modules pointed at http://localhost:4321/_viz-data instead
// of https://data.jaan.io. Nothing else changes — the same code path, the same
// range requests, just a different host.
//
// public/_viz-data/ is gitignored and MUST NOT be deployed: every file in it is
// over Cloudflare Pages' 25 MiB per-file limit, which is the reason they live in
// R2 in the first place. `npm run build` does not stage anything, so a normal
// production build never picks them up.
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "public", "_viz-data");

// Where the source data lives. Overridable because this is the one thing here
// that depends on a checkout outside this repo.
const source = resolve(root, process.env.JAAN_LI ?? "../jaan.li", "src");

// Must match the filenames passed to remote() in viz/src/charts/config.js.
const FILES = [
  "data/new_york_real_estate_MapPLUTO_data_min_zoom_0_max_zoom_g.pmtiles",
  "american-community-survey/data/income-histogram-historical-new-york-area.parquet",
  "american-community-survey/data/income-histogram-historical-new-york-area-by-race.parquet",
];

// The port `astro dev` uses. `npm run preview` serves on 4322, so pass
// VIZ_PORT=4322 before checking a production build.
const port = process.env.VIZ_PORT ?? "4321";

if (!existsSync(source)) {
  console.error(
    `\nCannot find the jaan.li source at ${source}.\n` +
      `Clone it beside this repo, or set JAAN_LI to its path:\n\n` +
      `  JAAN_LI=../some/other/jaan.li npm run viz:local\n`,
  );
  process.exit(1);
}

await mkdir(target, { recursive: true });
for (const file of FILES) {
  const from = join(source, file);
  if (!existsSync(from)) {
    console.error(`Missing dataset: ${from}`);
    process.exit(1);
  }
  const to = join(target, basename(file));
  await copyFile(from, to);
  console.log(
    `  ${((await stat(to)).size / 1024 / 1024).toFixed(0).padStart(4)} MB  ${basename(file)}`,
  );
}

execFileSync("node", [join(root, "scripts", "build-visualizations.mjs")], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, VIZ_DATA_BASE: `http://localhost:${port}/_viz-data` },
});

console.log(
  `\nStaged. \`npm run dev\` on port ${port} now serves all seven visualizations.\n` +
    `Re-run this after \`npm run viz\` or \`npm run build\`, both of which rebuild\n` +
    `the modules against the production R2 host.\n`,
);

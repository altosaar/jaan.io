// Build the Observable Framework charts in viz/ into public/visualizations.
//
// Run BEFORE `astro build`, which is what `npm run build` does.
//
// public/, not dist/. The obvious wiring is to build into dist/ after Astro has
// finished, since Astro clears dist/ on every run — but then the chart modules
// exist ONLY in a production build, and `astro dev` 404s every one of them.
// What the reader gets in dev is each page's error state ("This chart could not
// be loaded"), which looks like a broken chart rather than a missing file.
//
// Astro copies public/ into dist/ verbatim, so building here means dev and
// production both serve the same files from the same URLs, with no ordering
// constraint to remember. The cost is that public/visualizations is generated
// output living in the source tree: it is gitignored and prettier-ignored, and
// this script clears it before each build so a renamed chart cannot leave a
// stale module behind.
//
// Three things happen here beyond a copy:
//
//   1. DuckDB's two wasm binaries are repointed at jsDelivr and deleted from
//      the tree. They are 40 MB and 36 MB, and Cloudflare Pages refuses any
//      single file over 25 MiB, so shipping them is not an option. jsDelivr
//      serves the identical files from the same package version with
//      `access-control-allow-origin: *`.
//
//   2. Everything still over the limit is reported and the build FAILS. Better
//      to stop here than to find out at `wrangler pages deploy`, which uploads
//      for a while before rejecting the file.
//
//   3. The result is listed, so the build output says plainly what was added
//      under /visualizations.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vizRoot = join(root, "viz");
const vizDist = join(vizRoot, "dist");
const target = join(root, "public", "visualizations");

// Cloudflare Pages' hard per-file ceiling. Not a warning threshold — an upload
// containing a larger file is rejected outright.
const MAX_FILE_BYTES = 25 * 1024 * 1024;

// The duckdb-wasm version Framework self-hosts. Read out of the emitted path
// rather than pinned here, so a Framework upgrade that moves to a new duckdb
// cannot silently leave this rewriting a version that is no longer there.
//
// The leading `(?:\.\.\/)*` is not optional decoration. Framework emits these
// as RELATIVE paths ("../../_npm/@duckdb/…"), and a pattern anchored at `_npm`
// replaces only the tail — leaving "../../https://cdn.jsdelivr.net/…", which
// the browser resolves against the page into a 404 on this origin. The symptom
// is a thrown "Failed to execute 'compile' on 'WebAssembly': HTTP status code
// is not ok" from inside the DuckDB worker, several layers from the cause.
const DUCKDB_WASM =
  /(?:\.\.\/)*_npm\/@duckdb\/duckdb-wasm@([\d.]+)\/dist\/(duckdb-(?:eh|mvp)\.wasm)/g;
const jsdelivr = (version, file) =>
  `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${version}/dist/${file}`;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

// ── Build viz/ ───────────────────────────────────────────────────────────────
// `--if-missing` is how `npm run dev` calls this: build the charts on the first
// dev run of a fresh checkout, then get out of the way, so editing an Astro
// page does not pay for a Framework build every restart. `npm run viz` forces
// one when a chart module actually changes.
//
// It is the blunter of the two gates and stays that way ON PURPOSE. The
// fingerprint below is exact and would rebuild mid-session the moment a chart
// changed; `astro dev` is already running by then, and a five-second stall on
// restart is not what you want while editing a chart — the dev server serves
// the previous build until you ask for a new one. Every other caller gets the
// exact gate.
if (process.argv.includes("--if-missing") && existsSync(join(target, "charts"))) {
  console.log(
    "visualizations: public/visualizations already built — skipping (npm run viz to rebuild)",
  );
  process.exit(0);
}

// ── Skip when nothing that feeds the build has changed ───────────────────────
// A Framework build is ~5 seconds and 162 lines of asset log, and it ran on
// every `npm run build` — so every push paid for it whether or not a chart had
// been touched, which in practice is almost never.
//
// The fingerprint covers everything that can change the output: the chart
// sources and their data, the Framework config, the exact dependency versions
// (package-lock, not package.json's ranges), and THIS script, which rewrites
// the emitted tree afterwards. VIZ_DATA_BASE is folded in because it
// substitutes a different host into every module, so flipping it has to force a
// rebuild even though no file changed.
//
// Framework's download cache under viz/src/.observablehq is excluded: it is
// 89 MB, it is gitignored, and it is an artefact of the build rather than an
// input to it — hashing it would invalidate the stamp on every run. Hashing
// what remains is ~17 MB and takes 0.1s, which is the point: correctness here
// is cheap, and a stale chart shipping because a heuristic guessed wrong is
// not.
//
//   npm run viz    forces a rebuild (passes --force)
const stampFile = join(vizRoot, ".build-stamp");
const HASH_ROOTS = [
  "src",
  "scripts",
  "observablehq.config.js",
  "package.json",
  "package-lock.json",
];

async function fingerprint() {
  const paths = [fileURLToPath(import.meta.url)];
  for (const entry of HASH_ROOTS) {
    const start = join(vizRoot, entry);
    if (!existsSync(start)) continue;
    if ((await stat(start)).isDirectory()) for await (const path of walk(start)) paths.push(path);
    else paths.push(start);
  }
  const hash = createHash("sha256");
  hash.update(`VIZ_DATA_BASE=${process.env.VIZ_DATA_BASE ?? ""}\n`);
  // Sorted, and each entry carries its path as well as its content, so moving a
  // file between two names cannot produce the same digest.
  for (const path of paths.filter((p) => !p.includes(`${sep}.observablehq${sep}`)).sort()) {
    const content = createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
    hash.update(`${relative(root, path)}\0${content}\n`);
  }
  return hash.digest("hex");
}

const stamp = await fingerprint();
if (!process.argv.includes("--force") && existsSync(join(target, "charts"))) {
  const previous = existsSync(stampFile) ? (await readFile(stampFile, "utf8")).trim() : "";
  if (previous === stamp) {
    console.log(
      "visualizations: inputs unchanged — reusing public/visualizations (npm run viz to rebuild)",
    );
    process.exit(0);
  }
}

if (!existsSync(join(vizRoot, "node_modules"))) {
  console.log("visualizations: installing viz/ dependencies");
  execFileSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: vizRoot, stdio: "inherit" });
}
console.log("visualizations: building chart modules");
execFileSync("npx", ["observable", "build"], { cwd: vizRoot, stdio: "inherit" });

// ── Repoint the DuckDB wasm binaries at jsDelivr ─────────────────────────────
// Only one file references them: the stdlib duckdb shim, which holds the bundle
// manifest duckdb-wasm selects from at runtime.
let rewritten = 0;
const dropped = new Set();
for await (const path of walk(vizDist)) {
  if (!path.endsWith(".js")) continue;
  const source = await readFile(path, "utf8");
  if (!source.includes("duckdb-eh.wasm") && !source.includes("duckdb-mvp.wasm")) continue;
  const patched = source.replace(DUCKDB_WASM, (match, version, file) => {
    // Record the dist-relative path (without the ../.. prefix) so the local
    // copy can be deleted afterwards.
    dropped.add(match.slice(match.indexOf("_npm")));
    return jsdelivr(version, file);
  });
  if (patched === source) continue;
  await writeFile(path, patched);
  rewritten++;
}
if (rewritten === 0) {
  // Not fatal on its own, but it means the two 40 MB files are still in the
  // tree and the size check below is about to fail. Say why.
  console.warn(
    "visualizations: WARNING — no duckdb wasm references found to rewrite. " +
      "Framework may have changed how it self-hosts duckdb; check the size report below.",
  );
}
for (const path of dropped) await rm(join(vizDist, path), { force: true });
console.log(
  `visualizations: duckdb wasm → jsDelivr (${dropped.size} binaries, ${rewritten} file(s) rewritten)`,
);

// ── Optional: repoint the remote dataset host ────────────────────────────────
// `DATA_BASE` in viz/src/charts/config.js is the production R2 domain. Setting
// VIZ_DATA_BASE swaps it for something else across the built tree — a local
// static server while checking the charts, or a preview bucket. The literal is
// unique enough to substitute directly, and the modules are emitted unminified.
const DEFAULT_DATA_BASE = "https://data.jaan.io";
if (process.env.VIZ_DATA_BASE) {
  const replacement = process.env.VIZ_DATA_BASE.replace(/\/$/, "");
  let patched = 0;
  for await (const path of walk(vizDist)) {
    if (!path.endsWith(".js")) continue;
    const source = await readFile(path, "utf8");
    if (!source.includes(DEFAULT_DATA_BASE)) continue;
    await writeFile(path, source.split(DEFAULT_DATA_BASE).join(replacement));
    patched++;
  }
  console.log(`visualizations: data host → ${replacement} (${patched} file(s))`);
}

// ── Refuse to ship anything Cloudflare Pages will reject ─────────────────────
const oversized = [];
for await (const path of walk(vizDist)) {
  const { size } = await stat(path);
  if (size > MAX_FILE_BYTES) oversized.push({ path: relative(vizDist, path), size });
}
if (oversized.length) {
  console.error("\nvisualizations: these files exceed Cloudflare Pages' 25 MiB per-file limit:\n");
  for (const { path, size } of oversized) {
    console.error(`  ${(size / 1024 / 1024).toFixed(1).padStart(6)} MB  ${path}`);
  }
  console.error(
    "\nMove them to the R2 bucket and reference them through remote() in " +
      "viz/src/charts/config.js. See viz/README.md.\n",
  );
  process.exit(1);
}

// ── Clear the local data staging directory ───────────────────────────────────
// public/_viz-data holds local copies of the three R2-hosted datasets, put
// there by `npm run viz:local` so all seven charts work before the bucket
// exists (see scripts/stage-viz-data.mjs). Astro copies public/ into dist/
// verbatim, which means leaving it in place would quietly add ~250 MB to a
// production build — including two files past the Pages per-file limit, so the
// deploy would fail after a long upload.
//
// Removing it here rather than warning about it: this build has just pointed
// the modules back at the production R2 host, so the staged copies are not
// merely large, they are unreferenced. `npm run viz:local` puts them back.
// Skipped when VIZ_DATA_BASE is set, since that IS the local-data build.
if (!process.env.VIZ_DATA_BASE) {
  const staging = join(root, "public", "_viz-data");
  if (existsSync(staging)) {
    await rm(staging, { recursive: true, force: true });
    console.log("visualizations: cleared public/_viz-data (npm run viz:local to restore)");
  }
}

// ── Publish ──────────────────────────────────────────────────────────────────
// Cleared first: Framework hashes its asset filenames, so a rebuild after a
// data or dependency change writes new names beside the old ones. Copying over
// the top would accumulate every version ever built and ship all of them.
// Dropped BEFORE the target is cleared and rewritten after the copy lands, so a
// build killed partway through leaves no stamp standing over a half-copied
// tree — the next run rebuilds rather than trusting the wreckage.
await rm(stampFile, { force: true });
await rm(target, { recursive: true, force: true });
await cp(vizDist, target, { recursive: true });
await writeFile(stampFile, `${stamp}\n`);

let files = 0;
let bytes = 0;
for await (const path of walk(target)) {
  files++;
  bytes += (await stat(path)).size;
}
console.log(
  `visualizations: ${files} files (${(bytes / 1024 / 1024).toFixed(1)} MB) → ${relative(root, target)}`,
);

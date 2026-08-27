// Refuse to finish a build that Cloudflare Pages cannot deploy.
//
//   npm run build          # runs this last, after astro build
//   node scripts/check-pages-limits.mjs [dir]   # default: dist
//
// Pages rejects a deployment containing any file over 25 MiB, and caps a
// deployment at 20,000 files. Both are checked against dist/ — the actual
// upload — rather than against any one source directory.
//
// ── WHY THIS EXISTS SEPARATELY FROM THE VIZ CHECK ────────────────────────────
// scripts/build-visualizations.mjs already enforces the same 25 MiB ceiling,
// and that is where the rule was learned: DuckDB-wasm ships two binaries of
// 40 MB and 36 MB, and a build carrying them uploads for several minutes and
// then fails. But that check walks viz/dist only, because that is the output it
// is responsible for.
//
// Everything else in the upload was unguarded, and it took exactly one commit
// to find out: porting /papers and /talks put eighteen PDFs in public/, one of
// which — a 64-slide Keynote deck exported with near-uncompressed bitmaps — is
// 34.4 MiB. `npm run build` was perfectly happy. The failure would have arrived
// at `wrangler pages deploy`, after the upload, on a file nothing in the repo
// had ever measured.
//
// So this walks the FINISHED BUILD. public/ is copied verbatim by Astro, the og
// cards are generated into it, and the charts are built into it beforehand —
// dist/ is the one place all of that is visible at once, and it is what
// actually gets handed to Cloudflare.
import { stat, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

// Cloudflare Pages limits. Both are per-deployment and neither is negotiable on
// any plan — see https://developers.cloudflare.com/pages/platform/limits/.
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 20_000;

// Report anything within this much of the ceiling, without failing. A file that
// grows past the limit does so between two commits, and the first warning is
// worth more than the eventual error.
const WARN_AT = 0.8;

const root = process.argv[2] ?? "dist";

if (!existsSync(root)) {
  console.error(`check-pages-limits: ${root} does not exist — run the build first.`);
  process.exit(1);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile()) yield path;
  }
}

const mib = (bytes) => (bytes / 1024 / 1024).toFixed(1).padStart(6);

const oversized = [];
const nearLimit = [];
let count = 0;
let total = 0;

for await (const path of walk(root)) {
  const { size } = await stat(path);
  count++;
  total += size;
  if (size > MAX_FILE_BYTES) oversized.push({ path: relative(root, path), size });
  else if (size > MAX_FILE_BYTES * WARN_AT) nearLimit.push({ path: relative(root, path), size });
}

const bySize = (a, b) => b.size - a.size;

for (const { path, size } of nearLimit.sort(bySize)) {
  console.warn(`check-pages-limits: ${mib(size)} MiB  ${path}  — within 20% of the 25 MiB limit`);
}

if (count > MAX_FILES) {
  console.error(
    `\ncheck-pages-limits: ${count} files in ${root}, over Cloudflare Pages' ${MAX_FILES}-file limit.\n`,
  );
  process.exit(1);
}

if (oversized.length) {
  console.error(
    `\ncheck-pages-limits: ${oversized.length} file(s) in ${root} exceed Cloudflare Pages'` +
      " 25 MiB per-file limit:\n",
  );
  for (const { path, size } of oversized.sort(bySize)) {
    console.error(`  ${mib(size)} MiB  ${path}`);
  }
  // Two genuinely different fixes, because there are two genuinely different
  // kinds of file that land here. Naming both, because picking the wrong one is
  // the expensive mistake: putting a hotlinked PDF behind a redirect changes a
  // URL that other people's pages depend on.
  console.error(
    "\nEither:\n" +
      "  • Shrink it. A Keynote or Illustrator export is usually oversized because\n" +
      "    its images were never downsampled, not because it contains much:\n" +
      "      gs -sDEVICE=pdfwrite -dPDFSETTINGS=/printer -dNOPAUSE -dQUIET -dBATCH \\\n" +
      "         -sOutputFile=out.pdf in.pdf\n" +
      "    Check a few pages against the original before committing it.\n" +
      "  • Move it off Pages, to the R2 bucket (README §7). Right for DATA a chart\n" +
      "    fetches, where this repo chooses the URL. Wrong for anything hotlinked\n" +
      "    from outside — /papers/*.pdf and /talks/*.pdf are linked from other\n" +
      "    people's pages and CVs, so those paths are not ours to change.\n",
  );
  process.exit(1);
}

console.log(
  `check-pages-limits: ${count} files, ${(total / 1024 / 1024).toFixed(0)} MiB — within Pages limits`,
);

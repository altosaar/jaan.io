// Prepare gallery photos for the repo.
//
//   npm run photos                          # the default folder
//   npm run photos -- ~/Pictures/some-dir   # another one (note the --)
//   npm run photos -- --dry-run             # say what would change, write nothing
//   npm run photos -- --help
//
// The `--` is npm's, not this script's: without it npm eats the arguments
// rather than passing them on.
//
// Reads camera masters (default: ~/Pictures/_jaan.io-picpicks) and writes
// web-sized JPEGs into src/assets/gallery/, where Astro's image() collection
// schema picks them up (see src/content.config.ts).
//
// This is a one-time-per-photo step, kept in the repo so it's reproducible
// rather than a thing someone did once in a shell.
//
// Why each step exists — none of these are incidental:
//
//   .rotate()  with no argument applies the EXIF Orientation tag and then drops
//              it. SIX of the eighteen originals are stored landscape with
//              `Orientation = 8 (Rotate 270 CW)`. Sharp does NOT auto-rotate
//              unless asked, and neither does Astro's image service, so without
//              this those six render on their sides. Must come FIRST, before
//              resize, or the resize fits the wrong axis.
//
//   resize()   the masters run to 7008px and 17.9MB (63MB for the set). The
//              design system's convention is ~2000px masters in-repo; Astro
//              generates the actual srcset rungs at build time, so anything
//              bigger is dead weight in git forever.
//
//   no metadata passthrough — sharp drops EXIF by default. That's what we want:
//              these are portraits of identifiable people, and the originals
//              carry capture timestamps. Nothing is lost, because all 18 already
//              have empty title/description/artist/keywords.
//
//   renaming   the originals are camera sequence numbers with zero subject
//              information, and two are actively hazardous: `-small-00238.jpg`
//              starts with a hyphen (shell tools parse it as a flag) and
//              `230127-DSC09597-.jpg` ends with one. Filenames become URLs.

//   stable     slugs are assigned ONCE per source photo and then never move.
//              Numbering by position in the sorted list looked fine and was a
//              trap: inserting one photo shifts every slug after it, which
//              silently re-points every alt string in src/data/gallery.ts at
//              the wrong picture — the failure mode being a set of confident,
//              well-written descriptions attached to the wrong faces, which no
//              build check can catch. Slugs come from SOURCES.json when the
//              source is already known and from the lowest free number when it
//              is not, so adding a photo touches exactly one file and removing
//              one leaves a gap. The numbers are opaque identifiers; gaps in
//              them mean nothing.

import sharp from "sharp";
import { readdir, mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const DEFAULT_SRC = join(homedir(), "Pictures", "_jaan.io-picpicks");
const DEFAULT_PORTRAITS = "/Users/me/Pictures/221207-jaan-gif-photoshop-auto-aligned";

const USAGE = `Prepare gallery photos for the repo.

  npm run photos                          the default folder
  npm run photos -- <dir>                 another one (the -- is npm's)
  npm run photos -- --dry-run             report what would change, write nothing

Options
  --portraits <dir>   source for the two-frame home-page portrait
                      (default: ${DEFAULT_PORTRAITS})
  --dry-run, -n       write nothing; print what a real run would do
  --help, -h          this

Default source: ${DEFAULT_SRC}

THE FOLDER IS THE LIST. Every image in it becomes a gallery photo, and any
gallery photo whose source has left it is deleted from the repo. To add one
picture, put one picture in the folder — and check with --dry-run first, because
anything else sitting in there gets added too.`;

// Hand-rolled rather than a dependency: two flags and a positional.
const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}

const DRY = argv.includes("--dry-run") || argv.includes("-n");
const takeFlag = (name, fallback) => {
  const i = argv.indexOf(name);
  if (i < 0) return fallback;
  const value = argv[i + 1];
  if (!value || value.startsWith("-")) {
    console.error(`[prep-photos] ${name} needs a directory\n\n${USAGE}`);
    process.exit(1);
  }
  argv.splice(i, 2);
  return value;
};

const PORTRAIT_DIR = takeFlag("--portraits", DEFAULT_PORTRAITS);
const positional = argv.filter((a) => !a.startsWith("-"));
if (positional.length > 1) {
  console.error(
    `[prep-photos] Expected at most one source directory, got: ${positional.join(", ")}\n\n${USAGE}`,
  );
  process.exit(1);
}
const SRC = positional[0] ?? DEFAULT_SRC;
const OUT = "src/assets/gallery";

/** Long-edge cap. Astro derives every responsive rung from this master. */
const MAX_EDGE = 2000;
const QUALITY = 80;

const IMAGE_RE = /\.(jpe?g|png|webp|tiff?)$/i;

// A wrong path is the most likely mistake now that this takes one, and
// readdir's raw ENOENT stack does not say which argument was wrong.
let entries;
try {
  entries = await readdir(SRC);
} catch (err) {
  console.error(
    err.code === "ENOENT"
      ? `[prep-photos] No such directory: ${SRC}`
      : `[prep-photos] Cannot read ${SRC}: ${err.message}`,
  );
  process.exit(1);
}

// Top level only — no recursion. The default folder has a `todo/` subdirectory
// of photos not yet chosen, and descending into it would publish them.
const files = entries
  .filter((f) => IMAGE_RE.test(f) && !f.startsWith("._"))
  // Stable, locale-independent order so slug numbering is reproducible across
  // machines. `numeric` keeps DSC0999 before DSC01000.
  .sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }));

if (files.length === 0) {
  throw new Error(`[prep-photos] No images found in ${SRC}`);
}

if (!DRY) await mkdir(OUT, { recursive: true });

// Slugs already handed out, so a photo keeps the one it has. Missing or
// unreadable manifest just means every slug is allocated fresh.
const known = new Map();
try {
  for (const entry of JSON.parse(await readFile(join(OUT, "SOURCES.json"), "utf8"))) {
    known.set(entry.source, entry.slug);
  }
} catch {
  /* first run */
}

const taken = new Set(known.values());
const nextSlug = () => {
  for (let n = 1; ; n++) {
    const slug = `portrait-${String(n).padStart(2, "0")}`;
    if (!taken.has(slug)) return slug;
  }
};

const manifest = [];

const added = [];

for (const file of files) {
  let slug = known.get(file);
  const isNew = !slug;
  if (!slug) {
    slug = nextSlug();
    taken.add(slug);
  }
  const dest = join(OUT, `${slug}.jpg`);

  const pipeline = sharp(join(SRC, file))
    .rotate() // EXIF orientation — see the header. Must precede resize().
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: QUALITY, mozjpeg: true });
  const info = DRY
    ? await pipeline.toBuffer({ resolveWithObject: true }).then((r) => r.info)
    : await pipeline.toFile(dest);

  manifest.push({ slug, source: file, width: info.width, height: info.height, bytes: info.size });
  // NEW is the line that matters: it is the one that needs an alt string
  // writing, and the one that reveals anything unexpected sitting in the
  // folder. Everything else is a re-encode of a photo already in the gallery.
  if (isNew) added.push({ slug, file });
  console.log(
    `${isNew ? "NEW  " : "     "}${file.padEnd(44)} → ${slug}.jpg  ${info.width}×${info.height}  ` +
      `${(info.size / 1e6).toFixed(2)} MB`,
  );
}

// Photos dropped from the source folder are dropped from the repo. Without
// this the set only ever grows: a removed photo keeps its file, keeps being
// globbed by src/data/gallery.ts, and keeps appearing in the gallery, which is
// the opposite of what removing it from the folder was meant to do.
const keep = new Set(manifest.map((m) => `${m.slug}.jpg`));
const removed = [];
for (const file of await readdir(OUT).catch(() => [])) {
  if (file.endsWith(".jpg") && !keep.has(file)) {
    if (!DRY) await unlink(join(OUT, file));
    removed.push(file);
    console.log(`${"     (gone from source)".padEnd(49)} → removed ${file}`);
  }
}

// Written next to the photos so the mapping back to the originals survives the
// rename, and read back on the next run to keep every slug where it is.
if (!DRY) {
  await writeFile(join(OUT, "SOURCES.json"), JSON.stringify(manifest, null, 2) + "\n");
}

const total = manifest.reduce((sum, m) => sum + m.bytes, 0);
console.log(
  `\n${manifest.length} photos → ${OUT}  (${(total / 1e6).toFixed(1)} MB total)` +
    (DRY ? "\n\nDRY RUN — nothing was written." : `\nWrote ${OUT}/SOURCES.json`),
);

// The build refuses to run until each of these has a description, so say which
// ones and where, rather than leaving it to be discovered as a build failure.
if (added.length > 0) {
  console.log(
    `\n${added.length} NEW photo${added.length > 1 ? "s" : ""}. Add a line for each to the ALT ` +
      `table in\nsrc/data/gallery.ts, describing what the photograph shows:\n`,
  );
  for (const { slug, file } of added) console.log(`  "${slug}.jpg": "…",   // ${file}`);
  console.log(`\nThe build fails until every one of them has one.`);
} else if (removed.length > 0) {
  console.log(`\nRemove the ALT lines for: ${removed.join(", ")}`);
} else {
  console.log(`\nNo photos added or removed; src/data/gallery.ts needs no change.`);
}

// ── The two-frame portrait ───────────────────────────────────────────────────
// Not gallery entries: these are imported directly by PortraitBlink.astro (the
// home page) and og.ts (the social share image).
//
// The pair is one exposure sequence, auto-aligned in Photoshop so the head
// registers between frames — which is what lets the page cut between them
// without the subject appearing to jump. Frame order matters: "Layer 0" is
// eyes OPEN and is the resting frame, "Layer 1" is eyes closed.
//
// The same source was previously shipped as an animated GIF; the 1600px version
// of that GIF is 2.3 MB and the full-size one 5.9 MB, for a two-frame loop. Two
// still images that CSS alternates between cost a fraction of that and stay
// responsive (srcset per frame), which is why this exists as a pair of stills.
const FRAMES = [
  ["20221207-DSC08262_0001_Layer 0.jpg", "portrait-open.webp"],
  ["20221207-DSC08262_0000_Layer 1.jpg", "portrait-closed.webp"],
];

console.log("");
for (const [file, out] of FRAMES) {
  try {
    const p = await sharp(join(PORTRAIT_DIR, file))
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(join("src/assets", out));
    console.log(
      `${file.padEnd(38)} → src/assets/${out}  ${p.width}×${p.height}  ` +
        `${(p.size / 1e3).toFixed(0)} KB`,
    );
  } catch (err) {
    console.warn(`[prep-photos] Skipped ${file}: ${err.message}`);
  }
}

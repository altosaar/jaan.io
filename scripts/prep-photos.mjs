// Prepare gallery photos for the repo.
//
//   node scripts/prep-photos.mjs [sourceDir]
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

const SRC = process.argv[2] ?? join(homedir(), "Pictures", "_jaan.io-picpicks");
const OUT = "src/assets/gallery";

/** Long-edge cap. Astro derives every responsive rung from this master. */
const MAX_EDGE = 2000;
const QUALITY = 80;

const IMAGE_RE = /\.(jpe?g|png|webp|tiff?)$/i;

const files = (await readdir(SRC))
  .filter((f) => IMAGE_RE.test(f) && !f.startsWith("._"))
  // Stable, locale-independent order so slug numbering is reproducible across
  // machines. `numeric` keeps DSC0999 before DSC01000.
  .sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }));

if (files.length === 0) {
  throw new Error(`[prep-photos] No images found in ${SRC}`);
}

await mkdir(OUT, { recursive: true });

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

for (const file of files) {
  let slug = known.get(file);
  if (!slug) {
    slug = nextSlug();
    taken.add(slug);
  }
  const dest = join(OUT, `${slug}.jpg`);

  const info = await sharp(join(SRC, file))
    .rotate() // EXIF orientation — see the header. Must precede resize().
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toFile(dest);

  manifest.push({ slug, source: file, width: info.width, height: info.height, bytes: info.size });
  console.log(
    `${file.padEnd(44)} → ${slug}.jpg  ${info.width}×${info.height}  ` +
      `${(info.size / 1e6).toFixed(2)} MB`,
  );
}

// Photos dropped from the source folder are dropped from the repo. Without
// this the set only ever grows: a removed photo keeps its file, keeps being
// globbed by src/data/gallery.ts, and keeps appearing in the gallery, which is
// the opposite of what removing it from the folder was meant to do.
const keep = new Set(manifest.map((m) => `${m.slug}.jpg`));
for (const file of await readdir(OUT)) {
  if (file.endsWith(".jpg") && !keep.has(file)) {
    await unlink(join(OUT, file));
    console.log(`${"(gone from source)".padEnd(44)} → removed ${file}`);
  }
}

// Written next to the photos so the mapping back to the originals survives the
// rename, and read back on the next run to keep every slug where it is.
await writeFile(join(OUT, "SOURCES.json"), JSON.stringify(manifest, null, 2) + "\n");

const total = manifest.reduce((sum, m) => sum + m.bytes, 0);
console.log(
  `\n${manifest.length} photos → ${OUT}  (${(total / 1e6).toFixed(1)} MB total)\n` +
    `Wrote ${OUT}/SOURCES.json`,
);
console.log(
  `\nEvery photo needs an authored alt string in src/data/gallery.ts, keyed by ` +
    `its\nfilename. The build fails if one is missing or points at nothing.`,
);

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
const PORTRAIT_DIR = process.argv[3] ?? "/Users/me/Pictures/221207-jaan-gif-photoshop-auto-aligned";
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

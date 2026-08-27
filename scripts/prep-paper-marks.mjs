// Turn the Jekyll site's paper and talk icons into marks this site can paint.
//
//   npm run marks                 # rebuild src/assets/papers/*.png
//   npm run marks -- --preview    # also write a contact sheet to /tmp, write nothing else
//   npm run marks -- --help
//
// The `--` is npm's, not this script's: without it npm eats the arguments.
//
// Reads ../jaan.io-old/images/ and writes trimmed, single-channel PNGs into
// src/assets/papers/, where src/data/papers.ts imports them and
// src/components/IndexMark.astro paints them as a MASK — see that component for
// why every mark on this site is a shape rather than a picture.
//
// A one-time-per-icon step, in the repo so it is reproducible rather than a
// thing someone did once in a shell. The old repo is not a dependency of the
// build: the output is committed, the same way src/assets/gallery/ is.
//
// ── WHY THIS IS NOT JUST `sharp trim` ───────────────────────────────────────
// The nine article thumbs in src/assets/thumbs/ needed nothing but a trim: they
// are black line art on transparency, so their ALPHA already is the drawing and
// IndexMark's mask lands exactly on the ink. Five of these fourteen are not
// that. They are Illustrator artwork with fills — a yellow muppet, a red-and-
// blue line chart, arrows with emoji dropped into them — and their alpha is the
// silhouette of the whole illustration. Masked as-is, the chart becomes a
// smudge and the muppet becomes an egg.
//
// So the ink is EXTRACTED rather than assumed, by one of three modes. Which
// mode a file wants is a property of how it was drawn, so it is recorded in
// SOURCES below rather than guessed here.
//
//   line    ink = alpha x (1 - luminance).  The default, and right for anything
//           drawn dark on nothing: dark pixels become opaque ink, light ones
//           fall away, and interior detail survives — which a bare alpha
//           silhouette loses. Twelve of the fourteen.
//
//   fill    The artwork is a LIGHT SHAPE with dark features drawn on it, so the
//           rule above has it exactly backwards: it would paint the eyes and
//           drop the face. Here the light body becomes the ink and the dark
//           features become HOLES cut in it, which is how a monochrome face
//           icon is drawn anyway. Dark strokes OUTSIDE the body — the
//           stethoscope, the hair — are unioned back in, because the same test
//           that correctly drops the eyebrows would otherwise drop those too.
//           Only clinicalbert.
//
//   chroma  ink = alpha x saturation.  For the one mark that is a real chart:
//           it keeps the two coloured curves and drops the black axis labels
//           and legend text, which at an 80px box are illegible either way and
//           only muddy what is left. Strokes are thickened, because a 1px plot
//           line scaled into that box disappears; the legend's two loose key
//           markers are dropped as specks. Only representations.
import sharp from "sharp";
import { mkdir, writeFile, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SRC = "../jaan.io-old/images";
const OUT = "src/assets/papers";

// The size the mask is written at. The box it lands in is at most 5rem (80px,
// 160 physical on a 2x screen) — see MARK_SIZE in src/pages/papers.astro — so
// 512 is already more than it can show. It is deliberately not smaller: the
// same files are drawn large on the share cards (scripts/gen-og-cards.mjs).
const SIZE = 512;
// The resolution the ink is worked out at, before it is scaled down to SIZE.
// Extracting at full size and downsampling the finished MASK keeps antialiasing
// out of the luminance and saturation tests, which are per-pixel and would
// otherwise read blended edge pixels as real ink.
const WORK = 1024;

// slug → the file in the old repo, and how it was drawn. The slug is the name
// the mask is written under and the name src/data/papers.ts imports; it matches
// that file's `slug` so the two cannot drift apart silently.
const SOURCES = {
  "fish-music": "fishthumb.png",
  musicmapper: "musicmapperthumb.png",
  "correlated-lda": "correlated-thumb.png",
  "spin-ice": "ice-thumb.png",
  "word-embedding-music": "ycac-thumb.png",
  cofactor: "like-thumb.png",
  "operator-variational-inference": "operator-avatar.png",
  "proximity-variational-inference": "proximity-icon.png",
  noisin: "noisin.svg",
  // A filled illustration, not line art — see `fill` above.
  clinicalbert: { file: "clinicalbert.svg", mode: "fill", threshold: 0.3 },
  thesis: "thesis/thesis.svg",
  // A chart, not an icon — see `chroma` above.
  representations: { file: "representations-icon.svg", mode: "chroma" },
  "recommending-interesting-writing": "bansal-2020-recommending-icon.svg",
  rankfromsets: "altosaar-2020-rankfromsets-icon.svg",
  // The three talks. food2vec's icon is already in the repo as an article thumb
  // (src/assets/thumbs/food2vec-icon.png, on the food2vec post) and is imported
  // from there rather than copied to a second name.
  "talk-proximity": "proximity-icon.png",
  "talk-operator": "operator-avatar.png",
};

const argv = process.argv.slice(2);
if (argv.includes("--help")) {
  console.log(
    "Usage: npm run marks [-- --preview]\n\n" +
      `  Reads  ${SRC}\n` +
      `  Writes ${OUT}/<slug>.png  (${SIZE}px, trimmed to the ink)\n\n` +
      "  --preview  render a contact sheet to a temp file and write nothing else",
  );
  process.exit(0);
}
const PREVIEW = argv.includes("--preview");

if (!existsSync(SRC)) {
  console.error(
    `Cannot find ${SRC}.\n` +
      "This script reads the old Jekyll repo, which is not a dependency of the\n" +
      "build — the marks it produces are committed. Clone it next to this one\n" +
      "only if you need to regenerate them.",
  );
  process.exit(1);
}

const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const chroma = (r, g, b) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;

/** The source, as raw RGBA at WORK px on the long edge. */
async function load(file) {
  return sharp(join(SRC, file), { density: 600 })
    .resize(WORK, WORK, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

/** Map RGBA to a one-channel alpha mask with `fn`. */
function map({ data, info }, fn) {
  const a = Buffer.alloc(info.width * info.height);
  for (let i = 0, p = 0; p < a.length; i += info.channels, p++) {
    a[p] = fn(data[i], data[i + 1], data[i + 2], data[i + 3]);
  }
  return { a, w: info.width, h: info.height };
}

const gray = ({ a, w, h }) => sharp(a, { raw: { width: w, height: h, channels: 1 } });

/**
 * Thicken a mask by `sigma`, so a hairline survives being scaled into an 80px
 * box. Blurred by sharp, then re-binarized HERE rather than with sharp's
 * `.threshold()`: that operator is part of a fixed pipeline order and does not
 * reliably run after a blur in the same chain — chained the obvious way it
 * silently leaves the blur's soft gradient in place, which is a mask that fades
 * out rather than a thicker line.
 */
async function thicken({ a, w, h }, sigma, keep) {
  // `.toColourspace("b-w")` is not decoration: blurring a one-channel buffer
  // returns a THREE-channel one, because sharp promotes b-w to sRGB on the way
  // through. Read back at the wrong stride the mask comes out as diagonal
  // confetti, which looks like a broken drawing rather than a broken buffer.
  const blurred = await gray({ a, w, h }).blur(sigma).toColourspace("b-w").raw().toBuffer();
  const out = Buffer.alloc(a.length);
  for (let p = 0; p < out.length; p++) out[p] = blurred[p] >= keep ? 255 : 0;
  return { a: out, w, h };
}

/**
 * Which pixels are INSIDE a solid shape — including the holes punched in it.
 *
 * A pixel counts as inside when the shape appears somewhere to its left AND to
 * its right AND above it AND below it. For a blob like a head that is exact:
 * the eyes and the mouth are enclosed on all four sides, while the hair above
 * it and the stethoscope hanging beside it are not.
 *
 * This is what a dilate-then-erode would be for, and it is used instead because
 * it has nothing to tune. A closing needs a radius somewhere between the widest
 * hole and the narrowest gap separating the shape from what is outside it, and
 * a radius that is slightly wrong fails silently — it returns an empty mask,
 * every stroke gets unioned back in, and the result is indistinguishable from
 * the plain silhouette this mode exists to avoid.
 */
function interior({ a, w, h }) {
  const out = Buffer.alloc(a.length);
  const seen = Buffer.alloc(a.length); // bit 1 left, 2 right, 4 up, 8 down
  for (let y = 0; y < h; y++) {
    let on = false;
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (on) seen[p] |= 1;
      if (a[p]) on = true;
    }
    on = false;
    for (let x = w - 1; x >= 0; x--) {
      const p = y * w + x;
      if (on) seen[p] |= 2;
      if (a[p]) on = true;
    }
  }
  for (let x = 0; x < w; x++) {
    let on = false;
    for (let y = 0; y < h; y++) {
      const p = y * w + x;
      if (on) seen[p] |= 4;
      if (a[p]) on = true;
    }
    on = false;
    for (let y = h - 1; y >= 0; y--) {
      const p = y * w + x;
      if (on) seen[p] |= 8;
      if (a[p]) on = true;
    }
  }
  for (let p = 0; p < out.length; p++) out[p] = seen[p] === 15 ? 255 : 0;
  return { a: out, w, h };
}

/**
 * Drop everything smaller than `frac` of the largest connected blob.
 *
 * For the chart mark: the two curves are long connected runs, and what is left
 * over after the black text is dropped is the legend's two key markers — a
 * loose circle and a loose square floating where the words used to be. Removing
 * them by area rather than by position, so the rule survives the artwork moving.
 */
function despeckle({ a, w, h }, frac = 0.15) {
  const label = new Int32Array(w * h).fill(-1);
  const areas = [];
  const stack = [];
  for (let s = 0; s < a.length; s++) {
    if (a[s] < 16 || label[s] !== -1) continue;
    const id = areas.length;
    let area = 0;
    stack.push(s);
    label[s] = id;
    while (stack.length) {
      const p = stack.pop();
      area++;
      const x = p % w;
      const y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (a[q] >= 16 && label[q] === -1) {
            label[q] = id;
            stack.push(q);
          }
        }
      }
    }
    areas.push(area);
  }
  const biggest = Math.max(0, ...areas);
  const out = Buffer.from(a);
  for (let p = 0; p < out.length; p++) {
    if (label[p] !== -1 && areas[label[p]] < biggest * frac) out[p] = 0;
  }
  return { a: out, w, h };
}

async function ink(spec) {
  const { file, mode = "line", threshold = 0.3 } = typeof spec === "string" ? { file: spec } : spec;
  const src = await load(file);

  if (mode === "line") {
    return map(src, (r, g, b, a) => Math.round(a * (1 - lum(r, g, b))));
  }

  if (mode === "fill") {
    const body = map(src, (r, g, b, a) => (a > 128 && lum(r, g, b) > threshold ? 255 : 0));
    const stroke = map(src, (r, g, b, a) => (a > 128 && lum(r, g, b) <= threshold ? 255 : 0));
    // Where the body encloses — which is what tells the eyes and the mouth (cut
    // OUT of the face) from the hair and the stethoscope (drawn beside it, and
    // unioned back in). Without this the same dark-pixel test that correctly
    // drops the eyebrows drops the stethoscope too, and the mark is a bare egg.
    const region = interior(body);
    const out = Buffer.alloc(body.a.length);
    for (let p = 0; p < out.length; p++) {
      out[p] = body.a[p] || (region.a[p] ? 0 : stroke.a[p]);
    }
    return { a: out, w: body.w, h: body.h };
  }

  if (mode === "chroma") {
    // x2.5 so a curve drawn at 60% saturation still reaches full ink; the
    // black text it is being separated from has none at all, so the multiplier
    // only has to clear antialiasing.
    const c = map(src, (r, g, b, a) => Math.round(a * Math.min(1, chroma(r, g, b) * 2.5)));
    return despeckle(await thicken(c, 6, 24));
  }

  throw new Error(`unknown mode "${mode}" for ${file}`);
}

/**
 * The finished mask: trimmed to its ink and scaled into a SIZE box.
 *
 * Written as BLACK ON TRANSPARENCY, with the ink in the ALPHA channel — not as
 * a greyscale image with the ink in its luminance. That is not a detail: CSS
 * `mask` defaults to `mask-mode: match-source`, which for an image means its
 * alpha, so a greyscale mask is read as fully opaque everywhere and paints a
 * solid rectangle. It also puts these files in exactly the shape the nine
 * article thumbs in src/assets/thumbs/ are already in, so both sets go through
 * IndexMark's `mask` path unchanged.
 */
async function mark(spec) {
  const { a, w, h } = await ink(spec);
  const rgba = Buffer.alloc(w * h * 4);
  for (let p = 0; p < a.length; p++) rgba[p * 4 + 3] = a[p];
  return sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 1 })
    .resize(SIZE, SIZE, { fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const slugs = Object.keys(SOURCES);
const built = await Promise.all(slugs.map((s) => mark(SOURCES[s])));

if (PREVIEW) {
  // What IndexMark will do with them: the mask painted in --text on --bg, at the
  // size the page actually uses, above the same mask at four times that.
  const BOX = 80;
  const BIG = 190;
  const CELL = 210;
  const paint = async (buf, size) => {
    const fit = await sharp(buf)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    const alpha = await sharp(fit).extractChannel(3).toBuffer();
    return sharp({ create: { width: size, height: size, channels: 3, background: "#e2e2e2" } })
      .joinChannel(alpha)
      .png()
      .toBuffer();
  };
  const cols = 6;
  const rows = Math.ceil(built.length / cols);
  const tiles = [];
  for (const [i, buf] of built.entries()) {
    const x = (i % cols) * CELL;
    const y = Math.floor(i / cols) * (CELL + BOX + 20);
    tiles.push({ input: await paint(buf, BIG), left: x + 10, top: y + 10 });
    tiles.push({ input: await paint(buf, BOX), left: x + 10 + (BIG - BOX) / 2, top: y + CELL });
  }
  const out = join(tmpdir(), "paper-marks.png");
  await sharp({
    create: {
      width: cols * CELL,
      height: rows * (CELL + BOX + 20),
      channels: 3,
      background: "#000000",
    },
  })
    .composite(tiles)
    .png()
    .toFile(out);
  console.log(slugs.map((s, i) => `${i}: ${s}`).join("\n"));
  console.log(`\nPREVIEW — nothing written to ${OUT}.\n${out}`);
  process.exit(0);
}

await mkdir(OUT, { recursive: true });
let total = 0;
for (const [i, slug] of slugs.entries()) {
  const dest = join(OUT, `${slug}.png`);
  await writeFile(dest, built[i]);
  const { width, height } = await sharp(built[i]).metadata();
  total += built[i].length;
  console.log(
    `${slug.padEnd(34)} ${String(width).padStart(4)}x${String(height).padEnd(4)} ${(built[i].length / 1024).toFixed(1)} KB`,
  );
}

// Anything in the folder that SOURCES no longer names is left over from a
// removed paper, and would otherwise sit in git forever.
const want = new Set(slugs.map((s) => `${s}.png`));
for (const file of await readdir(OUT).catch(() => [])) {
  if (file.endsWith(".png") && !want.has(file)) {
    await unlink(join(OUT, file));
    console.log(`removed stale ${file}`);
  }
}

console.log(`\n${slugs.length} marks → ${OUT}  (${(total / 1024).toFixed(0)} KB total)`);

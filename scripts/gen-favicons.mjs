// Generate the site's favicons and nav mark from the faceglyph pipeline's output.
//
//   npm run gen:favicons              # the default build (SRC below)
//   npm run gen:favicons -- ../other  # some other build directory
//
// RE-RUN IT WHENEVER THE PIPELINE RE-RUNS. Add a photograph, drop one, retune a
// stroke weight — the whole set is derived, so this rebuilds all of it from
// whatever is in the source directory now, and prints what changed. Everything
// it writes is COMMITTED: the CI runner has no copy of the pipeline, so this
// never runs during a build. That is the whole of the update procedure —
//
//   npm run gen:favicons && npm run build && git add -A public src/data
//
// — and the summary it prints at the end is the check that it did what you
// expected before you commit it.
//
// The source is ~/projects/composite-portraits (the `faceglyph` pipeline): it
// turns a folder of portrait photographs into line drawings — facial landmarks
// plus a segmentation silhouette, converted straight to Bézier paths. It emits
// one glyph per portrait in `glyphs/`, plus a `favicon.svg` that is all of them
// averaged into a single composite face.
//
// WHAT THIS SCRIPT PRODUCES, AND WHY IT IS SPLIT IN TWO:
//
//   public/favicons/<slug>.svg   one per portrait — the daily rotation. The
//                                page picks today's at load; see src/lib/favicon.ts.
//   public/favicon.svg           the composite. It is the no-JS fallback, so
//                                the tab still gets a face when the picker
//                                cannot run, and it is the honest "default"
//                                mark: every portrait at once.
//   public/favicon.png           raster fallback for clients too old for an
//   public/apple-touch-icon.png  SVG favicon, and the iOS home screen.
//                                Both from the composite — a home-screen icon
//                                that changed daily would just look broken.
//
// This replaces scripts/gen-logo.mjs, which built the same set of files from
// Nuna Parr's "Dancing Bear". Nothing on the site carries that artwork any
// more, so its footer credit came out with it (SITE.footer.credit is null).
//
// STROKE WEIGHT IS THE WHOLE GAME. The pipeline emits each glyph at DISPLAY
// weight (stroke-width 34 in a 1000-unit viewBox) — that is 0.5px at 32px, so
// the face vanishes into a grey haze in a tab strip. `params.toml` carries a
// second, heavier weight for exactly this reason, and its composite favicon.svg
// is already emitted at it. The per-portrait glyphs are not, so this script
// restrokes them: it never patches the source SVG's <style>, it rebuilds the
// file from the path data alone, so an upstream change to the glyph stylesheet
// cannot quietly alter what ships.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import prettier from "prettier";
import sharp from "sharp";

/**
 * Write one of the two generated TypeScript files, formatted the way the repo
 * formats everything else.
 *
 * `npm run format:check` gates CI and does not care that a file is generated, so
 * anything emitted here has to come out already conforming — and hand-formatting
 * it cannot work, because the shape changes with the number of portraits. The
 * offsets list is the case that proved it: at eighteen it fits on one line, at
 * nineteen Prettier wants it wrapped, and a `npm run format` to fix that is
 * undone by the next run of this script. Ask Prettier instead. It is a
 * devDependency and this script never runs in CI, so the import is free.
 */
const writeGenerated = async (path, source) =>
  writeFileSync(
    path,
    await prettier.format(source, { ...(await prettier.resolveConfig(path)), filepath: path }),
  );

/**
 * The pipeline build to read. Everything comes from ONE directory — glyphs/,
 * favicon.svg and morph.svg together — so the nav mark always dissolves through
 * exactly the set of faces the tab rotates through. Mixing a glyphs/ from one
 * build with a morph.svg from another is the one way to get those out of step,
 * so there is deliberately no second argument for it.
 *
 * `squad` specifically, not the pipeline's top-level out/, which is an older and
 * smaller set. Override it with `npm run gen:favicons -- <dir>`; the path is
 * resolved against the current directory, so a relative one is fine.
 */
const SRC = process.argv[2] ?? "/Users/me/projects/composite-portraits/out/squad";
console.log(`reading ${SRC}`);

/** Estonian blue — the glyph against light browser chrome. */
const INK = "#0030DE";

/**
 * The glyph against dark browser chrome. #0030DE is a dark blue and measures
 * about 2.5:1 on a dark tab strip, so it fills in to a smudge at 16px; white is
 * legible on both but wrong on light chrome. An SVG favicon can carry its own
 * media query, so it picks per scheme rather than compromising on one colour.
 */
const INK_DARK = "#ffffff";

/**
 * Favicon weight, in viewBox units — matches `stroke_width_favicon` in the
 * pipeline's params.toml, which is tuned against a live 16px preview. Keep the
 * two in step: if that value is retuned, this one follows.
 */
const STROKE = 80;

/**
 * Background for the APPLE TOUCH ICON only — every other icon here is transparent.
 *
 * iOS does not honour transparency in a home-screen icon: it composites the
 * icon onto black, which would put #0030DE at roughly 2.5:1 and turn the face
 * into a dark smudge on a dark tile.
 */
const TOUCH_ICON_BG = "#ffffff";

/** `230127-DSC09597-.svg` → `230127-dsc09597`. The name lands in a URL. */
const slugify = (file) =>
  file
    .replace(/\.svg$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Pull the drawing out of a pipeline glyph, as raw path data.
 *
 * The guard is the point. A faceglyph SVG is a STROKED line drawing —
 * `fill: none` with a `stroke`. If an upstream change ever emits filled shapes
 * instead, restroking them here would produce a silhouette blob rather than a
 * face, and it would ship looking deliberate. Stop the build instead.
 */
function readGlyph(path) {
  const svg = readFileSync(path, "utf8");

  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox) throw new Error(`${path}: no viewBox`);

  if (!/fill:\s*none/.test(svg) || !/stroke:\s*#/.test(svg)) {
    throw new Error(
      `${path}: this glyph is not a stroked line drawing (expected \`fill: none\` ` +
        `and a \`stroke\` in its <style>). Read the note at the top of ` +
        `scripts/gen-favicons.mjs before changing anything.`,
    );
  }

  const paths = [...svg.matchAll(/<path\b[^>]*>/g)]
    .map((m) => m[0].match(/\sd="([^"]*)"/)?.[1])
    .filter(Boolean);
  if (!paths.length) throw new Error(`${path}: no <path> found`);

  return { viewBox, paths };
}

/**
 * Rebuild a glyph at favicon weight.
 *
 * Transparent, so it sits on whatever the browser's tab strip provides, and
 * scheme-aware: an SVG favicon carries its own <style>, and the media query
 * resolves against the browser's theme. Stroke comes from CSS rather than a
 * `stroke` attribute, because a presentation attribute would win over the rule
 * and the dark case would silently never apply.
 */
const toFavicon = ({ viewBox, paths }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="portrait glyph">` +
  `<style>` +
  `path{fill:none;stroke:${INK};stroke-width:${STROKE};stroke-linecap:round;stroke-linejoin:round}` +
  `@media(prefers-color-scheme:dark){path{stroke:${INK_DARK}}}` +
  `</style>` +
  paths.map((d) => `<path d="${d}"/>`).join("") +
  `</svg>\n`;

/**
 * The same drawing with every value as a presentation attribute, for sharp.
 *
 * Rasterised from an explicitly-styled copy rather than the file above —
 * librsvg's handling of prefers-color-scheme is not something to depend on for
 * a build artifact. The rasters take the light-scheme colour: they are only
 * reached by clients too old for an SVG favicon (far likelier to be on light
 * chrome) and by the touch icon, which paints its own background anyway.
 */
const toFlat = ({ viewBox, paths }, background) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">` +
  (background ? `<rect width="100%" height="100%" fill="${background}"/>` : "") +
  paths
    .map(
      (d) =>
        `<path fill="none" stroke="${INK}" stroke-width="${STROKE}" ` +
        `stroke-linecap="round" stroke-linejoin="round" d="${d}"/>`,
    )
    .join("") +
  `</svg>`;

// ── The rotation ─────────────────────────────────────────────────────────────
// Wiped and rewritten rather than overwritten in place: dropping a portrait
// from the pipeline has to drop it from the site too, and a stale file here
// would keep serving a face that is no longer in the set.
const glyphDir = join(SRC, "glyphs");
if (!existsSync(glyphDir)) throw new Error(`${glyphDir}: not found — has the pipeline been run?`);

// What is on the site right now, read before anything is overwritten — the
// summary at the end of this run is the difference between it and what the
// pipeline holds now. Missing on a first run, which reads as "everything is new".
const previous = existsSync("src/data/favicons.ts")
  ? [...readFileSync("src/data/favicons.ts", "utf8").matchAll(/^\s+"([^"]+)",$/gm)].map((m) => m[1])
  : [];

rmSync("public/favicons", { recursive: true, force: true });
mkdirSync("public/favicons", { recursive: true });

const slugs = [];
for (const file of readdirSync(glyphDir)
  .filter((f) => f.endsWith(".svg"))
  .sort()) {
  const slug = slugify(file);
  if (slugs.includes(slug)) throw new Error(`${file}: slug "${slug}" collides with another glyph`);
  writeFileSync(join("public/favicons", `${slug}.svg`), toFavicon(readGlyph(join(glyphDir, file))));
  slugs.push(slug);
}
if (!slugs.length) throw new Error(`${glyphDir}: no glyphs`);

const added = slugs.filter((s) => !previous.includes(s));
const removed = previous.filter((s) => !slugs.includes(s));
console.log(`wrote public/favicons/ — ${slugs.length} portraits at stroke-width ${STROKE}`);
for (const s of added) console.log(`  + ${s}`);
for (const s of removed) console.log(`  - ${s}`);
if (previous.length && !added.length && !removed.length) console.log("  (same set as before)");

// The list the page picks from. Generated, not hand-edited: the picker in
// src/lib/favicon.ts derives everything else from its length.
await writeGenerated(
  "src/data/favicons.ts",
  `// GENERATED by scripts/gen-favicons.mjs — do not edit.\n` +
    `//\n` +
    `// One entry per portrait in public/favicons/. The daily picker that reads\n` +
    `// this list lives in src/lib/favicon.ts.\n` +
    `export const FAVICON_GLYPHS = [\n` +
    slugs.map((s) => `  ${JSON.stringify(s)},\n`).join("") +
    `] as const;\n`,
);
console.log("wrote src/data/favicons.ts");

// ── The composite ────────────────────────────────────────────────────────────
// Already emitted at favicon weight by the pipeline, but read the same way as
// the rest so the guard and the stylesheet are identical.
const composite = readGlyph(join(SRC, "favicon.svg"));

writeFileSync("public/favicon.svg", toFavicon(composite));
console.log(`wrote public/favicon.svg (composite, ${INK} / ${INK_DARK} dark)`);

// `background` on resize is explicit rather than relied upon: sharp's SVG
// rasteriser defaults to a transparent canvas, but resize() fills any
// letterboxing with the background colour, and that default is black.
await sharp(Buffer.from(toFlat(composite)), { density: 600 })
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile("public/favicon.png");
console.log("wrote public/favicon.png (transparent, light-scheme colour)");

await sharp(Buffer.from(toFlat(composite, TOUCH_ICON_BG)), { density: 600 })
  .resize(180, 180)
  .png()
  .toFile("public/apple-touch-icon.png");
console.log(`wrote public/apple-touch-icon.png (on ${TOUCH_ICON_BG})`);

// ── The nav mark ─────────────────────────────────────────────────────────────
// The pipeline's morph.svg: the same seven paths, each carrying a SMIL <animate>
// that walks its `d` through every portrait in turn — one face dissolving into
// the next, on a loop as long as the set. Used as the mobile nav mark; see
// SITE.features.navMorph, which is the switch that turns it on and off.
//
// The loop is `repeatCount="indefinite"`, which is what lets the page start it
// on a DIFFERENT portrait every refresh: entering an endless timeline part-way
// through is just a negative `begin`. This script reads out where each portrait
// sits on that timeline and writes the list to src/data/nav-morph.ts.
//
// SMIL, not CSS. Only Chrome can interpolate a `d` in CSS, so a CSS version
// would sit motionless in Safari and Firefox. SMIL animates in all three, and
// it animates inside an <img> — that is what lets the nav reference this as a
// plain image rather than inlining 180 KB of path data into every page.
//
// ONE COLOUR, NO MEDIA QUERY, unlike the favicons above. A favicon sits in
// browser chrome and has to survive both schemes; this sits on the page, and the
// page is dark-only (`--bg: #000` in src/styles/tokens.css, no light scheme
// anywhere). A prefers-color-scheme rule here would be inert at best, and at
// worst wrong — a browser in light mode still renders this against black.

/** Matches `--text` in src/styles/tokens.css: the nav's own ink. */
const NAV_INK = "#e2e2e2";

/**
 * Lighter than the favicons' 80. The nav mark draws at ~28px rather than 16, so
 * it has more room; and it draws LIGHT ON DARK, which optically thickens a
 * stroke. At 80 the eyes and mouth close up into blobs at this size — 60 keeps
 * the features separated. Checked by rendering the sweep, not by eye-balling
 * the number.
 */
const NAV_STROKE = 60;

/**
 * Round every coordinate to a whole viewBox unit.
 *
 * The viewBox is 1000 units wide and the mark renders at 28px, so one unit is
 * 0.03px — a decimal place is 1/30th of a pixel of detail, paid for on every
 * one of the morph's 35 keyframes across 7 paths. Dropping them takes the
 * current build from 316 KB to 226 KB, and 41 KB to 22 KB over the wire once
 * compressed.
 *
 * Applied to path data ONLY, never to the animation's timing attributes:
 * keyTimes are fractions of the duration (0.039286…) and rounding one to 0
 * would collapse the schedule.
 */
const roundPathData = (d) => d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n))));

const morphSrc = readFileSync(join(SRC, "morph.svg"), "utf8");
const morphViewBox = morphSrc.match(/viewBox="([^"]+)"/)?.[1];
if (!morphViewBox) throw new Error(`${join(SRC, "morph.svg")}: no viewBox`);

// A <path> with an <animate> CHILD, not a self-closing one — so this cannot
// reuse readGlyph() above, which only ever reads an opening tag.
const morphPaths = [...morphSrc.matchAll(/<path\b([^>]*)>([\s\S]*?)<\/path>/g)].map(
  ([, attrs, inner]) => {
    const d = attrs.match(/\sd="([^"]*)"/)?.[1];
    if (!d) throw new Error(`${join(SRC, "morph.svg")}: a <path> has no d`);
    if (!/<animate\b/.test(inner)) {
      throw new Error(
        `${join(SRC, "morph.svg")}: a <path> has no <animate> child — this is the ` +
          `static composite, not the morph. Nothing would move.`,
      );
    }
    const animate = inner
      .replace(/values="([^"]*)"/, (_, v) => `values="${roundPathData(v)}"`)
      .replace(/\s+/g, " ")
      .trim();
    return `<path d="${roundPathData(d)}">${animate}</path>`;
  },
);
if (!morphPaths.length) throw new Error(`${join(SRC, "morph.svg")}: no <path> found`);

/**
 * When each portrait's HOLD begins, in seconds from the start of the loop.
 *
 * This is the list that makes the mark start on a different face every refresh:
 * the animation never ends, so "start on portrait k" is only "enter the timeline
 * at k's hold", and a negative `begin` says exactly that. src/lib/nav-morph.ts
 * picks one of these per page load.
 *
 * READ OUT OF THE SCHEDULE, not computed from the pipeline's seconds_per_face.
 * A hold is the one place two consecutive `values` entries are IDENTICAL — the
 * face is sitting still rather than dissolving — so the holds can be found
 * without knowing how the pipeline was configured. That matters: turning on
 * `pass_through_composite` in params.toml interleaves the composite between
 * portraits and doubles the stride, and a hardcoded formula would then land
 * every other refresh on the composite instead of a face. Reading the file
 * cannot get that wrong.
 *
 * All three attributes come off the FIRST <animate>. Every path shares one
 * schedule — they have to, or the seven strokes would be drawn from different
 * portraits at once — and the check below is that the schedule is well-formed.
 */
const morphTiming = morphSrc.match(/<animate\b[^>]*>/)?.[0];
if (!morphTiming) throw new Error(`${join(SRC, "morph.svg")}: no <animate> found`);

const morphDur = Number(morphTiming.match(/\sdur="([\d.]+)s"/)?.[1]);
if (!morphDur) throw new Error(`${join(SRC, "morph.svg")}: <animate> has no dur in seconds`);

const morphKeyTimes = morphTiming
  .match(/\skeyTimes="([^"]*)"/)?.[1]
  .split(";")
  .map(Number);
const morphValues = morphTiming.match(/\svalues="([^"]*)"/)?.[1].split(";");
if (!morphKeyTimes || !morphValues || morphKeyTimes.length !== morphValues.length) {
  throw new Error(`${join(SRC, "morph.svg")}: keyTimes and values do not line up`);
}

const frameOffsets = morphKeyTimes
  .filter((_, i) => i + 1 < morphValues.length && morphValues[i] === morphValues[i + 1])
  .map((t) => Math.round(t * morphDur * 1000) / 1000);
if (frameOffsets.length < 2) {
  throw new Error(
    `${join(SRC, "morph.svg")}: found ${frameOffsets.length} holds where one per portrait ` +
      `was expected. Every refresh would start on the same face.`,
  );
}

// The morph and the glyphs are two files the pipeline writes TOGETHER, and the
// one thing that can go wrong on a re-run is that only one of them got rewritten
// — a photograph added to glyphs/ while morph.svg still holds the old set. That
// is not broken, so it must not stop the build; it is just the nav quietly
// missing a face the tab shows, which is exactly the kind of thing nobody
// notices for months. Say so.
//
// One hold per portrait normally. Twice that with `pass_through_composite` in
// params.toml, which returns to the composite between faces — both are correct,
// anything else means one of the two files is stale.
if (frameOffsets.length !== slugs.length && frameOffsets.length !== slugs.length * 2) {
  console.warn(
    `\n!  ${join(SRC, "morph.svg")} holds ${frameOffsets.length} portraits but ` +
      `glyphs/ has ${slugs.length}.\n` +
      `!  These are written by the same pipeline run, so one of them is stale — ` +
      `re-run faceglyph and\n!  then re-run this script. The nav mark and the ` +
      `favicon rotation are showing different sets.\n`,
  );
}

const navStyle =
  `<style>` +
  `path{fill:none;stroke:${NAV_INK};stroke-width:${NAV_STROKE};stroke-linecap:round;stroke-linejoin:round}` +
  `</style>`;

const navMorphSvg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${morphViewBox}" role="img" aria-label="morphing portrait glyph">` +
  navStyle +
  morphPaths.join("") +
  `</svg>\n`;

// The page's ONLY lever on this file is a plain string replace of `begin="0s"`,
// once per animated path — see src/lib/nav-morph.ts. If the pipeline ever emits
// that attribute some other way, or omits it, the replace would quietly match
// nothing and every refresh would start on the same portrait: a feature that
// looks like it is working, because the mark still animates. Fail here instead.
const begins = navMorphSvg.match(/\sbegin="[^"]*"/g) ?? [];
if (begins.length !== morphPaths.length || begins.some((b) => b !== ` begin="0s"`)) {
  throw new Error(
    `public/nav-morph.svg: expected one \`begin="0s"\` per animated path, found ` +
      `${begins.length ? begins.join(", ") : "none"}.`,
  );
}

writeFileSync("public/nav-morph.svg", navMorphSvg);
console.log(
  `wrote public/nav-morph.svg (${morphPaths.length} animated paths at stroke-width ` +
    `${NAV_STROKE}, ${frameOffsets.length} portraits over ${morphDur}s)`,
);

// The offsets the page picks from. Generated, not hand-edited, for the same
// reason as src/data/favicons.ts: re-run the pipeline with a different folder of
// photographs and the list has to follow, or the mark starts mid-dissolve.
await writeGenerated(
  "src/data/nav-morph.ts",
  `// GENERATED by scripts/gen-favicons.mjs — do not edit.\n` +
    `//\n` +
    `// One entry per portrait in public/nav-morph.svg: the second, within that\n` +
    `// file's ${morphDur}s loop, at which the portrait stops dissolving and holds.\n` +
    `// The script that picks one per page load lives in src/lib/nav-morph.ts.\n` +
    `export const MORPH_FRAME_OFFSETS = [${frameOffsets.join(", ")}] as const;\n`,
);
console.log(`wrote src/data/nav-morph.ts — ${frameOffsets.length} start points`);

/**
 * The still the nav shows before — or instead of — the morph.
 *
 * It is the <img>'s src in the markup, so it is what a visitor sees with JS off,
 * with reduced motion on, or in the moment before the morph arrives; see
 * src/lib/nav-morph.ts.
 *
 * NOT public/favicon.svg, though it is the same composite drawing. That file is
 * built for browser chrome: it is Estonian blue under a light scheme, and the
 * nav is #000 in every scheme. A visitor in light mode who asks for reduced
 * motion would get #0030DE on black — around 2.5:1, the exact smudge INK_DARK
 * exists to avoid. This one is nav ink at nav weight, scheme-blind, like the
 * morph it stands in for.
 */
writeFileSync(
  "public/nav-still.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${composite.viewBox}" role="img" aria-label="portrait glyph">` +
    navStyle +
    composite.paths.map((d) => `<path d="${roundPathData(d)}"/>`).join("") +
    `</svg>\n`,
);
console.log(`wrote public/nav-still.svg (reduced-motion still, stroke-width ${NAV_STROKE})`);

/**
 * An empty SVG, and the whole reason it exists is the <picture> in
 * SiteHeader.astro: there is no way to tell a <source> to select NOTHING, so
 * desktop selects this rather than downloading 186 KB of morph for an image
 * chrome.css hides.
 *
 * A file rather than the `data:` URI this started as. A srcset candidate list
 * is split on commas, and every data: URI contains one right after its media
 * type — so `data:image/svg+xml,%3Csvg…` parses as two candidates, neither of
 * them a URL. (`npm run audit` is what caught it, splitting srcset the same way
 * a browser does.) Ninety-odd bytes, cached after the first page, and
 * unambiguous.
 */
writeFileSync("public/nav-blank.svg", `<svg xmlns="http://www.w3.org/2000/svg"/>\n`);
console.log("wrote public/nav-blank.svg (desktop no-op — see the <picture> in SiteHeader.astro)");

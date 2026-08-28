#!/usr/bin/env node
/**
 * gen-light-palettes.mjs — PALETTE TEST. Derives the light half of
 * src/styles/palettes.css from its dark half, in place.
 *
 * Chromaphony's Ghibli corpus is dark-only: every palette in that file sits at
 * tone 8. Rather than invent light palettes by hand, this computes one per dark
 * palette so that a film's colour signature survives the flip — each token keeps
 * its counterpart's HUE and CHROMA in Oklch and takes a new lightness.
 *
 * The surfaces are mirrored: in the dark palettes the page is the darkest thing
 * and each layer above it is lighter, so here the page is the lightest and each
 * layer steps darker by the same intervals. The foregrounds are not mirrored,
 * they are SOLVED — --text, --text-muted, --accent and --select are darkened by
 * binary search until they clear the ratio scripts/contrast-check.mjs asks of
 * them, with a little margin so rounding to 8-bit hex cannot drop a pair below
 * the floor. That is why the accents come out deep rather than bright: --accent
 * has to carry --bg as a LABEL on a button fill.
 *
 * Rewrites only the region between the two `light:generated` markers, so the
 * dark blocks, the file's header and the light section's own prose are never
 * touched. Zero dependencies; the Oklab matrices are Björn Ottosson's.
 *
 *   npm run palettes:light        then      npm run a11y
 *
 * Deleting this script and palettes.css takes the whole palette test's colour
 * work with it — see src/components/PaletteToggle.astro for the rest.
 */
import { readFileSync, writeFileSync } from "node:fs";

// ── sRGB ⇄ Oklab/Oklch ──────────────────────────────────────────────────────
const f = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const g = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const rgb2hex = (rgb) =>
  "#" +
  rgb
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

function rgb2oklch([r, gg, b]) {
  [r, gg, b] = [f(r), f(gg), f(b)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * gg + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * gg + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * gg + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), h: Math.atan2(B, A) };
}
function oklch2rgb({ L, C, h }) {
  const A = C * Math.cos(h),
    B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    g(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    g(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}
const inGamut = (rgb) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);
/** Largest chroma ≤ want that stays inside sRGB at this L and hue. */
function fit(L, want, h) {
  let lo = 0,
    hi = want;
  if (inGamut(oklch2rgb({ L, C: hi, h }))) return hi;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklch2rgb({ L, C: mid, h }))) lo = mid;
    else hi = mid;
  }
  return lo;
}
const toHex = (L, C, h) => rgb2hex(oklch2rgb({ L, C: fit(L, C, h), h }));

// ── WCAG ────────────────────────────────────────────────────────────────────
const lum = (hex) => {
  const [r, gg, b] = hex2rgb(hex).map(f);
  return 0.2126 * r + 0.7152 * gg + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Darkest-but-sufficient: the highest L whose contrast against `on` still clears `target`. */
function darkenUntil(C, h, on, target) {
  let lo = 0.15,
    hi = 0.95; // lo = darkest, hi = lightest
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (ratio(toHex(mid, C, h), on) >= target) lo = mid;
    else hi = mid;
  }
  return lo;
}

// ── the mirror ──────────────────────────────────────────────────────────────
// Surfaces step AWAY from the page the same way the dark ladder does — there the
// page is the darkest thing and each layer is lighter; here it is the lightest
// and each layer is darker. The steps are the dark palette's own, mirrored.
const SURFACE_L = {
  "--bg": 0.985,
  "--card": 0.955,
  "--surface": 0.935,
  "--line": 0.885,
  "--field": 0.855,
};
// Contrast targets, each a little above the gate's floor so rounding to 8-bit
// hex can never drop a pair below it.
const TARGET = { text: 12, muted: 4.8, accent: 4.8 };

const FILE = "src/styles/palettes.css";
const START = "/* light:generated:start";
const END = "/* light:generated:end */";
const css = readFileSync(FILE, "utf8");
const out = [];
let n = 0;
for (const block of css
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .matchAll(/\[data-palette="([^"]+)"\]\s*\{([\s\S]*?)\}/g)) {
  const [, name, body] = block;
  if (name.endsWith("-light")) continue;
  const dark = new Map();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-f]{6})\s*;/g)) dark.set(m[1], m[2]);

  const px = {};
  for (const [token, L] of Object.entries(SURFACE_L)) {
    const { C, h } = rgb2oklch(hex2rgb(dark.get(token)));
    px[token] = toHex(L, C, h);
  }
  const pick = (token, on, target) => {
    const { C, h } = rgb2oklch(hex2rgb(dark.get(token)));
    return toHex(darkenUntil(C, h, px[on], target), C, h);
  };
  px["--text"] = pick("--text", "--bg", TARGET.text);
  // Measured against --surface, the darkest of the three plates dim text lands
  // on: clear it and --bg and --card follow.
  px["--text-muted"] = pick("--text-muted", "--surface", TARGET.muted);
  // The accent and the selection colour both carry --bg as a LABEL on top of
  // them (a button fill, a <mark>), so they are darkened until near-white text
  // reads on them — which is also what keeps them legible as the corner swatch
  // over a dark page.
  px["--accent"] = pick("--accent", "--bg", TARGET.accent);
  px["--select"] = pick("--select", "--bg", TARGET.accent);

  const ratios = (fg, ...bgs) =>
    bgs.map((b) => `${ratio(px[fg], px[b]).toFixed(2)}:1 on ${b}`).join(" · ");
  out.push(
    `/* ${name} — derived light counterpart */\n` +
      `:root[data-palette="${name}-light"] {\n` +
      `  color-scheme: light;\n` +
      `  --bg: ${px["--bg"]};\n` +
      `  --text: ${px["--text"]}; /* ${ratios("--text", "--bg", "--card", "--surface", "--field")} */\n` +
      `  --card: ${px["--card"]};\n` +
      `  --surface: ${px["--surface"]};\n` +
      `  --line: ${px["--line"]};\n` +
      `  --field: ${px["--field"]};\n` +
      `  --text-muted: ${px["--text-muted"]}; /* ${ratios("--text-muted", "--bg", "--card", "--surface")} */\n` +
      `  --accent: ${px["--accent"]}; /* ${ratios("--accent", "--bg", "--surface")} */\n` +
      `  --select: ${px["--select"]}; /* ${ratios("--select", "--bg")} */\n` +
      `  --focus-ring-color: var(--accent);\n}`,
  );
  n++;
}
const from = css.indexOf(START);
const to = css.indexOf(END);
if (from === -1 || to === -1) {
  console.error(`\u2716 ${FILE} has no light:generated markers to write between`);
  process.exit(1);
}
const head = css.slice(0, css.indexOf("\n", from) + 1);
writeFileSync(FILE, head + out.join("\n\n") + "\n" + css.slice(to));
console.log(`${n} light palettes written into ${FILE}`);

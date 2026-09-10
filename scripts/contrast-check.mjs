#!/usr/bin/env node
/**
 * contrast-check.mjs — WCAG contrast gate for the colour tokens.
 *
 * Zero dependencies (Node 18+). Reads the `:root` block of src/styles/tokens.css
 * and recomputes the contrast ratio of every colour pairing the site actually
 * renders, so changing a token can't quietly ship an unreadable page.
 *
 * Why this exists: the palette once had a token named `--muted` that was used as
 * both a background and a text colour. At 1.44:1 on --bg it made the "← Back
 * home" link on every prose page effectively invisible. The fix at the time was
 * a rename (`--surface`) and a comment. A comment is not a gate — this is.
 *
 * Usage:
 *   node scripts/contrast-check.mjs                (defaults to src/styles/tokens.css)
 *   node scripts/contrast-check.mjs path/to/tokens.css
 *
 * Exit codes: 0 = every pair passes, 1 = at least one fails.
 *
 * ADDING A PAIR: if you introduce a colour combination the site renders — new
 * text colour, new button, new focus style — add it to PAIRS below. The check
 * only knows about the pairings listed here.
 */

import { existsSync, readFileSync } from "node:fs";

// ---------------------------------------------------------------- config ---
// Every foreground/background pairing the stylesheets actually produce.
//
// `min` is the WCAG 2.2 threshold for that kind of thing:
//   4.5  normal-size text                       (1.4.3 Contrast (Minimum), AA)
//   3    large text, icons, UI component edges, focus indicators
//        (1.4.3 for large text, 1.4.11 Non-text Contrast, 2.4.13 Focus Appearance)
const PAIRS = [
  { fg: "--text", bg: "--bg", min: 4.5, what: "Body text on the page background" },
  { fg: "--text-muted", bg: "--bg", min: 4.5, what: "Dim text: prose back-link, ticker control" },
  {
    fg: "--text",
    bg: "--surface",
    min: 4.5,
    what: "Text on a raised surface (.cta-secondary, chart tooltips, map popup)",
  },
  {
    fg: "--text-muted",
    bg: "--surface",
    min: 4.5,
    what: "Dim text on a raised surface (map popup field names)",
  },
  { fg: "--bg", bg: "--btn-light", min: 4.5, what: "Primary button label" },
  { fg: "--bg", bg: "--accent", min: 4.5, what: "Label on an accent fill (hover/focus states)" },
  { fg: "--bg", bg: "--select", min: 4.5, what: "Text inside <mark>" },
  { fg: "--accent", bg: "--bg", min: 3, what: "Accent used as an icon/indicator colour" },
  { fg: "--focus-ring-color", bg: "--bg", min: 3, what: "Keyboard focus ring (WCAG 2.4.13)" },
  { fg: "--focus-ring-color", bg: "--surface", min: 3, what: "Focus ring over a raised surface" },
  {
    fg: "--text",
    bg: "--card",
    min: 4.5,
    what: "Signup card heading and status line, and the text of a citation tile",
  },
  { fg: "--text-muted", bg: "--card", min: 4.5, what: "Microcopy under the signup form" },
  {
    fg: "--text",
    bg: "--field",
    min: 4.5,
    what:
      "A typed address, its label, the white focus ring drawn inside the field, and — " +
      "once signed up — the confirmation in that same box and the spent Sign up button under it",
  },
];

// Chart series colours (--series-1 … --series-N, see tokens.css). Each is a
// MARK on the page — a line, a bar, a legend swatch — so 1.4.11's 3:1 applies,
// not text's 4.5:1. How many there are is read from tokens.css below rather
// than restated here. Their other promise, that every PAIR stays distinct for a
// colour-blind reader, is not a contrast ratio and has its own check further
// down (SERIES DISTINCTNESS).
const SERIES_PAIR = (fg) => ({
  fg,
  bg: "--bg",
  min: 3,
  what: "Chart series colour — a mark, not text (1.4.11)",
});

// Tokens that must NEVER be used as a foreground colour. Listing one here says
// "this is a background/hairline, and here is the number that proves it" — so a
// future edit that reaches for it as text has a documented reason not to.
const BACKGROUND_ONLY = [
  { token: "--surface", note: "backgrounds only — 1.44:1 on --bg is the original bug" },
  { token: "--line", note: "hairline dividers only; decorative, not a UI boundary" },
  { token: "--card", note: "the signup card's plate; text on it is checked above" },
  { token: "--field", note: "a form field's fill; text on it is checked above" },
];

// ------------------------------------------------------------- plumbing ---
const file = process.argv[2] ?? "src/styles/tokens.css";

let css;
try {
  css = readFileSync(file, "utf8");
} catch {
  console.error(`✖ tokens file not found: ${file}`);
  process.exit(1);
}

// Pull `--name: value;` out of the :root block, ignoring comments.
const rootBlock = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/:root\s*\{([\s\S]*?)\}/);
if (!rootBlock) {
  console.error(`✖ no :root { … } block in ${file}`);
  process.exit(1);
}
const tokens = new Map();
for (const m of rootBlock[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens.set(m[1], m[2].trim());

// In order: --series-1, --series-2, … as tokens.css defines them.
const SERIES = [...tokens.keys()]
  .filter((t) => /^--series-\d+$/.test(t))
  .sort((a, b) => parseInt(a.slice(9), 10) - parseInt(b.slice(9), 10));
PAIRS.push(...SERIES.map(SERIES_PAIR));

// Follow `--a: var(--b)` chains to the literal colour. Depth-capped so a
// self-referential token reports instead of hanging.
function resolve(name, map = tokens, seen = new Set()) {
  if (seen.has(name)) return null;
  seen.add(name);
  const raw = map.get(name);
  if (!raw) return null;
  const alias = raw.match(/^var\(\s*(--[\w-]+)/);
  return alias ? resolve(alias[1], map, seen) : raw;
}

// sRGB parsing: #rgb, #rrggbb, and rgb()/rgba() with integer channels. Anything
// else (color-mix, hsl, oklch) is reported rather than silently skipped — a pair
// that can't be measured is a hole in the gate, not a pass.
function toRgb(value) {
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h =
      hex[1].length === 3
        ? hex[1]
            .split("")
            .map((c) => c + c)
            .join("")
        : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const fn = value.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  return null;
}

// WCAG 2.x relative luminance + contrast ratio.
const channel = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// ---------------------------------------------------------------- report ---
const failures = [];
const rows = [];

for (const { fg, bg, min, what } of PAIRS) {
  const fgRaw = resolve(fg);
  const bgRaw = resolve(bg);
  if (!fgRaw || !bgRaw) {
    failures.push(`${fg} on ${bg}: token not defined in ${file}`);
    continue;
  }
  const fgRgb = toRgb(fgRaw);
  const bgRgb = toRgb(bgRaw);
  if (!fgRgb || !bgRgb) {
    failures.push(
      `${fg} on ${bg}: cannot measure (${!fgRgb ? fgRaw : bgRaw}) — use a hex or rgb() value, or drop the pair`,
    );
    continue;
  }
  const r = ratio(fgRgb, bgRgb);
  const ok = r >= min;
  if (!ok) failures.push(`${fg} on ${bg}: ${r.toFixed(2)}:1 — needs ${min}:1 (${what})`);
  rows.push({ ok, label: `${fg} on ${bg}`, r, min, what });
}

// Report background-only tokens as information, with the measured number that
// explains the rule. Never a failure — these are correct as backgrounds.
for (const { token, note } of BACKGROUND_ONLY) {
  const raw = resolve(token);
  const rgb = raw && toRgb(raw);
  const bgRgb = toRgb(resolve("--bg") ?? "");
  if (rgb && bgRgb)
    rows.push({
      ok: null,
      label: `${token} on --bg`,
      r: ratio(rgb, bgRgb),
      min: null,
      what: note,
    });
}

// ------------------------------------------------- PALETTE TEST (optional) ---
// src/styles/palettes.css defines alternate palettes as `[data-palette="…"]`
// blocks, each redefining the colour tokens wholesale (see that file's header
// and src/components/PaletteToggle.astro). A visitor can put any of them on the
// page, so every one of them has to clear the SAME pairings as the default —
// the ratios in their comments come from the tool that generated them and are
// not this gate's word for anything.
//
// Guarded on the file existing, and read only when the tokens file being
// checked is the site's own: delete palettes.css and this section goes quiet,
// which is what makes the test revertible in one step.
const PALETTES_FILE = "src/styles/palettes.css";
// Each palette's --series-* live in a file of their own, generated beside
// palettes.css and keyed on the same names, so they are layered in here the
// way the cascade layers them. A palette with no block there inherits the
// site's own series from tokens.css — and then gets measured against its own
// --bg, which is exactly the failure a missing block should be.
const SERIES_FILE = "src/styles/series.css";
const blocksOf = (path) => {
  const out = new Map();
  if (!existsSync(path)) return out;
  const css = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, name, body] of css.matchAll(/\[data-palette="([^"]+)"\]\s*\{([\s\S]*?)\}/g))
    out.set(name, body);
  return out;
};
const paletteRows = [];
if (file === "src/styles/tokens.css" && existsSync(PALETTES_FILE)) {
  const seriesBlocks = blocksOf(SERIES_FILE);
  for (const [name, body] of blocksOf(PALETTES_FILE)) {
    // Layered over the defaults, not replacing them: a palette that redefines
    // eight tokens still inherits --btn-light (`var(--text)`, and so its own
    // text colour) and everything else from :root, exactly as the cascade does.
    const map = new Map(tokens);
    for (const layer of [body, seriesBlocks.get(name) ?? ""])
      for (const m of layer.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) map.set(m[1], m[2].trim());

    let worst = null;
    for (const { fg, bg, min, what } of PAIRS) {
      const fgRgb = toRgb(resolve(fg, map) ?? "");
      const bgRgb = toRgb(resolve(bg, map) ?? "");
      if (!fgRgb || !bgRgb) {
        failures.push(`palette ${name}: cannot measure ${fg} on ${bg}`);
        continue;
      }
      const r = ratio(fgRgb, bgRgb);
      if (r < min)
        failures.push(
          `palette ${name}: ${fg} on ${bg} is ${r.toFixed(2)}:1 — needs ${min}:1 (${what})`,
        );
      // The tightest pair in the palette, as a multiple of its own threshold, so
      // one number says how much headroom the whole palette has.
      if (!worst || r / min < worst.r / worst.min) worst = { r, min, label: `${fg} on ${bg}` };
    }
    paletteRows.push({
      name,
      map,
      worst,
      accent: resolve("--accent", map),
      bg: resolve("--bg", map),
    });
  }
  // A series block for a palette that palettes.css does not define is not
  // harmless: src/lib/palette.client.ts reads palette NAMES off every
  // [data-palette] rule in the bundle, so it would deal a palette that sets
  // twelve chart colours and nothing else.
  for (const name of seriesBlocks.keys())
    if (!paletteRows.some((p) => p.name === name))
      failures.push(`${SERIES_FILE}: block for "${name}", which ${PALETTES_FILE} does not define`);
}

// -------------------------------------------------- SERIES DISTINCTNESS ---
// The series' second promise: every pair is still two colours to a reader with
// a colour-vision deficiency. Measured as the distance between the two colours
// in OKLab — how different they LOOK, not how different their hex is — for
// normal vision and after simulating protanopia, deuteranopia and tritanopia
// (Machado, Oliveira & Fernandes 2009, full severity), and the pair scores the
// worst of the four. The first six are held to more, because six is about as
// many series as a chart here draws; the whole set to less, because twelve
// colours that clear 0.08 under all three simulations do not exist inside the
// band 3:1 leaves on a page. For scale on this metric: Okabe–Ito's seven
// chromatic colours, the usual reference set, score 0.076; Observable Plot's
// default scheme 0.020.
//
// And every series is kept clear of --text and --text-muted, the colours a
// chart draws its axes, ticks and labels in: a line that turns into the axis
// grey under a simulation has not been drawn at all.
const SERIES_GATE = { all: 0.06, first: 0.08, firstN: 6, neutral: 0.04 };
const CVD = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};
const VISIONS = ["normal", ...Object.keys(CVD)];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const mul = (m, v) => m.map((row) => clamp01(row[0] * v[0] + row[1] * v[1] + row[2] * v[2]));
// Linear RGB → OKLab (Björn Ottosson's matrices, as in scripts/gen-light-palettes.mjs).
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const seen = (rgb) => {
  const linear = rgb.map(channel);
  return [oklab(linear), ...Object.values(CVD).map((m) => oklab(mul(m, linear)))];
};
/** Worst-vision distance between two colours, and which vision it was. */
function apart(a, b) {
  const va = seen(a);
  const vb = seen(b);
  let best = { d: Infinity, vision: "" };
  va.forEach((x, i) => {
    const d = Math.hypot(x[0] - vb[i][0], x[1] - vb[i][1], x[2] - vb[i][2]);
    if (d < best.d) best = { d, vision: VISIONS[i] };
  });
  return best;
}

const seriesRows = [];
function checkSeries(name, map) {
  const colours = SERIES.map((t) => ({ t, rgb: toRgb(resolve(t, map) ?? "") }));
  const bad = colours.find((c) => !c.rgb);
  if (bad) {
    failures.push(`${name}: cannot measure ${bad.t} for series distinctness`);
    return;
  }
  const worst = { all: { d: Infinity }, first: { d: Infinity } };
  for (let i = 0; i < colours.length; i++) {
    for (let j = i + 1; j < colours.length; j++) {
      const p = {
        ...apart(colours[i].rgb, colours[j].rgb),
        pair: `${colours[i].t} / ${colours[j].t}`,
      };
      if (p.d < worst.all.d) worst.all = p;
      if (j < SERIES_GATE.firstN && p.d < worst.first.d) worst.first = p;
    }
  }
  let neutral = { d: Infinity };
  for (const text of ["--text", "--text-muted"]) {
    const n = toRgb(resolve(text, map) ?? "");
    if (!n) continue;
    for (const c of colours) {
      const p = { ...apart(c.rgb, n), pair: `${c.t} / ${text}` };
      if (p.d < neutral.d) neutral = p;
    }
  }
  const verdicts = [
    [worst.all, SERIES_GATE.all, "any two series"],
    [worst.first, SERIES_GATE.first, `two of the first ${SERIES_GATE.firstN} series`],
    [neutral, SERIES_GATE.neutral, "a series and the text colours"],
  ];
  for (const [p, min, what] of verdicts)
    if (p.d < min)
      failures.push(
        `${name}: ${p.pair} are ${p.d.toFixed(3)} apart for ${p.vision} vision — ${what} need ${min}`,
      );
  seriesRows.push({ name, ok: verdicts.every(([p, min]) => p.d >= min), worst, neutral });
}
if (SERIES.length) {
  checkSeries("(site palette)", tokens);
  for (const { name, map } of paletteRows) checkSeries(name, map);
}

// The corner marks are the one place a colour from one palette is drawn on top
// of another: each wears the accent of a palette that is NOT on screen, so a
// dark palette's bright accent can land on a light page and the reverse. This
// sweep is every accent over every background, and the worst of them is the
// number the component's hairline exists for.
//
// INFORMATION, NOT A GATE, and worth knowing rather than acting on. The marks
// carry no border, so in the worst combination the number below IS the contrast
// of that 12px square against the page — under the 3:1 that WCAG 1.4.11 asks of
// a control. It applies to one mark, in one direction (a bright dark-palette
// accent previewed on a light page), while the other two marks and every other
// pairing sit at 7:1 or better; the control it belongs to is a colour toy whose
// whole state is also announced in its accessible name. Gating on it would mean
// throwing away every bright accent in the dark corpus, or putting the hairline
// back — `outline: 1px solid var(--text-muted)` in PaletteToggle.astro, which is
// where this measurement stops mattering.
const swatch = { r: Infinity, fg: null, bg: null };
if (paletteRows.length) {
  const defaults = { name: "(site palette)", accent: resolve("--accent"), bg: resolve("--bg") };
  for (const fg of [defaults, ...paletteRows]) {
    for (const bg of [defaults, ...paletteRows]) {
      const a = toRgb(fg.accent ?? "");
      const b = toRgb(bg.bg ?? "");
      if (!a || !b) continue;
      const r = ratio(a, b);
      if (r < swatch.r) Object.assign(swatch, { r, fg: fg.name, bg: bg.name });
    }
  }
}

const width = Math.max(...rows.map((row) => row.label.length));
for (const row of rows) {
  const mark = row.ok === null ? "·" : row.ok ? "✔" : "✖";
  const need = row.min === null ? "     " : `(≥${row.min})`.padStart(7);
  console.log(
    `${mark} ${row.label.padEnd(width)}  ${row.r.toFixed(2).padStart(6)}:1 ${need}  ${row.what}`,
  );
}

console.log(
  `\n${rows.filter((r) => r.ok !== null).length} pairs checked · ${failures.length} failing`,
);

if (paletteRows.length) {
  const pw = Math.max(...paletteRows.map((p) => p.name.length));
  console.log(`\n${PALETTES_FILE} — the same ${PAIRS.length} pairs, per palette (tightest shown):`);
  for (const { name, worst } of paletteRows) {
    const bad = worst && worst.r < worst.min;
    console.log(
      `${bad ? "✖" : "✔"} ${name.padEnd(pw)}  ${worst.r.toFixed(2).padStart(6)}:1 ${`(≥${worst.min})`.padStart(7)}  ${worst.label}`,
    );
  }
  if (swatch.fg) {
    console.log(
      `\n· corner marks, every accent over every background · worst ` +
        `${swatch.r.toFixed(2)}:1 — ${swatch.fg} accent on ${swatch.bg} background ` +
        `(the marks carry no border: this is the mark itself against the page)`,
    );
  }
  console.log(`\n${paletteRows.length} palettes checked`);
}
if (seriesRows.length) {
  const sw = Math.max(...seriesRows.map((s) => s.name.length));
  console.log(
    `\nSeries distinctness — ${SERIES.length} colours, worst pair under normal/protan/deutan/tritan ` +
      `(ΔE OKLab; need ≥${SERIES_GATE.all} all, ≥${SERIES_GATE.first} first ${SERIES_GATE.firstN}, ` +
      `≥${SERIES_GATE.neutral} vs text):`,
  );
  for (const { name, ok, worst, neutral } of seriesRows) {
    console.log(
      `${ok ? "✔" : "✖"} ${name.padEnd(sw)}  all ${worst.all.d.toFixed(3)} (${worst.all.vision.padEnd(6)})  ` +
        `first ${worst.first.d.toFixed(3)}  vs text ${neutral.d.toFixed(3)}`,
    );
  }
}
if (failures.length) {
  console.error("\nFix the token values in " + file + ", or the pairing in the stylesheet:");
  for (const f of failures) console.error(`  ✖ ${f}`);
  process.exit(1);
}

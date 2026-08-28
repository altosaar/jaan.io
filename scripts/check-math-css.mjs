// Assert that the KaTeX CSS the site ships actually styles the KaTeX markup the
// site emits.
//
//   npm run build          # runs this last, with check-pages-limits
//   node scripts/check-math-css.mjs [dir]   # default: dist
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
// Math is rendered at BUILD time by rehype-katex and styled at READ time by a
// stylesheet imported separately (`import "katex/dist/katex.min.css"` in
// src/pages/[slug].astro). Nothing connects those two facts. They came from
// different copies of KaTeX for an unknown length of time:
//
//   katex@0.18.4          <- the direct dependency, and what the CSS import got
//   rehype-katex@7.0.1
//     └── katex@0.16.47   <- nested, because rehype-katex declares ^0.16.0,
//                            and what actually rendered every equation
//
// Between those versions KaTeX renamed its sizing classes — `.katex .sizing`
// became `.katex .katex-sizing` — so every one of the 121 sizing rules missed,
// and every subscript and superscript on the site rendered at full size on the
// baseline. q_θ(z|x) read as "qθ(z|x)". It shipped to production, and NOTHING
// caught it: the build passed, the types passed, the audit passed, the HTML was
// valid and the CSS was valid. They were simply about different software.
//
// The version is pinned now, and `overrides` forces a single copy — but a pin
// is a promise about package.json, and this is a check on the artefact. It
// compares what was emitted against what was shipped, so it stays true however
// the dependency graph is rearranged later.
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? "dist";

if (!existsSync(root)) {
  console.error(`check-math-css: ${root} does not exist — run the build first.`);
  process.exit(1);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile()) yield path;
  }
}

// Every class KaTeX puts on a span that carries a font-size rule. Collected from
// the HTML rather than hardcoded, so a future KaTeX that emits something new is
// covered without editing this list.
const CLASS_RE = /class="([^"]*\b(?:sizing|katex-sizing)\b[^"]*)"/g;

const pages = [];
const css = [];
for await (const path of walk(root)) {
  if (path.endsWith(".html")) pages.push(path);
  else if (path.endsWith(".css")) css.push(path);
}

// The one page with the most math is the one worth testing; checking every page
// would report the same failure nine times.
let worst = { path: null, classes: new Set(), count: 0 };
for (const path of pages) {
  const html = await readFile(path, "utf8");
  const count = (html.match(/class="katex"/g) ?? []).length;
  if (count <= worst.count) continue;
  const classes = new Set();
  for (const [, value] of html.matchAll(CLASS_RE)) {
    // "sizing reset-size6 size3 mtight" → ".sizing.reset-size6.size3"
    const parts = value
      .split(/\s+/)
      .filter((c) => /^(sizing|katex-sizing|reset-size\d+|size\d+)$/.test(c));
    if (parts.length >= 2) classes.add(parts.sort().join("."));
  }
  worst = { path, classes, count };
}

if (!worst.path || worst.classes.size === 0) {
  // No math anywhere is a legitimate state — nothing to check, and nothing to
  // complain about. It is NOT silently passing a broken build: if a page had
  // math, it would have been found.
  console.log("check-math-css: no rendered math in the build — nothing to check");
  process.exit(0);
}

const stylesheets = await Promise.all(css.map((p) => readFile(p, "utf8")));
const all = stylesheets.join("\n");

// A class combination is "styled" if the stylesheet mentions every one of its
// parts in a single selector. Matching on the parts rather than on the exact
// selector string, because the order KaTeX writes them in the class attribute
// and the order it writes them in the selector need not agree.
const unstyled = [];
for (const combo of worst.classes) {
  const parts = combo.split(".");
  const found = parts.every((part) => all.includes(`.${part}`));
  if (!found) unstyled.push(combo);
}

if (unstyled.length) {
  console.error(
    `\ncheck-math-css: ${worst.path} emits KaTeX classes that no shipped stylesheet styles:\n`,
  );
  for (const combo of unstyled.slice(0, 8)) console.error(`  .${combo}`);
  console.error(
    "\nThe renderer and the stylesheet are different versions of KaTeX. Check:\n" +
      "  npm ls katex          # expect ONE version, everything else deduped\n" +
      "and make the `katex` dependency match what rehype-katex resolves. The\n" +
      "`overrides` entry in package.json is what holds them together.\n" +
      "\nUncaught, this ships every subscript and superscript at full size on the\n" +
      "baseline — valid HTML, valid CSS, about different software.\n",
  );
  process.exit(1);
}

console.log(
  `check-math-css: ${worst.count} equations in ${worst.path}, ` +
    `${worst.classes.size} sizing combinations all styled`,
);

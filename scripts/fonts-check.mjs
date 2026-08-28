// Proves the three places that describe the site's typefaces still agree:
//
//   src/styles/tokens.css   the ROLES   (--font-display / --font-body / --font-chrome)
//   src/styles/fonts.css    the FILES   (@font-face family → .woff2)
//   src/site.config.ts      the PRELOAD (SITE.fonts)
//
//   node scripts/fonts-check.mjs        (npm run fonts:check)
//
// Every failure here is one that ships silently and looks like a design choice:
// a role pointing at a family with no @font-face renders in the fallback and
// nobody notices for a week; a preload for a file the page never uses is dead
// bandwidth on every visit and only shows up as a console warning; a typeface
// named directly in a component is invisible to every future font change.
//
// Exits non-zero on any failure, so CI can gate on it.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const problems = [];
const fail = (msg) => problems.push(msg);

const read = (p) => readFileSync(p, "utf8");
// Comments mention font names all the time — strip them before parsing so a
// note about Fraunces is never mistaken for a rule that uses it.
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

// ── The roles ───────────────────────────────────────────────────────────────
const tokens = stripComments(read("src/styles/tokens.css"));
const roles = new Map(); // token name → first family in the stack
for (const [, name, stack] of tokens.matchAll(/(--font-[\w-]+)\s*:\s*([^;]+);/g)) {
  const first = stack
    .trim()
    .split(",")[0]
    .trim()
    .replace(/^["']|["']$/g, "");
  roles.set(name, first);
}
if (roles.size === 0) fail("tokens.css: no --font-* role tokens found at all.");

// ── The files ───────────────────────────────────────────────────────────────
const faces = new Map(); // family → [public paths]
for (const [, block] of stripComments(read("src/styles/fonts.css")).matchAll(
  /@font-face\s*\{([^}]*)\}/g,
)) {
  const family = block.match(/font-family\s*:\s*["']?([^"';]+)["']?\s*;/)?.[1]?.trim();
  if (!family) {
    fail("fonts.css: an @font-face block has no font-family.");
    continue;
  }
  const urls = [...block.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]);
  if (urls.length === 0) fail(`fonts.css: @font-face for "${family}" has no src url().`);
  for (const u of urls) {
    if (!existsSync(join("public", u)))
      fail(`fonts.css: "${family}" points at public${u}, missing.`);
  }
  faces.set(family, [...(faces.get(family) ?? []), ...urls]);
}

// ── The preload list ────────────────────────────────────────────────────────
const config = read("src/site.config.ts");
const fontsArray = config.match(/\bfonts\s*:\s*\[([^\]]*)\]/)?.[1];
if (fontsArray === undefined) fail("site.config.ts: could not find the `fonts:` array.");
const preloaded = [...(fontsArray ?? "").matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);

// ── Cross-checks ────────────────────────────────────────────────────────────
const usedFamilies = new Set(roles.values());
// A role may legitimately name a generic (system-ui) with no @font-face.
const GENERIC = /^(system-ui|sans-serif|serif|monospace|cursive|fantasy|ui-[\w-]+)$/;

for (const [token, family] of roles) {
  if (GENERIC.test(family)) continue;
  if (!faces.has(family))
    fail(`${token} asks for "${family}", which has no @font-face in fonts.css.`);
  else if (!faces.get(family).some((u) => preloaded.includes(u)))
    fail(
      `${token} uses "${family}" but none of its files are in SITE.fonts — it will not be preloaded.`,
    );
}

const familyOf = (url) => [...faces].find(([, urls]) => urls.includes(url))?.[0];
for (const url of preloaded) {
  if (!existsSync(join("public", url))) fail(`SITE.fonts preloads ${url}, which does not exist.`);
  const fam = familyOf(url);
  if (!fam) fail(`SITE.fonts preloads ${url}, which no @font-face in fonts.css refers to.`);
  else if (!usedFamilies.has(fam))
    fail(
      `SITE.fonts preloads ${url} ("${fam}"), which no --font-* role uses — dead weight on every page.`,
    );
}

// ── No typeface may be named outside tokens.css ─────────────────────────────
// The whole point of the role tokens: a component that hardcodes "Inter" keeps
// rendering in Inter after someone repoints every token, and nothing says so.
const SOURCES = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(css|astro)$/.test(p)) SOURCES.push(p);
  }
})("src");

for (const file of SOURCES) {
  if (/styles[/\\](tokens|fonts)\.css$/.test(file)) continue;
  for (const [, value] of stripComments(read(file)).matchAll(/font-family\s*:\s*([^;}]+)/g)) {
    const v = value.trim();
    if (v.startsWith("var(--font-") || v === "inherit" || v === "initial" || v === "unset")
      continue;
    fail(`${relative(".", file)}: font-family is "${v}" — name a --font-* role, not a typeface.`);
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
for (const [token, family] of roles) console.log(`  ${token.padEnd(16)} → ${family}`);
console.log(
  `  ${String(faces.size).padStart(2)} @font-face families · ${preloaded.length} preloaded`,
);

if (problems.length) {
  console.error("");
  for (const p of problems) console.error(`✖ ${p}`);
  console.error(`\n${problems.length} font problem(s).`);
  process.exit(1);
}
console.log("\n✔ roles, @font-face files, and the preload list all agree.");

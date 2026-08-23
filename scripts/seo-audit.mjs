#!/usr/bin/env node
/**
 * seo-audit.mjs — static-site pre-flight audit for an Astro `dist/` folder.
 *
 * Zero dependencies (Node 18+). Regex-based on purpose: Astro's generated HTML
 * is regular enough for this; the goal is a fast CI tripwire, not a validator.
 *
 * Usage:
 *   node scripts/seo-audit.mjs dist --site https://plgcleanup.org
 *   node scripts/seo-audit.mjs dist            (site inferred from index canonical)
 *
 * Exit codes: 0 = clean or warnings only, 1 = errors.
 * Env:
 *   SEO_SKIP_FRESH=1       downgrades stale-Event-schema errors to warnings.
 *   SEO_SKIP_PLACEHOLDER=1 downgrades the placeholder-content errors ("xyz"
 *                          names, "…"-only pull quotes) to warnings. Set
 *                          pre-launch only, while real gallery copy is
 *                          still being written — remove at launch (LAUNCH.md).
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, posix } from "node:path";

// ---------------------------------------------------------------- config ---
const CFG = {
  // Strings that must never ship in visible text (case-insensitive). ERROR.
  forbiddenVisible: [
    "example.org",
    "example.com",
    "lorem ipsum",
    "TKTK",
    "STUB —",
    "STUB -",
    // Editors write "_todo_" into Markdown while drafting. Shipping one means an
    // unfinished page went live (this is how terms.md nearly launched blank).
    "TODO",
  ],
  // Softer launch markers. WARN.
  warnVisible: ["coming soon"],
  // Placeholder gallery copy. ERROR unless SEO_SKIP_PLACEHOLDER=1.
  placeholderVisible: ["xyz"],
  // Comment markers that leak roadmap if shipped inside <!-- -->. WARN.
  commentMarkers: ["TODO", "STUB", "FIXME", "HACK"],
  // Alt texts that are effectively junk. ERROR. (alt="" is fine = decorative.)
  junkAlts: ["...", "\u2026", ".", "-", "image", "photo", "help me"],
  // aria-* attributes whose value is a space-separated list of element ids.
  // Each one is checked against the ids actually present on the page.
  ariaIdRefs: ["aria-labelledby", "aria-describedby", "aria-controls", "aria-details"],
  // AI/answer-engine crawlers that should not be blocked in robots.txt. WARN.
  aiBots: [
    "GPTBot",
    "ClaudeBot",
    "Claude-Web",
    "PerplexityBot",
    "Google-Extended",
    "CCBot",
    "Bytespider",
  ],
  thinWords: 120, // WARN below this visible word count
  // Pages allowed to be thin. The three index pages are deliberately sparse:
  // their content IS the grid of links (photographs, projects, articles), and
  // the audit counts only prose. Padding them with an intro paragraph to
  // satisfy a word count would be writing for the linter, not the reader.
  thinAllow: ["404.html", "index.html", "images.html", "projects.html"],
  // Standalone HTML artifacts that are EMBEDDED in a page, never navigated to.
  // These are the interactive D3/Plotly figures the blog posts iframe from
  // /files/ — generated output kept at its original URL so the old posts keep
  // working. They are not site pages: auditing them for <title>, canonical,
  // meta description or sitemap membership is a category error, and they are
  // correctly absent from the sitemap because they should not be indexed.
  // Everything else under dist is still audited in full.
  embeddedHtml: [/^files\//],
  imgBudgetBytes: 1.5 * 1024 * 1024, // per-page local image weight. WARN.
  titleLen: [15, 70],
  descLen: [50, 165],
  requireOg: ["og:title", "og:description", "og:image", "og:url"],
};

// ------------------------------------------------------------- plumbing ---
const args = process.argv.slice(2);
const dist = args.find((a) => !a.startsWith("--")) ?? "dist";
let siteArg = (args.find((a) => a.startsWith("--site=")) ?? "").split("=")[1] ?? "";
const si = args.indexOf("--site");
if (!siteArg && si !== -1 && args[si + 1]) siteArg = args[si + 1];

if (!existsSync(dist)) {
  console.error(`✖ dist folder not found: ${dist}`);
  process.exit(1);
}

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)],
  );
const files = walk(dist).map((f) => posix.join(...f.split(/[\\/]/)));
const rel = (f) => f.slice(posix.join(...dist.split(/[\\/]/)).length + 1);
const htmlFiles = files
  .filter((f) => f.endsWith(".html"))
  .map(rel)
  .filter((f) => !CFG.embeddedHtml.some((re) => re.test(f)));
const fileSet = new Set(files.map(rel));

// Which link shape is canonical depends on astro.config's `build.format`, so
// infer it from what was actually emitted rather than assuming. "file" builds
// emit about.html and want /about; "directory" builds emit about/index.html and
// want /about/ (this site, because jaan.io's 2013-era URLs all end in a slash —
// see the note in astro.config.mjs). Getting this backwards flags every correct
// link on the site, which is how a real broken link would get lost in the noise.
const WANT_TRAILING_SLASH = htmlFiles.some((f) => f !== "index.html" && f.endsWith("/index.html"));

const read = (f) => readFileSync(join(dist, f), "utf8");
const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");

const issues = []; // {level, file, msg}
const err = (file, msg) => issues.push({ level: "ERROR", file, msg });
const warn = (file, msg) => issues.push({ level: "WARN", file, msg });
// Placeholder-content findings: errors, unless the pre-launch escape hatch is set.
const placeholder = (file, msg) =>
  process.env.SEO_SKIP_PLACEHOLDER ? warn(file, msg) : err(file, msg);

// Map a URL path ("/about", "/about/", "/") to a file in dist, honoring both
// Astro build formats (about.html and about/index.html).
function pathToFile(p) {
  p = p.split(/[?#]/)[0];
  if (p === "" || p === "/") return "index.html";
  const clean = p.replace(/^\//, "").replace(/\/$/, "");
  for (const c of [clean, `${clean}.html`, `${clean}/index.html`]) if (fileSet.has(c)) return c;
  return null;
}

// ------------------------------------------------------------ infer site ---
let SITE = siteArg || null;
if (!SITE) {
  const m = read("index.html").match(/<link\s+rel="canonical"\s+href="(https?:\/\/[^/"]+)/);
  SITE = m ? m[1] : null;
  if (SITE) console.log(`ℹ --site not given; inferred from index canonical: ${SITE}`);
}
if (!SITE) {
  console.error("✖ Could not determine site origin. Pass --site https://example.com");
  process.exit(1);
}
const siteHost = new URL(SITE).host;

// --------------------------------------------------------- global checks ---
if (!fileSet.has("404.html"))
  err(
    "(site)",
    "No 404.html — Cloudflare Pages will SPA-fallback and serve index.html with HTTP 200 for every unknown URL (soft-404s). Add src/pages/404.astro.",
  );

if (!fileSet.has("robots.txt")) err("(site)", "robots.txt missing.");
else {
  const r = read("robots.txt");
  if (/^\s*Disallow:\s*\/\s*$/im.test(r)) err("robots.txt", "Disallow: / blocks the whole site.");
  const sm = r.match(/^Sitemap:\s*(\S+)/im);
  if (!sm) warn("robots.txt", "No Sitemap: line.");
  else if (new URL(sm[1]).host !== siteHost)
    err(
      "robots.txt",
      `Sitemap host ${new URL(sm[1]).host} ≠ --site host ${siteHost}. Rebuild with the correct astro.config \`site\`.`,
    );
  for (const bot of CFG.aiBots) {
    const re = new RegExp(`User-agent:\\s*${bot}[\\s\\S]{0,80}?Disallow:\\s*\\/`, "i");
    if (re.test(r)) warn("robots.txt", `${bot} is disallowed — AI/answer-engine visibility off.`);
  }
}

// Sitemap coverage + host consistency (handles sitemap-index).
let sitemapUrls = [];
function collectSitemap(f) {
  if (!fileSet.has(f)) return;
  const xml = read(f);
  for (const loc of [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => decode(m[1]))) {
    if (loc.endsWith(".xml")) collectSitemap(loc.replace(/^https?:\/\/[^/]+\//, ""));
    else sitemapUrls.push(loc);
  }
}
collectSitemap("sitemap-index.xml");
collectSitemap("sitemap.xml");
if (!sitemapUrls.length) err("(site)", "No sitemap URLs found (sitemap-index.xml / sitemap.xml).");
for (const u of sitemapUrls) {
  const url = new URL(u);
  if (url.host !== siteHost) err("(sitemap)", `URL on wrong host: ${u} (expected ${siteHost}).`);
  if (!pathToFile(url.pathname)) err("(sitemap)", `URL has no matching file in dist: ${u}`);
}
const inSitemap = new Set(sitemapUrls.map((u) => pathToFile(new URL(u).pathname)).filter(Boolean));

// -------------------------------------------------------- per-page checks ---
const titles = new Map(),
  descs = new Map();
const missingAssets = new Set();
const eventNodePages = new Set(); // pages that emitted an Event JSON-LD node
const ogImages = new Map(); // page -> og:image URL, checked for agreement below

/**
 * Width and height straight out of a JPEG's SOF marker.
 *
 * Fifteen lines rather than an image library: this script is deliberately
 * dependency-free so it can run as the last gate before deploy without an
 * install step deciding whether the site ships. Markers are 0xFFC0-0xFFCF minus
 * C4 (Huffman table), C8 (JPEG extensions) and CC (arithmetic coding) — the rest
 * are all Start Of Frame variants, and every one of them lays out the same:
 * length, precision, height, width.
 */
function jpegSize(buf) {
  if (buf.readUInt16BE(0) !== 0xffd8) return null; // not a JPEG
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

/**
 * Width and height out of a PNG's IHDR.
 *
 * Needed since the generated share cards (scripts/gen-og-cards.mjs) are PNG:
 * flat black behind hard-edged line art is the one case JPEG is worst at, where
 * its ringing shows as a halo around every stroke. IHDR is mandated to be the
 * first chunk, so the two dimensions are always at a fixed offset — this needs
 * no chunk walk at all, unlike its JPEG sibling above.
 */
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  if (buf.toString("latin1", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Dimensions of whichever of the two the bytes turn out to be. */
const imageSize = (buf) => pngSize(buf) ?? jpegSize(buf);

function assetExists(u, page) {
  // Only verify same-host or root-relative references; externals are lychee's job.
  let p = u.trim();
  if (/^(data:|mailto:|tel:|#)/.test(p)) return;
  if (/^https?:\/\//.test(p)) {
    const url = new URL(p);
    if (url.host !== siteHost) return;
    p = url.pathname;
  }
  if (!p.startsWith("/")) p = "/" + p; // treat as root-relative (Astro emits root-relative)
  const f = pathToFile(p) ?? (fileSet.has(p.slice(1)) ? p.slice(1) : null);
  if (!f && !missingAssets.has(p)) {
    missingAssets.add(p);
    err(page, `Referenced asset not in dist (first seen here): ${p}`);
  }
  return f;
}

for (const page of htmlFiles) {
  const html = read(page);
  const head = html.split(/<\/head>/i)[0] ?? "";
  const body = html.split(/<\/head>/i)[1] ?? html;

  // <html lang> and viewport
  if (!/<html[^>]+lang=/.test(html)) err(page, "<html> missing lang attribute.");
  if (!/<meta\s+name="viewport"/.test(head)) warn(page, "No viewport meta.");

  // Title
  const t = [...head.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/g)].map((m) => decode(m[1]).trim());
  if (t.length !== 1) err(page, `Expected exactly 1 <title>, found ${t.length}.`);
  if (t[0]) {
    if (titles.has(t[0])) err(page, `Duplicate title (also on ${titles.get(t[0])}): "${t[0]}"`);
    titles.set(t[0], page);
    if (t[0].length < CFG.titleLen[0] || t[0].length > CFG.titleLen[1])
      warn(
        page,
        `Title length ${t[0].length} outside ${CFG.titleLen.join("–")}: "${t[0].slice(0, 60)}…"`,
      );
  }

  // Meta description
  const d = head.match(/<meta\s+name="description"\s+content="([^"]*)"/);
  if (!d) err(page, "Missing meta description.");
  else {
    const dv = decode(d[1]);
    if (descs.has(dv)) err(page, `Duplicate meta description (also on ${descs.get(dv)}).`);
    descs.set(dv, page);
    if (dv.length < CFG.descLen[0] || dv.length > CFG.descLen[1])
      warn(page, `Description length ${dv.length} outside ${CFG.descLen.join("–")}.`);
  }

  // Canonical
  const c = head.match(/<link\s+rel="canonical"\s+href="([^"]+)"/);
  if (!c) err(page, "Missing canonical.");
  else {
    const cu = new URL(decode(c[1]));
    if (cu.host !== siteHost) err(page, `Canonical host ${cu.host} ≠ ${siteHost}.`);
    const cf = pathToFile(cu.pathname);
    if (cf !== page && !(page === "index.html" && cf === "index.html"))
      err(page, `Canonical path ${cu.pathname} does not map to this file.`);
  }

  // robots meta
  const rm = head.match(/<meta\s+name="robots"\s+content="([^"]*)"/);
  if (rm && /noindex/i.test(rm[1]) && page !== "404.html") err(page, `noindex present: "${rm[1]}"`);

  // OG / twitter completeness
  for (const k of CFG.requireOg)
    if (!new RegExp(`<meta\\s+property="${k}"`).test(head)) warn(page, `Missing ${k}.`);
  if (!/<meta\s+name="twitter:card"/.test(head)) warn(page, "Missing twitter:card.");

  // Asset references must exist (this is what catches a dead og:image).
  for (const m of head.matchAll(
    /<meta\s+(?:property|name)="(?:og:image|twitter:image)"\s+content="([^"]+)"/g,
  ))
    assetExists(decode(m[1]), page);

  // The whole share card, as this page declares it. Collected per page rather
  // than as a single sitewide value: posts and visualizations each carry their
  // own picture now (see src/lib/og.ts), so the share-image section below checks
  // that every one of them is real and correctly described, not that they agree.
  const ogImg = head.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
  if (ogImg) {
    const declared = (k) =>
      head.match(new RegExp(`<meta property="og:image:${k}" content="([^"]+)"`))?.[1];
    ogImages.set(page, {
      url: decode(ogImg[1]),
      width: Number(declared("width")) || null,
      height: Number(declared("height")) || null,
      type: declared("type") ?? null,
      alt: declared("alt") ? decode(declared("alt")) : null,
      twitter: decode(head.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/)?.[1] ?? ""),
    });
  }
  for (const m of html.matchAll(/<(?:img|source|script|link)\b[^>]*?(?:src|href)="([^"]+)"/g)) {
    const v = decode(m[1]);
    if (/\.(css|js|mjs|png|jpe?g|webp|avif|gif|svg|ico|woff2?)(\?|$)/i.test(v))
      assetExists(v, page);
  }
  for (const m of html.matchAll(/srcset="([^"]+)"/g))
    for (const cand of decode(m[1]).split(",")) assetExists(cand.trim().split(/\s+/)[0], page);

  // JSON-LD: parse + referenced images + Event freshness
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data;
    try {
      data = JSON.parse(decode(m[1]));
    } catch (e) {
      err(page, `Invalid JSON-LD: ${e.message}`);
      continue;
    }
    const nodes = Array.isArray(data) ? data : (data["@graph"] ?? [data]);
    for (const n of nodes) {
      for (const k of ["image", "logo"]) if (typeof n[k] === "string") assetExists(n[k], page);
      if (n["@type"] === "Event") {
        eventNodePages.add(page);
        // Google requires these three; without them the node is inert in search.
        for (const k of ["name", "startDate", "location"])
          if (!n[k]) err(page, `Event JSON-LD is missing required "${k}".`);
        const end = new Date(n.endDate ?? n.startDate ?? 0);
        // An unparseable date compares false against every Date, so it would
        // sail past the freshness check below as if it were fresh.
        if (Number.isNaN(end.getTime()))
          err(page, `Event has unparseable startDate/endDate: ${n.endDate ?? n.startDate}`);
        else if (end < new Date()) {
          const msg = `Stale Event schema: "${n.name}" ended ${end.toISOString().slice(0, 10)}. Rebuild with a future event or drop past events at build time.`;
          process.env.SEO_SKIP_FRESH ? warn(page, msg) : err(page, msg);
        }
        if (!n.location?.address?.streetAddress)
          warn(
            page,
            "Event location.address has no streetAddress (recommended for event rich results).",
          );
      }
    }
  }

  // Internal links resolve. The pattern must NOT exclude "#": excluding it made
  // the regex skip every link containing a fragment rather than skipping the
  // fragment part (pathToFile already strips #, so /about#team resolves fine).
  for (const m of body.matchAll(/href="([^"]+)"/g)) {
    const h = decode(m[1]);
    // A data: URI is not a link — nothing is being navigated to and there is
    // nothing to resolve. The /visualizations marks carry two of them, on the
    // <image> elements inside the inlined SVG rasters, and this check reported
    // both as broken internal links.
    if (h.startsWith("data:")) continue;
    if (/^(https?:|mailto:|tel:)/.test(h)) {
      if (/\/\/(www\.)?(example\.(org|com|net)|localhost|127\.0\.0\.1)/i.test(h))
        err(page, `Placeholder external link shipped: ${h}`);
      if (h.startsWith("http://")) warn(page, `Insecure external link: ${h}`);
      continue;
    }
    const target = pathToFile(h);
    if (!target) {
      err(page, `Broken internal link: ${h}`);
      continue;
    }
    // Canonical link shape. Only applies to links that actually address a
    // PAGE by path, so four things are excluded first:
    //   • pure fragments ("#main", "#user-content-fn-1") — same page, no path
    //   • the site root ("/") — already canonical either way
    //   • links that resolve to something other than an HTML file
    //   • links that NAME a file, extension and all. Checking only the resolved
    //     target is not enough: /files/figure.html resolves to an .html file, so
    //     it survived that test and got told to end in a slash, which would be
    //     wrong for a file. The href's own shape is what settles it.
    const pathPart = h.split(/[?#]/)[0];
    if (pathPart === "" || pathPart === "/" || !target.endsWith(".html")) continue;
    if (/\.[a-z0-9]{1,8}$/i.test(pathPart)) continue;
    if (pathPart.endsWith("/") !== WANT_TRAILING_SLASH)
      warn(
        page,
        WANT_TRAILING_SLASH
          ? `Missing trailing slash on "${h}" — directory-format build, so "${pathPart}/" is canonical and this serves via a redirect.`
          : `Trailing-slash link "${h}" on a file-format build (serves via redirect; drop the slash).`,
      );
  }

  // Visible text checks
  let vis = body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, " ");
  vis = decode(vis.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  for (const s of CFG.forbiddenVisible)
    if (vis.toLowerCase().includes(s.toLowerCase()))
      err(page, `Forbidden string visible on page: "${s}"`);
  for (const s of CFG.warnVisible)
    if (vis.toLowerCase().includes(s.toLowerCase()))
      warn(page, `Launch marker visible on page: "${s}"`);
  // Placeholder gallery copy: a stand-in title ("xyz"), or a pull quote that
  // is nothing but dots. Both ship straight onto the home-page carousel.
  for (const s of CFG.placeholderVisible)
    if (vis.toLowerCase().includes(s.toLowerCase())) placeholder(page, `Placeholder name: "${s}"`);
  for (const q of html.matchAll(/card__quote[^>]*>([\s\S]*?)<\/p>/g)) {
    const text = decode(q[1].replace(/<[^>]+>/g, "")).replace(/[“”"\s]|\[…\]/g, "");
    if (text && /^[.…]+$/.test(text))
      placeholder(page, `Placeholder pull quote (dots only): "${text}"`);
  }
  const words = vis.split(" ").filter(Boolean).length;
  if (words < CFG.thinWords && !CFG.thinAllow.includes(page))
    warn(page, `Thin page: ${words} visible words (< ${CFG.thinWords}).`);

  // Shipped comments that leak roadmap
  for (const cm of html.matchAll(/<!--([\s\S]*?)-->/g))
    if (CFG.commentMarkers.some((k) => cm[1].includes(k)))
      warn(
        page,
        `Shipped HTML comment contains ${CFG.commentMarkers.find((k) => cm[1].includes(k))} (visible in view-source): "${cm[1].trim().slice(0, 60)}…"`,
      );

  // Image hygiene: alt + per-page weight
  let pageImgBytes = 0,
    noAlt = 0;
  const junk = [];
  for (const im of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = im[0];
    // Match alt="…", alt='…', or a bare `alt` (how HTML serializers, incl. Astro,
    // emit alt=""). A bare alt is a present, empty, decorative alt — not missing.
    //
    // Each quoting style is matched separately so the value may contain the
    // OTHER quote character. A single pattern with a backreference and a
    // [^"'] value class reports a false "missing alt" for perfectly valid
    // markup like alt="A woman's face …" — which is exactly the kind of alt
    // text good alt text tends to be.
    const alt = tag.match(/\salt(?:="([^"]*)"|='([^']*)')?(?=[\s/>])/);
    const altValue = alt ? (alt[1] ?? alt[2]) : undefined;
    if (!alt) noAlt++;
    else if (
      altValue !== undefined &&
      (CFG.junkAlts.includes(altValue.trim().toLowerCase()) ||
        CFG.junkAlts.includes(altValue.trim()))
    )
      junk.push(altValue);
    const src = tag.match(/src="([^"]+)"/);
    const f = src
      ? pathToFile(decode(src[1]).startsWith("/") ? decode(src[1]) : "/" + decode(src[1]))
      : null;
    const p = src && !f ? null : f;
    const candidate =
      p ??
      (src && fileSet.has(decode(src[1]).replace(/^\//, ""))
        ? decode(src[1]).replace(/^\//, "")
        : null);
    if (candidate) {
      try {
        pageImgBytes += statSync(join(dist, candidate)).size;
      } catch {}
    }
  }
  if (noAlt) warn(page, `${noAlt} <img> tag(s) missing an alt attribute.`);
  // ERROR, not WARN: every gallery photo carries authored alt (a required field
  // in src/content.config.ts), so junk alt means someone typed it. The net.
  if (junk.length)
    err(
      page,
      `${junk.length} image(s) with junk alt text (${[...new Set(junk)].slice(0, 4).join(", ")}) — use real descriptions or alt="" if decorative.`,
    );
  if (pageImgBytes > CFG.imgBudgetBytes)
    warn(
      page,
      `Local image weight ${(pageImgBytes / 1048576).toFixed(2)} MB exceeds ${(CFG.imgBudgetBytes / 1048576).toFixed(1)} MB budget.`,
    );

  // ── Accessibility ──────────────────────────────────────────────────────────
  // Regex over built HTML, same as everything else here — so this catches the
  // structural WCAG mistakes that survive a code review, not the behavioural
  // ones. Focus order, computed contrast, and anything that needs a running
  // browser are out of reach by design; `npm run a11y` covers colour, and the
  // keyboard pass in the README covers the rest.

  // Zoom must not be disabled (WCAG 1.4.4). The viewport check above only
  // asserts the tag exists; this reads what it actually says.
  const vp = head.match(/<meta\s+name="viewport"[^>]*\scontent="([^"]*)"/i);
  if (vp && /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*(1(\.0+)?)\b/i.test(vp[1]))
    err(page, `Viewport blocks zoom (WCAG 1.4.4): "${vp[1]}"`);

  // Exactly one <h1>, and no skipped heading levels (h2 → h4).
  const headings = [...body.matchAll(/<h([1-6])\b[^>]*>/gi)].map((m) => Number(m[1]));
  const h1s = headings.filter((h) => h === 1).length;
  if (h1s !== 1) warn(page, `Expected exactly 1 <h1>, found ${h1s}.`);
  for (let i = 1; i < headings.length; i++)
    if (headings[i] > headings[i - 1] + 1) {
      warn(page, `Heading level skips h${headings[i - 1]} → h${headings[i]}.`);
      break; // one report per page is enough to send someone looking
    }

  // Duplicate ids. Breaks every aria-* reference that points at one, and is
  // exactly what a copy-pasted component produces.
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupeIds = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
  if (dupeIds.length) err(page, `Duplicate id(s): ${dupeIds.slice(0, 5).join(", ")}`);

  // aria-* that points at an id which isn't on the page. A dangling reference
  // is silently ignored by assistive tech, so the control ends up unlabelled.
  const idSet = new Set(ids);
  for (const attr of CFG.ariaIdRefs)
    for (const m of html.matchAll(new RegExp(`\\s${attr}="([^"]+)"`, "g")))
      for (const ref of m[1].trim().split(/\s+/))
        if (ref && !idSet.has(ref))
          err(page, `${attr}="${ref}" points at no element on this page.`);

  // Links and buttons with no accessible name — nothing to announce, and
  // nothing for a voice-control user to say.
  for (const m of html.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const [, tag, attrs, inner] = m;
    if (tag.toLowerCase() === "a" && !/\shref=/.test(attrs)) continue; // not a link
    if (/\saria-hidden="true"/.test(attrs)) continue;
    const named =
      /\saria-label="[^"]*[^\s"][^"]*"/.test(attrs) ||
      /\saria-labelledby="/.test(attrs) ||
      /\stitle="[^"]*[^\s"][^"]*"/.test(attrs) ||
      // text content, or an image inside carrying a non-empty alt
      decode(inner.replace(/<[^>]*>/g, "")).trim().length > 0 ||
      /<img\b[^>]*\salt="[^"]*[^\s"][^"]*"/.test(inner);
    if (!named)
      err(page, `<${tag}> has no accessible name: ${m[0].replace(/\s+/g, " ").slice(0, 90)}…`);
  }

  // Positive tabindex overrides the document's natural order for everyone.
  const positiveTab = [...html.matchAll(/\stabindex="(\d+)"/g)].filter((m) => Number(m[1]) > 0);
  if (positiveTab.length)
    err(page, `${positiveTab.length} element(s) with a positive tabindex — use 0 or -1.`);

  // An <iframe> without a title is an unlabelled frame in the tab order.
  for (const m of html.matchAll(/<iframe\b[^>]*>/gi))
    if (!/\stitle="[^"]*[^\s"][^"]*"/.test(m[0])) err(page, "<iframe> missing a title attribute.");

  // Sitemap membership (indexable pages only)
  if (!inSitemap.has(page) && page !== "404.html" && !(rm && /noindex/i.test(rm[1])))
    err(page, "Indexable page missing from sitemap.");
}

// ------------------------------------------------------- favicon variants ---
// Estonian blue on light chrome, white on dark. Both must be true in SAFARI,
// which is the whole reason this check is worth having: Safari ignores
// `@media (prefers-color-scheme: dark)` inside an SVG favicon (WebKit bug
// 199134, open since 2019), so the page cannot delegate the choice to the
// renderer. scripts/gen-favicons.mjs writes each portrait twice — `<slug>.svg`
// in blue and `<slug>-dark.svg` in white — and src/lib/favicon.ts reads the
// preference itself and points at one of them.
//
// That arrangement has two halves that can drift apart silently, and drift the
// wrong way is invisible to everyone not in dark mode: a dark variant that is
// not actually white, or a picker that stops asking for it. Check both. The
// colours are repeated here on purpose — a gate that imports its expectations
// from the thing it is gating cannot fail.
{
  const INK = "#0030DE";
  const INK_DARK = "#ffffff";
  const icons = fileSet.has("favicons")
    ? []
    : [...fileSet].filter((f) => f.startsWith("favicons/") && f.endsWith(".svg"));

  if (!icons.length) {
    err("(site)", "No favicons/*.svg in dist — the daily rotation has nothing to point at.");
  } else {
    for (const f of icons) {
      const svg = readFileSync(join(dist, f), "utf8");
      const style = svg.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
      const base = style.match(/^path\{[^}]*stroke:(#[0-9A-Fa-f]{3,8})/)?.[1];
      const darkRule = style.match(
        /prefers-color-scheme:\s*dark\)\s*\{path\{stroke:(#[0-9A-Fa-f]{3,8})/,
      )?.[1];
      const isDark = /-dark\.svg$/.test(f);

      if (base?.toLowerCase() !== (isDark ? INK_DARK : INK).toLowerCase())
        err(f, `Favicon stroke is ${base} — expected ${isDark ? INK_DARK : INK}.`);
      // A `stroke` presentation attribute beats the stylesheet, so a glyph
      // carrying one is frozen in whatever colour it was born with.
      if (/<path[^>]*\sstroke=/.test(svg))
        err(f, "Favicon <path> carries a stroke attribute, which overrides the stylesheet.");
      if (isDark && darkRule)
        err(
          f,
          "Dark favicon carries a prefers-color-scheme rule; it is chosen by the picker and must be one colour.",
        );
      if (!isDark && darkRule?.toLowerCase() !== INK_DARK.toLowerCase())
        err(
          f,
          `Light favicon's dark-scheme rule is ${darkRule ?? "missing"} — expected ${INK_DARK}.`,
        );
      // Every light glyph needs the twin the picker will ask for in dark mode.
      if (!isDark && !fileSet.has(f.replace(/\.svg$/, "-dark.svg")))
        err(f, "No -dark variant — a dark-mode visitor would get a 404 and no icon at all.");
    }

    // …and the picker has to actually ask for it.
    const picker = read("index.html");
    if (!/"-dark"/.test(picker) || !/prefers-color-scheme:\s*dark/.test(picker))
      err(
        "index.html",
        "The inline favicon picker no longer chooses a -dark variant. Safari ignores the media query inside the SVG, so dark mode would fall back to Estonian blue on a dark tab strip.",
      );
  }
}

// ------------------------------------------------------ share image (OG) ---
// Three kinds of share card, and this section checks all three are real.
//
// The site used to declare ONE image everywhere, and this block used to enforce
// exactly that. It no longer does: posts and visualizations carry a picture of
// their own (a ported feature photograph, or their mark drawn large on a card by
// scripts/gen-og-cards.mjs), and everything else falls back to the portrait. See
// src/lib/og.ts for the ladder.
//
// That trade is worth making — a link to one chart previewing as that chart
// beats previewing as a face — but it buys a failure mode the old design did not
// have: a page can now fall back SILENTLY. Nothing looks broken when a card goes
// missing and the portrait quietly stands in, so the checks that used to be
// "everything agrees" are now "everything that should differ, does".
{
  const entries = [...ogImages];

  // ── The fallback itself still resolves ────────────────────────────────────
  // Checked on the home page specifically. It is the one route that must never
  // carry a picture of its own, so if its share image is not the portrait, the
  // sitewide default has broken rather than been overridden.
  const home = ogImages.get("index.html");
  if (home && !/portrait-open/.test(home.url))
    err("index.html", `og:image is not the portrait: ${home.url} — the sitewide fallback broke.`);

  // ── The pages that should differ, do ──────────────────────────────────────
  // Every chart page gets its own card. Derived from the URL rather than from a
  // list, so a visualization added later is covered the day it ships.
  for (const [page, og] of entries) {
    if (!page.startsWith("visualizations/") || page === "visualizations/index.html") continue;
    if (!og.url.includes("/og/visualizations/"))
      err(
        page,
        `og:image is ${og.url}, not this chart's card. Viz.astro looks the mark up by URL — ` +
          `check the slug matches src/data/visualizations.ts, and that \`npm run viz\` has run.`,
      );
  }

  // No generated card may go unused. This is what catches the wiring breaking
  // in the other direction: a card built for a post or chart that no page ends
  // up pointing at means the lookup in [slug].astro or Viz.astro stopped
  // matching, and those pages have silently fallen back to the portrait.
  // Compared as PATHS, not as written. og:image has to be absolute for a crawler
  // that never loaded the page (Facebook and LinkedIn drop a relative one), so
  // what is in the tag is https://jaan.io/og/… while what is on disk is og/… .
  const referenced = new Set(
    entries.map(([, og]) => {
      try {
        return new URL(og.url, SITE).pathname;
      } catch {
        return og.url;
      }
    }),
  );
  for (const f of fileSet)
    if (f.startsWith("og/") && f.endsWith(".png") && !referenced.has("/" + f))
      err(
        "(site)",
        `Generated card /${f} is referenced by no page — see scripts/gen-og-cards.mjs.`,
      );

  // ── Every distinct card, on its own terms ─────────────────────────────────
  const byUrl = new Map();
  for (const [page, og] of entries) {
    if (og.twitter && og.twitter !== og.url)
      err(page, `twitter:image (${og.twitter}) differs from og:image (${og.url}).`);
    if (!og.alt) warn(page, "og:image has no og:image:alt.");
    if (!byUrl.has(og.url)) byUrl.set(og.url, { page, og });
  }

  for (const [url, { page, og }] of byUrl) {
    const file = assetExists(url, page);
    if (!file) continue;

    const bytes = statSync(join(dist, file)).size;
    // Every platform that documents a ceiling puts it at 5 MB or more
    // (Twitter/LinkedIn 5, Facebook 8). Over that the card silently does not
    // render — no error anywhere, just a bare link.
    if (bytes > 5 * 1024 * 1024)
      err(
        page,
        `og:image is ${(bytes / 1024 / 1024).toFixed(1)} MB — over the 5 MB most platforms accept.`,
      );

    // THE DECLARED SIZE MUST BE THE REAL SIZE. Astro's Sharp service resizes
    // `withoutEnlargement`, so asking for a crop larger than the source quietly
    // yields a SMALLER file while og:image:width/height keep claiming the number
    // that was asked for — and a crawler that trusts those dimensions lays the
    // card out wrong. Read them back out of the file itself.
    const actual = imageSize(readFileSync(join(dist, file)));
    if (!actual) {
      warn(page, `og:image ${url} is neither JPEG nor PNG — dimensions unverified.`);
      continue;
    }
    if (og.width && (actual.width !== og.width || actual.height !== og.height))
      err(
        page,
        `og:image is ${actual.width}×${actual.height} but declares ${og.width}×${og.height}. ` +
          `The requested size is probably larger than the source image — see src/lib/og.ts.`,
      );

    // Facebook and LinkedIn both refuse to render anything under 200px, and
    // both draw the small side-by-side card rather than the large one below
    // 600 × 315. A card under the floor is invisible; one under the recommended
    // size just shows small, so that is a warning.
    if (Math.min(actual.width, actual.height) < 200)
      err(page, `og:image is ${actual.width}×${actual.height} — under the 200px floor.`);
    else if (actual.width < 600 || actual.height < 315)
      warn(
        page,
        `og:image is ${actual.width}×${actual.height} — under 600×315, so it renders as a small card.`,
      );

    // og:image:type is what a crawler believes before it fetches anything.
    const ext = file.toLowerCase();
    const real = ext.endsWith(".png") ? "image/png" : "image/jpeg";
    if (og.type && og.type !== real)
      err(page, `og:image:type says ${og.type} but ${url} is ${real}.`);
  }
}

// -------------------------------------------------- Event schema presence ---
// join.astro drops the Event JSON-LD once the cleanup is over (a past event in
// search results is worse than none). That legitimate absence must not become a
// silent hole where a *future* event ships with no schema at all — so require
// the node whenever dist itself still describes an upcoming event.
//
// The event's end timestamp is read back out of dist, not src: every
// [data-countdown] element carries data-end, baked from src/data/event.ts. That
// keeps this check honest about what actually shipped.
if (fileSet.has("join.html")) {
  let latestEnd = null;
  for (const page of htmlFiles)
    for (const m of read(page).matchAll(/data-end="([^"]+)"/g)) {
      const d = new Date(decode(m[1]));
      if (!Number.isNaN(d.getTime()) && (!latestEnd || d > latestEnd)) latestEnd = d;
    }
  if (latestEnd && latestEnd > new Date() && !eventNodePages.has("join.html"))
    err(
      "join.html",
      `No Event JSON-LD, but the build describes an upcoming cleanup ending ${latestEnd.toISOString()}. Google event listings need the schema — check the eventSchema block in src/pages/join.astro.`,
    );
}

// ---------------------------------------------------------------- report ---
const order = { ERROR: 0, WARN: 1 };
issues.sort((a, b) => order[a.level] - order[b.level] || a.file.localeCompare(b.file));
let e = 0,
  w = 0;
for (const i of issues) {
  i.level === "ERROR" ? e++ : w++;
  console.log(`${i.level === "ERROR" ? "✖" : "▲"} [${i.level}] ${i.file}: ${i.msg}`);
}
console.log(`\n${htmlFiles.length} pages · ${e} errors · ${w} warnings`);
if (missingAssets.size)
  console.log(
    `Missing asset paths (${missingAssets.size} unique): ${[...missingAssets].slice(0, 8).join(", ")}${missingAssets.size > 8 ? " …" : ""}`,
  );
process.exit(e ? 1 : 0);

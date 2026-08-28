// Port a Jekyll/kramdown post from the old jaan.io into src/content/posts/.
//
//   node scripts/port-jekyll-post.mjs <old-post.md> <slug> <YYYY-MM-DD>
//
// This exists because three conversions are easy to get wrong by hand, and
// getting them wrong is silent — the page still builds, it just renders badly.
//
// 1. `$$ … $$` IS THE INLINE DELIMITER IN THESE POSTS.
//    kramdown + MathJax accept `$$` for both inline and display math, and the
//    old posts lean on that: "the encoder outputs $$ z $$, a Gaussian" is a
//    normal sentence there. remark-math follows the CommonMark-ish convention
//    where `$$` is ALWAYS display, so a naive port turns every inline symbol
//    into its own centered block and the prose disintegrates. In the VAE post
//    that is 55 lines of mixed prose+math against 9 genuine display blocks.
//
//    So each `$$…$$` span is classified by position, not by delimiter: it is
//    display only when the opening `$$` is alone on its line AND the closing
//    `$$` is alone on its line. Everything else becomes `$…$`. Spans also wrap
//    across line breaks (an opener at the end of one line closing on the next),
//    which is why this works on the whole body rather than line by line.
//
// 2. LITERAL DOLLAR SIGNS. With single-`$` inline math enabled, "$339,574 …
//    $12,000" makes the text between two currency amounts into math. Any `$`
//    left outside a math span is escaped to `\$`.
//
// 3. `{% asset foo.svg %}` — a jekyll-assets tag that inlined an SVG from
//    _svg/. Rewritten to a plain <img> against public/images/svg/.

import { readFileSync, writeFileSync } from "node:fs";

const [src, slug, date] = process.argv.slice(2);
if (!src || !slug || !date) {
  throw new Error("usage: port-jekyll-post.mjs <old-post.md> <slug> <YYYY-MM-DD>");
}

const raw = readFileSync(src, "utf8");
const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (!m) throw new Error(`${src}: no YAML frontmatter`);
const [, fm, original] = m;

const field = (name) => {
  const hit = fm.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
  return hit
    ? hit[1]
        .trim()
        .replace(/^["']|["']$/g, "")
        .trim()
    : "";
};

let body = original;

// ── 3. jekyll-assets SVG tags ───────────────────────────────────────────────
body = body.replace(
  /\{%\s*asset\s+([\w.-]+)\s*%\}/g,
  (_, file) => `<img src="/images/svg/${file}" alt="">`,
);

// ── 1. Split on $$ and classify each span by its delimiters' position ────────
const parts = body.split("$$");
if (parts.length % 2 === 0) {
  throw new Error(`${src}: unbalanced $$ (${parts.length - 1} delimiters)`);
}

const aloneAtLineEnd = (text) => /(^|\n)[ \t]*$/.test(text);
const aloneAtLineStart = (text) => /^[ \t]*(\n|$)/.test(text);

let out = "";
let displayCount = 0;
let inlineCount = 0;

for (let i = 0; i < parts.length; i++) {
  if (i % 2 === 0) {
    // Prose. Escape any literal $ so it can't open a single-$ math span.
    out += parts[i].replace(/\$/g, "\\$");
    continue;
  }
  const content = parts[i].trim();
  const isDisplay = aloneAtLineEnd(parts[i - 1]) && aloneAtLineStart(parts[i + 1] ?? "");
  if (isDisplay) {
    displayCount++;
    // Blank lines around the block so it parses as its own node, but NEVER
    // between `$$` and the formula — remark-math needs the opening delimiter
    // and the body in one block, and a blank line there splits it into a stray
    // `$$` paragraph followed by raw LaTeX.
    out += `\n\n$$\n${content}\n$$\n\n`;
  } else {
    inlineCount++;
    // Inline math cannot span a line break in remark-math.
    out += `$${content.replace(/\s*\n\s*/g, " ")}$`;
  }
}

// Collapse the runs of blank lines the display blocks introduce at their seams.
out = out.replace(/\n{3,}/g, "\n\n");

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const frontmatter = [
  "---",
  `title: "${esc(field("title"))}"`,
  `description: "${esc(field("description"))}"`,
  `date: ${date}`,
  "---",
  "",
].join("\n");

const dest = `src/content/posts/${slug}.md`;
writeFileSync(dest, frontmatter + out.trimStart() + "\n");
console.log(
  `${slug}: ${displayCount} display, ${inlineCount} inline, ` +
    `${(out.match(/\\\$/g) ?? []).length} escaped literal $ → ${dest}`,
);

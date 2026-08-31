// Turn `> [!cite]` into a collapsible citation tile.
//
// WHAT IT IS FOR. The Once Upon guide carries about thirty references — a
// "Background" block under most of its sections, plus the reading list at the
// end — and as plain numbered lists they read as more article. They are not:
// they are the apparatus under it, the thing you skip on the way down and come
// back to. This gives them a plate of their own so the eye can step over them,
// using the same grey the signup card sits on, and folds them shut so a run of
// four is four quiet bars rather than four paragraphs of interruption.
//
// WHY A REMARK PLUGIN AND NOT A COMPONENT. Astro cannot mount a component
// inside a `.md` file — that is what `.mdx` is for, and switching this post to
// MDX would mean a new integration, a change to the `posts` glob in
// src/content.config.ts (which matches `*.md`), and a different Markdown
// pipeline for one file out of eleven. A remark plugin is the other standard
// answer and the one this repo already reaches for: see src/lib/rehype-mermaid.mjs,
// which exists for the same reason. The markup it emits is styled in
// src/components/Prose.astro alongside every other Markdown element.
//
// THE SYNTAX IS A BLOCKQUOTE, and that is doing real work rather than being a
// convenient hook. Everything inside a blockquote is parsed as ordinary
// Markdown, so a citation keeps its links, its italics for a journal name, and
// its several paragraphs, with no escaping and nothing this plugin has to
// re-parse. It also degrades honestly: strip this plugin out and the citations
// render as blockquotes — indented, muted, still legible, still in order.
// The `[!cite]` marker is GitHub's alert spelling (`> [!NOTE]`, `> [!TIP]`),
// which is the closest thing Markdown has to a convention for this, and so is
// the optional label that follows it on the same line.
//
//   > [!cite]
//   > Zak, P. J. (2015, January). Why inspiring stories make us react.
//   > In *Cerebrum* (Vol. 2015). Dana Foundation.
//   > [Read it](https://example.org/)
//
//   > [!cite] Reading
//   > [The Storytelling Animal](https://example.org/)
//
// A `+` on the marker starts the tile OPEN — Obsidian's spelling for the same
// thing on its callouts, and the closest to a convention there is. It also
// drops the default label, and that pairing is the rule rather than a special
// case: a CLOSED tile has to say what it is hiding, an OPEN one is already
// showing you. So `[!cite]+` is a bare caret over an unfolded list, which is
// what the References section at the foot of the Once Upon guide wants — the
// `# References` heading directly above it has already said the word.
//
//   > [!cite]+
//   > [The Storytelling Animal](https://example.org/)
//
// Write a label after the `+` and it is kept and shown, so an open tile can
// still carry one. Only the DEFAULT is conditional.
//
// A blockquote WITHOUT the marker is left completely alone, which is what keeps
// the pull quote at the top of the sauna post a pull quote.
//
// WHY <details> AND NOT A TOGGLE SCRIPT. The carousel's testimonial panel is
// JavaScript because it also has to slide, be clipped to the photo, and trap a
// scroll; none of that applies here, and <details>/<summary> is the element the
// platform provides for exactly this. It costs no JS, works before hydration
// and with it switched off, prints legibly, and is keyboard- and
// screen-reader-operable with no ARIA of our own — <summary> is already a
// button that reports its expanded state. Chrome and Safari also expand a
// closed <details> when find-in-page matches inside it, so folding these away
// does not hide them from Cmd-F. What is borrowed from the carousel is the
// LOOK: the same 20px chevron, flipping through the same half turn on the same
// curve (see .citation__caret in Prose.astro).

// IF YOU EDIT THIS FILE AND THE DEV SERVER DOES NOT CHANGE, that is not your
// change failing. Astro's content layer caches the RENDERED HTML of every post
// in .astro/data-store.json, keyed by the Markdown file's own digest — which a
// change to a Markdown plugin does not touch. The build is unaffected (it keeps
// its own store under node_modules/.astro), so the two can silently disagree.
// Delete .astro/data-store.json, or start the dev server with `--force`.
//
// AND THE WORSE HALF OF THE SAME PROBLEM: a running dev server holds the plugin
// it BOOTED with. astro.config.mjs imports this file into a `unified()` call
// that is evaluated once at startup; editing the config restarts the server,
// editing a module the config imports does not. So change the syntax here and
// the marker in a post together — as `+` was — and the digest change re-renders
// the post through the OLD plugin. The page does not go stale, which is what
// makes this one nasty: it updates, and updates WRONGLY. `[!cite]+` came out as
// a shut tile labelled "+", which looks like this file being broken rather than
// like this file not being loaded. Restart the dev server after touching it.

/**
 * The marker, at the very start of the blockquote's first paragraph. An
 * optional `+` right after the bracket starts the tile open; whatever follows
 * on that line is the tile's label. The label capture is deliberately
 * `[^\n]*` and not `.*` so a label can only ever be the first LINE.
 */
const MARKER = /^\[!cite\](\+?)[ \t]*([^\n]*)\n?/i;

/**
 * What the label says when the marker carries none — and only when the tile is
 * CLOSED. See the note on `+` at the top: a shut tile needs a word on its lid,
 * an open one does not, so this is the one thing `+` takes away.
 */
const DEFAULT_LABEL = "Background";

/**
 * The carousel's caret glyph, copied rather than shared: it is nine attributes
 * of markup, and the alternative — an .astro component — cannot be reached from
 * a remark plugin, which emits a string. Prose.astro parks it pointing DOWN at
 * rest and unrolls it to this, its drawn orientation, when the tile is open.
 */
const CARET =
  '<svg class="citation__caret" width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
  '<path d="M4 10l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"/>' +
  "</svg>";

/** The label is written into raw HTML, so it has to be inert there. */
const escapeHtml = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Depth-first walk. Blockquotes nest (a citation inside a list item inside a
 * section), so this cannot just scan `tree.children`.
 */
function walk(node, visit) {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

export default function remarkCitation() {
  return (tree) => {
    walk(tree, (node) => {
      if (node.type !== "blockquote") return;

      const [paragraph] = node.children ?? [];
      if (paragraph?.type !== "paragraph") return;

      // The marker has to be the first TEXT of the paragraph. Checking the
      // first child rather than searching the paragraph is deliberate: a
      // citation that happens to contain the literal "[!cite]" further along —
      // in a quoted title, say — is not a marker and must not be eaten.
      const [first] = paragraph.children ?? [];
      if (first?.type !== "text") return;
      const marker = MARKER.exec(first.value);
      if (!marker) return;

      const open = marker[1] === "+";
      const label = marker[2].trim() || (open ? "" : DEFAULT_LABEL);
      first.value = first.value.slice(marker[0].length);

      // A marker on its own line leaves an empty text node, and then possibly
      // an empty paragraph. Both would render — the paragraph as a blank line
      // of the tile's own leading — so they are cleared here rather than being
      // papered over with `p:empty { display: none }` in the stylesheet.
      if (first.value === "") paragraph.children.shift();
      if (paragraph.children.length === 0) node.children.shift();

      // hName/hProperties are mdast's own hand-off to hast: the node stays a
      // blockquote for anything else walking the tree and becomes <details> on
      // the way out. Rewriting it to a raw `html` node instead would mean
      // stringifying the children by hand and losing every plugin that runs
      // after this one.
      //
      // <details> rather than the <aside> this used to emit. The tile is still
      // content tangential to the passage beside it, but only one of the two
      // elements can be the root, and being operable is worth more here than
      // the semantic label: <aside> is not a landmark this deep in an article
      // anyway (it only becomes one as a direct child of <body>), so nothing
      // that was announced before has stopped being announced.
      //
      // `citation--open` is not styling of its own: it is how the stylesheet
      // tells a tile that WAS open at first paint from one the reader opened.
      // Both match `[open]`, but only the second should fade its contents in —
      // see the @starting-style note in Prose.astro. `open: false` serialises
      // to no attribute at all, so it is safe to set either way.
      node.data = {
        ...node.data,
        hName: "details",
        hProperties: { class: open ? "citation citation--open" : "citation", open },
      };

      // The summary goes in as raw HTML, which is what a remark plugin has to
      // hand: an mdast node carrying an hName could produce the <summary> and
      // the <span>, but not the caret, which is nine SVG attributes and no
      // Markdown at all. Raw HTML already flows through this pipeline — the
      // post's own <figure> blocks are written that way.
      //
      // THE LABEL SPAN IS EMITTED EVEN WHEN IT IS EMPTY, and the summary takes
      // an aria-label in its place. The empty span is what keeps the caret on
      // the right: the summary is `justify-content: space-between`, and one
      // flex item alone would sit at the START of the line. The aria-label is
      // what keeps the control from being a button with no name — a <summary>
      // with nothing in it but an aria-hidden caret is announced as "expanded"
      // and nothing else, which is a real gap however quiet it looks.
      const named = label ? "" : ` aria-label="${escapeHtml(DEFAULT_LABEL)}"`;
      node.children.unshift({
        type: "html",
        value:
          `<summary class="citation__summary"${named}>` +
          `<span class="citation__label">${escapeHtml(label)}</span>` +
          CARET +
          "</summary>",
      });
    });
  };
}

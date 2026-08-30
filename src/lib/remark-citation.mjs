// Turn `> [!cite]` into a citation tile.
//
// WHAT IT IS FOR. The Once Upon guide carries about thirty references — a
// "Background" block under most of its sections, plus the reading list at the
// end — and as plain numbered lists they read as more article. They are not:
// they are the apparatus under it, the thing you skip on the way down and come
// back to. This gives them a plate of their own so the eye can step over them,
// using the same grey the signup card sits on.
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
// which is the closest thing Markdown has to a convention for this.
//
//   > [!cite]
//   > Zak, P. J. (2015, January). Why inspiring stories make us react.
//   > In *Cerebrum* (Vol. 2015). Dana Foundation.
//   > [Read it](https://example.org/)
//
// A blockquote WITHOUT the marker is left completely alone, which is what keeps
// the pull quote at the top of the sauna post a pull quote.

/** The marker, at the very start of the blockquote's first paragraph. */
const MARKER = /^\[!cite\][ \t]*\n?/i;

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
      if (first?.type !== "text" || !MARKER.test(first.value)) return;

      first.value = first.value.replace(MARKER, "");

      // A marker on its own line leaves an empty text node, and then possibly
      // an empty paragraph. Both would render — the paragraph as a blank line
      // of the tile's own leading — so they are cleared here rather than being
      // papered over with `p:empty { display: none }` in the stylesheet.
      if (first.value === "") paragraph.children.shift();
      if (paragraph.children.length === 0) node.children.shift();

      // hName/hProperties are mdast's own hand-off to hast: the node stays a
      // blockquote for anything else walking the tree and becomes <aside> on
      // the way out. Rewriting it to a raw `html` node instead would mean
      // stringifying the children by hand and losing every plugin that runs
      // after this one.
      //
      // <aside> rather than <div>, because that is what this is — content
      // tangential to the passage beside it. It is not a landmark here: <aside>
      // only becomes one as a direct child of <body>, and these are nested deep
      // inside the article, so thirty of them add thirty "complementary"
      // regions to exactly nobody's landmark list.
      node.data = { ...node.data, hName: "aside", hProperties: { class: "citation" } };
    });
  };
}

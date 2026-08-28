// Turn a ```mermaid fence into the element mermaid's browser runtime looks for.
//
// WHY THIS EXISTS AT ALL. The Wanna Sauna post was written for jaan.li, an
// Observable Framework site, where ```mermaid is a first-class block: Framework
// hands the fence to its own `mermaid` tagged template and the diagram appears.
// Astro has no such thing — a fence is a fence — so the post arrived here as a
// dark grey slab of `timeline / section Personal Saunas / …`. This is the one
// piece that makes the fence mean something again, and it is deliberately the
// SMALLEST such piece: it moves the text out of `<pre><code>` and into
// `<pre class="mermaid">`, which is the selector mermaid.run() defaults to, and
// stops. Everything about how the diagram then LOOKS is in
// src/components/MermaidRuntime.astro.
//
// WHY THE SOURCE SURVIVES THE TRIP. Two things had to be arranged for it to:
//
//   1. `syntaxHighlight.excludeLangs` in astro.config.mjs lists "mermaid".
//      Shiki runs BEFORE user rehype plugins in @astrojs/markdown-remark's
//      pipeline (see createMarkdownProcessor there), so without the exclusion
//      this plugin would receive a tree of coloured <span>s and would have to
//      reassemble the diagram out of them, line spans and all. Excluded, the
//      fence is still a plain text node when it gets here.
//   2. It is a FENCE and not raw HTML in the Markdown, which is what keeps
//      remark-math off it. This site parses single `$…$` as inline maths (see
//      the note in astro.config.mjs) and the diagram is nothing but dollar
//      signs — "$60 : Amazon Tiny Sauna Tent", "$3,000", "$200M". Written as
//      an HTML block it would still dodge the maths parser, but as a fence it
//      also stays byte-identical to the source file on jaan.li, which is the
//      thing a future edit will be diffed against.
//
// The emitted element carries the source as its text, unescaped by anything
// beyond hast's own stringifier, and no `data-processed` attribute — mermaid
// sets that itself once it has rendered, and it is how the runtime tells a
// diagram it has already drawn from one it has not.

/** Depth-first walk over a hast tree, parent in hand so a node can be replaced. */
function walk(node, visit, parent = null, index = -1) {
  visit(node, parent, index);
  const children = node.children;
  if (!children) return;
  // Backwards: `visit` may splice this array, and an index taken from the front
  // would then point at the wrong child (or past the end) for the rest of the
  // loop. Nothing here removes nodes today; iterating this way means nothing
  // has to remember that if something ever does.
  for (let i = children.length - 1; i >= 0; i--) walk(children[i], visit, node, i);
}

/** `<pre><code class="language-mermaid">` — what an unhighlighted fence is. */
function mermaidSource(node) {
  if (node.tagName !== "pre") return null;
  const code = node.children?.find((child) => child.tagName === "code");
  if (!code) return null;
  const classes = code.properties?.className ?? [];
  if (!(Array.isArray(classes) ? classes : [classes]).includes("language-mermaid")) return null;
  return code.children
    .filter((child) => child.type === "text")
    .map((child) => child.value)
    .join("");
}

export default function rehypeMermaid() {
  return (tree) => {
    walk(tree, (node, parent, index) => {
      if (node.type !== "element" || !parent) return;
      const source = mermaidSource(node);
      if (source === null) return;
      parent.children[index] = {
        type: "element",
        tagName: "pre",
        properties: { className: ["mermaid"] },
        // The trailing newline every fence carries is dropped: mermaid parses
        // it fine, but it is also what the runtime shows as the fallback if
        // rendering fails, and a stray blank line at the bottom of that is one
        // more thing to explain.
        children: [{ type: "text", value: source.replace(/\n$/, "") }],
      };
    });
  };
}

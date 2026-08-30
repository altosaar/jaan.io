// Put a permalink on every heading in a Markdown body: the small `#` that
// appears to its right on hover and copies as a link to that spot.
//
// WHY IT EXISTS. The contents rail lists only a post's top level (see the note
// above `items` in src/components/Toc.astro), so that `###` and below can break
// up a long section without filling the gutter with tags. That trade is only
// honest if the levels the rail stops listing are still reachable — otherwise
// "use sub-headings freely" means "write sections nobody can link to". This is
// the other half of that change: the rail addresses the sections, the `#`
// addresses everything, including the sections.
//
// WHY IT IS A BUILD-TIME PLUGIN AND NOT THREE LINES OF DOM. The same reason
// the maths is (see astro.config.mjs): a heading anchor is a fact about the
// document, and a document that has to run JavaScript before its headings can
// be linked is a document whose links do not exist for the first paint, for a
// failed script, or for anything reading the HTML.
//
// ── THE ANCHOR IS EMPTY, AND THAT IS LOAD-BEARING ───────────────────────────
// The `#` is drawn by CSS (`content` on ::before, in Prose.astro) rather than
// written here as text, because of WHERE this plugin sits in the pipeline.
// @astrojs/markdown-remark runs user rehype plugins BEFORE its own
// rehypeHeadingIds, and that pass does two jobs at once: it assigns the ids AND
// it collects the `headings` array that render() hands to the rail. Its text
// collector walks into child elements, so a text node of "#" inside this
// anchor would come back out as part of the heading's text — every tag in the
// rail reading "Ingredients#", and every id slugged from it. An element with no
// text nodes cannot be collected, whatever it is nested in.
//
// It also means the ids must already exist by the time this runs, since the
// href is built from one. astro.config.mjs therefore lists Astro's own
// `rehypeHeadingIds` immediately before this plugin; Astro's later pass sees a
// string id and leaves it alone, so nothing is assigned twice.

/** Depth-first walk over a hast tree. Mutates children in place. */
function walk(node, visit) {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

/**
 * rehype's generated sr-only "Footnotes" heading, inside <section
 * data-footnotes>. It is machinery rather than a section — the same reason the
 * rail drops it (APPARATUS_SLUGS in Toc.astro) — and it is invisible, so a
 * hover affordance on it is an anchor nobody can see to hover.
 */
const SKIP_IDS = new Set(["footnote-label"]);

/** The heading's own words, for the link's accessible name. */
function textOf(node) {
  if (node.type === "text") return node.value;
  if (!node.children) return "";
  return node.children.map(textOf).join("");
}

export default function rehypeHeadingAnchors() {
  return (tree) => {
    walk(tree, (node) => {
      if (node.type !== "element" || !HEADINGS.has(node.tagName)) return;
      const id = node.properties?.id;
      if (typeof id !== "string" || !id || SKIP_IDS.has(id)) return;

      node.children.push({
        type: "element",
        tagName: "a",
        properties: {
          className: ["heading-anchor"],
          href: `#${id}`,
          // Named, not "Permalink" repeated a dozen times down the page: this
          // is what a screen reader announces on reaching it and what a voice
          // control user has to say out loud to click it, and neither works if
          // every heading's anchor answers to the same phrase.
          ariaLabel: `Link to “${textOf(node).trim()}”`,
        },
        children: [],
      });
    });
  };
}

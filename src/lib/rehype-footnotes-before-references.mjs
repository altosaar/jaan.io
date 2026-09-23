// Move the footnotes above a post's References heading.
//
// remark-rehype always appends <section data-footnotes> to the very end of the
// document, which puts it after the References list and anything below that.
// Footnotes belong to the prose, so they go directly after it. A post with no
// heading whose id is `references` keeps its footnotes at the end.
//
// This matches on the heading's id, so it has to run after Astro's
// rehypeHeadingIds. See the plugin order in astro.config.mjs.

export default function rehypeFootnotesBeforeReferences() {
  return (tree) => {
    const children = tree.children;
    const footnotes = children.findIndex(
      (node) => node.type === "element" && node.properties?.dataFootnotes !== undefined,
    );
    if (footnotes === -1) return;
    const [section] = children.splice(footnotes, 1);
    const references = children.findIndex(
      (node) =>
        node.type === "element" &&
        /^h[1-6]$/.test(node.tagName) &&
        node.properties?.id === "references",
    );
    children.splice(references === -1 ? children.length : references, 0, section);
  };
}

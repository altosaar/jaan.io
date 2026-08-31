// Turn a post's rendered HTML into HTML fit for a feed reader.
//
// Two transforms, both of which exist because a feed reader is not this site:
// it has none of this site's CSS, and it resolves nothing relative.

/**
 * The origin every root-relative URL in a feed has to be rewritten against.
 * Feed items are read inside someone else's application, where `/images/x.svg`
 * resolves against THEIR host and 404s.
 */
export function absolutize(html: string, origin: string): string {
  // `(?!/)` is the whole subtlety: it protects protocol-relative URLs. `//x.com`
  // is an absolute URL with the scheme left to the browser, and rewriting it to
  // `https://jaan.io//x.com` would break a link that already worked.
  return html.replace(/\b(href|src)="\/(?!\/)/g, `$1="${origin}/`);
}

const ENTITIES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
  "&apos;": "'",
  "&amp;": "&",
};

/** Undo the escaping KaTeX applied when it copied the TeX into the document. */
function unescapeHtml(text: string): string {
  // &amp; last, via the map's own ordering — decoding it first would turn
  // `&amp;lt;` into `<` instead of `&lt;`.
  return text.replace(/&(?:lt|gt|quot|apos|#x27|#39|amp);/g, (m) => ENTITIES[m] ?? m);
}

/**
 * Find the index just past the `<span>` that opens at `start`, by counting
 * opens and closes. KaTeX output nests spans dozens deep, so the matching close
 * cannot be found by searching for the next `</span>` — which is why this is a
 * scanner and not a regular expression.
 *
 * Returns -1 if the element never closes, which would mean malformed input; the
 * caller leaves the block alone rather than truncating the post.
 */
function endOfSpan(html: string, start: number): number {
  let depth = 0;
  let i = start;
  while (i < html.length) {
    const next = html.indexOf("<", i);
    if (next === -1) return -1;
    if (html.startsWith("<span", next)) {
      depth++;
      i = next + 5;
    } else if (html.startsWith("</span>", next)) {
      depth--;
      if (depth === 0) return next + 7;
      i = next + 7;
    } else {
      i = next + 1;
    }
  }
  return -1;
}

/**
 * Put the LaTeX back.
 *
 * These posts are rendered with remark-math + rehype-katex, so an equation
 * reaches the page as a `.katex` span holding TWO copies of itself: a MathML
 * tree for assistive technology and an `aria-hidden` pile of positioned spans
 * that only looks like an equation once KaTeX's stylesheet has loaded. A feed
 * reader has no stylesheet, strips the aria-hidden nothing, and renders both
 * copies as run-together characters — so the physics post arrives as several
 * hundred equations of gibberish.
 *
 * The Jekyll site's feed did not have this problem: it rendered math in the
 * browser, so its feed carried `$…$` source, and subscribers have been reading
 * it that way for a decade. This restores exactly that. KaTeX helpfully keeps
 * the original TeX in `<annotation encoding="application/x-tex">`, so nothing
 * has to be reconstructed — only unwrapped.
 *
 * A block that cannot be read back is left exactly as it is. Shipping one ugly
 * equation beats dropping a paragraph.
 */
export function katexToTex(html: string): string {
  let out = "";
  let i = 0;

  while (i < html.length) {
    // Display math is wrapped in an outer .katex-display; matching it FIRST is
    // what lets a display equation come out as $$…$$ rather than as the $…$ of
    // the .katex span nested inside it.
    const display = html.indexOf('<span class="katex-display">', i);
    const inline = html.indexOf('<span class="katex">', i);

    let start: number;
    let isDisplay: boolean;
    if (display !== -1 && (inline === -1 || display <= inline)) {
      start = display;
      isDisplay = true;
    } else if (inline !== -1) {
      start = inline;
      isDisplay = false;
    } else {
      break;
    }

    const end = endOfSpan(html, start);
    if (end === -1) break;

    const block = html.slice(start, end);
    const tex = /<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/.exec(block);

    out += html.slice(i, start);
    if (tex) {
      const source = unescapeHtml(tex[1]).trim();
      out += isDisplay ? `<p>$$${source}$$</p>` : `$${source}$`;
    } else {
      out += block;
    }
    i = end;
  }

  return out + html.slice(i);
}

/**
 * Wrap text in CDATA safely.
 *
 * The sequence `]]>` cannot appear inside a CDATA section — it is what ends one
 * — so any occurrence is split across two sections. Without this a post that
 * happened to contain it would silently truncate every entry after it in the
 * feed, and the feed would still be well-formed enough to look fine.
 */
export function cdata(text: string): string {
  return `<![CDATA[${text.split("]]>").join("]]]]><![CDATA[>")}]]>`;
}

/**
 * Turn each `<lite-youtube>` facade into the poster frame it stands for,
 * wrapped in the link it already carries.
 *
 * On the page the element is a custom element that upgrades: its poster is an
 * inline `background-image`, its play button is an anchor, and a click swaps in
 * the real iframe (src/components/YouTubeRuntime.astro). A feed reader runs
 * none of that. It sees an unknown tag with no styling, so the poster — which
 * lives in a `style` attribute most readers strip anyway, and points at a
 * ROOT-RELATIVE path that would resolve against the reader's own host — never
 * appears, and the figure arrives as the bare text of the button's
 * visually-hidden label. Two of this site's figures were reaching subscribers
 * as the words "Play: …" and nothing else.
 *
 * So for the feed the facade is flattened back to what it depicts: an <img> of
 * the poster inside an <a> to the video. Both survive any reader's sanitizer,
 * and the href is the one already in the markup, so the "start at 21:19" cue on
 * the Stanton talk still rides along.
 *
 * Run BEFORE absolutize(), which is what turns the extracted poster path into a
 * URL a reader can fetch. A facade whose poster cannot be found is left exactly
 * as it is — the label-only rendering is poor, not broken.
 */
export function youtubeFacadeToImage(html: string): string {
  return html.replace(
    /<lite-youtube\b([^>]*)>([\s\S]*?)<\/lite-youtube>/g,
    (whole, attrs: string, inner: string) => {
      // The poster, out of `style="background-image: url('…')"`. The quotes
      // arrive HTML-escaped (&#x27;) because Astro escaped the attribute, so
      // the quote character is stripped after the fact rather than matched.
      const poster = /background-image:\s*url\(([^)]*)\)/.exec(attrs)?.[1];
      const src = poster?.replace(
        /^(?:&#x27;|&#39;|&quot;|['"])|(?:&#x27;|&#39;|&quot;|['"])$/g,
        "",
      );
      const href = /<a\b[^>]*\bhref="([^"]*)"/.exec(inner)?.[1];
      if (!src || !href) return whole;

      // The button's own label ("Play: …", "Play from 21:19: …") describes both
      // the still and what the link does, which is what alt text on a linked
      // poster should say. The element's `title` — the video's own title — is
      // the fallback.
      const label =
        /<span\b[^>]*>([\s\S]*?)<\/span>/.exec(inner)?.[1].trim() ??
        /\btitle="([^"]*)"/.exec(attrs)?.[1] ??
        "";

      return `<a href="${href}"><img src="${src}" alt="${label}" /></a>`;
    },
  );
}

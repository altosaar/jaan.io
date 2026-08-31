// /feed.xml — the Atom feed, at the path jaan.io has served since 2013.
//
// THE PATH AND THE FORMAT ARE BOTH INHERITED, and neither is a free choice:
// every existing subscriber's reader is polling this exact URL and keying off
// the ids inside it. Subscribers do not appear in analytics, so a 404 here is
// a loss nothing would have reported — which is why this was on the cutover
// list (README §3).
//
// Reproduced from `jaan.io-old/feed.xml` and checked against the feed that site
// actually built (`jaan.io-old/_site/feed.xml`), not just against its template:
//
//   • Atom, not RSS 2.0. `@astrojs/rss` is the usual answer for an Astro feed
//     and emits RSS 2.0; switching format at a live URL is a needless thing to
//     ask a decade of subscribers' readers to cope with, and the dependency
//     would not have saved the interesting part below anyway.
//   • `<id>` is `https://jaan.io/<slug>` — no trailing slash — because that is
//     the literal string the old feed emitted. An id is the ONLY thing a reader
//     uses to decide whether it has seen an entry before, so a "nicer" id would
//     redeliver up to twenty old posts to everyone at once.
//   • Full content, not summaries. That is what the old feed carried.
//
// The one deliberate difference is `<link rel="alternate">`, which the old feed
// gave a trailing slash. That is not an identifier, it is where the reader
// sends you, and it should be this site's canonical slash-less form rather than
// a URL that 301s.
import type { APIContext } from "astro";
import { getCollection } from "astro:content";
import { SITE } from "../site.config";
import { absolutize, cdata, katexToTex, youtubeFacadeToImage } from "../lib/feed-html";

// What the Jekyll feed carried, and what a reader will show without scrolling
// forever. The site has nine posts, so this is headroom rather than a limit.
const MAX_ENTRIES = 20;

export async function GET(context: APIContext) {
  // `context.site` is `site` from astro.config.mjs. Everything in a feed has to
  // be absolute, so this is required rather than optional — failing loudly here
  // beats emitting a feed full of root-relative links that resolve against
  // whatever host the reader happens to be.
  if (!context.site) throw new Error("feed.xml needs `site` set in astro.config.mjs");
  const origin = context.site.origin;

  const posts = (await getCollection("posts"))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
    .slice(0, MAX_ENTRIES);

  const entries = posts.map((post) => {
    const url = `${origin}/${post.id}`;
    // `updated` when the post has one, the publication date otherwise. This is
    // the field a reader uses to decide whether to resurface something already
    // seen, which is the whole reason `updated` is set by hand rather than from
    // git — see the note on it in src/content.config.ts.
    const updated = post.data.updated ?? post.data.date;
    // rendered.html is the same HTML the page ships, so the feed cannot drift
    // from the post. It is then put back into a shape a reader can use: math
    // returned to its LaTeX source, video facades flattened to their poster
    // frames, and every root-relative URL absolutized — absolutize LAST, since
    // the poster it rewrites is one the step before it just uncovered.
    const html = absolutize(youtubeFacadeToImage(katexToTex(post.rendered?.html ?? "")), origin);

    return `<entry>
  <title type="html">${cdata(post.data.title)}</title>
  <link rel="alternate" type="text/html" href="${url}" />
  <id>${url}</id>
  <published>${post.data.date.toISOString()}</published>
  <updated>${updated.toISOString()}</updated>
  <summary type="html">${cdata(post.data.description)}</summary>
  <content type="html">${cdata(html)}</content>
</entry>`;
  });

  // The feed's own <updated> is the newest entry's, NOT the build time. The old
  // Jekyll feed used `site.time`, which changed on every rebuild and told every
  // reader the feed had changed when nothing in it had.
  const latest = posts.reduce((newest, post) => {
    const stamp = post.data.updated ?? post.data.date;
    return stamp > newest ? stamp : newest;
  }, new Date(0));

  const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${SITE.lang}">
<title type="text">${cdata(SITE.name)}</title>
<subtitle type="text">${cdata(SITE.description)}</subtitle>
<link rel="self" type="application/atom+xml" href="${origin}/feed.xml" />
<link rel="alternate" type="text/html" href="${origin}" />
<updated>${latest.toISOString()}</updated>
<id>${origin}/</id>
<author>
  <name>${cdata(SITE.footer.copyright)}</name>
  <uri>${origin}/</uri>
</author>
${entries.join("\n")}
</feed>
`;

  // These headers reach `astro dev` and nothing else. The site is static, so
  // this route is PRERENDERED: it runs at build time and only `body` survives,
  // into dist/feed.xml, which Cloudflare then types from the file extension as
  // `application/xml`. The production headers are in public/_headers, and that
  // is where to change them — setting them here alone looks like it works
  // locally and ships the wrong content type.
  return new Response(body, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

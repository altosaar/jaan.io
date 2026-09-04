// Assert that every URL jaan.io serves today still resolves here.
//
//   npm run pages:dev            # in one shell — wrangler, so _redirects applies
//   npm run test:redirects       # in another
//   npm run test:redirects -- https://jaan-io.pages.dev   # or against a deploy
//
// WHY WRANGLER AND NOT `astro preview`: public/_redirects is a Cloudflare Pages
// feature. `astro preview` serves dist/ as plain files and ignores it entirely,
// so every rule in this file would appear to fail. This is the same reason
// test:newsletter needs `pages:dev` and stays out of CI.
//
// ── WHAT THIS IS PROTECTING ──────────────────────────────────────────────────
// jaan.io has served `permalink: /:title/` since 2013, so EVERY indexed URL —
// the ones carrying 20–30k organic visits a month — ends in a slash. This site
// serves the slash-less form (astro.config.mjs `trailingSlash: "never"` +
// `format: "file"`). The single `/*/ /:splat 301` rule at the bottom of
// public/_redirects is what turns each of those from a 404 into a 301.
//
// That rule is one line, it is easy to delete while tidying, and NOTHING ELSE
// WOULD NOTICE: the nav links are already slash-less, so the site looks
// perfectly healthy while every inbound link from a decade of the web 404s.
// This is the check that fails instead.
import { argv, exit } from "node:process";

const base = (argv[2] ?? "http://127.0.0.1:8788").replace(/\/$/, "");

// The three vanity destinations, spelled once. They are long, two of them
// carry query strings, and a typo in one would be asserted rather than caught.
const FEEDBACK =
  "https://docs.google.com/forms/d/e/1FAIpQLSdAWfrXnmNDyIHGQMqmEK_Uwc4VEgiI7GQ5h3hpK3PDM_UsLg/viewform";
const ZOOM = "https://us04web.zoom.us/j/4234569486?pwd=VFgxNG5qaWlWb3ZPNHkzOFVlSzFnUT09";
const GUEST = "https://www.dropbox.com/s/0qi1xhd4qr8pt80/thinkspace.md?dl=0";

// `to: null` means "no hop — the status is the whole assertion". With no
// explicit `status` that means 200 (already canonical); the two paths that are
// deliberately NOT redirected say `status: 404`.
//
// `status` overrides the expected code — 302 for the vanity shortcuts, which are
// pointers at other people's services rather than moved content.
// `external: true` asserts the Location and stops there, instead of following
// the hop and requiring a 200 from a third party.
const CASES = [
  // The one that matters most. Hacker News and David Duvenaud's course syllabus
  // both link the slashed form; it is the single most-linked URL on the site.
  {
    from: "/what-is-variational-autoencoder-vae-tutorial/",
    to: "/what-is-variational-autoencoder-vae-tutorial",
  },
  { from: "/what-is-variational-autoencoder-vae-tutorial", to: null },

  // The rest of the posts, in their indexed slashed form.
  {
    from: "/how-does-physics-connect-machine-learning/",
    to: "/how-does-physics-connect-machine-learning",
  },
  {
    from: "/food2vec-augmented-cooking-machine-intelligence/",
    to: "/food2vec-augmented-cooking-machine-intelligence",
  },
  { from: "/how-to-apply-to-grad-school/", to: "/how-to-apply-to-grad-school" },
  { from: "/how-to-ace-the-gre-and-physics-gre/", to: "/how-to-ace-the-gre-and-physics-gre" },
  { from: "/info-overload/", to: "/info-overload" },
  { from: "/princeton-pianos/", to: "/princeton-pianos" },
  { from: "/smoked-salmon-open-faced-sandwich/", to: "/smoked-salmon-open-faced-sandwich" },
  {
    from: "/virtual-thesis-defense-recording-zoom-presentation/",
    to: "/virtual-thesis-defense-recording-zoom-presentation",
  },

  // The writing index — the one URL this port changes, and the one that has now
  // changed twice: /blog/ (2013–) → /articles (this port) → /writing. All four
  // forms in a SINGLE hop each, which is the whole point of listing them: the
  // slashed ones must not go via their unslashed twin, and neither old name may
  // go via the other. A chain here is the regression this case exists to catch.
  { from: "/blog/", to: "/writing" },
  { from: "/blog", to: "/writing" },
  { from: "/articles/", to: "/writing" },
  { from: "/articles", to: "/writing" },

  // The guide that shipped as "Once Upon" and is "The Gab Lab" now. The old
  // slug was live and indexed before the rename, so both forms must reach the
  // new one in a SINGLE hop — the slashed one must not go via its unslashed
  // twin — and the new URL must itself be canonical rather than another hop.
  { from: "/once-upon/", to: "/the-gab-lab" },
  { from: "/once-upon", to: "/the-gab-lab" },
  { from: "/the-gab-lab", to: null },
  { from: "/the-gab-lab/", to: "/the-gab-lab" },

  // Index pages, including the two ported from the Jekyll tree.
  { from: "/papers/", to: "/papers" },
  { from: "/talks/", to: "/talks" },
  { from: "/about/", to: "/about" },
  { from: "/writing/", to: "/writing" },
  { from: "/projects/", to: "/projects" },

  // The accidental URL, which must reach the tutorial in ONE hop from either
  // form rather than falling through the catch-all into a bare .md path.
  {
    from: "/variational-autoencoder-perspectives.md/",
    to: "/what-is-variational-autoencoder-vae-tutorial",
  },
  {
    from: "/variational-autoencoder-perspectives.md",
    to: "/what-is-variational-autoencoder-vae-tutorial",
  },

  // The VAE tutorial's two earlier names, plus the `/index.html` twin S3 static
  // hosting needed for each. Live on jaan.io these are a TWO-hop chain
  // (/unreasonable-confusion → /what-is-variational-autoencoder-vae → the
  // tutorial); the whole point of the rules here is that they are one hop, and
  // the one-hop follow below is what would catch a reintroduced chain.
  { from: "/unreasonable-confusion/", to: "/what-is-variational-autoencoder-vae-tutorial" },
  { from: "/unreasonable-confusion", to: "/what-is-variational-autoencoder-vae-tutorial" },
  {
    from: "/unreasonable-confusion/index.html",
    to: "/what-is-variational-autoencoder-vae-tutorial",
  },
  {
    from: "/what-is-variational-autoencoder-vae/",
    to: "/what-is-variational-autoencoder-vae-tutorial",
  },
  {
    from: "/what-is-variational-autoencoder-vae",
    to: "/what-is-variational-autoencoder-vae-tutorial",
  },
  {
    from: "/what-is-variational-autoencoder-vae/index.html",
    to: "/what-is-variational-autoencoder-vae-tutorial",
  },

  // The sitemap path both crawlers already have on file. @astrojs/sitemap emits
  // sitemap-index.xml instead, so this is the rule that stops /sitemap.xml
  // 404ing at cutover — which Search Console reads as a sitemap that has been
  // removed rather than one that moved.
  { from: "/sitemap.xml", to: "/sitemap-index.xml" },

  // The vanity shortcuts. 302 rather than 301 — see _redirects for why — and
  // `external: true` stops the destination being fetched: these belong to
  // Google, Zoom and Dropbox, and Zoom in particular 403s a scripted client
  // while serving a browser fine. What is asserted is that the rule fires with
  // the right status and the right Location.
  { from: "/feedback/", to: FEEDBACK, status: 302, external: true },
  { from: "/feedback", to: FEEDBACK, status: 302, external: true },
  { from: "/zoom/", to: ZOOM, status: 302, external: true },
  { from: "/zoom", to: ZOOM, status: 302, external: true },
  { from: "/guest/", to: GUEST, status: 302, external: true },
  { from: "/guest", to: GUEST, status: 302, external: true },

  // The two rules NOT carried over from s3_website.yml, asserted as 404s so
  // that "we decided against this" cannot be mistaken later for "we forgot".
  // /impact's Figma file is gone (404 to a browser UA, while figma.com/community
  // is 200, so it is not bot-blocking); the radicalization post stays
  // unpublished, so its redirect would land on a 404 either way.
  //
  // The slashed forms are absent on purpose: those DO match the catch-all and
  // 301 to the slash-less form, which then 404s. That is a hop into a dead end
  // rather than a dead end, and it is what the catch-all is for.
  { from: "/impact", to: null, status: 404 },
  { from: "/dont-become-data-for-AI", to: null, status: 404 },

  // /consulting IS live on jaan.io today and is deliberately not ported — the
  // copy describes an availability that no longer holds, and a stale offer is
  // worse than no page. So this is the one URL the port knowingly gives up.
  //
  // Asserted for the same reason as the two above, and with one extra: this is
  // the case most likely to be read later as an oversight, because unlike them
  // it is a 200 today. If it should instead land somewhere rather than 404 —
  // /about is the obvious candidate — this is the line to change, and _redirects
  // needs `/consulting /about 301` in the section above the catch-all.
  { from: "/consulting", to: null, status: 404 },

  // The feed, at the path a decade of subscribers' readers are polling.
  { from: "/feed.xml", to: null },

  // Hotlinked documents. Not redirects — these must be served, at these exact
  // names, because other people's pages and CVs point straight at them.
  { from: "/papers/altosaar-2020-thesis.pdf", to: null },
  { from: "/talks/2017_Altosaar_food2vec_slides.pdf", to: null },
  { from: "/files/UsefulScience-press-photo.jpg", to: null },

  // The hotlinked .html files are the one exception, and NOT because of
  // anything in _redirects: Cloudflare Pages strips `.html` itself, 308ing to
  // the extensionless path, which then serves the file. There is no setting for
  // it on Pages and no rule here that overrides it.
  //
  // That is one automatic hop, which every browser and crawler follows, so the
  // original URLs keep working — which is the promise §4 of the README makes
  // about them. It is asserted rather than left to be rediscovered, because the
  // failure it looks like from the outside (a 308 on a URL printed in a paper)
  // is indistinguishable from a real one until you follow it.
  { from: "/files/rankfromsets-arxiv.html", to: "/files/rankfromsets-arxiv", status: 308 },
  {
    from: "/files/food2vec_food_embeddings_tsne.html",
    to: "/files/food2vec_food_embeddings_tsne",
    status: 308,
  },
  {
    from: "/files/ising_model_magnetization.html",
    to: "/files/ising_model_magnetization",
    status: 308,
  },

  // The share image every route without a picture of its own points at. A
  // fixed path on purpose — see PORTRAIT_PATH in src/lib/og-card.mjs.
  { from: "/og/portrait.jpg", to: null },

  // The site root must NOT match the trailing-slash rule. `/*/` needs a slash
  // after whatever `*` matches and "/" has no second slash, so this can never
  // loop — asserted rather than assumed, because a redirect loop on the home
  // page is the worst possible way to find out.
  { from: "/", to: null },
];

const results = [];
for (const testCase of CASES) {
  const { from, to, external = false } = testCase;
  // No explicit status means the obvious one: 200 for a path that should
  // already be canonical, 301 for a path that should move.
  const expect = testCase.status ?? (to === null ? 200 : 301);
  let status;
  let location = null;
  let final = null;
  try {
    const res = await fetch(base + from, { redirect: "manual" });
    status = res.status;
    location = res.headers.get("location");
    if (location && !external) {
      // Follow exactly ONE hop. A chain longer than that is a failure, not a
      // pass with extra steps: each hop costs a round trip and PageRank.
      const next = await fetch(new URL(location, base).href, { redirect: "manual" });
      final = next.status;
    }
  } catch (err) {
    results.push({ from, ok: false, note: `unreachable — ${err.cause?.code ?? err.message}` });
    continue;
  }

  if (to === null) {
    results.push({
      from,
      ok: status === expect,
      note:
        status === expect
          ? String(expect)
          : `expected ${expect}, got ${status}${location ? ` → ${location}` : ""}`,
    });
  } else if (status !== expect) {
    results.push({ from, ok: false, note: `expected ${expect}, got ${status}` });
  } else if (location !== to) {
    results.push({ from, ok: false, note: `${expect} → ${location}, expected ${to}` });
  } else if (external) {
    // Destination deliberately NOT followed. It belongs to Google, Dropbox or
    // Zoom, and all three answer a scripted client differently from a browser —
    // Zoom 403s a join link outright. Following it would make this test fail on
    // someone else's bot policy, and go red when the network is slow, while
    // telling us nothing about a rule in _redirects. What is ours to assert is
    // that the rule fires and points where we said; that the far end is alive
    // is a question for a human with a browser, and §2 of the README asks for
    // exactly that before a cutover.
    results.push({ from, ok: true, note: `${expect} → ${to} (external, not followed)` });
  } else if (final !== 200) {
    results.push({ from, ok: false, note: `${expect} → ${to} but that is ${final}, not 200` });
  } else {
    results.push({ from, ok: true, note: `${expect} → ${to} → 200` });
  }
}

for (const { from, ok, note } of results) {
  console.log(`${ok ? "pass" : "FAIL"}  ${from.padEnd(56)} ${note}`);
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(
    `\n${failed.length} of ${results.length} failed against ${base}.\n` +
      "If they ALL failed, the server is probably `astro preview` rather than\n" +
      "`npm run pages:dev` — only wrangler applies public/_redirects.\n",
  );
  exit(1);
}
console.log(`\nAll ${results.length} pass against ${base}.`);

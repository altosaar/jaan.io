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

// `to: null` means "expected to already be canonical — must be 200, no hop".
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

  // Index pages, including the two ported from the Jekyll tree.
  { from: "/papers/", to: "/papers" },
  { from: "/talks/", to: "/talks" },
  { from: "/about/", to: "/about" },
  { from: "/articles/", to: "/articles" },
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

  // The feed, at the path a decade of subscribers' readers are polling.
  { from: "/feed.xml", to: null },

  // Hotlinked documents. Not redirects — these must be served, at these exact
  // names, because other people's pages and CVs point straight at them.
  { from: "/papers/altosaar-2020-thesis.pdf", to: null },
  { from: "/talks/2017_Altosaar_food2vec_slides.pdf", to: null },

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
for (const { from, to } of CASES) {
  let status;
  let location = null;
  let final = null;
  try {
    const res = await fetch(base + from, { redirect: "manual" });
    status = res.status;
    location = res.headers.get("location");
    if (location) {
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
      ok: status === 200,
      note:
        status === 200 ? "200" : `expected 200, got ${status}${location ? ` → ${location}` : ""}`,
    });
  } else if (status !== 301) {
    results.push({ from, ok: false, note: `expected 301, got ${status}` });
  } else if (location !== to) {
    results.push({ from, ok: false, note: `301 → ${location}, expected ${to}` });
  } else if (final !== 200) {
    results.push({ from, ok: false, note: `301 → ${to} but that is ${final}, not 200` });
  } else {
    results.push({ from, ok: true, note: `301 → ${to} → 200` });
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

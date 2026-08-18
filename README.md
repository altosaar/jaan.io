# jaan.io

The Astro rebuild of [jaan.io](https://jaan.io), which has run on a 2013-era
Jekyll site (`../jaan.io-old`) served from a plain S3 bucket ever since.

**This is not live at jaan.io yet, and must not be pointed there until the
checklist below is finished.** The old site earns 20–30k organic visits a
month, concentrated in a handful of long-form technical posts. Every URL it
serves has to keep working — the same path, the same content — or that traffic
goes away and does not come back.

## Running it

```sh
npm install
npm run dev      # localhost:4321
npm run build    # → dist/
npm run preview  # serves dist/ on localhost:4322
```

`npm run dev` and `npm run build` both build the `/visualizations` charts first
(see §7 and `viz/README.md`); `npm run viz` forces a rebuild after editing one.
Three of the seven read their data from R2, so until that bucket exists they
need `npm run viz:local` once to run against local copies.

There is no test framework by design. These four are the tests, and CI runs
all of them:

```sh
npm run check    # astro check — TypeScript, strict
npm run a11y     # contrast-check.mjs against tokens.css
npm run audit    # seo-audit.mjs over dist/ — titles, descriptions, canonicals
npm run format:check
```

`npm run photos` re-syncs `src/assets/gallery/` from
`~/Pictures/_jaan.io-picpicks` (see `src/data/gallery.ts`). `npm run deploy`
pushes `dist/` to Cloudflare Pages.

## Where things live

|                                      |                          |
| ------------------------------------ | ------------------------ |
| Name, nav, social, feature switches  | `src/site.config.ts`     |
| Colours, type, spacing               | `src/styles/tokens.css`  |
| Blog posts — **filename is the URL** | `src/content/posts/*.md` |
| Long-form page content               | `src/content/pages/*.md` |
| Gallery photos + alt text            | `src/data/gallery.ts`    |
| Trailing-slash and legacy redirects  | `public/_redirects`      |

---

# Phase 4 — before jaan.io points here

Everything below is what stands between this repo and a DNS cutover. Nothing
here is cosmetic: each item is a URL that is live today and would break, or a
signal that would be lost. Tick them off in any order, but **all of them before
the DNS change**.

## 1. Content that exists on jaan.io and not here

Nine of the ten real articles are ported and verified. What remains:

- [ ] **`/blog/`** — the article index, live today. This site calls it
      `/articles`, so `/blog/` needs a 301 (see §2). Decide whether `/blog`
      should also keep working as an alias rather than only redirecting.
- [ ] **`/projects/`** — the index now exists and carries one entry,
      Visualizations (see §7). Still to port: the four published external
      entries from the Jekyll tree, which are links rather than pages — a
      thumbnail and a blurb pointing straight out to Flickr, CANImmunize,
      Useful Science and the One Fact Foundation. Their copy is in
      `jaan.io-old/_posts/projects/`. `npm run audit` flags /projects as a thin
      page at 53 words until they land.
- [ ] **`/papers/`** — the publication list, driven by 14 entries in
      `jaan.io-old/_papers/`. `output: false` there, so there are no
      per-paper pages — the index links to the PDFs in §4.
- [ ] **`/consulting/`** — one long page of prose, six bulleted engagements.
      Check with Jaan whether the copy is still current before porting it
      verbatim; it describes past availability.
- [ ] **`/talks/`** — index over the talk PDFs in §4.
- [ ] **`/my-friend-radicalized-this-made-me-rethink-how-i-build-AI/`** — the
      one unported article. It is `published: false` in the Jekyll tree and
      **404s on jaan.io right now**, so this is not a regression, but a live
      301 still points at it (see §2). Either restore the post or repoint that
      redirect; leaving both as they are ships a dead-ending redirect.

`/about/` is already here, deliberately rewritten rather than ported — the old
page's closing sections (Useful Science, the Protonmail contact instructions,
the social row, the colophon) were dropped on purpose.

## 2. Redirects

`public/_redirects` currently carries the trailing-slash rule and one legacy
redirect. The rest of `jaan.io-old/s3_website.yml` still has to move over.
**Order matters** — Cloudflare Pages takes the first matching rule, so anything
specific belongs above the `/*/ /:splat` catch-all at the bottom of the file.

- [ ] `/blog/` → `/articles` (301). The index URL is the one that changes in
      this port; the post URLs do not.
- [ ] `/feedback` → `https://goo.gl/forms/UolGIq1bpHJeK8dJ2` — verified 200.
- [ ] `/zoom` → the Zoom room. Also fix `public/robots.txt`, which still says
      `Disallow: /zoom/` with a trailing slash; this site serves `/zoom`, so
      the rule as written no longer matches what it is meant to hide.
- [ ] `/guest` → the Dropbox `thinkspace.md` — verified 200.
- [ ] `/impact` → the Figma community file. `curl` gets a 403 from Figma, which
      is probably bot-blocking rather than a dead link — **check it in a real
      browser before shipping**, and drop the rule if it is gone.
- [ ] `/unreasonable-confusion` → **collapse the two-hop chain.** Live today it
      301s to `/what-is-variational-autoencoder-vae`, which 301s again to
      `/what-is-variational-autoencoder-vae-tutorial`. Point it at the tutorial
      directly, in one hop.
- [ ] `/what-is-variational-autoencoder-vae` → the tutorial (one hop, as now).
- [ ] `/dont-become-data-for-AI` → currently the radicalization post, which
      404s. Blocked on the decision in §1.
- [ ] The `…/index.html` twins. S3 static hosting needed a separate rule for
      each of `/unreasonable-confusion/index.html`,
      `/what-is-variational-autoencoder-vae/index.html` and
      `/dont-become-data-for-AI/index.html`. They are distinct paths that may
      have been indexed, and the rules cost nothing to carry over.
- [x] `/variational-autoencoder-perspectives.md/` → the VAE tutorial. Done —
      this was a `.md.bak` file Jekyll published by accident, not a page.

## 3. Feeds and sitemaps

- [ ] **`/feed.xml`** — live and 200 today. Atom, full content, the 20 most
      recent posts, with `<updated>` from `modified` where a post has one.
      Nothing emits it here yet. Subscribers are invisible in analytics, so a
      404 at this path is a silent loss.
- [ ] **`/sitemap.xml`** — live and 200 today, and the path search engines
      already know. `@astrojs/sitemap` emits `sitemap-index.xml` instead, and
      `public/robots.txt` points at that. Serve or redirect the old path.

## 4. Static assets that must keep their exact paths

These are hotlinked from outside the site — from papers, from CVs, from other
people's pages — so the paths are not ours to change.

- [ ] **`/papers/*.pdf`** — 14 files, 19 MB. Only
      `altosaar-2020-thesis.pdf` is here so far; the thesis is the one linked
      externally, but the other 13 are all live.
- [ ] **`/talks/*.pdf`** — 4 files, 41 MB. Only the food2vec slides are here.
- [ ] **`/files/*`** — two are missing and both 200 on jaan.io today:
      `UsefulScience-press-photo.jpg` and `rankfromsets-arxiv.html`.

60 MB of PDFs is worth a thought before it goes into git. If they move to R2 or
another bucket instead, the paths still have to resolve as `jaan.io/papers/…`.

## 5. Analytics and webmaster verification

None of this is in the build yet.

- [ ] **GA4 `G-65ZYPYCLQE`** only. The old site also carries Universal
      Analytics `UA-34129661-2`, which stopped collecting in 2023 — do not
      port it.
- [ ] **Bing** `msvalidate.01` = `B3B21CDB59D1FC75DFE9B0D0CC329C8C`, carried
      over as-is.
- [ ] **Google** `google-site-verification` — the old value is **malformed**:
      the token is repeated, joined by a `#`. Take the half before the `#`, or
      re-issue it from Search Console.
- [ ] Re-submit the sitemap in Search Console after cutover, and watch Coverage
      for a week.

## 6. Cutover checks

Run these against the Pages preview URL before touching DNS, and again after.

- [ ] Every live URL returns 200 or an intended 301 — not a 404. The full list
      is `jaan.io-old/_site/`, one directory per URL.
- [ ] No redirect chains longer than one hop.
- [ ] Spot-check heading anchors on the ported posts against the live pages.
      They matched exactly at port time; a later heading edit silently breaks
      external deep links, as happened once already with food2vec.
- [ ] Canonical, `og:url` and the sitemap all agree on the slash-less form.
      `npm run audit` fails the build if they drift.
- [ ] Keyboard pass over the carousel: Tab in, arrows, Home/End, and confirm
      off-screen slides are not focusable. No script tests this.

## 7. /visualizations — three pages need the R2 bucket

The seven Observable pages from `../jaan.li` are ported and deployed under
`/visualizations/…`. Four work now. **Three do not, and will not, until the R2
bucket below exists:**

| Page                                                       | Dataset                                                            | Size   |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | ------ |
| `/visualizations/new-york-real-estate`                     | `new_york_real_estate_MapPLUTO_data_min_zoom_0_max_zoom_g.pmtiles` | 101 MB |
| `/visualizations/american-community-survey/new-york-area`  | `income-histogram-historical-new-york-area.parquet`                | 45 MB  |
| `/visualizations/american-community-survey/income-by-race` | `income-histogram-historical-new-york-area-by-race.parquet`        | 25 MB  |

All three are over Cloudflare Pages' 25 MiB per-file ceiling, so they cannot be
served from the site itself. Each page currently renders its headline, prose and
source note, then replaces the chart with "This chart could not be loaded" —
it fails visibly rather than blanking, and the other four pages are unaffected.

**No rebuild or redeploy is needed afterwards.** The deployed modules already
request `https://data.jaan.io/<file>`; those three pages start working the
moment the bucket answers.

### The runbook

```sh
# 1. Create the bucket.
npx wrangler r2 bucket create jaan-io-data

# 2. Upload the three datasets, from this repo's root.
SRC=../jaan.li/src
npx wrangler r2 object put jaan-io-data/new_york_real_estate_MapPLUTO_data_min_zoom_0_max_zoom_g.pmtiles \
  --file "$SRC/data/new_york_real_estate_MapPLUTO_data_min_zoom_0_max_zoom_g.pmtiles" \
  --content-type application/octet-stream --remote
npx wrangler r2 object put jaan-io-data/income-histogram-historical-new-york-area.parquet \
  --file "$SRC/american-community-survey/data/income-histogram-historical-new-york-area.parquet" \
  --content-type application/vnd.apache.parquet --remote
npx wrangler r2 object put jaan-io-data/income-histogram-historical-new-york-area-by-race.parquet \
  --file "$SRC/american-community-survey/data/income-histogram-historical-new-york-area-by-race.parquet" \
  --content-type application/vnd.apache.parquet --remote
```

3. **Attach the custom domain `data.jaan.io`** in the dashboard: R2 →
   `jaan-io-data` → Settings → Public access → Custom domains. That hostname is
   what `DATA_BASE` in `viz/src/charts/config.js` points at; change one and
   change the other.

4. **Set the CORS policy.** `data.jaan.io` and `jaan.io` are different origins.
   Allowing the `Range` request header and exposing `Content-Range` is the part
   that matters — without it DuckDB and PMTiles lose range requests and fall
   back to pulling whole files, which is a 101 MB download on the map page.

   ```json
   [
     {
       "AllowedOrigins": ["https://jaan.io"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedHeaders": ["range", "if-match"],
       "ExposeHeaders": ["content-range", "content-length", "etag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   Add the Pages preview origin too if you want the three pages working there.

5. **Verify** — a range request must come back `206`, not `200`:

   ```sh
   curl -sI -r 0-99 -H "Origin: https://jaan.io" \
     https://data.jaan.io/income-histogram-historical-new-york-area.parquet \
     | grep -iE "^HTTP|content-range|access-control-allow-origin"
   ```

   Then open the three pages. A `200` where a `206` belongs means the charts
   will work but download the whole file.

### Also outstanding

- [ ] **Confirm the New York map paints in a real browser.** Verified at the
      network layer — the PMTiles archive answers `206` and the Protomaps style,
      sprites and fonts all return 200 — but headless Chrome renders WebGL
      through software GL and produces a blank canvas, so nothing automated can
      check the last step.
- [ ] `viz/src/charts/new-york-real-estate.js` carries a **Protomaps API key**
      inline. It was already public in the `jaanli/jaan.li` repo this was ported
      from, but it is published here too now. Rotate it if that matters.
- [ ] The four Jekyll `/projects/` entries are still unported — see §1.

### Working on all seven locally in the meantime

```sh
npm run viz:local   # copies the three datasets out of ../jaan.li, points the modules at localhost
npm run dev
```

`public/_viz-data/` (what that creates) is **local-only** and gitignored. Every
file in it is over the Pages limit; `npm run build` deletes it before Astro runs
so a production build cannot carry it, and re-running `viz:local` restores it.

### Two things that are load-bearing and not obvious

- The charts build into `public/visualizations/` **before** `astro build`, not
  into `dist/` after it. Astro copies `public/` verbatim, so dev and production
  serve identical files; building into `dist/` works in production and 404s
  every chart under `astro dev`.
- DuckDB-wasm's two binaries (40 MB and 36 MB) are **rewritten to jsDelivr and
  deleted from the tree** by `scripts/build-visualizations.mjs`. They are over
  the Pages per-file limit and cannot ship. That script fails the build rather
  than shipping anything still over the cap.
- The loader in `src/layouts/Viz.astro` is `is:inline` deliberately. A
  Vite-processed script rewrites every dynamic import into
  `__vitePreload(…, __VITE_PRELOAD__)`, and since these modules are not Vite's
  the placeholder is never substituted and every chart page throws on load.

## Do not commit

`jaan.io-old/.env` holds live AWS keys. It stays out of this repo and out of
any transcript. Secrets go in via `wrangler secret put` or the Pages
dashboard — never as a command-line argument.

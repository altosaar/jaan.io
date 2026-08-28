# jaan.io

[jaan.io](https://jaan.io) — a personal site on [Astro](https://astro.build),
deployed to Cloudflare Pages. Writing, papers, talks, a photo gallery, and a set
of interactive visualizations that run their queries in the browser against real
public data.

**It is live, and CI is the only build.** The Pages project (`jaan-io`) is
Direct Upload, so Cloudflare never builds anything itself — `.github/workflows/ci.yml`
type-checks, builds, gates, and uploads `dist/` on every push to `main`.
Deploying a hand-built `dist/` bypasses that gate and ships whatever is in the
local `.env`; don't, unless you mean to.

**The one rule that outranks everything else here: a post's filename is its
URL, and it is not yours to rename.** The site earns most of its traffic from a
handful of long-form technical posts that have been linked from elsewhere for
over a decade. Every URL that has ever worked still has to work — same path,
same content — or that traffic goes away and does not come back. Renaming a file
under `src/content/posts/`, editing a heading that an external deep link points
at, or dropping a rule from `public/_redirects` all break that promise silently.

## Running it

```sh
npm install
cp .env.example .env  # a Turnstile testing key; the build refuses to run without one
npm run dev      # localhost:4321
npm run build    # → dist/
npm run preview  # serves dist/ on localhost:4322
```

`npm run dev` and `npm run build` both build the `/visualizations` charts first
(see **Visualizations**), then draw the social share cards from their marks and
from each post's thumb. `npm run viz` forces a rebuild of both after editing a
chart. Three of the eight charts read their data from R2 at `data.jaan.io`,
which is live, so they need no extra setup; `npm run viz:local` points them at
local copies for working offline.

`npm run photos` re-syncs `src/assets/gallery/` from `~/Pictures/_jaan.io-picpicks`
(see `src/data/gallery.ts`). `npm run deploy` pushes `dist/` to Pages by hand.

## The checks

There is no test framework by design. These are the tests:

```sh
npm run check            # astro check over src/, tsc over functions/ — strict
npm run format:check
npm run a11y             # contrast-check.mjs against tokens.css
npm run audit            # seo-audit.mjs over dist/ — titles, descriptions, canonicals, og
npm run limits           # check-pages-limits.mjs over dist/ — Pages' size caps
npm run test:newsletter  # posts to a running `npm run pages:dev`
npm run test:redirects   # 46 legacy-URL cases; needs pages:dev, or pass a live origin
```

`.githooks/pre-push` runs format, check, a11y, build and audit before every
push, printing one line per stage and the whole log on a failure (`VERBOSE=1` to
stream, `--no-verify` to skip). CI runs the same set. `npm run limits` is also
the last step of `npm run build`, so a file Pages would reject fails the build
rather than the upload.

`test:newsletter` and `test:redirects` are the odd ones out: both need a live
`wrangler pages dev`, so they stay out of CI and are run by hand —
`test:newsletter` before touching anything under `functions/`, `test:redirects`
before a deploy, because `public/_redirects` is a Pages feature that
`astro preview` ignores completely. Every rule in it appears to work locally and
404s in production.

```sh
npm run test:redirects -- https://jaan.io   # or any deployed origin
```

## Where things live

|                                      |                                              |
| ------------------------------------ | -------------------------------------------- |
| Name, nav, social, feature switches  | `src/site.config.ts`                         |
| Colours, type, spacing               | `src/styles/tokens.css`                      |
| Blog posts — **filename is the URL** | `src/content/posts/*.md`                     |
| Long-form page content               | `src/content/pages/*.md`                     |
| Index lists (projects, viz, gallery) | `src/data/*.ts`                              |
| Papers, talks, and their BibTeX      | `src/data/papers.ts`, `talks.ts`, `bibtex/`  |
| Trailing-slash and legacy redirects  | `public/_redirects`                          |
| Newsletter form                      | `src/components/NewsletterSignup.astro`      |
| Newsletter endpoints + D1 bindings   | `functions/api/`, `wrangler.toml`            |
| Share images (og:image)              | `src/lib/og.ts`, `scripts/gen-og-cards.mjs`  |
| The Atom feed                        | `src/pages/feed.xml.ts`                      |
| GA4 + webmaster verification tags    | `src/site.config.ts`, `src/lib/analytics.ts` |

## URLs, redirects and the feed

Everything legacy lives in `public/_redirects`, and `scripts/redirect-check.mjs`
covers it in 46 cases.

- **Order matters.** Pages takes the first matching rule, so anything specific
  belongs above the `/*/ → /:splat` catch-all at the bottom of the file.
- **Every rule is listed in both its slashed and slash-less form**, so an
  inbound link is one hop from wherever it points rather than two through the
  catch-all. The check fails on any chain longer than one hop.
- **A few paths are asserted as intended 404s** rather than left out of the
  script, so a later reader can tell "decided against" from "forgot".
- **`.html` files under `public/` arrive via one automatic 308.** Pages strips
  the extension itself (`html_handling`), before `_redirects` and not
  configurable. It is fine — 308 preserves the method and every client follows
  it — but from the outside it looks like a path that broke, so the check
  asserts the hop and the 200 at the end of it.
- **`/sitemap.xml` 301s to `/sitemap-index.xml`**, which is what
  `@astrojs/sitemap` emits and what `public/robots.txt` points at.
- **The Atom feed's entry `<id>`s must not change.** They are byte-identical to
  the ones the pre-Astro site served; changing the scheme would redeliver a
  decade of posts to every subscriber's reader. Math is converted back from
  KaTeX to `$…$` source in the feed on purpose — shipping KaTeX markup turns the
  physics post into several hundred equations of gibberish in a reader.

**GA4 loads only on the hostnames in `SITE.analytics.hosts`, currently just
`jaan.io`.** On localhost, on `npm run preview`, and on every `*.pages.dev`
deployment, `gtag.js` is not requested at all. Serve the site from a hostname
not on that list and analytics silently stops; add it in `site.config.ts`, not
in `Base.astro`. The two webmaster verification tags are emitted everywhere,
because Search Console and Bing verify by fetching a page of their choosing.

## Share images

What a link previews as when it is pasted into iMessage, Slack or a social post.
Three kinds, in the order a page reaches for them — full reasoning in
`src/lib/og.ts`:

1. **Its own picture.** A post sets `ogImage` (and the required `ogImageAlt`) in
   its frontmatter, pointing at a file in `src/assets/og/`. Cropped to 1200 × 630
   with Sharp's saliency crop, so nothing has to be pre-cut.
2. **Its mark, on a card.** Otherwise a post uses its `thumb` and a
   visualization its generated SVG mark, drawn large on the site's black at
   1200 × 630 by `scripts/gen-og-cards.mjs` into `public/og/` (gitignored,
   rebuilt every build). No type on the card — the platform already prints the
   title beside it, and text would mean a font no CI runner has.
3. **The portrait**, for every other route, at the **fixed** path
   `/og/portrait.jpg`.

   Fixed is the whole point. As an `import` through `getImage()` it shipped a
   content-hashed filename, and a hash moves whenever the image, the encoder
   settings or Astro's naming changes. Nothing breaks visibly when it does:
   every link already pasted into iMessage or Slack keeps pointing at the URL
   the crawler cached, and those go blank one by one after the next deploy. See
   `PORTRAIT_PATH` in `src/lib/og-card.mjs`.

`npm run audit` is the guard: it checks each declared size against the file that
shipped, that every chart page carries its own card, and that no generated card
goes unreferenced — which is what catches a page silently falling back to the
portrait because a slug stopped matching.

## Portraits and marks

Every mark on the site — the favicons, the nav mark, the touch icon — is
generated from one directory of line drawings that the `faceglyph` pipeline
(`../composite-portraits`) writes from a folder of photographs. The tab carries
a different portrait each day and the nav mark dissolves through all of them;
the how and why are in `src/lib/favicon.ts` and `src/lib/nav-morph.ts`, the
file-by-file output in `scripts/gen-favicons.mjs`.

After the pipeline runs again — a portrait added, one dropped, a weight retuned:

```sh
npm run gen:favicons        # or: npm run gen:favicons -- path/to/other/out
npm run build && npm run audit
git add -A public src/data
```

The set is derived, so the script rebuilds all of it from whatever the source
directory holds now and prints what changed:

```
wrote public/favicons/ — 18 portraits at stroke-width 80
  + sophie-and-david
```

That is the check that it did what you expected before you commit. Read the
source directory off the `reading …` line it starts with. Everything it writes
is committed, including `src/data/favicons.ts` and `src/data/nav-morph.ts`: CI
has no copy of the pipeline, so this never runs during a build. It warns if
`morph.svg` and `glyphs/` disagree on how many portraits there are — they come
out of the same run, so that means one is stale.

The nav mark is a **test**: `SITE.features.navMorph = false` removes it and
brings the wordmark back, and nothing else needs touching.

## Newsletter

**Collection only.** Nothing is ever sent to a subscriber, and there is no
confirmation email and no unsubscribe page, because there is nothing yet to
unsubscribe from.

```
the form (src/components/NewsletterSignup.astro, at the foot of most pages)
  │  POST /api/subscribe — same origin, JSON
  ▼
functions/api/subscribe.ts — honeypot → normalise + validate → verify the
  Turnstile token server-side → INSERT OR IGNORE into D1 → 200 {"ok":true}

functions/api/health.ts — SELECT 1 against D1 → 200 / 503
```

Three things about that are deliberate and would each look like an oversight:

- **The 200 is identical for a new address and one already on the list.** A
  different answer would turn the form into a membership oracle for anyone with
  a list of addresses to try.
- **No CORS headers anywhere.** The form is same-origin; a cross-origin caller
  is supposed to fail.
- **No IP address is stored, and none is sent to Turnstile** (its `remoteip`
  field is left out on purpose). The table holds an address and two timestamps
  and nothing else. For the same reason no alert or log line may carry a
  submitted address.

### Configuration

| Name                        | Kind                  | Where it is set                                                  | Read by   |
| --------------------------- | --------------------- | ---------------------------------------------------------------- | --------- |
| `DB`                        | D1 binding            | `wrangler.toml`, production + `[env.preview]`                    | both      |
| `TURNSTILE_SECRET`          | encrypted secret      | `wrangler pages secret put`, production + preview                | subscribe |
| `ALERT_WEBHOOK`             | encrypted secret      | same; optional, and see below                                    | subscribe |
| `ALERT_NTFY_TOKEN`          | encrypted secret      | same; optional, and see below                                    | subscribe |
| `PUBLIC_TURNSTILE_SITE_KEY` | public build-time var | `PUBLIC_TURNSTILE_SITE_KEY` repo variable for CI; `.env` locally | the form  |

The site key is public by design — it ships in the HTML. The secrets are never
in this repo; `.dev.vars` holds the local copies and is gitignored.
`NewsletterSignup.astro` warns on a local build carrying a Turnstile testing key
and fails a CI build outright.

**In-process alerting does not deliver, and the health endpoint is the real
monitoring.** An unexpected failure in `subscribe` publishes to an
[ntfy](https://ntfy.sh) topic; ntfy.sh meters its free tier per **source IP**,
and a Worker egresses from a shared Cloudflare pool whose daily quota strangers
have already spent, so the publish comes back `429` every time. The code is
correct and the secrets are set — a paid ntfy tier, Cloudflare Email Sending, or
a webhook that is not IP-metered would each make it work with no code change.
Meanwhile `.github/workflows/health.yml` polls `/api/health` every 10 minutes
and opens a GitHub issue when it goes red, closing it on the next green run.
That catches broken deploys, missing bindings and D1 quota exhaustion, none of
which an in-process alert could report anyway.

### Working on it locally

```sh
npx wrangler d1 migrations apply jaan-newsletter --local  # once
npm run build
npm run pages:dev        # wrangler pages dev — serves dist/ AND functions/
npm run test:newsletter  # in another shell
```

`npm run dev` alone will not do: `astro dev` knows nothing about `functions/`,
so the form renders and every submission 404s. Rebuild before re-testing —
`pages:dev` serves `dist/`, not `src/`.

Two of the ten acceptance cases need a differently-configured server:

```sh
# 5 — a failing challenge is rejected. Swap TURNSTILE_SECRET in .dev.vars for
#     Turnstile's always-fails testing secret (2x0000…AA), restart pages:dev:
NEWSLETTER_REJECT=1 npm run test:newsletter

# 9 — an unexpected failure alerts once, and says nothing about who submitted.
#     Point ALERT_WEBHOOK at a throwaway local receiver (NOT the real topic),
#     rename the `DB` binding in wrangler.toml, restart, post once: expect 500,
#     one message, and no address anywhere in it.
```

To exercise the real widget end to end, deploy to any branch other than `main`:
wrangler picks the `[env.preview]` bindings automatically, so the address lands
in `jaan-newsletter-preview` and never touches the real list.

```sh
npm run build && npx wrangler pages deploy dist --project-name=jaan-io --branch=test
```

### Reading and exporting the list

```sh
npx wrangler d1 execute jaan-newsletter --remote \
  --command "SELECT email, created_at FROM subscribers WHERE status='active'"

npx wrangler d1 export jaan-newsletter --remote --output dump.sql
```

The export is subscriber data — see **Do not commit**. Quotas are not a concern
at this scale: D1's free tier is ~100k row-writes and 5M row-reads a day, and
Pages Functions share the Workers free tier of 100k requests a day. If a cap is
hit, D1 queries fail until 00:00 UTC and `/api/health` goes red.

The table is already shaped for sending, so no migration will be needed on a
table holding real addresses: `status` has `pending` / `unsubscribed` /
`bounced`, `confirmed_at` + `confirm_token` carry double opt-in, and every row
has an `unsubscribe_token`. What is missing is a provider, an outbox and a
compliance footer.

## Visualizations

Eight pages under `/visualizations/…`, listed in `src/data/visualizations.ts`;
the chart modules and their build live in `viz/` (see `viz/README.md`). Three of
them read a dataset far past Pages' per-file ceiling, so those are served from
R2 at `https://data.jaan.io`:

| Page                                                       | Dataset                                                            | Size   |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | ------ |
| `/visualizations/new-york-real-estate`                     | `new_york_real_estate_MapPLUTO_data_min_zoom_0_max_zoom_g.pmtiles` | 101 MB |
| `/visualizations/american-community-survey/new-york-area`  | `income-histogram-historical-new-york-area.parquet`                | 45 MB  |
| `/visualizations/american-community-survey/income-by-race` | `income-histogram-historical-new-york-area-by-race.parquet`        | 25 MB  |

Four things here are load-bearing and not obvious:

- **The bucket's CORS list is origin-exact.** `https://jaan.io` is allowed; a
  bare `http://`, a `www.` host or any other domain gets no CORS header and
  those three charts fail while the other five keep working. Serving the site
  from a new hostname means adding it to the bucket policy. The setup and the
  one real trap in it (the dashboard and `wrangler` take **different CORS JSON
  shapes**) are in `viz/README.md`.
- **The charts build into `public/visualizations/` _before_ `astro build`**, not
  into `dist/` after it. Astro copies `public/` verbatim, so dev and production
  serve identical files; building into `dist/` works in production and 404s
  every chart under `astro dev`.
- **DuckDB-wasm's two binaries (40 MB and 36 MB) are rewritten to jsDelivr and
  deleted from the tree** by `scripts/build-visualizations.mjs`. They are over
  the Pages per-file limit and cannot ship; that script fails the build rather
  than shipping anything still over the cap.
- **The loader in `src/layouts/Viz.astro` is `is:inline` deliberately.** A
  Vite-processed script rewrites every dynamic import into
  `__vitePreload(…, __VITE_PRELOAD__)`, and since these modules are not Vite's
  the placeholder is never substituted and every chart page throws on load.

`viz/src/charts/new-york-real-estate.js` carries a Protomaps API key inline. It
is **origin-restricted** — a request with no `Referer` gets
`403 Invalid origin for API key`, one with a `jaan.io` referer gets a 200 — so a
bare `curl` of that style URL failing is not a bug.

WebGL charts cannot be verified headlessly: headless Chrome renders through
software GL and produces a blank canvas. Check the map by opening it.

### Working against local copies

```sh
npm run viz:local   # copies the three datasets locally, points the modules at localhost
npm run dev
```

`public/_viz-data/` is local-only and gitignored. Every file in it is over the
Pages limit; `npm run build` deletes it before Astro runs so a production build
cannot carry it.

## Size limits

Cloudflare Pages rejects any file over **25 MiB**. `npm run limits` walks the
finished `dist/` at the end of every build so this fails locally rather than at
upload. Documents (`/papers/*.pdf`, `/talks/*.pdf`, `/files/*`) are hotlinked
from other people's pages and from the PDFs themselves, so their paths are not
ours to change and they stay on Pages rather than moving to R2. An oversized PDF
gets re-encoded instead: this took the thesis deck from 34 MiB to 15 MiB with no
visible difference at a 100% crop, because Keynote had exported 94
near-uncompressed bitmaps.

```sh
gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.5 -dPDFSETTINGS=/printer \
   -dNOPAUSE -dQUIET -dBATCH -sOutputFile=out.pdf in.pdf
```

## Wired outside this repo

Four things put the site at `jaan.io`. Nothing here would recreate them, and
each is a single click away from taking the site down.

- **The Pages custom domain.** `jaan.io` is a custom domain on the `jaan-io`
  project; the apex is a proxied CNAME to `jaan-io.pages.dev`. Direct Upload, so
  CI is the only build — and a Direct Upload project cannot be converted to a
  Git-integrated one, it would have to be recreated.
- **`www.jaan.io` → `jaan.io`** as a Cloudflare **Redirect Rule**, not a DNS
  record and not in `_redirects`. The `www` record only has to stay _proxied_ —
  the rule fires before any origin is reached, so what it points at is
  irrelevant.
- **The R2 bucket** `jaan-io-data` behind `data.jaan.io` — see above and
  `viz/README.md`.
- **Turnstile, D1 and the Pages secrets** — see **Newsletter**.

## Do not commit

Secrets go in via `wrangler pages secret put` or the dashboard — never as a
command-line argument, never in this repo.

The same goes for anything carrying a subscriber's address: `.dev.vars`, and any
`wrangler d1 export` output (`dump*.sql` and `*.sqlite*` are gitignored). This
repo is public, and a git history is not something a mailing list can be removed
from.

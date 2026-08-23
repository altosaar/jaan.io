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
cp .env.example .env  # a Turnstile testing key; the build refuses to run without one
npm run dev      # localhost:4321
npm run build    # → dist/
npm run preview  # serves dist/ on localhost:4322
```

`npm run dev` and `npm run build` both build the `/visualizations` charts first
(see §7 and `viz/README.md`), then draw the social share cards from their marks
and from each post's thumb (`npm run og`; see **Share images** below). `npm run
viz` forces a rebuild of both after editing a chart. Three of the seven read
their data from R2, so until that bucket exists they need `npm run viz:local`
once to run against local copies.

There is no test framework by design. These are the tests, and CI runs all but
the last one:

```sh
npm run check            # astro check over src/, tsc over functions/ — strict
npm run a11y             # contrast-check.mjs against tokens.css
npm run audit            # seo-audit.mjs over dist/ — titles, descriptions, canonicals
npm run format:check
npm run test:newsletter  # posts to a running `npm run pages:dev` — see Newsletter
```

`test:newsletter` is the odd one out: it needs a live Functions runtime and a
local D1, which the other four do not, so it stays out of CI and is run by hand
before touching anything under `functions/`.

`npm run photos` re-syncs `src/assets/gallery/` from
`~/Pictures/_jaan.io-picpicks` (see `src/data/gallery.ts`). `npm run deploy`
pushes `dist/` to Cloudflare Pages.

### Portraits

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

That is the whole procedure. The set is derived, so the script rebuilds all of
it from whatever the source directory holds now, and prints what changed —

```
wrote public/favicons/ — 18 portraits at stroke-width 80
  + sophie-and-david
```

— which is the check that it did what you expected before you commit. Read the
source directory off the `reading …` line it starts with; the default is in
`scripts/gen-favicons.mjs`. Everything it writes is committed, including
`src/data/favicons.ts` and `src/data/nav-morph.ts`: CI has no copy of the
pipeline, so this never runs during a build.

It warns if `morph.svg` and `glyphs/` disagree on how many portraits there are.
They come out of the same pipeline run, so that means one of them is stale — the
nav mark would be missing a face the tab still shows.

The nav mark itself is a **test**: `SITE.features.navMorph = false` removes it
and brings the wordmark back, and nothing else needs touching.

## Where things live

|                                      |                                             |
| ------------------------------------ | ------------------------------------------- |
| Name, nav, social, feature switches  | `src/site.config.ts`                        |
| Colours, type, spacing               | `src/styles/tokens.css`                     |
| Blog posts — **filename is the URL** | `src/content/posts/*.md`                    |
| Long-form page content               | `src/content/pages/*.md`                    |
| Gallery photos + alt text            | `src/data/gallery.ts`                       |
| Trailing-slash and legacy redirects  | `public/_redirects`                         |
| Newsletter form                      | `src/components/NewsletterSignup.astro`     |
| Newsletter endpoints + D1 bindings   | `functions/api/`, `wrangler.toml`           |
| Share images (og:image)              | `src/lib/og.ts`, `scripts/gen-og-cards.mjs` |

## Share images

What a link previews as when it is pasted into iMessage, WhatsApp, Slack or a
social post. Three kinds, in the order a page reaches for them — the full
reasoning is in `src/lib/og.ts`:

1. **Its own picture.** A post sets `ogImage` (and the required `ogImageAlt`) in
   its frontmatter, pointing at a file in `src/assets/og/`. Five do: the Jekyll
   site's `image.feature` banners, at the resolutions that survived. Cropped to
   1200 × 630 with Sharp's saliency crop, so nothing has to be pre-cut.
2. **Its mark, on a card.** Otherwise a post uses its `thumb`, and a
   visualization uses its generated SVG mark, drawn large on the site's black at
   1200 × 630 by `scripts/gen-og-cards.mjs` into `public/og/` (gitignored,
   rebuilt every `npm run build`). No type on the card — the platform already
   prints the title beside it, and text would mean a font no CI runner has.
3. **The portrait.** Every other route — `/about`, `/articles`, `/projects`,
   `/images`, the home page — shares one square 1536² face.

`npm run audit` is the guard. It checks each declared size against the file that
shipped, that every chart page carries its own card, and that no generated card
goes unreferenced — which is what catches a page silently falling back to the
portrait because a slug stopped matching.

## Newsletter

Stage 1 is **collection only**. Nothing is ever sent to a subscriber, there is
no confirmation email and no unsubscribe page, because there is nothing yet to
unsubscribe from. What exists is the smallest thing that can start a list
without losing the addresses that arrive before there is anything to send them.

```
the form (src/components/NewsletterSignup.astro, on /about and /articles)
  │  POST /api/subscribe — same origin, JSON
  ▼
functions/api/subscribe.ts — honeypot → normalise + validate → verify the
  Turnstile token server-side → INSERT OR IGNORE into D1 → 200 {"ok":true}
  └─ unexpected error → fire ALERT_WEBHOOK without blocking → 500
     (wired, but ntfy.sh rejects it from a Worker — see Alerting)

functions/api/health.ts — SELECT 1 against D1 → 200 / 503,
  polled every 5 minutes by an external uptime monitor
```

Three things about that are deliberate and would each look like an oversight:

- **The 200 is identical for a new address and one already on the list.** A
  different answer would turn the form into a membership oracle for anyone with
  a list of addresses to try.
- **No CORS headers anywhere.** The form is same-origin; a cross-origin caller
  is supposed to fail.
- **No IP address is stored, and none is sent to Turnstile** (its `remoteip`
  field is left out on purpose). The table holds an address and two timestamps
  and nothing else — no IPs, no user agents, no analytics. For the same reason,
  an alert message never contains a submitted address or any part of a request
  body: the alert channel is not somewhere subscriber data may end up.

### Configuration

| Name                        | Kind                       | Where it is set                                                  | Read by        |
| --------------------------- | -------------------------- | ---------------------------------------------------------------- | -------------- |
| `DB`                        | D1 binding                 | `wrangler.toml`, production + `[env.preview]`                    | both functions |
| `TURNSTILE_SECRET`          | encrypted secret           | `wrangler pages secret put`, production + preview                | subscribe      |
| `ALERT_WEBHOOK`             | encrypted secret, optional | same; set, but see Alerting — not delivering                     | subscribe      |
| `ALERT_NTFY_TOKEN`          | encrypted secret, optional | same; set, but see Alerting — not delivering                     | subscribe      |
| `PUBLIC_TURNSTILE_SITE_KEY` | public build-time var      | `PUBLIC_TURNSTILE_SITE_KEY` repo variable for CI; `.env` locally | the form       |

The site key is public by design — it ships in the HTML. The secret and the
webhook URL are Cloudflare secrets and are never in this repo; `.dev.vars` holds
the local copies and is gitignored.

### Alerting — built, wired, and NOT currently delivering

**Read this before trusting an alert to arrive, or before rebuilding this.** An
unexpected failure in `subscribe` publishes to an [ntfy](https://ntfy.sh) topic,
which is supposed to fan out to a phone push and an email. The code is correct
and the secrets are set; ntfy.sh rejects the publish anyway:

```
429 {"code":42908,"error":"limit reached: daily message quota reached"}
```

Six attempts out of six from a deployed Function. The same publish, same token,
same topic, from a laptop: `200`. The cause is in the ntfy account's own limits
— `"basis": "ip"`. On the free tier ntfy meters per **source IP**, not per
account; the token authenticates but does not change the basis. A Worker
egresses from a shared Cloudflare IP pool whose daily quota strangers have
already spent, so the rejection has nothing to do with this account's remaining
messages. It blocks the push as well as the email: ntfy from a Worker is off,
not degraded.

The fix, if alerts are ever wanted, is one of:

- an ntfy paid tier — the basis becomes `tier`, and everything here starts
  working with no code change at all;
- Cloudflare Email Sending from the Worker — no third-party quota, and both
  `jaan.io` and `jaan.li` are already zones on this account;
- a webhook that is not IP-metered (Discord, Telegram) — push, no email.

What exists in the meantime:

- **`ALERT_WEBHOOK`** is the whole topic URL, `https://ntfy.sh/<topic>`. On the
  public ntfy.sh server **the topic name is the only access control** — anyone
  who learns it can read every alert and publish fakes — so the URL is a secret
  rather than a constant in this file, and the topic is one this project shares
  with nothing else. A copy lives at `~/.config/ntfy/topic.jaan-io-newsletter`,
  since a Cloudflare secret cannot be read back.
- **`ALERT_NTFY_TOKEN`** is an ntfy account token, and it buys exactly one
  thing: email. ntfy.sh refuses anonymous email forwarding, so without a token
  an alert would be push-only. With it the request carries `Email: yes`, which
  routes to the account's primary **verified** address — so no email address
  appears in this repo either.

Both secrets are left in place deliberately: a doomed `fetch` on an error path
that should never run costs nothing, and it means an ntfy upgrade would need no
deploy. Remove them with `npx wrangler pages secret delete ALERT_WEBHOOK
--project-name jaan-io` (and `--env preview`) to make the handler skip alerting
entirely, which is what it already does when the secret is unset.

**So the real monitoring is the health endpoint.** That is not a consolation
prize — polling it from outside is the layer that catches broken deploys,
missing bindings, and D1 quota exhaustion, none of which an in-process alert can
report anyway. `.github/workflows/health.yml` does that poll every 10 minutes
and opens a GitHub issue when it goes red, which is what actually reaches an
inbox; it closes the issue again on the next green run. The one thing it cannot
report is GitHub itself being down, which is the argument for the third-party
monitor still on the open list below.

Because this Pages project is Direct Upload, **CI is the only build**, so the
site key comes from a GitHub repository variable rather than a Cloudflare build
setting. Deploying a hand-built `dist/` would ship whatever is in the local
`.env` — a testing key — so `NewsletterSignup.astro` warns on a local build
carrying one and fails a CI build outright.

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

Two of the ten acceptance cases need a differently-configured server and are run
by hand:

```sh
# 5 — a failing challenge is rejected. Swap TURNSTILE_SECRET in .dev.vars for
#     Turnstile's always-fails testing secret (2x0000…AA), restart pages:dev:
NEWSLETTER_REJECT=1 npm run test:newsletter

# 9 — an unexpected failure alerts once, and says nothing about who submitted.
#     Point ALERT_WEBHOOK at a throwaway local receiver (NOT the real topic),
#     rename the `DB` binding in wrangler.toml, restart, post once: expect 500,
#     one message, and no address anywhere in it.
```

### Reading and exporting the list

```sh
npx wrangler d1 execute jaan-newsletter --remote \
  --command "SELECT email, created_at FROM subscribers WHERE status='active'"

npx wrangler d1 execute jaan-newsletter --remote \
  --command "SELECT count(*) FROM subscribers"

npx wrangler d1 export jaan-newsletter --remote --output dump.sql
```

The export is subscriber data. `dump*.sql` and `*.sqlite*` are gitignored, and
this repo is public — see _Do not commit_ at the bottom of this file.

Quotas are not a concern at this scale: D1's free tier is ~100k row-writes and
5M row-reads a day, and Pages Functions share the Workers free tier of 100k
requests a day. If a cap is ever hit, D1 queries fail until 00:00 UTC and
`/api/health` goes red, which is what the uptime monitor is for.

### What is already set up, and what is left

Done: both D1 databases (`jaan-newsletter`, `jaan-newsletter-preview`) created
and migrated; the Turnstile widget (managed mode, `jaan-io.pages.dev` and
`jaan.io`); `TURNSTILE_SECRET`, `ALERT_WEBHOOK` and `ALERT_NTFY_TOKEN` on the
Pages project for production and preview; `PUBLIC_TURNSTILE_SITE_KEY` as a repo
variable.

The widget renders with `appearance="interaction-only"`, so it draws nothing
unless a visitor actually has to click something, and the form waits for its
token rather than posting an empty one (see NewsletterSignup.astro). Switching
it to **Invisible** mode is a dashboard setting on the same site key and needs
no code change — but it removes the checkbox fallback, leaving a visitor who
cannot pass silently with no way through, and Cloudflare makes it a condition
that the site's privacy policy reference their Turnstile Privacy Addendum,
which means writing one first.

Still open, and neither blocks the form from working:

1. **An end-to-end test against the real widget.** The testing keys cannot
   exercise the actual Turnstile challenge, and no browser has driven this form
   yet — only the endpoint has been tested. Deploy a preview and submit it once:

   ```sh
   npm run build && npx wrangler pages deploy dist --project-name=jaan-io --branch=test
   ```

   Any branch that is not `main` makes it a preview deployment, and wrangler
   picks the `[env.preview]` bindings from `wrangler.toml` automatically — so the
   address lands in `jaan-newsletter-preview` and never touches the real list.
   Confirm it with `npx wrangler d1 execute jaan-newsletter-preview --remote
--env preview --command "SELECT * FROM subscribers"`. (CI only ever deploys
   `main`, so preview deployments are a manual step.)

2. **A third-party uptime monitor** (optional second opinion) — point a free monitor (UptimeRobot or similar) at
   `https://jaan-io.pages.dev/api/health`, 5-minute interval, alert to email.
   This is the layer that catches a broken deploy or a missing binding, which
   the in-code alerting cannot see. Use the slash-less URL: `_redirects` ends
   with a `/*/ → /:splat` catch-all, so a trailing slash costs a 301.

### Stage 2, when there is something to send

The table is already shaped for it, so no migration is needed on a table that
will by then hold real addresses: `status` has `pending` / `unsubscribed` /
`bounced` waiting for it, `confirmed_at` + `confirm_token` carry double opt-in,
and every row already has an `unsubscribe_token` for one-click unsubscribe
links. What is missing is all of the sending: a provider, an outbox, and a
compliance footer.

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
- [ ] Paste a post URL and a `/visualizations/…` URL into iMessage and Slack and
      confirm each previews as its own picture, not as the portrait. The audit
      checks the tags; only a real unfurl checks the crawlers.
- [ ] Keyboard pass over the carousel: Tab in, arrows, Home/End, and confirm
      off-screen slides are not focusable. No script tests this.

## 7. /visualizations — three of the eight need the R2 bucket

Eight pages are deployed under `/visualizations/…` — seven ported from
`../jaan.li`, plus the NYU Langone hospital-price dashboard from
`../payless.health` (its 1.1 MB extract ships with the site, so it needs
nothing). Five work now. **Three do not, and will not, until the R2 bucket
below exists:**

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

The same goes for anything carrying a subscriber's address: `.dev.vars`, and any
`wrangler d1 export` output. This repo is public, and a git history is not
something a mailing list can be removed from.

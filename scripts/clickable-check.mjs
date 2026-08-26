#!/usr/bin/env node
// Acceptance test: the newsletter Sign up button can actually be clicked, in
// Chrome, Firefox and Safari.
//
// WHY IT EXISTS. The form shipped broken and looked perfect. `.palette-corner`
// (PaletteToggle.astro) is `position: fixed` across the width of the chrome
// column at the bottom of the viewport — three 28px marks drawn at its right
// end, and a transparent box the full 94vw the whole way across. A transparent
// box still hit-tests, so that box was an invisible 1354 × 84px bar lying over
// the foot of every desktop page, at z-index 200, swallowing every click that
// landed in it. /about/ is short enough that the Sign up button could not be
// scrolled out from under it: the form was unclickable, permanently, on the
// live site, with nothing wrong in the markup, the handler, Turnstile or the
// endpoint. Nothing that reads HTML or CSS could have caught it — the only
// thing that catches a covered control is asking a browser to click it.
//
// So this is deliberately NOT a unit test of the handler. It drives real
// engines and presses the real button, and it presses it on every page that
// mounts the form and at four viewport sizes, because whether a fixed overlay
// covers a control depends entirely on how tall the page and the window are.
//
// WHAT IT CHECKS, per engine × viewport × page:
//   click    a real click reaches the button (Playwright runs the browser's own
//            hit-test before dispatching, so a covered control fails here
//            rather than silently doing nothing — which is the bug)
//   submit   typing an address and pressing it runs the whole path: handler,
//            Turnstile token, POST, success copy
//   palette  the three marks still answer, which is what proves the fix handed
//            pointer events back to the buttons after taking them off the box
//
// WHAT IT DOES NOT CHECK: the endpoint. /api/subscribe is a Pages Function and
// is stubbed with a 200 here — nothing is posted anywhere and no row is
// written, including when this is pointed at the deployed site. What the
// endpoint does with a submission is scripts/newsletter-check.mjs's job.
//
// Usage:
//   npm run build
//   npm run test:clickable                       # serves ./dist itself
//   npm run test:clickable -- --origin https://jaan-io.pages.dev
//
// First run needs the engines, which are not part of `npm ci`:
//   npx playwright install chromium firefox webkit
//
// Exit codes: 0 = every case passed, 1 = at least one failed.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const args = process.argv.slice(2);
const originArg = args.includes("--origin") ? args[args.indexOf("--origin") + 1] : null;

// The engines are an explicit install (see the header), so a missing one is the
// normal first-run state rather than a broken checkout. Say which command fixes
// it instead of printing a module-not-found stack.
let chromium, firefox, webkit;
try {
  ({ chromium, firefox, webkit } = await import("playwright"));
} catch {
  console.error(
    "playwright is not installed.\n" +
      "  npm i -D playwright && npx playwright install chromium firefox webkit",
  );
  process.exit(1);
}

// Every page that mounts NewsletterSignup, one of each kind: the two flavours of
// index page, /about (the shortest, and the one where the bug was unscrollable),
// and one article. Height is what decides whether a bottom-fixed overlay covers
// the button, so the set is chosen for page LENGTH rather than for coverage.
const PAGES = ["/about", "/articles", "/projects", "/visualizations", "/info-overload"];

// 1025px is the site's own line between the two chromes (chrome.css), and it is
// also where .palette-corner leaves the corner for the footer — so the set has
// to straddle it. `short` is the case that actually bites: a window with less
// room to scroll holds the button nearer the bottom of the screen.
const VIEWPORTS = [
  { name: "desktop 1440x900", width: 1440, height: 900 },
  { name: "laptop 1280x720", width: 1280, height: 720 },
  { name: "short 1280x600", width: 1280, height: 600 },
  { name: "phone 390x844", width: 390, height: 844 },
];

// Enough to serve `dist` the way Cloudflare Pages does with `trailingSlash:
// "never"`: /about → dist/about.html. Spawning `astro preview` instead would be
// a daemon to start, find the port of, and stop again.
const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

async function serveDist() {
  const root = new URL("../dist/", import.meta.url).pathname;
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    for (const candidate of [path, path + ".html", join(path, "index.html")]) {
      try {
        const body = await readFile(join(root, candidate));
        res.writeHead(200, {
          "content-type": MIME[extname(candidate)] ?? "application/octet-stream",
        });
        return res.end(body);
      } catch {
        /* try the next shape */
      }
    }
    res.writeHead(404).end("not found");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

// One shape for all three checks: "ok", or a short reason that fits in a column.
const check = async (label, fn) => {
  try {
    return (await fn()) ? "ok" : `FAILED(${label})`;
  } catch (e) {
    return "BLOCKED:" + String(e.message).split("\n")[0].slice(0, 44);
  }
};

const served = originArg ? null : await serveDist();
const origin = originArg ?? served.origin;
console.log(`Clicking the Sign up button at ${origin}\n`);

let failures = 0;
let ran = 0;
for (const [engine, launcher] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await launcher.launch();
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    // Nothing is ever posted — see the header. This stub is why the script is
    // safe to point at the deployed site.
    await page.route("**/api/subscribe", (route) => route.fulfill({ status: 200, body: "{}" }));

    for (const path of PAGES) {
      await page.goto(origin + path, { waitUntil: "load" });
      const button = page.locator("button.newsletter__submit");
      const results = {};

      // A listener on the button itself, rather than trusting that click()
      // returning means the event arrived somewhere.
      results.click = await check("no event", async () => {
        await button.evaluate((node) => {
          node.dataset.clickProbe = "0";
          node.addEventListener("click", () => (node.dataset.clickProbe = "1"), { once: true });
        });
        await button.click({ timeout: 4000 });
        return (await button.getAttribute("data-click-probe")) === "1";
      });

      // The success copy is the only outward sign the whole path ran, which is
      // the same thing a visitor has to go on.
      results.submit = await check("no status", async () => {
        await page.fill("#newsletter-email", "clickable-check@example.invalid");
        await button.click({ timeout: 4000 });
        // Generous: waitForToken in NewsletterSignup.astro will sit for up to
        // six seconds if Turnstile has not written a token yet.
        await page.waitForFunction(
          () =>
            document
              .querySelector("[data-newsletter-status]")
              ?.textContent?.includes("on the list"),
          null,
          { timeout: 15000 },
        );
        return true;
      });

      results.palette = await check("no palette", async () => {
        await page.locator("[data-palette-dark]").click({ timeout: 4000 });
        return !!(await page.locator("html").getAttribute("data-palette"));
      });

      const bad = Object.values(results).filter((v) => v !== "ok").length;
      failures += bad;
      ran += 1;
      console.log(
        `${bad ? "FAIL" : "pass"}  ${engine.padEnd(9)} ${vp.name.padEnd(16)} ${path.padEnd(16)} ` +
          Object.entries(results)
            .map(([k, v]) => `${k}=${v}`)
            .join("  "),
      );
    }
    await context.close();
  }
  await browser.close();
}

served?.close();
console.log(
  failures
    ? `\n${failures} failure(s) across ${ran} cases.`
    : `\nAll ${ran} cases pass — the Sign up button is clickable in Chrome, Firefox and Safari.`,
);
process.exit(failures ? 1 : 0);

#!/usr/bin/env node
// Acceptance tests for the newsletter signup endpoint.
//
// What it proves: that POST /api/subscribe normalises and validates an address,
// honours the honeypot, refuses a bad Turnstile token, writes exactly one row
// per address, and that GET /api/health answers — against the real Functions
// runtime and a real (local) D1, not a mock.
//
// Why it exists: everything this checks is invisible from the browser. A form
// that silently drops every submission and a form that works look identical to
// the person filling it in — they both say "You're on the list." The only way
// to tell them apart is to post to the endpoint and then go and look in the
// database, which is exactly what this does.
//
// Usage:
//   npx wrangler d1 migrations apply jaan-newsletter --local   # once
//   npm run build
//   npx wrangler pages dev                                     # in another shell
//   npm run test:newsletter
//
//   node scripts/newsletter-check.mjs --origin http://localhost:8788
//
// Exit codes: 0 = every case passed, 1 = at least one failed (or the dev server
// is not running).
//
// Env:
//   NEWSLETTER_ORIGIN   same as --origin.
//   NEWSLETTER_REJECT=1 run the ONE case that needs a differently-configured
//                       server: with TURNSTILE_SECRET set to Turnstile's
//                       always-fails testing secret in .dev.vars, a valid
//                       submission must be rejected. See the README.
//
// Not covered here, and deliberately so — both need a state this script cannot
// create without breaking the thing it is testing:
//   • the 500 + alert-webhook path (spec test #9): break the DB binding by hand,
//     post once, confirm one message arrives carrying no email address.
//   • the production round trip: submit the real form on the deployed site.

import { execFileSync } from "node:child_process";

// ---- config ---------------------------------------------------------------
// The local database `wrangler pages dev` binds as DB. Row assertions are read
// back through wrangler rather than by opening the SQLite file, so this cannot
// drift from wherever wrangler decides to keep its state.
const DB = "jaan-newsletter";

const origin = (
  process.argv.find((a) => a.startsWith("--origin="))?.slice("--origin=".length) ??
  (process.argv.includes("--origin")
    ? process.argv[process.argv.indexOf("--origin") + 1]
    : undefined) ??
  process.env.NEWSLETTER_ORIGIN ??
  "http://localhost:8788"
).replace(/\/$/, "");

// Any string is accepted by Turnstile's always-passes testing secret; this is
// the value the matching testing site key actually produces in a browser.
const TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

const failures = [];
const rows = [];

const record = (name, ok, detail = "") => {
  rows.push({ name, ok, detail });
  if (!ok) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
};

/** POST a JSON body to the subscribe endpoint, exactly as the form does. */
async function subscribe(body) {
  const res = await fetch(`${origin}/api/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, headers: res.headers, body: await res.text() };
}

/** Rows currently in the local subscribers table, as objects. */
function query(sql) {
  const out = execFileSync(
    "npx",
    ["--no-install", "wrangler", "d1", "execute", DB, "--local", "--json", "--command", sql],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  // wrangler prints its banner before the JSON; take from the first bracket.
  const json = out.slice(out.indexOf("["));
  return JSON.parse(json)[0].results;
}

const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s);
const isIso = (s) => typeof s === "string" && !Number.isNaN(Date.parse(s)) && s.endsWith("Z");

// ---- run ------------------------------------------------------------------
try {
  await fetch(`${origin}/api/health`);
} catch {
  console.error(
    `Nothing is listening on ${origin}.\n` +
      `Start the Functions runtime first:  npm run build && npx wrangler pages dev`,
  );
  process.exit(1);
}

// A fresh table per run. Without this, case 1 passes only the first time and
// then trips over the row the previous run left behind.
execFileSync(
  "npx",
  [
    "--no-install",
    "wrangler",
    "d1",
    "execute",
    DB,
    "--local",
    "--command",
    "DELETE FROM subscribers",
  ],
  { stdio: "ignore" },
);

if (process.env.NEWSLETTER_REJECT === "1") {
  // The whole run, when the server is configured with the always-FAILS secret.
  const res = await subscribe({ email: "reject@example.com", token: TOKEN });
  record("5 · failing Turnstile secret → 400", res.status === 400, `got ${res.status}`);
  record("5 · failing Turnstile secret → no row", query("SELECT * FROM subscribers").length === 0);
} else {
  // 1 — the happy path, and what it wrote.
  const first = await subscribe({ email: "test@example.com", token: TOKEN });
  record("1 · valid signup → 200 {ok:true}", first.status === 200 && first.body === '{"ok":true}');
  let all = query("SELECT * FROM subscribers");
  record("1 · exactly one row", all.length === 1, `got ${all.length}`);
  const row = all[0] ?? {};
  record("1 · status defaults to active", row.status === "active", `got ${row.status}`);
  record("1 · unsubscribe_token is a UUID", isUuid(row.unsubscribe_token));
  record("1 · created_at is ISO 8601 UTC", isIso(row.created_at), `got ${row.created_at}`);
  const token = row.unsubscribe_token;

  // 2 — a repeat signup must be indistinguishable from the outside AND must
  // leave the existing row completely alone.
  const again = await subscribe({ email: "test@example.com", token: TOKEN });
  record("2 · repeat signup → same 200", again.status === 200 && again.body === first.body);
  all = query("SELECT * FROM subscribers WHERE email = 'test@example.com'");
  record("2 · still exactly one row", all.length === 1, `got ${all.length}`);
  record("2 · unsubscribe_token unchanged", all[0]?.unsubscribe_token === token);

  // 3 — normalisation. Two people typing the same address differently are one
  // subscriber, or the list mails them twice.
  await subscribe({ email: " Foo@Bar.COM ", token: TOKEN });
  record(
    "3 · ' Foo@Bar.COM ' stored as foo@bar.com",
    query("SELECT * FROM subscribers WHERE email = 'foo@bar.com'").length === 1,
  );

  // 4 — validation, including the RFC 5321 length cap.
  const before = query("SELECT * FROM subscribers").length;
  for (const bad of ["", "a", "a@b", `${"a".repeat(250)}@b.com`, "two words@example.com"]) {
    const res = await subscribe({ email: bad, token: TOKEN });
    record(
      `4 · rejects ${JSON.stringify(bad.slice(0, 24))} → 400`,
      res.status === 400,
      `got ${res.status}`,
    );
  }
  record("4 · no rows written", query("SELECT * FROM subscribers").length === before);

  // 6 — the honeypot. 200 so the bot believes it, and nothing written.
  const pot = await subscribe({ email: "bot@example.com", token: TOKEN, website: "http://spam" });
  record("6 · honeypot → 200 {ok:true}", pot.status === 200 && pot.body === '{"ok":true}');
  record(
    "6 · honeypot → no row",
    query("SELECT * FROM subscribers WHERE email = 'bot@example.com'").length === 0,
  );

  // 7 — a body that is not JSON at all.
  const junk = await subscribe("{not json");
  record("7 · malformed JSON → 400", junk.status === 400, `got ${junk.status}`);

  // 8 — what the uptime monitor polls.
  const health = await fetch(`${origin}/api/health`);
  record(
    "8 · GET /api/health → 200 {ok:true}",
    health.status === 200 && (await health.text()) === '{"ok":true}',
  );

  // 10 — the headers on every response. No CORS is the design (same-origin
  // form), and no-store keeps a 200 for one address off a shared cache.
  record("10 · no CORS headers", !first.headers.has("access-control-allow-origin"));
  record("10 · Cache-Control: no-store", first.headers.get("cache-control") === "no-store");
  record(
    "10 · JSON content type",
    (first.headers.get("content-type") ?? "").startsWith("application/json"),
  );
}

// ---- report ---------------------------------------------------------------
const width = Math.max(...rows.map((r) => r.name.length));
for (const r of rows) {
  console.log(
    `${r.ok ? "✔" : "✖"} ${r.name.padEnd(width)}${r.ok || !r.detail ? "" : `  ${r.detail}`}`,
  );
}
console.log(`\n${rows.length} checks · ${failures.length} failing · ${origin}`);

if (failures.length) {
  console.error(
    `\nFailing:\n${failures.map((f) => `  ${f}`).join("\n")}\n\n` +
      `The endpoint is functions/api/subscribe.ts; the table it writes to is\n` +
      `migrations/0001_init.sql. If everything failed at once, the likeliest\n` +
      `cause is a stale build — wrangler pages dev serves dist/, so re-run\n` +
      `npm run build after editing anything under src/.`,
  );
}
process.exit(failures.length ? 1 : 0);

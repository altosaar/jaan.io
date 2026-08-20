// POST /api/subscribe — the newsletter signup endpoint.
//
// Stage 1 is COLLECTION ONLY: a row lands in D1 and nothing is ever sent. No
// email provider, no confirmation mail, no unsubscribe route — see
// docs/newsletter.md for the boundary and what stage 2 would add.
//
// Deliberately absent, all for the same reason (this system stores the minimum
// that a mailing list can be run on, and nothing else):
//   • no CORS headers — the form is same-origin, so cross-origin callers should
//     fail; adding them would only widen the abuse surface.
//   • no `remoteip` on the Turnstile verification, and no IP or user-agent
//     column. The endpoint never handles an address it could store by accident.
//   • no distinct response for "already subscribed" — see the note on OK below.
import type { PagesFunction } from "@cloudflare/workers-types";

interface Env {
  DB: D1Database;
  TURNSTILE_SECRET: string;
  /**
   * An ntfy topic URL — https://ntfy.sh/<topic>. Optional: unset locally, and
   * alerting is simply skipped. The topic name IS the access control on
   * ntfy.sh, which is why the whole URL is a secret and not a constant here.
   */
  ALERT_WEBHOOK?: string;
  /**
   * ntfy account token. Optional, and it buys exactly one thing: email. ntfy.sh
   * refuses anonymous email forwarding (abuse), so without a token an alert is
   * a push notification only — which nobody sees if the phone is face-down.
   */
  ALERT_NTFY_TOKEN?: string;
}

/** Every response is JSON and must never be cached — including the 400s. */
const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: HEADERS });

// The 200 is byte-identical whether the address was new, already on the list,
// or silently dropped as a bot. A caller must not be able to use this form to
// learn who is subscribed.
const OK = () => json({ ok: true }, 200);
const BAD = () => json({ ok: false }, 400);

/** Trimmed, lowercased, and shaped like an address. Length cap is RFC 5321's. */
function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

async function verifyTurnstile(secret: string, token: unknown): Promise<boolean> {
  if (typeof token !== "string" || token === "") return false;
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const outcome = (await res.json()) as { success?: boolean };
  return outcome.success === true;
}

/**
 * Fire-and-forget alert on an unexpected failure, published to an ntfy topic
 * that fans out to a phone push and an email. Two rules:
 *   1. It must never delay or break the response — the caller hands this to
 *      ctx.waitUntil and never awaits it.
 *   2. The message must never contain the submitted address or any part of the
 *      request body. An alert channel is not a place subscriber data may leak
 *      to, and an alert about a malformed submission would otherwise carry one.
 */
function alert(env: Env, error: unknown): Promise<unknown> {
  if (!env.ALERT_WEBHOOK) return Promise.resolve();
  const message = error instanceof Error ? error.message : String(error);

  // ntfy's plain-text publish: the body is the message, everything else is a
  // header. The error text stays in the BODY on purpose — header values are
  // ASCII-only, and a stack message carrying a smart quote would make the
  // request itself invalid.
  const headers: Record<string, string> = {
    "Content-Type": "text/plain",
    Title: "jaan.io newsletter",
    Priority: "high",
    Tags: "rotating_light",
  };
  // `Email: yes` sends to the account's primary VERIFIED address, so the
  // address itself never appears in this public repo. It is gated on the token
  // because ntfy.sh rejects anonymous email outright (error 40053) — and that
  // rejection fails the whole publish, taking the push notification with it.
  if (env.ALERT_NTFY_TOKEN) {
    headers.Authorization = `Bearer ${env.ALERT_NTFY_TOKEN}`;
    headers.Email = "yes";
  }

  return fetch(env.ALERT_WEBHOOK, {
    method: "POST",
    headers,
    body: `subscribe error: ${message.slice(0, 500)}`,
  }).catch(() => {
    // An alert that cannot be delivered is not itself an incident worth
    // escalating — and rethrowing here would take down the request.
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    let body: { email?: unknown; token?: unknown; website?: unknown };
    try {
      body = await request.json();
    } catch {
      return BAD();
    }

    // Honeypot. A field no human sees and no browser autofills; anything that
    // filled it is scripted. Answer 200 so the bot logs a success and moves on
    // rather than probing for what gave it away.
    if (typeof body.website === "string" && body.website !== "") return OK();

    const email = normalizeEmail(body.email);
    if (!email) return BAD();

    if (!(await verifyTurnstile(env.TURNSTILE_SECRET, body.token))) return BAD();

    // OR IGNORE, not upsert: a repeat signup must leave the existing row alone,
    // so created_at stays the real consent timestamp and unsubscribe_token stays
    // the one already minted (a rotated token would break any link already sent).
    await env.DB.prepare(
      "INSERT OR IGNORE INTO subscribers (email, created_at, unsubscribe_token) VALUES (?1, ?2, ?3)",
    )
      .bind(email, new Date().toISOString(), crypto.randomUUID())
      .run();

    return OK();
  } catch (error) {
    context.waitUntil(alert(env, error));
    return json({ ok: false }, 500);
  }
};

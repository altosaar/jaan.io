// POST /api/unsubscribe?t=<unsubscribe_token> — the way off the list.
//
// The counterpart to subscribe.ts, and the thing stage 1 deliberately did not
// have because there was nothing yet to unsubscribe FROM. Sending now happens
// (from a laptop, out of the jaan.io-newsletter repo — nothing that sends is
// deployed), so this is the other half.
//
// ── POST ONLY, AND THAT IS THE WHOLE DESIGN ────────────────────────────────
// There is no onRequestGet here on purpose. Corporate mail gateways and link
// scanners — Proofpoint, Mimecast, Defender, and Gmail's own image proxy —
// fetch every URL in a message before the recipient ever sees it. An endpoint
// that unsubscribes on GET therefore unsubscribes people who never clicked, and
// does it silently. The link in the email points at /unsubscribe, a static page
// that asks; this endpoint is what that page's button posts to.
//
// It also has to be a POST for RFC 8058: the List-Unsubscribe-Post header the
// newsletter carries promises Gmail and Apple Mail that a POST here needs no
// confirmation step, which is what puts a native Unsubscribe control in their
// chrome. Both bodies land in the same handler — the one-click form post and
// the confirmation page's fetch — because the token in the query string is the
// only input either of them carries.
//
// ── WHAT IT DOES NOT DO ────────────────────────────────────────────────────
// No CORS headers (the page is same-origin, like the signup form). No Turnstile:
// a challenge on the exit is a dark pattern, and the token is already an
// unguessable secret that only its owner was ever sent. No IP, no logging of
// the address, for the same reason subscribe.ts stores neither.
import type { PagesFunction } from "@cloudflare/workers-types";

interface Env {
  DB: D1Database;
}

const HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: HEADERS });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const token = new URL(request.url).searchParams.get("t");

  // A UUID, because that is what subscribe.ts mints with crypto.randomUUID().
  // Shape-checking before touching D1 keeps a scan of junk tokens off the
  // database entirely.
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return json({ ok: false }, 400);
  }

  try {
    // UPDATE, not DELETE. A deleted row is silently re-created the next time
    // that address goes through the signup form — someone's opt-out would
    // evaporate the moment they, or a colleague, typed it in again. `status`
    // exists precisely so that leaving is a state and not an absence.
    //
    // The WHERE deliberately does NOT filter on status: unsubscribing twice
    // must succeed. Gmail retries the one-click POST, people click the button
    // and then click it again, and a second attempt that answered "not found"
    // would tell somebody who has already left that it did not work. SQLite
    // counts a row the UPDATE matched whether or not the value changed, so a
    // repeat is `changes: 1` and lands in the 200 below.
    const { meta } = await env.DB.prepare(
      "UPDATE subscribers SET status = 'unsubscribed' WHERE unsubscribe_token = ?1",
    )
      .bind(token)
      .run();

    // A token that matches nothing is a 404, and this is the one place this API
    // is allowed to tell two cases apart. It is not the membership oracle that
    // subscribe.ts refuses to be: that endpoint takes an ADDRESS, which anybody
    // can guess, while this one takes a 122-bit secret that was only ever sent
    // to its owner. And the confirmation page needs the distinction — it has to
    // be able to say "this link is no longer valid" rather than report success
    // for a click that did nothing.
    if (!meta.changes) return json({ ok: false }, 404);

    return json({ ok: true }, 200);
  } catch {
    // Deliberately says nothing about the address or the error — the same rule
    // subscribe.ts follows for its alerts.
    return json({ ok: false }, 500);
  }
};

// GET /api/health — the endpoint an external uptime monitor polls every five
// minutes. Green means the Function deployed, the DB binding exists, and D1 is
// answering; that trio is what actually breaks (a bad deploy, a missing binding
// after a settings change, a D1 daily quota exhausted at some point before
// 00:00 UTC) and none of it is visible from inside the subscribe handler.
//
// It deliberately does NOT call the alert webhook. The monitor owns alerting
// here: if D1 is down and this fired its own alert, a 5-minute poll would post
// 288 messages a day into the same channel that stage-1 errors use.
import type { PagesFunction } from "@cloudflare/workers-types";

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  try {
    // The cheapest possible proof that the binding resolves and D1 responds.
    // Nothing about the table, the row count, or the timing is exposed — a
    // health endpoint is public, and subscriber-list size is not public.
    await env.DB.prepare("SELECT 1").first();
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 503, headers });
  }
};

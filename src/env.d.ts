/// <reference path="../.astro/types.d.ts" />

// Build-time public env. `PUBLIC_` is Astro's prefix for values that are
// inlined into the shipped HTML/JS — which is correct for a Turnstile SITE key
// (it is meant to be read by the browser) and would be a leak for anything
// else. The Turnstile SECRET is a Cloudflare Pages secret read by
// functions/api/subscribe.ts and never enters the Astro build.
//
// Declared here so `astro check` catches a typo in the name rather than handing
// the component `undefined` at build time. See .env.example.
interface ImportMetaEnv {
  readonly PUBLIC_TURNSTILE_SITE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

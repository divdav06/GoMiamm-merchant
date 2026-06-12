import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Basic Cloudflare adapter config. No incremental/ISR cache binding is
// configured because the merchant dashboard is fully dynamic SSR (no ISR
// pages) — add an R2/KV incremental cache here later if static caching is
// introduced. Node runtime is preserved (nodejs_compat in wrangler.jsonc),
// so Supabase SSR + the fetch-based Stripe wrapper run unchanged.
export default defineCloudflareConfig();

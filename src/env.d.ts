/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

/** Wrangler bindings + Astro static assets (`ASSETS`) */
declare namespace Cloudflare {
  interface Env {
    R2: R2Bucket;
    DB: KVNamespace;
    MAX_FILE_SIZE: string;
    WORKER_URL: string;
    ASSETS: Fetcher;
  }
}

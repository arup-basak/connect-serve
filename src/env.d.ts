/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

/** Wrangler bindings + Astro static assets (`ASSETS`) */
declare namespace Cloudflare {
  interface Env {
    R2: R2Bucket;
    MAX_FILE_SIZE: string;
    WORKER_URL: string;
    UPSTASH_REDIS_REST_URL: string;
    UPSTASH_REDIS_REST_TOKEN: string;
    ASSETS: Fetcher;
  }
}

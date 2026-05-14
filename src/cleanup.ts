import type { Bindings } from "./types";
import { getRedis } from "./lib/upstash";

// Runs on cron schedule (every 15 minutes via wrangler.toml).
// Reads the `cleanup:r2` sorted set for r2Keys whose expiresAt has passed,
// deletes them from R2, then removes them from the set. Session records in
// Redis auto-expire via EX, so we only need to chase R2 here.
export async function runCleanup(env: Bindings): Promise<void> {
  const redis = getRedis(env);
  const now = Date.now();

  const expired = await redis.zrange<string[]>("cleanup:r2", 0, now, {
    byScore: true,
  });

  if (expired.length === 0) {
    console.log("[cleanup] no expired sessions");
    return;
  }

  for (const r2Key of expired) {
    await env.R2.delete(r2Key).catch(() => {});
  }

  await redis.zremrangebyscore("cleanup:r2", 0, now);
  console.log(`[cleanup] Deleted ${expired.length} expired R2 object(s)`);
}

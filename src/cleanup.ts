import type { Bindings, SessionRecord } from "./types";

// Runs on cron schedule (every 15 minutes via wrangler.toml)
// Scans all KV sessions and deletes expired ones from both KV and R2.
// Belt-and-suspenders alongside KV's own expirationTtl.
export async function runCleanup(env: Bindings): Promise<void> {
  const now = Date.now();
  let cursor: string | undefined;
  let deleted = 0;

  do {
    const list = await env.DB.list({ prefix: "session:", cursor, limit: 100 });

    for (const key of list.keys) {
      const raw = await env.DB.get(key.name);
      if (!raw) continue;

      let session: SessionRecord;
      try {
        session = JSON.parse(raw);
      } catch {
        // corrupt entry — clean it up
        await env.DB.delete(key.name);
        continue;
      }

      if (now > session.expiresAt) {
        // Delete object from R2 (ignore 404 — already gone)
        await env.R2.delete(session.r2Key).catch(() => {});
        await env.DB.delete(key.name);
        deleted++;
      }
    }

    cursor = list.list_complete ? undefined : (list as any).cursor;
  } while (cursor);

  console.log(`[cleanup] Deleted ${deleted} expired session(s)`);
}

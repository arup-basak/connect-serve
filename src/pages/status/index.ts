import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { SessionRecord } from "../../types";
import { jsonResponse } from "../../lib/api-common";
import { getRedis } from "../../lib/upstash";

export const GET: APIRoute = async ({ request }) => {
  const redis = getRedis(env);
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session");
  if (!sessionId) return jsonResponse({ error: "session required" }, 400);

  const session = await redis.get<SessionRecord>(`session:${sessionId}`);
  if (!session) {
    return jsonResponse({ ready: false, expired: true });
  }

  if (Date.now() > session.expiresAt) {
    return jsonResponse({ ready: false, expired: true });
  }

  return jsonResponse({
    ready: session.complete,
    fileName: session.fileName,
    fileSize: session.fileSize,
    mimeType: session.mimeType,
    expiresAt: session.expiresAt,
    passwordProtected: !!session.passwordHash,
  });
};

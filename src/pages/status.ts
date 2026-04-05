import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { SessionRecord } from "../types";
import { jsonResponse, parseSessionRecord } from "../lib/api-common";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session");
  if (!sessionId) return jsonResponse({ error: "session required" }, 400);

  const raw = await env.DB.get(`session:${sessionId}`);
  if (!raw) {
    return jsonResponse({ ready: false, expired: true });
  }

  const session: SessionRecord = parseSessionRecord(raw);

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

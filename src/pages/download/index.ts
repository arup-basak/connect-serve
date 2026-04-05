import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { SessionRecord } from "../../types";
import { hashPassword, jsonResponse, parseSessionRecord } from "../../lib/api-common";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session");
  if (!sessionId) return jsonResponse({ error: "session required" }, 400);

  const raw = await env.DB.get(`session:${sessionId}`);
  if (!raw) return jsonResponse({ error: "Session not found or expired" }, 404);

  const session: SessionRecord = parseSessionRecord(raw);

  if (!session.complete) {
    return jsonResponse({ error: "Upload not complete yet" }, 425);
  }

  if (Date.now() > session.expiresAt) {
    return jsonResponse({ error: "File has expired and been deleted" }, 410);
  }

  if (session.passwordHash) {
    const provided =
      url.searchParams.get("password") ?? request.headers.get("X-Password") ?? "";
    if (!provided) {
      return jsonResponse(
        { error: "Password required", passwordRequired: true },
        401,
      );
    }
    if ((await hashPassword(provided)) !== session.passwordHash) {
      return jsonResponse({ error: "Incorrect password" }, 403);
    }
  }

  const rangeHeader = request.headers.get("range");
  const object = rangeHeader
    ? await env.R2.get(session.r2Key, {
        range: request.headers,
      })
    : await env.R2.get(session.r2Key);

  if (!object) {
    return jsonResponse({ error: "File not found in storage" }, 404);
  }

  const safeFileName = encodeURIComponent(session.fileName);
  const status = rangeHeader ? 206 : 200;

  const headers = new Headers({
    "Content-Type": session.mimeType || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${session.fileName}"; filename*=UTF-8''${safeFileName}`,
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
  });

  if (object.size) headers.set("Content-Length", String(object.size));
  object.writeHttpMetadata(headers);

  return new Response(object.body, { status, headers });
};

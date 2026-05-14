import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { SessionRecord } from "../../types";
import { jsonResponse } from "../../lib/api-common";
import { getRedis } from "../../lib/upstash";

export const PUT: APIRoute = async ({ request }) => {
  const redis = getRedis(env);
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session");
  const partStr = url.searchParams.get("part");

  if (!sessionId || !partStr) {
    return jsonResponse({ error: "session and part query params required" }, 400);
  }

  const partNumber = parseInt(partStr, 10);
  if (isNaN(partNumber) || partNumber < 1 || partNumber > 10000) {
    return jsonResponse(
      { error: "part must be an integer between 1 and 10000" },
      400,
    );
  }

  const session = await redis.get<SessionRecord>(`session:${sessionId}`);
  if (!session) return jsonResponse({ error: "Session not found or expired" }, 404);

  if (session.complete) {
    return jsonResponse({ error: "Upload already completed" }, 409);
  }

  if (Date.now() > session.expiresAt) {
    return jsonResponse({ error: "Session expired" }, 410);
  }

  const body = request.body;
  if (!body) return jsonResponse({ error: "No body provided" }, 400);

  const multipart = env.R2.resumeMultipartUpload(session.r2Key, session.uploadId);
  let part: R2UploadedPart;
  try {
    part = await multipart.uploadPart(partNumber, body);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: "R2 upload failed: " + msg }, 502);
  }

  const existingIdx = session.parts.findIndex((p) => p.partNumber === partNumber);
  if (existingIdx >= 0) {
    session.parts[existingIdx] = { partNumber, etag: part.etag };
  } else {
    session.parts.push({ partNumber, etag: part.etag });
  }

  const remainingTtl = Math.max(
    1,
    Math.ceil((session.expiresAt - Date.now()) / 1000),
  );
  await redis.set(`session:${sessionId}`, session, { ex: remainingTtl });

  return jsonResponse({ partNumber, etag: part.etag });
};

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { CompleteBody, SessionRecord } from "../../types";
import { jsonResponse, parseSessionRecord } from "../../lib/api-common";

export const POST: APIRoute = async ({ request }) => {
  let body: CompleteBody;
  try {
    body = (await request.json()) as CompleteBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { sessionId } = body;
  if (!sessionId) return jsonResponse({ error: "sessionId required" }, 400);

  const raw = await env.DB.get(`session:${sessionId}`);
  if (!raw) return jsonResponse({ error: "Session not found or expired" }, 404);

  const session: SessionRecord = parseSessionRecord(raw);

  if (session.complete) {
    return jsonResponse({
      shareLink: `${env.WORKER_URL}/receive?session=${sessionId}`,
    });
  }

  if (session.parts.length === 0) {
    return jsonResponse({ error: "No parts uploaded yet" }, 400);
  }

  const sortedParts = [...session.parts].sort((a, b) => a.partNumber - b.partNumber);

  const multipart = env.R2.resumeMultipartUpload(session.r2Key, session.uploadId);
  try {
    await multipart.complete(sortedParts);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: "R2 complete failed: " + msg }, 502);
  }

  session.complete = true;
  session.parts = sortedParts;

  const remainingTtl = Math.max(
    60,
    Math.ceil((session.expiresAt - Date.now()) / 1000),
  );
  await env.DB.put(`session:${sessionId}`, JSON.stringify(session), {
    expirationTtl: remainingTtl,
  });

  return jsonResponse({
    shareLink: `${env.WORKER_URL}/receive?session=${sessionId}`,
    expiresAt: session.expiresAt,
  });
};

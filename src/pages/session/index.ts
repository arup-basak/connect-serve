import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { CreateSessionBody, SessionRecord } from "../../types";
import {
  ALLOWED_TTLS,
  TTL_DEFAULT,
  TTL_MAX,
  MAX_FILE_SIZE_DEFAULT,
  hashPassword,
  jsonResponse,
} from "../../lib/api-common";

export const POST: APIRoute = async ({ request }) => {
  const maxFileSize =
    parseInt(env.MAX_FILE_SIZE ?? "") || MAX_FILE_SIZE_DEFAULT;

  let body: CreateSessionBody;
  try {
    body = (await request.json()) as CreateSessionBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { fileName, fileSize, mimeType, checksum, ttl: requestedTtl, password } =
    body;

  if (!fileName || !fileSize || !mimeType) {
    return jsonResponse(
      { error: "fileName, fileSize, and mimeType are required" },
      400,
    );
  }

  if (fileSize > maxFileSize) {
    return jsonResponse(
      { error: `File exceeds ${maxFileSize / (1024 * 1024)} MB limit` },
      413,
    );
  }

  const ttlSeconds =
    requestedTtl && ALLOWED_TTLS.has(requestedTtl)
      ? Math.min(requestedTtl, TTL_MAX)
      : TTL_DEFAULT;

  const sessionId = crypto.randomUUID();
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const r2Key = `transfers/${sessionId}/${safeFileName}`;
  const expiresAt = Date.now() + ttlSeconds * 1000;

  const multipart = await env.R2.createMultipartUpload(r2Key, {
    httpMetadata: { contentType: mimeType },
    customMetadata: {
      originalName: fileName,
      checksum: checksum ?? "",
      expiresAt: String(expiresAt),
    },
  });

  const record: SessionRecord = {
    uploadId: multipart.uploadId,
    r2Key,
    fileName,
    fileSize,
    mimeType,
    checksum: checksum ?? "",
    expiresAt,
    parts: [],
    complete: false,
    ...(password ? { passwordHash: await hashPassword(password) } : {}),
  };

  await env.DB.put(`session:${sessionId}`, JSON.stringify(record), {
    expirationTtl: ttlSeconds,
  });

  return jsonResponse({
    sessionId,
    uploadId: multipart.uploadId,
    expiresAt,
  });
};

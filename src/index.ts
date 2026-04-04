import { Hono } from "hono";
import { cors } from "hono/cors";
import type {
  Bindings,
  SessionRecord,
  CreateSessionBody,
  CompleteBody,
} from "./types";
import { receivePageHtml } from "./pages/receive";
import { indexPageHtml } from "./pages/index";
import { docsPageHtml } from "./pages/docs";
import { runCleanup } from "./cleanup";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const buf  = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Constants ────────────────────────────────────────────────────────────────
const TTL_DEFAULT  = 60 * 60;           // 1 hour (used when caller omits ttl)
const TTL_MAX      = 7 * 24 * 60 * 60; // 7 days hard ceiling
const MAX_FILE_SIZE_DEFAULT = 512 * 1024 * 1024; // 512 MB
// R2 multipart minimum is 5 MB for all parts except the last.
// Clients MUST use this chunk size (or larger) to avoid EntityTooSmall errors.
const MIN_PART_SIZE = 5 * 1024 * 1024; // 5 MB

// Discrete TTL values the API accepts (seconds). Anything else is rejected.
const ALLOWED_TTLS = new Set([
  15 * 60,          // 15 min
  60 * 60,          // 1 hour
  6  * 60 * 60,     // 6 hours
  24 * 60 * 60,     // 1 day
  3  * 24 * 60 * 60,// 3 days
  7  * 24 * 60 * 60,// 7 days
]);

// ── App ──────────────────────────────────────────────────────────────────────
const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "PUT", "OPTIONS"] }));

// ── HTML Pages ───────────────────────────────────────────────────────────────

app.get("/", (c) => {
  return c.html(indexPageHtml(c.env.WORKER_URL));
});

app.get("/docs", (c) => {
  return c.html(docsPageHtml());
});

// Browser opens this URL from the share link the Mac app generates.
app.get("/receive", (c) => {
  return c.html(receivePageHtml(c.env.WORKER_URL));
});

// ── Health ───────────────────────────────────────────────────────────────────

app.get("/health", (c) => c.json({ ok: true }));

// ── 1. Create session + initiate R2 multipart upload ─────────────────────────

app.post("/session", async (c) => {
  const maxFileSize =
    parseInt(c.env.MAX_FILE_SIZE ?? "") || MAX_FILE_SIZE_DEFAULT;

  let body: CreateSessionBody;
  try {
    body = await c.req.json<CreateSessionBody>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { fileName, fileSize, mimeType, checksum, ttl: requestedTtl, password } = body;

  if (!fileName || !fileSize || !mimeType) {
    return c.json({ error: "fileName, fileSize, and mimeType are required" }, 400);
  }

  if (fileSize > maxFileSize) {
    return c.json({ error: `File exceeds ${maxFileSize / (1024 * 1024)} MB limit` }, 413);
  }

  // Resolve TTL: use caller value if it's one of the allowed presets, else default.
  const ttlSeconds = requestedTtl && ALLOWED_TTLS.has(requestedTtl)
    ? Math.min(requestedTtl, TTL_MAX)
    : TTL_DEFAULT;

  const sessionId = crypto.randomUUID();
  // Sanitise filename for use as an R2 key segment
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const r2Key = `transfers/${sessionId}/${safeFileName}`;
  const expiresAt = Date.now() + ttlSeconds * 1000;

  // Initiate R2 multipart upload
  const multipart = await c.env.R2.createMultipartUpload(r2Key, {
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

  await c.env.DB.put(`session:${sessionId}`, JSON.stringify(record), {
    expirationTtl: ttlSeconds,
  });

  return c.json({ sessionId, uploadId: multipart.uploadId, expiresAt });
});

// ── 2. Proxy chunk PUT → R2 multipart part ───────────────────────────────────
// The Mac app PUTs raw bytes here. We stream directly into the R2 part.
// This avoids buffering the chunk in Worker memory beyond what Workers allows.

app.put("/upload-part", async (c) => {
  const sessionId = c.req.query("session");
  const partStr = c.req.query("part");

  if (!sessionId || !partStr) {
    return c.json({ error: "session and part query params required" }, 400);
  }

  const partNumber = parseInt(partStr, 10);
  if (isNaN(partNumber) || partNumber < 1 || partNumber > 10000) {
    return c.json({ error: "part must be an integer between 1 and 10000" }, 400);
  }

  const raw = await c.env.DB.get(`session:${sessionId}`);
  if (!raw) return c.json({ error: "Session not found or expired" }, 404);

  const session: SessionRecord = JSON.parse(raw);

  if (session.complete) {
    return c.json({ error: "Upload already completed" }, 409);
  }

  if (Date.now() > session.expiresAt) {
    return c.json({ error: "Session expired" }, 410);
  }

  const body = c.req.raw.body;
  if (!body) return c.json({ error: "No body provided" }, 400);

  // Resume multipart and upload this part
  const multipart = c.env.R2.resumeMultipartUpload(session.r2Key, session.uploadId);
  let part: R2UploadedPart;
  try {
    part = await multipart.uploadPart(partNumber, body);
  } catch (err: any) {
    return c.json({ error: "R2 upload failed: " + (err?.message ?? err) }, 502);
  }

  // Upsert this part in the session record (idempotent — overwrite on retry)
  const existingIdx = session.parts.findIndex((p) => p.partNumber === partNumber);
  if (existingIdx >= 0) {
    session.parts[existingIdx] = { partNumber, etag: part.etag };
  } else {
    session.parts.push({ partNumber, etag: part.etag });
  }

  // Persist updated parts list — preserve the original TTL the session was created with
  const remainingTtl = Math.max(60, Math.ceil((session.expiresAt - Date.now()) / 1000));
  await c.env.DB.put(`session:${sessionId}`, JSON.stringify(session), {
    expirationTtl: remainingTtl,
  });

  return c.json({ partNumber, etag: part.etag });
});

// ── 3. Complete multipart upload ─────────────────────────────────────────────

app.post("/complete", async (c) => {
  let body: CompleteBody;
  try {
    body = await c.req.json<CompleteBody>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { sessionId } = body;
  if (!sessionId) return c.json({ error: "sessionId required" }, 400);

  const raw = await c.env.DB.get(`session:${sessionId}`);
  if (!raw) return c.json({ error: "Session not found or expired" }, 404);

  const session: SessionRecord = JSON.parse(raw);

  if (session.complete) {
    // Idempotent — return share link again
    return c.json({
      shareLink: `${c.env.WORKER_URL}/receive?session=${sessionId}`,
    });
  }

  if (session.parts.length === 0) {
    return c.json({ error: "No parts uploaded yet" }, 400);
  }

  // Parts must be sorted by partNumber for R2 to assemble correctly
  const sortedParts = [...session.parts].sort((a, b) => a.partNumber - b.partNumber);

  const multipart = c.env.R2.resumeMultipartUpload(session.r2Key, session.uploadId);
  try {
    await multipart.complete(sortedParts);
  } catch (err: any) {
    return c.json({ error: "R2 complete failed: " + (err?.message ?? err) }, 502);
  }

  session.complete = true;
  session.parts = sortedParts; // store final sorted list

  const remainingTtl = Math.max(60, Math.ceil((session.expiresAt - Date.now()) / 1000));
  await c.env.DB.put(`session:${sessionId}`, JSON.stringify(session), {
    expirationTtl: remainingTtl,
  });

  return c.json({
    shareLink: `${c.env.WORKER_URL}/receive?session=${sessionId}`,
    expiresAt: session.expiresAt,
  });
});

// ── 4. Session status (browser polls this) ───────────────────────────────────

app.get("/status", async (c) => {
  const sessionId = c.req.query("session");
  if (!sessionId) return c.json({ error: "session required" }, 400);

  const raw = await c.env.DB.get(`session:${sessionId}`);
  if (!raw) {
    return c.json({ ready: false, expired: true });
  }

  const session: SessionRecord = JSON.parse(raw);

  if (Date.now() > session.expiresAt) {
    return c.json({ ready: false, expired: true });
  }

  return c.json({
    ready: session.complete,
    fileName: session.fileName,
    fileSize: session.fileSize,
    mimeType: session.mimeType,
    expiresAt: session.expiresAt,
    passwordProtected: !!session.passwordHash,
  });
});

// ── 5. Download — stream from R2 to browser ──────────────────────────────────

app.get("/download", async (c) => {
  const sessionId = c.req.query("session");
  if (!sessionId) return c.json({ error: "session required" }, 400);

  const raw = await c.env.DB.get(`session:${sessionId}`);
  if (!raw) return c.json({ error: "Session not found or expired" }, 404);

  const session: SessionRecord = JSON.parse(raw);

  if (!session.complete) {
    return c.json({ error: "Upload not complete yet" }, 425);
  }

  if (Date.now() > session.expiresAt) {
    return c.json({ error: "File has expired and been deleted" }, 410);
  }

  // Password check — only if this session was created with a password
  if (session.passwordHash) {
    const provided = c.req.query("password") ?? c.req.header("X-Password") ?? "";
    if (!provided) {
      return c.json({ error: "Password required", passwordRequired: true }, 401);
    }
    if ((await hashPassword(provided)) !== session.passwordHash) {
      return c.json({ error: "Incorrect password" }, 403);
    }
  }

  // Support HTTP range requests — R2 handles them natively.
  const rangeHeader = c.req.header("range");
  const object = rangeHeader
    ? await c.env.R2.get(session.r2Key, {
        range: c.req.raw.headers,
      })
    : await c.env.R2.get(session.r2Key);

  if (!object) {
    return c.json({ error: "File not found in storage" }, 404);
  }

  const safeFileName = encodeURIComponent(session.fileName);
  const status = rangeHeader ? 206 : 200;

  const headers = new Headers({
    "Content-Type": session.mimeType || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${session.fileName}"; filename*=UTF-8''${safeFileName}`,
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
  });

  // Attach content length and range headers from R2 response
  if (object.size) headers.set("Content-Length", String(object.size));
  object.writeHttpMetadata(headers);

  return new Response(object.body, { status, headers });
});

// ── Cron export (cleanup handler) ───────────────────────────────────────────

export default {
  fetch: app.fetch,

  async scheduled(_event: ScheduledEvent, env: Bindings): Promise<void> {
    await runCleanup(env);
  },
};

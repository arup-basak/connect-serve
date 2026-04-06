import type { SessionRecord } from "../types";

export const TTL_DEFAULT = 60 * 60;
export const TTL_MAX = 7 * 24 * 60 * 60;
export const MAX_FILE_SIZE_DEFAULT = 512 * 1024 * 1024;

export const ALLOWED_TTLS = new Set([
  15 * 60,
  60 * 60,
  6 * 60 * 60,
  24 * 60 * 60,
  3 * 24 * 60 * 60,
  7 * 24 * 60 * 60,
]);

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function parseSessionRecord(raw: string): SessionRecord {
  return JSON.parse(raw) as SessionRecord;
}

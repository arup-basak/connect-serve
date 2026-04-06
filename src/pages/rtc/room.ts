import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { RTCRoomRecord } from "../../types";
import { jsonResponse } from "../../lib/api-common";

export const POST: APIRoute = async () => {
  // 6-character alphanumeric room ID — easy to share verbally
  const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();

  const record: RTCRoomRecord = {
    roomId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  };

  await env.DB.put(`rtc:${roomId}`, JSON.stringify(record), {
    expirationTtl: 600,
  });

  return jsonResponse({ roomId });
};

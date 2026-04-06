import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import type { RTCRoomRecord } from "../../types";
import { jsonResponse } from "../../lib/api-common";

export const GET: APIRoute = async ({ url }) => {
  const roomId = url.searchParams.get("room");
  if (!roomId) return jsonResponse({ error: "Missing room" }, 400);

  const raw = await env.DB.get(`rtc:${roomId}`);
  if (!raw) return jsonResponse({ error: "Room not found or expired" }, 404);

  return jsonResponse(JSON.parse(raw) as RTCRoomRecord);
};

export const POST: APIRoute = async ({ request }) => {
  let body: { roomId: string; type: "offer" | "answer"; sdp: { type: string; sdp: string } };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { roomId, type, sdp } = body;
  if (!roomId || !type || !sdp) {
    return jsonResponse({ error: "roomId, type, and sdp are required" }, 400);
  }

  const raw = await env.DB.get(`rtc:${roomId}`);
  if (!raw) return jsonResponse({ error: "Room not found or expired" }, 404);

  const record = JSON.parse(raw) as RTCRoomRecord;

  if (type === "offer") {
    record.offer = sdp;
  } else if (type === "answer") {
    record.answer = sdp;
  } else {
    return jsonResponse({ error: "type must be offer or answer" }, 400);
  }

  const ttlSec = Math.max(60, Math.floor((record.expiresAt - Date.now()) / 1000));
  await env.DB.put(`rtc:${roomId}`, JSON.stringify(record), {
    expirationTtl: ttlSec,
  });

  return jsonResponse({ ok: true });
};

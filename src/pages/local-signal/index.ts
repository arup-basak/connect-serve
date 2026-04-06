import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { jsonResponse } from "../../lib/api-common";

const LOCAL_TTL = 5 * 60; // 5 minutes

interface LocalRoom {
  offerSdp: string;
  answerSdp?: string;
  targetDeviceId?: string;
  senderName?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  password?: string;
  createdAt: number;
}

interface IncomingTransfer {
  roomId: string;
  senderName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  passwordProtected?: boolean;
}

function roomKey(roomId: string) {
  return `local:${roomId.toUpperCase()}`;
}

function incomingKey(deviceId: string) {
  return `incoming:${deviceId}`;
}

export const GET: APIRoute = async ({ url }) => {
  const roomId = url.searchParams.get("roomId");
  const deviceId = url.searchParams.get("deviceId");

  if (roomId) {
    const raw = await env.DB.get(roomKey(roomId));
    if (!raw) return jsonResponse({ error: "Room not found" }, 404);
    const room = JSON.parse(raw) as LocalRoom;
    // Never expose the actual password over the wire
    const { password: _pw, ...safeRoom } = room;
    return jsonResponse({ ...safeRoom, passwordProtected: !!room.password });
  }

  if (deviceId) {
    const raw = await env.DB.get(incomingKey(deviceId));
    if (!raw) return jsonResponse({ incoming: null });
    return jsonResponse({ incoming: JSON.parse(raw) as IncomingTransfer });
  }

  return jsonResponse({ error: "roomId or deviceId required" }, 400);
};

export const POST: APIRoute = async ({ request }) => {
  let body: {
    action: string;
    offerSdp?: string;
    answerSdp?: string;
    roomId?: string;
    targetDeviceId?: string;
    senderName?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    password?: string;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  if (body.action === "create") {
    if (!body.offerSdp) return jsonResponse({ error: "offerSdp required" }, 400);

    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const roomId = Array.from(bytes)
      .map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32])
      .join("")
      .slice(0, 6);

    const room: LocalRoom = {
      offerSdp: body.offerSdp,
      targetDeviceId: body.targetDeviceId,
      senderName: body.senderName,
      fileName: body.fileName,
      fileSize: body.fileSize,
      mimeType: body.mimeType,
      password: body.password || undefined,
      createdAt: Date.now(),
    };
    await env.DB.put(roomKey(roomId), JSON.stringify(room), {
      expirationTtl: LOCAL_TTL,
    });

    // Write incoming record so receiver can discover this transfer
    if (body.targetDeviceId && body.fileName) {
      const incoming: IncomingTransfer = {
        roomId,
        senderName: body.senderName ?? "Someone",
        fileName: body.fileName,
        fileSize: body.fileSize ?? 0,
        mimeType: body.mimeType ?? "application/octet-stream",
        passwordProtected: !!body.password,
      };
      await env.DB.put(incomingKey(body.targetDeviceId), JSON.stringify(incoming), {
        expirationTtl: LOCAL_TTL,
      });
    }

    return jsonResponse({ roomId });
  }

  if (body.action === "answer") {
    if (!body.roomId) return jsonResponse({ error: "roomId required" }, 400);
    if (!body.answerSdp) return jsonResponse({ error: "answerSdp required" }, 400);

    const raw = await env.DB.get(roomKey(body.roomId));
    if (!raw) return jsonResponse({ error: "Room not found" }, 404);

    const room = JSON.parse(raw) as LocalRoom;

    // Verify password if room is protected
    if (room.password && body.password !== room.password) {
      return jsonResponse({ error: "Incorrect password" }, 403);
    }

    room.answerSdp = body.answerSdp;

    const remaining = Math.max(
      60, // KV minimum TTL
      Math.floor((room.createdAt + LOCAL_TTL * 1000 - Date.now()) / 1000)
    );
    await env.DB.put(roomKey(body.roomId), JSON.stringify(room), {
      expirationTtl: remaining,
    });

    // Remove the incoming record so it disappears from receiver's queue
    if (room.targetDeviceId) {
      await env.DB.delete(incomingKey(room.targetDeviceId));
    }

    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Unknown action" }, 400);
};

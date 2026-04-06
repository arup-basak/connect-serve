import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { jsonResponse } from "../../lib/api-common";

const DEVICE_TTL = 60; // seconds — KV minimum; client heartbeats every 25s

interface DeviceMeta {
  name: string;
  ip: string;
  lastSeen: number;
}

function clientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0].trim() ??
    "unknown"
  );
}

export const GET: APIRoute = async ({ request }) => {
  const ip = clientIp(request);
  const list = await env.DB.list<DeviceMeta>({ prefix: "device:" });

  const devices = list.keys
    .filter((k) => k.metadata?.ip === ip)
    .map((k) => ({
      id: k.name.slice("device:".length),
      name: k.metadata?.name ?? "Unknown Device",
      lastSeen: k.metadata?.lastSeen ?? 0,
    }));

  return jsonResponse({ devices });
};

export const POST: APIRoute = async ({ request }) => {
  const ip = clientIp(request);

  let body: { action: string; deviceId?: string; name?: string };
  try {
    body = await request.json() as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  if (body.action === "register") {
    if (!body.name) return jsonResponse({ error: "name required" }, 400);
    const deviceId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const meta: DeviceMeta = { name: body.name, ip, lastSeen: Date.now() };
    await env.DB.put(`device:${deviceId}`, "", {
      expirationTtl: DEVICE_TTL,
      metadata: meta,
    });
    return jsonResponse({ deviceId });
  }

  if (body.action === "heartbeat") {
    if (!body.deviceId || !body.name) return jsonResponse({ error: "deviceId and name required" }, 400);
    const meta: DeviceMeta = { name: body.name, ip, lastSeen: Date.now() };
    await env.DB.put(`device:${body.deviceId}`, "", {
      expirationTtl: DEVICE_TTL,
      metadata: meta,
    });
    return jsonResponse({ ok: true });
  }

  if (body.action === "unregister") {
    if (!body.deviceId) return jsonResponse({ error: "deviceId required" }, 400);
    await env.DB.delete(`device:${body.deviceId}`);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Unknown action" }, 400);
};

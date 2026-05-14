import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { jsonResponse } from "../../lib/api-common";
import { getRedis } from "../../lib/upstash";

const DEVICE_TTL = 30; // seconds — client heartbeats every 25s

interface DeviceRecord {
  name: string;
  lastSeen: number;
}

function clientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0].trim() ??
    "unknown"
  );
}

function deviceKey(ip: string, deviceId: string) {
  return `device:${ip}:${deviceId}`;
}

async function scanByIp(redis: ReturnType<typeof getRedis>, ip: string): Promise<string[]> {
  const match = `device:${ip}:*`;
  const keys: string[] = [];
  let cursor: string | number = 0;
  do {
    const [next, batch] = await redis.scan(cursor, { match, count: 100 });
    keys.push(...batch);
    cursor = next;
  } while (cursor !== "0" && cursor !== 0);
  return keys;
}

export const GET: APIRoute = async ({ request }) => {
  const redis = getRedis(env);
  const ip = clientIp(request);
  const keys = await scanByIp(redis, ip);

  if (keys.length === 0) return jsonResponse({ devices: [] });

  const values = await redis.mget<(DeviceRecord | null)[]>(...keys);
  const prefix = `device:${ip}:`;
  const devices = keys
    .map((key, i) => {
      const rec = values[i];
      if (!rec) return null;
      return {
        id: key.slice(prefix.length),
        name: rec.name,
        lastSeen: rec.lastSeen,
      };
    })
    .filter((d): d is { id: string; name: string; lastSeen: number } => d !== null);

  return jsonResponse({ devices });
};

export const POST: APIRoute = async ({ request }) => {
  const redis = getRedis(env);
  const ip = clientIp(request);

  let body: { action: string; deviceId?: string; name?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  if (body.action === "register") {
    if (!body.name) return jsonResponse({ error: "name required" }, 400);
    const deviceId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const rec: DeviceRecord = { name: body.name, lastSeen: Date.now() };
    await redis.set(deviceKey(ip, deviceId), rec, { ex: DEVICE_TTL });
    return jsonResponse({ deviceId });
  }

  if (body.action === "heartbeat") {
    if (!body.deviceId || !body.name)
      return jsonResponse({ error: "deviceId and name required" }, 400);
    const rec: DeviceRecord = { name: body.name, lastSeen: Date.now() };
    await redis.set(deviceKey(ip, body.deviceId), rec, { ex: DEVICE_TTL });
    return jsonResponse({ ok: true });
  }

  if (body.action === "unregister") {
    if (!body.deviceId) return jsonResponse({ error: "deviceId required" }, 400);
    await redis.del(deviceKey(ip, body.deviceId));
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "Unknown action" }, 400);
};

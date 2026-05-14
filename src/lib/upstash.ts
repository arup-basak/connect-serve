import { Redis } from "@upstash/redis/cloudflare";
import type { Bindings } from "../types";

export function getRedis(env: Bindings): Redis {
  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

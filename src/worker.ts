import { handle } from "@astrojs/cloudflare/handler";
import { runCleanup } from "./cleanup";
import type { Bindings } from "./types";

interface Env extends Bindings {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return handle(request, env, ctx);
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runCleanup(env));
  },
};

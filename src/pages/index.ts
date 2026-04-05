import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { indexPageHtml } from "../lib/index-html";

export const GET: APIRoute = () => {
  return new Response(indexPageHtml(env.WORKER_URL), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};

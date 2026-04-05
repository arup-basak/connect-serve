import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { receivePageHtml } from "../lib/receive-html";

export const GET: APIRoute = () => {
  return new Response(receivePageHtml(env.WORKER_URL), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};

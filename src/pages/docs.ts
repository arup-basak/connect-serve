import type { APIRoute } from "astro";
import { docsPageHtml } from "../lib/docs-html";

export const GET: APIRoute = () => {
  return new Response(docsPageHtml(), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};

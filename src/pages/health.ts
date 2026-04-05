import type { APIRoute } from "astro";
import { jsonResponse } from "../lib/api-common";

export const GET: APIRoute = () => jsonResponse({ ok: true });

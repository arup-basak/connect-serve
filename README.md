# connect-serve

The backend for **Connect** — a peer-assisted file transfer service. Built as a [Cloudflare Worker](https://developers.cloudflare.com/workers/) with [Hono](https://hono.dev/), it accepts large multipart uploads into **R2**, tracks sessions in **KV**, and serves a browser **receive** page that recipients open from a share link.

The intended pairing is a native client (e.g. a Mac app) that chunks and uploads a file, then hands a `/receive?session=…` link to the recipient — who can download directly in their browser with no account required.

## How it works

```
Sender (Mac app)                   Worker (this repo)              Recipient (browser)
──────────────────                 ──────────────────              ───────────────────
POST /session         ──────────>  KV: store session
                      <──────────  sessionId + uploadId

PUT /upload-part ×N   ──────────>  R2: multipart upload parts

POST /complete        ──────────>  R2: complete multipart
                      <──────────  shareLink (/receive?session=…)

Share link sent to recipient ───────────────────────────────────>  GET /receive
                                                                    polls /status
                                                                    GET /download  ──> streams from R2
```

## Features

- **Multipart upload** — chunks stream directly into R2; minimum part size is **5 MB** (R2 requirement), except the final part.
- **Configurable TTL** — sessions expire after one of six presets (15 min, 1 h, 6 h, 1 day, 3 days, 7 days). Default is 1 hour.
- **Streaming download** — the receive page uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API) (Chrome/Edge) to write directly to disk with no RAM spike. Falls back to an in-memory Blob for other browsers.
- **HTTP range requests** — R2 handles partial content natively; the download endpoint passes range headers through.
- **Idempotent parts** — re-uploading a part number overwrites the previous ETag, so retries are safe.
- **Scheduled cleanup** — a cron job runs every 15 minutes and deletes expired sessions from both KV and R2.

## Requirements

- Node.js 22+
- [pnpm](https://pnpm.io/) (lockfile: `pnpm-lock.yaml`)
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (dev dependency)
- Cloudflare account with **R2** and **Workers KV** enabled

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Create Cloudflare resources** (once per account/environment)

   ```bash
   pnpm run kv:create    # KV namespace for sessions → copy the printed id
   pnpm run r2:create    # R2 bucket for uploaded files
   ```

3. **Configure `wrangler.toml`**

   - Set `[[kv_namespaces]]` → `id` to the ID printed by `kv:create` (replace `REPLACE_WITH_KV_NAMESPACE_ID`).
   - After your first deploy, update `[vars].WORKER_URL` to your Worker URL or custom domain — this value is embedded in `shareLink` responses.
   - Optional: adjust `[vars].MAX_FILE_SIZE` (default `536870912` = 512 MB).

4. **R2 lifecycle rule (recommended)**

   In the Cloudflare dashboard: R2 → `connect-transfers` → **Settings** → **Lifecycle rules**
   - Prefix: `transfers/`
   - Delete after: **1 day**

   This is a safety net that removes objects even if the KV record was cleaned up before the scheduled job ran.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Local dev server (`wrangler dev`, port **8787**) |
| `pnpm deploy` | Deploy to Cloudflare Workers |
| `pnpm deploy:dry` | Dry-run deploy (no publish) |
| `pnpm tail` | Stream live Worker logs |
| `pnpm typecheck` | TypeScript check (`tsc --noEmit`) |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |

## HTTP API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Landing page |
| `GET` | `/docs` | API documentation |
| `GET` | `/receive` | Recipient download page (opened from share link) |
| `GET` | `/health` | `{ ok: true }` |
| `POST` | `/session` | Start a new upload session |
| `PUT` | `/upload-part?session=&part=` | Upload a single chunk (raw bytes) |
| `POST` | `/complete` | Finalise the multipart upload |
| `GET` | `/status?session=` | Poll upload state |
| `GET` | `/download?session=` | Stream the completed file (supports `Range`) |

CORS is open (`*`) for `GET`, `POST`, `PUT`, `OPTIONS`.

### POST `/session`

Request body:

```jsonc
{
  "fileName": "archive.zip",   // required
  "fileSize": 104857600,       // required — bytes
  "mimeType": "application/zip", // required
  "checksum": "sha256:abc…",   // optional
  "ttl": 3600                  // optional — seconds; must be one of the allowed presets
}
```

Allowed `ttl` values: `900` (15 min) · `3600` (1 h) · `21600` (6 h) · `86400` (1 day) · `259200` (3 days) · `604800` (7 days). Any other value falls back to the default of `3600`.

Response: `{ sessionId, uploadId, expiresAt }`.

### PUT `/upload-part`

- Query params: `session=<sessionId>` and `part=<1–10000>`.
- Body: raw chunk bytes. All parts except the last must be **≥ 5 MB**.
- Response: `{ partNumber, etag }`.

### POST `/complete`

Request body: `{ "sessionId": "…" }`.

Response: `{ shareLink, expiresAt }` where `shareLink` is the `/receive?session=…` URL to hand to the recipient.

## Configuration (`wrangler.toml`)

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKER_URL` | `http://localhost:8787` | Public base URL embedded in share links |
| `MAX_FILE_SIZE` | `536870912` | Max upload size in bytes (512 MB) |

The cron trigger `*/15 * * * *` drives the cleanup handler.

## License

`UNLICENSED` (private) — see `package.json`.

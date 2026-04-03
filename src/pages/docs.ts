// API reference page — served at /docs
export function docsPageHtml(): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Connect — API Reference</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .card {
      width: 100%;
      max-width: 520px;
    }

    .logo {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #3b82f6;
      margin-bottom: 40px;
    }

    h1 {
      font-size: 32px;
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 16px;
    }

    .tagline {
      font-size: 16px;
      color: #666;
      line-height: 1.6;
      margin-bottom: 48px;
    }

    .features {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 48px;
    }

    .features li {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      font-size: 14px;
      color: #888;
      line-height: 1.5;
    }

    .feat-icon {
      width: 20px;
      height: 20px;
      border-radius: 6px;
      background: #1a2a3a;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 11px;
      margin-top: 1px;
    }

    .divider {
      height: 1px;
      background: #1e1e1e;
      margin-bottom: 28px;
    }

    .cta-label {
      font-size: 13px;
      color: #444;
      margin-bottom: 12px;
    }

    .endpoint {
      background: #141414;
      border: 1px solid #222;
      border-radius: 8px;
      padding: 12px 14px;
      font-family: "SF Mono", "Fira Code", monospace;
      font-size: 13px;
      color: #888;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .method {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .method.post { background: #1a3a1a; color: #4ade80; }
    .method.get  { background: #1a2a3a; color: #60a5fa; }
    .method.put  { background: #3a2a1a; color: #fb923c; }

    .endpoints { display: flex; flex-direction: column; gap: 8px; }

    .footer {
      margin-top: 40px;
      font-size: 12px;
      color: #333;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Connect</div>

    <h1>API Reference</h1>
    <p class="tagline">
      Chunked multipart upload via Cloudflare R2. Up to 512 MB.
      Files auto-delete after 1 hour. <a href="/" style="color:#3b82f6;text-decoration:none;">Open the app &rarr;</a>
    </p>

    <ul class="features">
      <li>
        <span class="feat-icon">&#128274;</span>
        AES-256-GCM encrypted in transit and at rest. Decryption key travels in the URL fragment &mdash; never reaches the server.
      </li>
      <li>
        <span class="feat-icon">&#9889;</span>
        Chunked multipart upload with resume. Drop your connection, pick it back up from the last chunk.
      </li>
      <li>
        <span class="feat-icon">&#9203;</span>
        1-hour TTL enforced at two layers: KV expiry + R2 lifecycle. No manual cleanup needed.
      </li>
      <li>
        <span class="feat-icon">&#127760;</span>
        Receiver streams directly to disk via File System Access API. 512 MB never sits in browser RAM.
      </li>
    </ul>

    <div class="divider"></div>

    <p class="cta-label">API endpoints &mdash; hit these directly or use the <a href="/" style="color:#3b82f6;text-decoration:none;">web UI</a>:</p>

    <div class="endpoints">
      <div class="endpoint"><span class="method post">POST</span>/session</div>
      <div class="endpoint"><span class="method get">GET</span>/chunk-url?session=&amp;part=</div>
      <div class="endpoint"><span class="method put">PUT</span>/upload-part?session=&amp;part=</div>
      <div class="endpoint"><span class="method post">POST</span>/complete</div>
      <div class="endpoint"><span class="method get">GET</span>/download?session=</div>
      <div class="endpoint"><span class="method get">GET</span>/status?session=</div>
    </div>

    <div class="footer">connect &middot; files expire in 1 hour &middot; max 512 MB</div>
  </div>
</body>
</html>`;
}

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

    :root {
      --bg:      #0a0a0a;
      --surface: #111111;
      --surface2:#181818;
      --border:  #1e1e1e;
      --border2: #2a2a2a;
      --text:    #e5e5e5;
      --muted:   #555;
      --muted2:  #333;
      --blue:    #3b82f6;
      --green:   #4ade80;
      --orange:  #fb923c;
      --mono:    "SF Mono", "Fira Code", "Cascadia Code", monospace;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 0 24px 64px;
    }

    /* ── Top bar ── */
    .topbar {
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 0 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 48px;
    }

    .logo {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--blue);
    }

    .topbar a {
      font-size: 13px;
      color: var(--muted);
      text-decoration: none;
    }
    .topbar a:hover { color: var(--text); }

    /* ── Layout ── */
    .wrap {
      max-width: 720px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 48px;
    }

    /* ── Page header ── */
    .page-header h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    .page-header p {
      font-size: 15px;
      color: var(--muted);
      line-height: 1.6;
    }
    .page-header a { color: var(--blue); text-decoration: none; }

    /* ── Section ── */
    .section-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border);
    }

    /* ── Endpoint block ── */
    .endpoint-block {
      display: flex;
      flex-direction: column;
      gap: 0;
      border: 1px solid var(--border2);
      border-radius: 12px;
      overflow: hidden;
    }

    .endpoint-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      background: var(--surface);
    }

    .method {
      font-family: var(--mono);
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 5px;
      flex-shrink: 0;
      letter-spacing: 0.04em;
    }
    .method.post   { background: #1a3a1a; color: var(--green); }
    .method.get    { background: #1a2a3a; color: #60a5fa; }
    .method.put    { background: #3a2a1a; color: var(--orange); }

    .endpoint-path {
      font-family: var(--mono);
      font-size: 14px;
      color: var(--text);
      flex: 1;
    }

    .endpoint-desc {
      font-size: 13px;
      color: var(--muted);
      padding: 12px 18px 0;
      background: var(--surface);
    }

    .endpoint-divider {
      height: 1px;
      background: var(--border);
      margin: 12px 18px 0;
    }

    .endpoint-body {
      background: var(--surface2);
      padding: 16px 18px;
    }

    /* ── Field table ── */
    .field-table {
      width: 100%;
      border-collapse: collapse;
    }

    .field-table thead th {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      text-align: left;
      padding: 0 0 8px;
      border-bottom: 1px solid var(--border);
    }

    .field-table tbody tr:not(:last-child) td {
      border-bottom: 1px solid var(--border);
    }

    .field-table td {
      padding: 10px 0;
      font-size: 13px;
      vertical-align: top;
    }

    .field-table td:first-child {
      width: 36%;
      padding-right: 16px;
    }

    .field-name {
      font-family: var(--mono);
      font-size: 13px;
      color: var(--text);
    }

    .field-req {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.05em;
      padding: 1px 5px;
      border-radius: 3px;
      margin-left: 6px;
      vertical-align: middle;
    }
    .field-req.req  { background: #2a1a1a; color: #f87171; }
    .field-req.opt  { background: #1a2a1a; color: #6ee7b7; }

    .field-type {
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
      width: 16%;
      padding-right: 16px;
    }

    .field-desc {
      color: var(--muted);
      line-height: 1.5;
    }

    .field-desc code {
      font-family: var(--mono);
      font-size: 12px;
      background: var(--surface);
      border: 1px solid var(--border2);
      padding: 1px 5px;
      border-radius: 3px;
      color: #93c5fd;
    }

    /* ── Sub-label ── */
    .sub-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted2);
      margin-bottom: 10px;
    }

    .body-section { margin-bottom: 18px; }
    .body-section:last-child { margin-bottom: 0; }

    /* ── TTL table ── */
    .ttl-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .ttl-chip {
      font-family: var(--mono);
      font-size: 12px;
      padding: 4px 10px;
      border-radius: 20px;
      border: 1px solid var(--border2);
      background: var(--surface);
      color: var(--muted);
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .ttl-chip .val { color: var(--text); }
    .ttl-default-badge {
      font-size: 10px;
      font-weight: 700;
      background: var(--blue);
      color: #fff;
      padding: 1px 5px;
      border-radius: 3px;
    }

    /* ── Note ── */
    .note {
      font-size: 13px;
      color: var(--muted);
      background: var(--surface);
      border: 1px solid var(--border2);
      border-left: 3px solid var(--blue);
      border-radius: 6px;
      padding: 12px 14px;
      line-height: 1.6;
    }
    .note code {
      font-family: var(--mono);
      font-size: 12px;
      color: #93c5fd;
      background: var(--surface2);
      padding: 1px 4px;
      border-radius: 3px;
    }

    /* ── Footer ── */
    .footer {
      font-size: 12px;
      color: var(--muted2);
      margin-top: 16px;
    }
    .footer a { color: var(--muted); text-decoration: none; }
    .footer a:hover { color: var(--text); }
  </style>
</head>
<body>

  <div class="topbar">
    <div class="logo">Connect</div>
    <a href="/">&larr; Back to app</a>
  </div>

  <div class="wrap">

    <div class="page-header">
      <h1>API Reference</h1>
      <p>
        Chunked multipart upload via Cloudflare R2. Files expire after a configurable TTL (15 min – 7 days) and are permanently deleted from storage. Max file size 512 MB. Chunk size must be &ge;5 MB (R2 multipart minimum) except for the final chunk.
      </p>
    </div>

    <!-- ═══════════════════════════════════════════════ UPLOAD FLOW ══ -->
    <div>
      <div class="section-title">Upload flow &mdash; 3 steps</div>
      <div style="display:flex;flex-direction:column;gap:12px;">

        <!-- POST /session -->
        <div class="endpoint-block">
          <div class="endpoint-header">
            <span class="method post">POST</span>
            <span class="endpoint-path">/session</span>
          </div>
          <div class="endpoint-desc">
            Initiates an R2 multipart upload and returns a <code>sessionId</code>. Call this once before uploading any chunks.
          </div>
          <div class="endpoint-divider"></div>
          <div class="endpoint-body">

            <div class="body-section">
              <div class="sub-label">Request body (JSON)</div>
              <table class="field-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Type</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span class="field-name">fileName</span><span class="field-req req">req</span></td>
                    <td class="field-type">string</td>
                    <td class="field-desc">Original filename including extension, e.g. <code>report.pdf</code></td>
                  </tr>
                  <tr>
                    <td><span class="field-name">fileSize</span><span class="field-req req">req</span></td>
                    <td class="field-type">number</td>
                    <td class="field-desc">Total file size in bytes. Must be &le; 536870912 (512 MB).</td>
                  </tr>
                  <tr>
                    <td><span class="field-name">mimeType</span><span class="field-req req">req</span></td>
                    <td class="field-type">string</td>
                    <td class="field-desc">MIME type, e.g. <code>application/pdf</code>. Stored as R2 <code>Content-Type</code>.</td>
                  </tr>
                  <tr>
                    <td><span class="field-name">checksum</span><span class="field-req opt">opt</span></td>
                    <td class="field-type">string</td>
                    <td class="field-desc">SHA-256 hex of the full file. Stored in R2 custom metadata for integrity verification by the receiver. Pass <code>""</code> to skip.</td>
                  </tr>
                  <tr>
                    <td><span class="field-name">ttl</span><span class="field-req opt">opt</span></td>
                    <td class="field-type">number</td>
                    <td class="field-desc">
                      Seconds until the file is auto-deleted. Must be one of the allowed values below. Defaults to <code>3600</code> (1 hour) if omitted or invalid.
                      <div style="margin-top:10px;">
                        <div class="ttl-grid">
                          <div class="ttl-chip"><span class="val">900</span> 15 min</div>
                          <div class="ttl-chip"><span class="val">3600</span> 1 hour <span class="ttl-default-badge">default</span></div>
                          <div class="ttl-chip"><span class="val">21600</span> 6 hours</div>
                          <div class="ttl-chip"><span class="val">86400</span> 1 day</div>
                          <div class="ttl-chip"><span class="val">259200</span> 3 days</div>
                          <div class="ttl-chip"><span class="val">604800</span> 7 days</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="body-section">
              <div class="sub-label">Response (200)</div>
              <table class="field-table">
                <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
                <tbody>
                  <tr>
                    <td><span class="field-name">sessionId</span></td>
                    <td class="field-type">string</td>
                    <td class="field-desc">UUID identifying this transfer session. Pass to all subsequent calls.</td>
                  </tr>
                  <tr>
                    <td><span class="field-name">uploadId</span></td>
                    <td class="field-type">string</td>
                    <td class="field-desc">R2 multipart upload ID. Stored server-side; clients do not need to track this.</td>
                  </tr>
                  <tr>
                    <td><span class="field-name">expiresAt</span></td>
                    <td class="field-type">number</td>
                    <td class="field-desc">Unix timestamp (ms) when the file will be deleted.</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>

        <!-- PUT /upload-part -->
        <div class="endpoint-block">
          <div class="endpoint-header">
            <span class="method put">PUT</span>
            <span class="endpoint-path">/upload-part?session=&lt;id&gt;&amp;part=&lt;n&gt;</span>
          </div>
          <div class="endpoint-desc">
            Streams a single chunk directly into R2. Repeat for every part. Parts can be retried idempotently — re-uploading the same <code>part</code> number overwrites the previous ETag.
          </div>
          <div class="endpoint-divider"></div>
          <div class="endpoint-body">

            <div class="body-section">
              <div class="sub-label">Query params</div>
              <table class="field-table">
                <thead><tr><th>Param</th><th>Type</th><th>Description</th></tr></thead>
                <tbody>
                  <tr>
                    <td><span class="field-name">session</span><span class="field-req req">req</span></td>
                    <td class="field-type">string</td>
                    <td class="field-desc">Session ID from <code>POST /session</code>.</td>
                  </tr>
                  <tr>
                    <td><span class="field-name">part</span><span class="field-req req">req</span></td>
                    <td class="field-type">integer</td>
                    <td class="field-desc">1-indexed part number (1 – 10000). Parts must be &ge;5 MB except the last.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="body-section">
              <div class="sub-label">Request body</div>
              <div class="note">Raw binary chunk. Set <code>Content-Type: application/octet-stream</code>. The chunk is streamed directly into R2 — it is never buffered on the server.</div>
            </div>

            <div class="body-section">
              <div class="sub-label">Response (200)</div>
              <table class="field-table">
                <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
                <tbody>
                  <tr>
                    <td><span class="field-name">partNumber</span></td>
                    <td class="field-type">integer</td>
                    <td class="field-desc">Echo of the part number.</td>
                  </tr>
                  <tr>
                    <td><span class="field-name">etag</span></td>
                    <td class="field-type">string</td>
                    <td class="field-desc">R2 ETag for this part. Stored server-side; clients do not need to track this.</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>

        <!-- POST /complete -->
        <div class="endpoint-block">
          <div class="endpoint-header">
            <span class="method post">POST</span>
            <span class="endpoint-path">/complete</span>
          </div>
          <div class="endpoint-desc">
            Finalises the multipart upload and assembles the file in R2. Returns the shareable download link. Idempotent — calling again returns the same link.
          </div>
          <div class="endpoint-divider"></div>
          <div class="endpoint-body">

            <div class="body-section">
              <div class="sub-label">Request body (JSON)</div>
              <table class="field-table">
                <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
                <tbody>
                  <tr>
                    <td><span class="field-name">sessionId</span><span class="field-req req">req</span></td>
                    <td class="field-type">string</td>
                    <td class="field-desc">Session ID from <code>POST /session</code>.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="body-section">
              <div class="sub-label">Response (200)</div>
              <table class="field-table">
                <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
                <tbody>
                  <tr>
                    <td><span class="field-name">shareLink</span></td>
                    <td class="field-type">string</td>
                    <td class="field-desc">Full URL to the download page, e.g. <code>https://…/receive?session=&lt;id&gt;</code>. Send this to the recipient.</td>
                  </tr>
                  <tr>
                    <td><span class="field-name">expiresAt</span></td>
                    <td class="field-type">number</td>
                    <td class="field-desc">Unix timestamp (ms) when the file will be deleted.</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>
    </div>

    <!-- ══════════════════════════════════════════════ DOWNLOAD FLOW ══ -->
    <div>
      <div class="section-title">Download flow</div>
      <div style="display:flex;flex-direction:column;gap:12px;">

        <!-- GET /status -->
        <div class="endpoint-block">
          <div class="endpoint-header">
            <span class="method get">GET</span>
            <span class="endpoint-path">/status?session=&lt;id&gt;</span>
          </div>
          <div class="endpoint-desc">
            Poll this until <code>ready: true</code> before calling <code>/download</code>. Safe to call every 2–3 seconds.
          </div>
          <div class="endpoint-divider"></div>
          <div class="endpoint-body">
            <div class="sub-label">Response (200)</div>
            <table class="field-table">
              <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
              <tbody>
                <tr>
                  <td><span class="field-name">ready</span></td>
                  <td class="field-type">boolean</td>
                  <td class="field-desc"><code>true</code> once <code>POST /complete</code> has been called successfully.</td>
                </tr>
                <tr>
                  <td><span class="field-name">expired</span></td>
                  <td class="field-type">boolean</td>
                  <td class="field-desc"><code>true</code> if the session TTL has elapsed. Stop polling and show an error.</td>
                </tr>
                <tr>
                  <td><span class="field-name">fileName</span></td>
                  <td class="field-type">string</td>
                  <td class="field-desc">Original filename.</td>
                </tr>
                <tr>
                  <td><span class="field-name">fileSize</span></td>
                  <td class="field-type">number</td>
                  <td class="field-desc">Total size in bytes.</td>
                </tr>
                <tr>
                  <td><span class="field-name">mimeType</span></td>
                  <td class="field-type">string</td>
                  <td class="field-desc">MIME type as provided by the sender.</td>
                </tr>
                <tr>
                  <td><span class="field-name">expiresAt</span></td>
                  <td class="field-type">number</td>
                  <td class="field-desc">Unix timestamp (ms) when the file will be deleted.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- GET /download -->
        <div class="endpoint-block">
          <div class="endpoint-header">
            <span class="method get">GET</span>
            <span class="endpoint-path">/download?session=&lt;id&gt;</span>
          </div>
          <div class="endpoint-desc">
            Streams the assembled file from R2 directly to the client. Supports <code>Range</code> requests — R2 handles byte-range seeking natively.
          </div>
          <div class="endpoint-divider"></div>
          <div class="endpoint-body">
            <div class="body-section">
              <div class="sub-label">Response headers</div>
              <table class="field-table">
                <thead><tr><th>Header</th><th>Value</th></tr></thead>
                <tbody>
                  <tr>
                    <td><span class="field-name">Content-Type</span></td>
                    <td class="field-desc">MIME type from the session record.</td>
                  </tr>
                  <tr>
                    <td><span class="field-name">Content-Disposition</span></td>
                    <td class="field-desc"><code>attachment; filename="…"</code> — triggers browser save dialog.</td>
                  </tr>
                  <tr>
                    <td><span class="field-name">Content-Length</span></td>
                    <td class="field-desc">Full file size in bytes (or range length for partial responses).</td>
                  </tr>
                  <tr>
                    <td><span class="field-name">Accept-Ranges</span></td>
                    <td class="field-desc"><code>bytes</code> — pause/resume supported.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="body-section">
              <div class="note">
                For large files use the browser <code>File System Access API</code> (<code>showSaveFilePicker</code>) to pipe the response stream directly to disk without holding the file in memory. The web UI does this automatically on supported browsers.
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ══════════════════════════════════════════════════ ERROR CODES ══ -->
    <div>
      <div class="section-title">Error responses</div>
      <div class="endpoint-block">
        <div class="endpoint-body">
          <table class="field-table">
            <thead><tr><th style="width:12%">Status</th><th style="width:20%">Meaning</th><th>When</th></tr></thead>
            <tbody>
              <tr>
                <td class="field-type">400</td>
                <td class="field-desc">Bad request</td>
                <td class="field-desc">Missing required field, invalid <code>part</code> number, or malformed JSON.</td>
              </tr>
              <tr>
                <td class="field-type">404</td>
                <td class="field-desc">Not found</td>
                <td class="field-desc">Session ID not in KV — either never existed or already expired.</td>
              </tr>
              <tr>
                <td class="field-type">409</td>
                <td class="field-desc">Conflict</td>
                <td class="field-desc">Part upload attempted after <code>POST /complete</code> was already called.</td>
              </tr>
              <tr>
                <td class="field-type">410</td>
                <td class="field-desc">Gone</td>
                <td class="field-desc">Session TTL elapsed — file has been deleted.</td>
              </tr>
              <tr>
                <td class="field-type">413</td>
                <td class="field-desc">Too large</td>
                <td class="field-desc"><code>fileSize</code> exceeds 512 MB limit.</td>
              </tr>
              <tr>
                <td class="field-type">425</td>
                <td class="field-desc">Too early</td>
                <td class="field-desc">Download requested before upload is complete.</td>
              </tr>
              <tr>
                <td class="field-type">502</td>
                <td class="field-desc">R2 error</td>
                <td class="field-desc">R2 rejected the part or complete call (e.g. <code>EntityTooSmall</code> if a non-final part is &lt;5 MB).</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="footer">
      connect &middot; files deleted after chosen TTL (15 min – 7 days) &middot; max 512 MB &middot;
      <a href="/">open app</a>
    </div>

  </div>
</body>
</html>`;
}

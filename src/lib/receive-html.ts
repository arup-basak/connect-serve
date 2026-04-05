// Browser download page — served at /receive?session=<id>
// Uses File System Access API to stream directly to disk (no RAM spike for large files)
// Falls back to in-memory Blob download for unsupported browsers

export function receivePageHtml(workerUrl: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Connect — Receive File</title>
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
    }

    .card {
      background: #141414;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 24px 48px rgba(0,0,0,0.5);
    }

    .logo {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #555;
      margin-bottom: 32px;
    }

    h1 {
      font-size: 22px;
      font-weight: 600;
      line-height: 1.3;
      margin-bottom: 8px;
    }

    .subtitle {
      font-size: 14px;
      color: #666;
      margin-bottom: 32px;
    }

    /* Status indicator */
    .status-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 28px;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .dot.pulse { background: #f59e0b; animation: pulse 1.4s ease-in-out infinite; }
    .dot.green  { background: #22c55e; }
    .dot.red    { background: #ef4444; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.3; }
    }

    .status-text { font-size: 14px; color: #888; }

    /* File info */
    .file-info {
      background: #1c1c1c;
      border: 1px solid #2a2a2a;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 24px;
      display: none;
    }
    .file-info.visible { display: block; }

    .file-name {
      font-size: 15px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }

    .file-meta {
      font-size: 13px;
      color: #555;
    }

    /* Progress */
    .progress-wrap {
      margin-bottom: 24px;
      display: none;
    }
    .progress-wrap.visible { display: block; }

    .progress-bar {
      height: 4px;
      background: #222;
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: #3b82f6;
      border-radius: 2px;
      width: 0%;
      transition: width 0.15s ease;
    }

    .progress-label {
      font-size: 12px;
      color: #555;
      margin-top: 8px;
      text-align: right;
    }

    /* CTA */
    button {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.1s;
    }
    button:active { transform: scale(0.98); }
    button:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

    .btn-primary { background: #3b82f6; color: #fff; }
    .btn-primary:hover:not(:disabled) { opacity: 0.9; }

    /* Expiry notice */
    .expiry {
      font-size: 12px;
      color: #444;
      text-align: center;
      margin-top: 20px;
    }

    .error-msg {
      background: #1f0f0f;
      border: 1px solid #4d1a1a;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
      color: #f87171;
      margin-bottom: 20px;
      display: none;
    }
    .error-msg.visible { display: block; }

    /* Password prompt */
    .pw-prompt {
      display: none;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 20px;
    }
    .pw-prompt.visible { display: flex; }

    .pw-hint {
      font-size: 13px;
      color: #888;
    }

    .pw-input-row {
      display: flex;
      gap: 8px;
    }

    .pw-field {
      flex: 1;
      background: #1c1c1c;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      padding: 11px 13px;
      font-size: 14px;
      color: #e5e5e5;
      outline: none;
      transition: border-color 0.15s;
    }
    .pw-field:focus { border-color: #3b82f6; }
    .pw-field::placeholder { color: #444; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Connect</div>
    <h1 id="heading">Waiting for file&hellip;</h1>
    <p class="subtitle" id="subtext">Keep this tab open. The sender is uploading.</p>

    <div class="status-row">
      <div class="dot pulse" id="status-dot"></div>
      <span class="status-text" id="status-text">Waiting for sender to finish upload</span>
    </div>

    <div class="error-msg" id="error-msg"></div>

    <div class="pw-prompt" id="pw-prompt">
      <div class="pw-hint">🔒 This file is password protected</div>
      <div class="pw-input-row">
        <input
          class="pw-field"
          id="pw-field"
          type="password"
          placeholder="Enter password…"
          autocomplete="current-password"
        />
      </div>
    </div>

    <div class="file-info" id="file-info">
      <div class="file-name" id="file-name"></div>
      <div class="file-meta" id="file-meta"></div>
    </div>

    <div class="progress-wrap" id="progress-wrap">
      <div class="progress-bar">
        <div class="progress-fill" id="progress-fill"></div>
      </div>
      <div class="progress-label" id="progress-label">0%</div>
    </div>

    <button class="btn-primary" id="dl-btn" disabled>Download</button>

    <div class="expiry" id="expiry-note"></div>
  </div>

  <script>
    const WORKER = ${JSON.stringify(workerUrl)};
    const params = new URLSearchParams(location.search);
    const sessionId = params.get("session");

    const $ = id => document.getElementById(id);

    if (!sessionId) showError("Invalid link — missing session ID.");

    let isPasswordProtected = false;

    // ── Poll until upload is complete ────────────────────────────────────────
    let pollTimer;

    async function poll() {
      try {
        const res = await fetch(WORKER + "/status?session=" + sessionId);
        const data = await res.json();

        if (data.expired) {
          clearInterval(pollTimer);
          showError("This link has expired. Ask the sender to share a new one.");
          return;
        }

        if (data.expiresAt) {
          const mins = Math.round((data.expiresAt - Date.now()) / 60000);
          $("expiry-note").textContent = "Link expires in ~" + mins + " min";
        }

        if (data.ready) {
          clearInterval(pollTimer);
          isPasswordProtected = !!data.passwordProtected;
          onReady(data);
        }
      } catch (e) {
        // transient network error — keep polling
      }
    }

    function onReady(data) {
      $("heading").textContent = "Your file is ready";
      $("subtext").textContent = "Click download to save it to your device.";
      $("status-dot").className = "dot green";
      $("status-text").textContent = "Upload complete";

      $("file-name").textContent = data.fileName;
      $("file-meta").textContent = formatBytes(data.fileSize) + " · " + (data.mimeType || "file");
      $("file-info").classList.add("visible");

      if (isPasswordProtected) {
        $("pw-prompt").classList.add("visible");
        $("dl-btn").disabled = true;
        $("dl-btn").textContent = "Download " + data.fileName;
        $("pw-field").addEventListener("input", () => {
          $("dl-btn").disabled = $("pw-field").value.length === 0;
        });
        $("pw-field").addEventListener("keydown", e => {
          if (e.key === "Enter" && $("pw-field").value.length > 0) $("dl-btn").click();
        });
      } else {
        $("dl-btn").disabled = false;
        $("dl-btn").textContent = "Download " + data.fileName;
      }
    }

    if (sessionId) {
      poll();
      pollTimer = setInterval(poll, 2500);
    }

    // ── Download ─────────────────────────────────────────────────────────────
    $("dl-btn").addEventListener("click", async () => {
      $("dl-btn").disabled = true;
      $("dl-btn").textContent = "Downloading\u2026";
      $("progress-wrap").classList.add("visible");

      try {
        const pw = isPasswordProtected ? $("pw-field").value : "";
        const dlUrl = WORKER + "/download?session=" + sessionId +
          (pw ? "&password=" + encodeURIComponent(pw) : "");
        const res = await fetch(dlUrl);

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Download failed" }));
          if (res.status === 401 || res.status === 403) {
            showError("Incorrect password. Please try again.");
            $("dl-btn").disabled = false;
            $("dl-btn").textContent = "Download";
            return;
          }
          throw new Error(err.error || "Download failed (" + res.status + ")");
        }

        const contentLength = parseInt(res.headers.get("Content-Length") || "0", 10);
        const contentDisposition = res.headers.get("Content-Disposition") || "";
        const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        const suggestedName = fileNameMatch ? fileNameMatch[1] : "download";
        const mimeType = res.headers.get("Content-Type") || "application/octet-stream";

        // Try File System Access API (Chrome/Edge) — streams to disk, no RAM spike
        if ("showSaveFilePicker" in window) {
          await streamToDisk(res, suggestedName, mimeType, contentLength);
        } else {
          // Fallback: load into memory → Blob URL → <a> click
          await downloadViaBlob(res, suggestedName, mimeType, contentLength);
        }

        $("status-dot").className = "dot green";
        $("status-text").textContent = "Download complete";
        $("dl-btn").textContent = "Done!";
        $("progress-fill").style.width = "100%";
        $("progress-label").textContent = "100%";
      } catch (e) {
        showError(e.message || "Download failed. Try again.");
        $("dl-btn").disabled = false;
        $("dl-btn").textContent = "Retry Download";
      }
    });

    async function streamToDisk(res, name, mimeType, totalBytes) {
      const fileHandle = await window.showSaveFilePicker({ suggestedName: name });
      const writable = await fileHandle.createWritable();
      const reader = res.body.getReader();
      let received = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writable.write(value);
          received += value.byteLength;
          updateProgress(received, totalBytes);
        }
      } finally {
        await writable.close();
      }
    }

    async function downloadViaBlob(res, name, mimeType, totalBytes) {
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        updateProgress(received, totalBytes);
      }

      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    function updateProgress(received, total) {
      const pct = total > 0 ? Math.round((received / total) * 100) : 0;
      $("progress-fill").style.width = pct + "%";
      $("progress-label").textContent = formatBytes(received) + (total ? " / " + formatBytes(total) : "") + "  (" + pct + "%)";
    }

    function showError(msg) {
      $("error-msg").textContent = msg;
      $("error-msg").classList.add("visible");
      $("status-dot").className = "dot red";
      $("status-text").textContent = "Error";
      $("heading").textContent = "Something went wrong";
      $("subtext").textContent = "";
      $("dl-btn").disabled = true;
    }

    function formatBytes(b) {
      if (!b) return "0 B";
      const units = ["B","KB","MB","GB"];
      const i = Math.floor(Math.log(b) / Math.log(1024));
      return (b / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i];
    }
  </script>
</body>
</html>`;
}

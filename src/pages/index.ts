// Main app page — served at /
// Send tab: drag-and-drop → chunked multipart upload → share link
// Receive tab: paste link → inline download with progress

export function indexPageHtml(workerUrl: string): string {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Connect — File Transfer</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:       #0a0a0a;
      --surface:  #111111;
      --surface2: #181818;
      --border:   #222222;
      --border2:  #2d2d2d;
      --text:     #e5e5e5;
      --muted:    #555555;
      --muted2:   #3a3a3a;
      --blue:     #3b82f6;
      --blue-dim: #1d3a6e;
      --green:    #22c55e;
      --amber:    #f59e0b;
      --red:      #ef4444;
      --radius:   14px;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    /* ── Top bar ── */
    .topbar {
      width: 100%;
      max-width: 680px;
      padding: 24px 24px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .logo {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--blue);
    }

    .topbar-links {
      display: flex;
      gap: 20px;
    }

    .topbar-links a {
      font-size: 13px;
      color: var(--muted);
      text-decoration: none;
      transition: color 0.15s;
    }
    .topbar-links a:hover { color: var(--text); }

    /* ── Shell ── */
    .shell {
      width: 100%;
      max-width: 680px;
      padding: 28px 24px 48px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* ── Tabs ── */
    .tabs {
      display: flex;
      gap: 4px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 4px;
      width: fit-content;
    }

    .tab {
      padding: 7px 20px;
      border-radius: 7px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      background: transparent;
      color: var(--muted);
      transition: background 0.15s, color 0.15s;
    }
    .tab.active {
      background: var(--surface);
      color: var(--text);
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    }

    /* ── Panel ── */
    .panel { display: none; flex-direction: column; gap: 16px; }
    .panel.active { display: flex; }

    /* ── Card ── */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }

    .card-inner { padding: 24px; }

    /* ── Drop zone ── */
    .dropzone {
      border: 1.5px dashed var(--border2);
      border-radius: 10px;
      padding: 48px 24px;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
      position: relative;
    }
    .dropzone:hover,
    .dropzone.drag-over {
      border-color: var(--blue);
      background: rgba(59,130,246,0.04);
    }

    .dropzone input[type="file"] {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
      width: 100%;
      height: 100%;
    }

    .dz-icon {
      width: 44px;
      height: 44px;
      margin: 0 auto 16px;
      border-radius: 10px;
      background: var(--surface2);
      border: 1px solid var(--border2);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .dz-icon svg { width: 20px; height: 20px; stroke: var(--muted); fill: none; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }

    .dz-primary {
      font-size: 14px;
      font-weight: 500;
      color: var(--text);
      margin-bottom: 4px;
    }

    .dz-secondary {
      font-size: 13px;
      color: var(--muted);
    }

    /* ── File pill (after selection) ── */
    .file-pill {
      display: none;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      background: var(--surface2);
      border: 1px solid var(--border2);
      border-radius: 10px;
    }
    .file-pill.visible { display: flex; }

    .file-icon {
      width: 36px;
      height: 36px;
      background: var(--blue-dim);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 14px;
    }

    .file-details { flex: 1; min-width: 0; }
    .file-details .name {
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .file-details .meta { font-size: 12px; color: var(--muted); margin-top: 2px; }

    .file-clear {
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      padding: 4px;
      width: auto;
      font-size: 18px;
      line-height: 1;
      flex-shrink: 0;
    }
    .file-clear:hover { color: var(--text); }
    .file-clear:active { transform: none; }

    /* ── Progress ── */
    .progress-block {
      display: none;
      flex-direction: column;
      gap: 10px;
    }
    .progress-block.visible { display: flex; }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .progress-label { font-size: 13px; color: var(--muted); }
    .progress-pct { font-size: 13px; font-weight: 600; color: var(--text); }

    .progress-bar {
      height: 5px;
      background: var(--surface2);
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--blue);
      border-radius: 3px;
      width: 0%;
      transition: width 0.2s ease;
    }

    .progress-stats {
      display: flex;
      gap: 16px;
    }

    .stat { font-size: 12px; color: var(--muted); }
    .stat span { color: var(--text); font-weight: 500; }

    /* ── Share link ── */
    .share-block {
      display: none;
      flex-direction: column;
      gap: 12px;
    }
    .share-block.visible { display: flex; }

    .share-label {
      font-size: 13px;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .share-label .dot-green {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--green);
      flex-shrink: 0;
    }

    .share-link-row {
      display: flex;
      gap: 8px;
    }

    .share-link-input {
      flex: 1;
      background: var(--surface2);
      border: 1px solid var(--border2);
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 13px;
      color: var(--text);
      font-family: "SF Mono", "Fira Code", monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: text;
      min-width: 0;
    }

    .btn-copy {
      padding: 10px 16px;
      background: var(--surface2);
      border: 1px solid var(--border2);
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text);
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      width: auto;
      transition: background 0.15s;
    }
    .btn-copy:hover { background: var(--border2); }
    .btn-copy:active { transform: scale(0.97); }

    .expiry-note {
      font-size: 12px;
      color: var(--muted2);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* ── TTL selector ── */
    .ttl-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .ttl-label {
      font-size: 12px;
      color: var(--muted);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .ttl-pills {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .ttl-pill {
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid var(--border2);
      background: var(--surface2);
      color: var(--muted);
      transition: background 0.12s, color 0.12s, border-color 0.12s;
      width: auto;
    }
    .ttl-pill:hover { color: var(--text); border-color: var(--muted2); }
    .ttl-pill.selected {
      background: var(--blue-dim);
      border-color: var(--blue);
      color: var(--blue);
    }
    .ttl-pill:active { transform: scale(0.96); }

    /* ── Buttons ── */
    button {
      width: 100%;
      padding: 13px;
      border: none;
      border-radius: 9px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.1s;
    }
    button:active { transform: scale(0.98); }
    button:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

    .btn-primary { background: var(--blue); color: #fff; }
    .btn-primary:hover:not(:disabled) { opacity: 0.88; }

    .btn-ghost {
      background: var(--surface2);
      border: 1px solid var(--border2);
      color: var(--muted);
      width: auto;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 500;
    }
    .btn-ghost:hover:not(:disabled) { color: var(--text); border-color: var(--muted2); }

    /* ── Error ── */
    .error-banner {
      display: none;
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.25);
      border-radius: 8px;
      padding: 11px 14px;
      font-size: 13px;
      color: #f87171;
    }
    .error-banner.visible { display: block; }

    /* ── Divider ── */
    .divider {
      height: 1px;
      background: var(--border);
      margin: 4px 0;
    }

    /* ── Receive panel ── */
    .receive-label {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
    }
    .receive-desc {
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 16px;
      line-height: 1.5;
    }

    .link-row {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    .link-input {
      flex: 1;
      background: var(--surface2);
      border: 1px solid var(--border2);
      border-radius: 8px;
      padding: 11px 13px;
      font-size: 14px;
      color: var(--text);
      outline: none;
      transition: border-color 0.15s;
      min-width: 0;
    }
    .link-input:focus { border-color: var(--blue); }
    .link-input::placeholder { color: var(--muted2); }

    .btn-go {
      padding: 11px 20px;
      background: var(--blue);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      flex-shrink: 0;
      width: auto;
      transition: opacity 0.15s;
    }
    .btn-go:hover { opacity: 0.88; }
    .btn-go:disabled { opacity: 0.35; cursor: not-allowed; }

    /* Receive status card */
    .rx-status {
      display: none;
      flex-direction: column;
      gap: 14px;
    }
    .rx-status.visible { display: flex; }

    .rx-file-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--amber);
    }
    .status-dot.pulse { animation: pulse 1.4s ease-in-out infinite; }
    .status-dot.green { background: var(--green); animation: none; }
    .status-dot.red   { background: var(--red);   animation: none; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.25; }
    }

    .status-text-sm { font-size: 13px; color: var(--muted); }

    /* ── Footer ── */
    .footer {
      font-size: 12px;
      color: var(--muted2);
      text-align: center;
      padding: 0 24px 32px;
    }
    .footer a { color: var(--muted); text-decoration: none; }
    .footer a:hover { color: var(--text); }
  </style>
</head>
<body>

  <div class="topbar">
    <div class="logo">Connect</div>
    <div class="topbar-links">
      <a href="/docs">API Docs</a>
    </div>
  </div>

  <div class="shell">

    <!-- ── Tabs ── -->
    <div class="tabs">
      <button class="tab active" id="tab-send" onclick="switchTab('send')">Send</button>
      <button class="tab" id="tab-receive" onclick="switchTab('receive')">Receive</button>
    </div>

    <!-- ═══════════════════════════════════════════════════════════ SEND ══ -->
    <div class="panel active" id="panel-send">

      <div class="card">
        <div class="card-inner" style="display:flex;flex-direction:column;gap:16px;">

          <!-- Drop zone -->
          <div class="dropzone" id="dropzone">
            <input type="file" id="file-input" />
            <div class="dz-icon">
              <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <div class="dz-primary">Drop a file here</div>
            <div class="dz-secondary">or click to browse &mdash; up to 512 MB</div>
          </div>

          <!-- File pill -->
          <div class="file-pill" id="file-pill">
            <div class="file-icon" id="file-icon">📄</div>
            <div class="file-details">
              <div class="name" id="pill-name"></div>
              <div class="meta" id="pill-meta"></div>
            </div>
            <button class="file-clear" id="file-clear" title="Remove">&times;</button>
          </div>

          <!-- Error -->
          <div class="error-banner" id="send-error"></div>

          <!-- TTL selector -->
          <div class="ttl-row" id="ttl-row">
            <span class="ttl-label">Delete after</span>
            <div class="ttl-pills">
              <button class="ttl-pill" data-ttl="900"   onclick="selectTtl(this)">15 min</button>
              <button class="ttl-pill selected" data-ttl="3600"  onclick="selectTtl(this)">1 hour</button>
              <button class="ttl-pill" data-ttl="21600" onclick="selectTtl(this)">6 hours</button>
              <button class="ttl-pill" data-ttl="86400" onclick="selectTtl(this)">1 day</button>
              <button class="ttl-pill" data-ttl="259200" onclick="selectTtl(this)">3 days</button>
              <button class="ttl-pill" data-ttl="604800" onclick="selectTtl(this)">7 days</button>
            </div>
          </div>

          <!-- Progress -->
          <div class="progress-block" id="progress-block">
            <div class="progress-header">
              <span class="progress-label" id="progress-label">Uploading&hellip;</span>
              <span class="progress-pct" id="progress-pct">0%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" id="progress-fill"></div>
            </div>
            <div class="progress-stats">
              <div class="stat">Speed <span id="stat-speed">&mdash;</span></div>
              <div class="stat">ETA <span id="stat-eta">&mdash;</span></div>
              <div class="stat">Parts <span id="stat-parts">0</span></div>
            </div>
          </div>

          <!-- Share link -->
          <div class="share-block" id="share-block">
            <div class="share-label">
              <span class="dot-green"></span>
              Upload complete &mdash; share this link
            </div>
            <div class="share-link-row">
              <div class="share-link-input" id="share-link" title="Share link"></div>
              <button class="btn-copy" id="copy-btn" onclick="copyLink()">Copy</button>
            </div>
            <div class="expiry-note" id="expiry-note">
              &bull; Expires &mdash; &bull; Max one recipient
            </div>
          </div>

          <!-- CTA -->
          <button class="btn-primary" id="send-btn" disabled>Send File</button>

          <!-- New transfer (shown after complete) -->
          <button class="btn-ghost" id="new-btn" style="display:none;" onclick="resetSend()">New Transfer</button>

        </div>
      </div>

    </div>
    <!-- ═══════════════════════════════════════════════════════ /SEND ══ -->


    <!-- ══════════════════════════════════════════════════════ RECEIVE ══ -->
    <div class="panel" id="panel-receive">

      <div class="card">
        <div class="card-inner" style="display:flex;flex-direction:column;gap:16px;">

          <div>
            <div class="receive-label">Paste a Connect link</div>
            <div class="receive-desc">
              The sender shares a link from their Mac app or this page.
              Paste it below to download the file.
            </div>
          </div>

          <div class="link-row">
            <input
              class="link-input"
              id="rx-link-input"
              type="url"
              placeholder="https://…/receive?session=…"
              autocomplete="off"
              spellcheck="false"
            />
            <button class="btn-go" id="rx-go-btn" onclick="startReceive()">Go</button>
          </div>

          <!-- Error -->
          <div class="error-banner" id="rx-error"></div>

          <!-- Status + download -->
          <div class="rx-status" id="rx-status">

            <div class="rx-file-row">
              <div class="status-dot pulse" id="rx-dot"></div>
              <span class="status-text-sm" id="rx-status-text">Waiting for upload to finish&hellip;</span>
            </div>

            <!-- File info (shown when ready) -->
            <div class="file-pill" id="rx-file-pill" style="display:none;">
              <div class="file-icon" id="rx-file-icon">📄</div>
              <div class="file-details">
                <div class="name" id="rx-pill-name"></div>
                <div class="meta" id="rx-pill-meta"></div>
              </div>
            </div>

            <!-- Download progress -->
            <div class="progress-block" id="rx-progress-block">
              <div class="progress-header">
                <span class="progress-label" id="rx-progress-label">Downloading&hellip;</span>
                <span class="progress-pct" id="rx-progress-pct">0%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" id="rx-progress-fill"></div>
              </div>
              <div class="progress-stats">
                <div class="stat">Received <span id="rx-stat-received">&mdash;</span></div>
                <div class="stat">Speed <span id="rx-stat-speed">&mdash;</span></div>
              </div>
            </div>

            <button class="btn-primary" id="rx-dl-btn" disabled>Download</button>

          </div>

        </div>
      </div>

    </div>
    <!-- ═════════════════════════════════════════════════════ /RECEIVE ══ -->

  </div><!-- /shell -->

  <div class="footer">
    connect &middot; files expire in 1 hour &middot; max 512 MB &middot;
    <a href="/docs">API docs</a>
  </div>

  <script>
  (() => {
    'use strict';

    const WORKER     = ${JSON.stringify(workerUrl)};
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB — R2 multipart minimum

    // ── Helpers ──────────────────────────────────────────────────────────────
    const $ = id => document.getElementById(id);

    function formatBytes(b) {
      if (!b || b === 0) return '0 B';
      const u = ['B','KB','MB','GB'];
      const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), u.length - 1);
      return (b / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + u[i];
    }

    function formatSpeed(bps) {
      return formatBytes(bps) + '/s';
    }

    function formatEta(seconds) {
      if (!isFinite(seconds) || seconds <= 0) return '—';
      if (seconds < 60) return Math.ceil(seconds) + 's';
      return Math.ceil(seconds / 60) + 'm';
    }

    function fileEmoji(name) {
      const ext = name.split('.').pop().toLowerCase();
      const map = {
        pdf: '📄', zip: '🗜️', gz: '🗜️', tar: '🗜️', '7z': '🗜️', rar: '🗜️',
        mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬',
        mp3: '🎵', wav: '🎵', flac: '🎵', aac: '🎵',
        jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️',
        dmg: '💿', pkg: '📦', exe: '⚙️', app: '⚙️',
        js: '📝', ts: '📝', json: '📝', md: '📝', txt: '📝',
        xls: '📊', xlsx: '📊', csv: '📊',
        doc: '📃', docx: '📃',
      };
      return map[ext] || '📄';
    }

    // ── Tab switching ─────────────────────────────────────────────────────────
    window.switchTab = function(name) {
      ['send','receive'].forEach(t => {
        $('tab-' + t).classList.toggle('active', t === name);
        $('panel-' + t).classList.toggle('active', t === name);
      });
    };

    // ══════════════════════════════════════════════════════════════════ SEND ══

    let selectedFile = null;
    let uploadAborted = false;
    let selectedTtl = 3600; // default 1 hour
    let sessionExpiresAt = null;

    window.selectTtl = function(btn) {
      document.querySelectorAll('.ttl-pill').forEach(p => p.classList.remove('selected'));
      btn.classList.add('selected');
      selectedTtl = parseInt(btn.dataset.ttl, 10);
    };

    // Drop zone events
    const dz = $('dropzone');
    const fi = $('file-input');

    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => {
      e.preventDefault();
      dz.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) selectFile(file);
    });

    fi.addEventListener('change', () => {
      if (fi.files[0]) selectFile(fi.files[0]);
    });

    $('file-clear').addEventListener('click', () => {
      uploadAborted = true;
      resetSend();
    });

    $('send-btn').addEventListener('click', startUpload);

    function selectFile(file) {
      const MAX = 512 * 1024 * 1024;
      if (file.size > MAX) {
        showSendError('File exceeds 512 MB limit.');
        return;
      }
      selectedFile = file;
      hideSendError();

      // Show pill
      $('pill-name').textContent = file.name;
      $('pill-meta').textContent = formatBytes(file.size) + ' · ' + (file.type || 'file');
      $('file-icon').textContent = fileEmoji(file.name);
      $('file-pill').classList.add('visible');
      $('dropzone').style.display = 'none';

      $('send-btn').disabled = false;
      $('send-btn').textContent = 'Send File';
    }

    window.resetSend = function() {
      uploadAborted = true;
      selectedFile = null;
      fi.value = '';

      $('file-pill').classList.remove('visible');
      $('dropzone').style.display = '';
      $('progress-block').classList.remove('visible');
      $('share-block').classList.remove('visible');
      $('ttl-row').style.display = '';
      $('send-btn').disabled = true;
      $('send-btn').textContent = 'Send File';
      $('send-btn').style.display = '';
      $('new-btn').style.display = 'none';
      hideSendError();

      // Reset progress
      $('progress-fill').style.width = '0%';
      $('progress-pct').textContent = '0%';
      $('stat-speed').textContent = '—';
      $('stat-eta').textContent = '—';
      $('stat-parts').textContent = '0';
    };

    function showSendError(msg) {
      $('send-error').textContent = msg;
      $('send-error').classList.add('visible');
    }
    function hideSendError() {
      $('send-error').classList.remove('visible');
    }

    async function startUpload() {
      if (!selectedFile) return;
      uploadAborted = false;
      hideSendError();

      $('send-btn').disabled = true;
      $('send-btn').textContent = 'Uploading…';
      $('progress-block').classList.add('visible');
      $('file-clear').style.display = 'none';
      $('ttl-row').style.display = 'none';

      const file = selectedFile;
      const totalParts = Math.ceil(file.size / CHUNK_SIZE);

      // ── 1. Create session ──────────────────────────────────────────────────
      let sessionId;
      try {
        const res = await fetch(WORKER + '/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream',
            checksum: '',
            ttl: selectedTtl,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to create session (' + res.status + ')');
        }
        const data = await res.json();
        sessionId = data.sessionId;
        // Store expiresAt so we can display it on the share card after complete
        sessionExpiresAt = data.expiresAt;
      } catch (e) {
        showSendError(e.message);
        $('send-btn').disabled = false;
        $('send-btn').textContent = 'Retry';
        return;
      }

      // ── 2. Upload parts ────────────────────────────────────────────────────
      let offset = 0;
      let partNumber = 1;
      let uploadedBytes = 0;
      const startTime = Date.now();

      while (offset < file.size) {
        if (uploadAborted) return;

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();

        try {
          const res = await fetch(
            WORKER + '/upload-part?session=' + sessionId + '&part=' + partNumber,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/octet-stream' },
              body: buffer,
            }
          );
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Part ' + partNumber + ' failed (' + res.status + ')');
          }
        } catch (e) {
          if (uploadAborted) return;
          showSendError(e.message + ' — try again.');
          $('send-btn').disabled = false;
          $('send-btn').textContent = 'Retry';
          return;
        }

        uploadedBytes += buffer.byteLength;
        offset += buffer.byteLength;

        // Update UI
        const pct = Math.round((uploadedBytes / file.size) * 100);
        const elapsed = (Date.now() - startTime) / 1000;
        const bps = elapsed > 0 ? uploadedBytes / elapsed : 0;
        const remaining = bps > 0 ? (file.size - uploadedBytes) / bps : Infinity;

        $('progress-fill').style.width = pct + '%';
        $('progress-pct').textContent = pct + '%';
        $('stat-speed').textContent = formatSpeed(bps);
        $('stat-eta').textContent = formatEta(remaining);
        $('stat-parts').textContent = partNumber + ' / ' + totalParts;

        partNumber++;
      }

      if (uploadAborted) return;

      // ── 3. Complete ────────────────────────────────────────────────────────
      $('progress-label').textContent = 'Finalising…';
      let shareLink;
      try {
        const res = await fetch(WORKER + '/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Complete failed (' + res.status + ')');
        }
        const data = await res.json();
        shareLink = data.shareLink;
      } catch (e) {
        showSendError(e.message);
        $('send-btn').disabled = false;
        $('send-btn').textContent = 'Retry';
        return;
      }

      // ── Done ───────────────────────────────────────────────────────────────
      $('progress-fill').style.width = '100%';
      $('progress-pct').textContent = '100%';
      $('stat-eta').textContent = '✓';

      $('share-link').textContent = shareLink;
      $('share-link').title = shareLink;
      $('share-block').classList.add('visible');

      // Show real expiry datetime
      if (sessionExpiresAt) {
        const exp = new Date(sessionExpiresAt);
        const now = new Date();
        const diffMs = exp - now;
        const diffH = diffMs / 3600000;
        let label;
        if (diffH < 1)       label = Math.round(diffMs / 60000) + ' min';
        else if (diffH < 24) label = Math.round(diffH) + ' hour' + (Math.round(diffH) !== 1 ? 's' : '');
        else                 label = Math.round(diffH / 24) + ' day' + (Math.round(diffH / 24) !== 1 ? 's' : '');
        $('expiry-note').textContent =
          '• Deletes in ' + label + ' (' + exp.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ')  • Max one recipient';
      }

      $('send-btn').style.display = 'none';
      $('new-btn').style.display = '';
    }

    window.copyLink = function() {
      const link = $('share-link').textContent;
      navigator.clipboard.writeText(link).then(() => {
        $('copy-btn').textContent = 'Copied!';
        setTimeout(() => { $('copy-btn').textContent = 'Copy'; }, 2000);
      });
    };

    // ══════════════════════════════════════════════════════════════ RECEIVE ══

    let rxPollTimer = null;
    let rxSessionId = null;
    let rxMeta = null;

    window.startReceive = function() {
      const raw = $('rx-link-input').value.trim();
      $('rx-error').classList.remove('visible');

      // Accept bare session ID or full URL
      let sid;
      try {
        const url = new URL(raw);
        sid = url.searchParams.get('session');
      } catch {
        // Maybe they pasted just the session ID
        if (/^[0-9a-f-]{36}$/i.test(raw)) sid = raw;
      }

      if (!sid) {
        showRxError('Invalid link — paste a full Connect URL or session ID.');
        return;
      }

      rxSessionId = sid;
      rxMeta = null;
      $('rx-status').classList.add('visible');
      $('rx-go-btn').disabled = true;
      $('rx-link-input').disabled = true;
      $('rx-dl-btn').disabled = true;
      $('rx-dl-btn').textContent = 'Download';
      $('rx-file-pill').style.display = 'none';
      $('rx-progress-block').classList.remove('visible');
      $('rx-dot').className = 'status-dot pulse';
      $('rx-status-text').textContent = 'Waiting for upload to finish…';

      rxPoll();
      rxPollTimer = setInterval(rxPoll, 2500);
    };

    async function rxPoll() {
      try {
        const res = await fetch(WORKER + '/status?session=' + rxSessionId);
        const data = await res.json();

        if (data.expired) {
          clearInterval(rxPollTimer);
          $('rx-dot').className = 'status-dot red';
          $('rx-status-text').textContent = 'Link expired.';
          showRxError('This link has expired. Ask the sender for a new one.');
          resetRxInputs();
          return;
        }

        if (data.ready) {
          clearInterval(rxPollTimer);
          rxMeta = data;
          $('rx-dot').className = 'status-dot green';
          $('rx-status-text').textContent = 'Ready to download';

          $('rx-pill-name').textContent = data.fileName;
          $('rx-pill-meta').textContent = formatBytes(data.fileSize) + ' · ' + (data.mimeType || 'file');
          $('rx-file-icon').textContent = fileEmoji(data.fileName);
          $('rx-file-pill').style.display = 'flex';

          $('rx-dl-btn').disabled = false;
          $('rx-dl-btn').textContent = 'Download ' + data.fileName;
        }
      } catch {
        // transient — keep polling
      }
    }

    function resetRxInputs() {
      $('rx-go-btn').disabled = false;
      $('rx-link-input').disabled = false;
    }

    function showRxError(msg) {
      $('rx-error').textContent = msg;
      $('rx-error').classList.add('visible');
    }

    $('rx-link-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') window.startReceive();
    });

    $('rx-dl-btn').addEventListener('click', async () => {
      if (!rxSessionId || !rxMeta) return;

      $('rx-dl-btn').disabled = true;
      $('rx-dl-btn').textContent = 'Downloading…';
      $('rx-progress-block').classList.add('visible');

      try {
        const res = await fetch(WORKER + '/download?session=' + rxSessionId);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Download failed' }));
          throw new Error(err.error || 'Download failed (' + res.status + ')');
        }

        const contentLength = parseInt(res.headers.get('Content-Length') || '0', 10);
        const cd = res.headers.get('Content-Disposition') || '';
        const nameMatch = cd.match(/filename="?([^"]+)"?/);
        const suggestedName = nameMatch ? nameMatch[1] : (rxMeta.fileName || 'download');
        const mimeType = res.headers.get('Content-Type') || 'application/octet-stream';

        const startTime = Date.now();

        if ('showSaveFilePicker' in window) {
          await rxStreamToDisk(res, suggestedName, contentLength, startTime);
        } else {
          await rxDownloadBlob(res, suggestedName, mimeType, contentLength, startTime);
        }

        $('rx-dot').className = 'status-dot green';
        $('rx-status-text').textContent = 'Download complete';
        $('rx-dl-btn').textContent = 'Done!';
        $('rx-progress-fill').style.width = '100%';
        $('rx-progress-pct').textContent = '100%';
        $('rx-progress-label').textContent = 'Done';
      } catch (e) {
        showRxError(e.message || 'Download failed.');
        $('rx-dl-btn').disabled = false;
        $('rx-dl-btn').textContent = 'Retry Download';
      }
    });

    async function rxStreamToDisk(res, name, totalBytes, startTime) {
      const handle = await window.showSaveFilePicker({ suggestedName: name });
      const writable = await handle.createWritable();
      const reader = res.body.getReader();
      let received = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writable.write(value);
          received += value.byteLength;
          updateRxProgress(received, totalBytes, startTime);
        }
      } finally {
        await writable.close();
      }
    }

    async function rxDownloadBlob(res, name, mimeType, totalBytes, startTime) {
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        updateRxProgress(received, totalBytes, startTime);
      }

      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    function updateRxProgress(received, total, startTime) {
      const pct = total > 0 ? Math.round((received / total) * 100) : 0;
      const elapsed = (Date.now() - startTime) / 1000;
      const bps = elapsed > 0 ? received / elapsed : 0;

      $('rx-progress-fill').style.width = pct + '%';
      $('rx-progress-pct').textContent = pct + '%';
      $('rx-stat-received').textContent = formatBytes(received) + (total ? ' / ' + formatBytes(total) : '');
      $('rx-stat-speed').textContent = formatSpeed(bps);
    }

  })();
  </script>
</body>
</html>`;
}

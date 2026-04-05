import { useState } from "react";
import { useReceive } from "../../lib/use-receive";
import ErrorMessage from "../ui/ErrorMessage";
import FilePill from "../ui/FilePill";
import ProgressBlock from "../ui/ProgressBlock";
import StatusDot from "../ui/StatusDot";

interface ReceivePanelProps {
  workerUrl: string;
}

export default function ReceivePanel({ workerUrl }: ReceivePanelProps) {
  const [link, setLink] = useState("");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [linkError, setLinkError] = useState("");

  const {
    state,
    dotState,
    statusLabel,
    fileMeta,
    passwordProtected,
    password,
    setPassword,
    error,
    downloadPct,
    downloadLabel,
    downloadReceived,
    downloadSpeed,
    startPolling,
    startDownload,
  } = useReceive(workerUrl);

  function handleGo() {
    setLinkError("");
    const raw = link.trim();
    let sid: string | null = null;
    try {
      const url = new URL(raw);
      sid = url.searchParams.get("session");
    } catch {
      if (/^[0-9a-f-]{36}$/i.test(raw)) sid = raw;
    }
    if (!sid) {
      setLinkError("Invalid link — paste a full Connect URL or session ID.");
      return;
    }
    setSessionStarted(true);
    startPolling(sid);
  }

  const downloadDisabled =
    state === "ready" && passwordProtected ? password.length === 0 : state !== "ready";

  return (
    <div className="card">
      <div className="card-inner">
        <div className="panel-header">
          <p className="panel-title">Paste a Connect link</p>
          <p className="panel-desc">
            The sender shares a link from their app or this page. Paste it below to download the file.
          </p>
        </div>

        <div className="link-row">
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGo()}
            disabled={sessionStarted}
            placeholder="https://…/receive?session=…"
            autoComplete="off"
            spellCheck={false}
            className="input"
          />
          <button
            type="button"
            onClick={handleGo}
            disabled={sessionStarted || link.trim().length === 0}
            className="btn btn-primary btn-inline"
            style={{ width: "auto", padding: "10px 20px" }}
          >
            Go
          </button>
        </div>

        <ErrorMessage message={linkError || error} />

        {sessionStarted && (
          <>
            <StatusDot state={dotState} label={statusLabel} />

            {fileMeta && (
              <FilePill
                name={fileMeta.fileName}
                size={fileMeta.fileSize}
                mimeType={fileMeta.mimeType}
              />
            )}

            {fileMeta && passwordProtected && state === "ready" && (
              <div>
                <p style={{ color: "var(--fg-mute)", fontSize: "var(--t-sm)", margin: "0 0 8px" }}>
                  🔒 This file is password protected
                </p>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && password.length > 0) startDownload();
                  }}
                  placeholder="Enter password…"
                  autoComplete="current-password"
                  className="input"
                />
              </div>
            )}

            {state === "downloading" && (
              <ProgressBlock
                variant="download"
                pct={downloadPct}
                label={downloadLabel}
                received={downloadReceived}
                speed={downloadSpeed}
              />
            )}

            {state !== "done" && (
              <button
                type="button"
                onClick={startDownload}
                disabled={downloadDisabled || state === "downloading"}
                className="btn btn-primary"
              >
                {state === "downloading"
                  ? "Downloading…"
                  : fileMeta
                  ? `Download ${fileMeta.fileName}`
                  : "Download"}
              </button>
            )}

            {state === "done" && (
              <div className="done-row">
                <span className="done-dot" />
                Download complete
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

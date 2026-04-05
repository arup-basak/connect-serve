import { useEffect } from "react";
import { useReceive } from "../../lib/use-receive";
import ErrorMessage from "../ui/ErrorMessage";
import FilePill from "../ui/FilePill";
import ProgressBlock from "../ui/ProgressBlock";
import StatusDot from "../ui/StatusDot";

interface ReceivePageProps {
  workerUrl: string;
}

export default function ReceivePage({ workerUrl }: ReceivePageProps) {
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("session");
    if (sid) startPolling(sid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heading =
    state === "ready" || state === "downloading" || state === "done"
      ? "Your file is ready"
      : state === "error"
      ? "Something went wrong"
      : "Waiting for file…";

  const subtext =
    state === "ready"
      ? "Click download to save it to your device."
      : state === "done"
      ? "Your download is complete."
      : state === "error"
      ? ""
      : "Keep this tab open. The sender is uploading.";

  const downloadDisabled =
    state === "ready" && passwordProtected ? password.length === 0 : state !== "ready";

  return (
    <div className="receive-page">
      <div className="receive-card">
        <span className="logo receive-logo">Connect</span>

        <h1 className="receive-heading">{heading}</h1>
        {subtext && <p className="receive-subtext">{subtext}</p>}

        <StatusDot state={dotState} label={statusLabel} />

        <ErrorMessage message={error} />

        {fileMeta && (
          <div style={{ marginTop: "20px" }}>
            <FilePill
              name={fileMeta.fileName}
              size={fileMeta.fileSize}
              mimeType={fileMeta.mimeType}
            />
          </div>
        )}

        {fileMeta && passwordProtected && state === "ready" && (
          <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <p style={{ color: "var(--fg-mute)", fontSize: "var(--t-sm)", margin: 0 }}>
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
          <div style={{ marginTop: "20px" }}>
            <ProgressBlock
              variant="download"
              pct={downloadPct}
              label={downloadLabel}
              received={downloadReceived}
              speed={downloadSpeed}
            />
          </div>
        )}

        {state !== "done" && state !== "error" && (
          <button
            type="button"
            onClick={startDownload}
            disabled={downloadDisabled || state === "downloading"}
            className="btn btn-primary"
            style={{ marginTop: "24px" }}
          >
            {state === "downloading"
              ? "Downloading…"
              : fileMeta
              ? `Download ${fileMeta.fileName}`
              : "Download"}
          </button>
        )}

        {state === "done" && (
          <div className="done-row" style={{ marginTop: "24px" }}>
            <span className="done-dot" />
            Download complete
          </div>
        )}
      </div>
    </div>
  );
}

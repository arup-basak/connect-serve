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
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGo()}
          disabled={sessionStarted}
          placeholder="https://…/receive?session=…"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 bg-[#161616] border border-white/10 rounded-xl px-4 py-3 text-sm text-[#e0e0e0] placeholder:text-white/20 outline-none focus:border-blue-500/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={handleGo}
          disabled={sessionStarted || link.trim().length === 0}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors flex-shrink-0"
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
              <p className="text-xs text-white/40 mb-2 m-0">
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
                className="w-full bg-[#161616] border border-white/10 rounded-xl px-4 py-3 text-sm text-[#e0e0e0] placeholder:text-white/20 outline-none focus:border-blue-500/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-xl transition-colors"
            >
              {state === "downloading"
                ? "Downloading…"
                : fileMeta
                ? `Download ${fileMeta.fileName}`
                : "Download"}
            </button>
          )}

          {state === "done" && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-sm text-white/50">Download complete</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

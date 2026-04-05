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

  const [linkError, setLinkError] = useState("");

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
    state === "ready" && passwordProtected
      ? password.length === 0
      : state !== "ready";

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-[14px] border border-[#222] bg-[#111]">
        <div className="flex flex-col gap-4 p-6">

          <div>
            <div className="mb-2 text-sm font-medium">Paste a Connect link</div>
            <div className="mb-4 text-[13px] leading-relaxed text-neutral-500">
              The sender shares a link from their Mac app or this page. Paste it below to download the file.
            </div>
          </div>

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
              className="min-w-0 flex-1 rounded-lg border border-[#2d2d2d] bg-[#181818] px-3 py-2.5 text-sm text-neutral-200 outline-none transition-colors placeholder:text-[#3a3a3a] focus:border-blue-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleGo}
              disabled={sessionStarted || link.trim().length === 0}
              className="w-auto shrink-0 cursor-pointer rounded-lg border-none bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
            >
              Go
            </button>
          </div>

          <ErrorMessage message={linkError || error} />

          {/* Status + download flow */}
          {sessionStarted && (
            <div className="flex flex-col gap-3.5">
              <StatusDot state={dotState} label={statusLabel} />

              {fileMeta && (
                <FilePill
                  name={fileMeta.fileName}
                  size={fileMeta.fileSize}
                  mimeType={fileMeta.mimeType}
                />
              )}

              {fileMeta && passwordProtected && state === "ready" && (
                <div className="flex flex-col gap-2">
                  <div className="text-[13px] text-neutral-500">🔒 This file is password protected</div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && password.length > 0) startDownload();
                      }}
                      placeholder="Enter password…"
                      autoComplete="current-password"
                      className="min-w-0 flex-1 rounded-lg border border-[#2d2d2d] bg-[#181818] px-3 py-2.5 text-sm text-neutral-200 outline-none transition-colors placeholder:text-[#3a3a3a] focus:border-blue-500"
                    />
                  </div>
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
                  className="w-full rounded-lg border-none bg-blue-500 px-3 py-3.5 text-sm font-semibold text-white transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none disabled:opacity-35"
                >
                  {state === "downloading"
                    ? "Downloading…"
                    : fileMeta
                    ? `Download ${fileMeta.fileName}`
                    : "Download"}
                </button>
              )}

              {state === "done" && (
                <div className="flex items-center gap-1.5 text-[13px] text-neutral-500">
                  <span className="size-1.5 shrink-0 rounded-full bg-green-500" />
                  Download complete
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

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
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
      <div className="bg-[#0f0f0f] border border-white/[0.07] rounded-2xl p-10 w-full max-w-md">
        <span className="text-[10px] font-bold tracking-[0.2em] text-blue-500 uppercase block mb-8">
          CONNECT
        </span>

        <h1 className="text-2xl font-semibold text-[#e0e0e0] mb-2">{heading}</h1>
        {subtext && <p className="text-sm text-white/40 mb-6">{subtext}</p>}

        <StatusDot state={dotState} label={statusLabel} />

        <ErrorMessage message={error} />

        {fileMeta && (
          <div className="mt-5">
            <FilePill
              name={fileMeta.fileName}
              size={fileMeta.fileSize}
              mimeType={fileMeta.mimeType}
            />
          </div>
        )}

        {fileMeta && passwordProtected && state === "ready" && (
          <div className="mt-5">
            <p className="text-xs text-white/40 mb-2">🔒 This file is password protected</p>
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
          <div className="mt-5">
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
            className="mt-6 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-xl transition-colors"
          >
            {state === "downloading"
              ? "Downloading…"
              : fileMeta
              ? `Download ${fileMeta.fileName}`
              : "Download"}
          </button>
        )}

        {state === "done" && (
          <div className="mt-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
            <span className="text-sm text-white/50">Download complete</span>
          </div>
        )}
      </div>
    </div>
  );
}

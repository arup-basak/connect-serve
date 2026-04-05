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
    if (sid) {
      startPolling(sid);
    }
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
    state === "ready" && passwordProtected
      ? password.length === 0
      : state !== "ready";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-[480px] rounded-[14px] border border-[#222] bg-[#111] p-10 shadow-[0_24px_48px_rgba(0,0,0,0.5)]">

        <div className="mb-8 text-[13px] font-bold uppercase tracking-[0.14em] text-blue-500">
          Connect
        </div>

        <h1 className="mb-2 text-[22px] font-semibold leading-snug">{heading}</h1>
        {subtext && <p className="mb-8 text-sm text-neutral-500">{subtext}</p>}

        <div className="mb-7">
          <StatusDot state={dotState} label={statusLabel} />
        </div>

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
          <div className="mt-5 flex flex-col gap-2">
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
            className="mt-6 w-full cursor-pointer rounded-lg border-none bg-blue-500 px-3.5 py-3.5 text-[15px] font-semibold text-white transition-[opacity,transform] duration-150 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none disabled:opacity-40"
          >
            {state === "downloading"
              ? "Downloading…"
              : fileMeta
              ? `Download ${fileMeta.fileName}`
              : "Download"}
          </button>
        )}

        {state === "done" && (
          <div className="mt-6 flex items-center gap-1.5 text-[13px] text-neutral-500">
            <span className="size-1.5 shrink-0 rounded-full bg-green-500" />
            Download complete
          </div>
        )}

      </div>
    </div>
  );
}

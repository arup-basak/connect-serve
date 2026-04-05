import Uppy, { type Meta } from "@uppy/core";
import "@uppy/core/css/style.css";
import Dashboard from "@uppy/react/dashboard";
import { useUppyState } from "@uppy/react";
import "@uppy/dashboard/css/style.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_FILE_SIZE_DEFAULT } from "../../lib/api-common";
import {
  CHUNK_SIZE,
  formatEta,
  formatExpiryLabel,
  formatSpeed,
} from "../../lib/transfer-utils";
import ConnectWorkerUpload from "../../lib/uppy-connect-worker-upload";
import ErrorMessage from "../ui/ErrorMessage";
import FilePill from "../ui/FilePill";
import ProgressBlock from "../ui/ProgressBlock";
import TtlSelector from "../ui/TtlSelector";
import { TTL_DEFAULT } from "../ui/TtlSelector";

interface SendPanelProps {
  workerUrl: string;
}

export default function SendPanel({ workerUrl }: SendPanelProps) {
  const [error, setError] = useState("");
  const [ttl, setTtl] = useState(TTL_DEFAULT);
  const [password, setPassword] = useState("");
  const [passwordEnabled, setPasswordEnabled] = useState(false);

  const [uploadPct, setUploadPct] = useState(0);
  const [uploadLabel, setUploadLabel] = useState("Uploading…");
  const [speed, setSpeed] = useState("—");
  const [eta, setEta] = useState("—");
  const [partsLabel, setPartsLabel] = useState("0");

  const [shareLink, setShareLink] = useState("");
  const [expiryLabel, setExpiryLabel] = useState("");
  const [copied, setCopied] = useState(false);

  const uploadStartRef = useRef(0);

  const connectOptsRef = useRef({
    workerUrl,
    ttl,
    password: "" as string,
  });
  connectOptsRef.current = {
    workerUrl,
    ttl,
    password: passwordEnabled ? password : "",
  };

  const uppy = useMemo(
    () =>
      new Uppy<Meta, Record<string, unknown>>({
        id: "send-panel",
        autoProceed: false,
        restrictions: {
          maxNumberOfFiles: 1,
          maxFileSize: MAX_FILE_SIZE_DEFAULT,
        },
      }),
    []
  );

  const files = useUppyState(uppy, (s) => Object.values(s.files));

  useEffect(() => {
    uppy.use(ConnectWorkerUpload, {
      getConnectOptions: () => connectOptsRef.current,
    });
    return () => {
      const p = uppy.getPlugin("ConnectWorkerUpload");
      if (p) uppy.removePlugin(p);
    };
  }, [uppy]);

  useEffect(() => {
    const onRestrict = (_file: unknown, err: Error) => {
      setError(err.message);
    };
    const onUploadErr = (_file: unknown, err: Error) => {
      setError(err.message);
    };
    const onFileAdded = () => setError("");
    const onUploadSuccess = (
      _file: unknown,
      resp: { body?: { shareLink?: string; expiresAt?: string } }
    ) => {
      const body = resp?.body;
      if (body?.shareLink) {
        setShareLink(body.shareLink);
        setExpiryLabel(formatExpiryLabel(body.expiresAt ?? ""));
      }
    };
    const onUploadStart = () => {
      uploadStartRef.current = Date.now();
      setUploadLabel("Uploading…");
    };
    const onFinalising = () => setUploadLabel("Finalising…");
    const onProgress = (
      file: { size: number | null },
      progress: { bytesUploaded: number; bytesTotal: number }
    ) => {
      const total = progress.bytesTotal || file.size || 1;
      const pct = Math.round((progress.bytesUploaded / total) * 100);
      const elapsed = (Date.now() - uploadStartRef.current) / 1000;
      const bps = elapsed > 0 ? progress.bytesUploaded / elapsed : 0;
      const remaining = bps > 0 ? (total - progress.bytesUploaded) / bps : Infinity;
      setUploadPct(pct);
      setSpeed(formatSpeed(bps));
      setEta(formatEta(remaining));
      const fileSize = file.size ?? total;
      const totalParts = Math.ceil(fileSize / CHUNK_SIZE);
      const partNum = Math.min(
        totalParts,
        Math.ceil(progress.bytesUploaded / CHUNK_SIZE) || 1
      );
      setPartsLabel(`${partNum} / ${totalParts}`);
    };

    uppy.on("restriction-failed", onRestrict);
    uppy.on("upload-error", onUploadErr);
    uppy.on("file-added", onFileAdded);
    uppy.on("upload-success", onUploadSuccess);
    uppy.on("upload-start", onUploadStart);
    const uppyLoose = uppy as { on: (ev: string, fn: () => void) => void; off: (ev: string, fn: () => void) => void };
    uppyLoose.on("connect-finalising", onFinalising);
    uppy.on("upload-progress", onProgress);

    return () => {
      uppy.off("restriction-failed", onRestrict);
      uppy.off("upload-error", onUploadErr);
      uppy.off("file-added", onFileAdded);
      uppy.off("upload-success", onUploadSuccess);
      uppy.off("upload-start", onUploadStart);
      uppyLoose.off("connect-finalising", onFinalising);
      uppy.off("upload-progress", onProgress);
    };
  }, [uppy]);

  const hasFile = files.length > 0;
  const first = files[0];
  const isUploading = Boolean(
    first?.progress.uploadStarted && !first?.progress.uploadComplete
  );

  function resetSend() {
    uppy.cancelAll();
    uppy.clear();
    setError("");
    setPassword("");
    setPasswordEnabled(false);
    setTtl(TTL_DEFAULT);
    setUploadPct(0);
    setUploadLabel("Uploading…");
    setSpeed("—");
    setEta("—");
    setPartsLabel("0");
    setShareLink("");
    setExpiryLabel("");
    setCopied(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const canSend = hasFile && !isUploading && !shareLink;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-[14px] border border-[#222] bg-[#111]">
        <div className="flex flex-col gap-4 p-6">
          {!hasFile && !shareLink && (
            <Dashboard
              uppy={uppy}
              theme="dark"
              proudlyDisplayPoweredByUppy={false}
              hideUploadButton
              height={280}
              note="Up to 512 MB per file"
            />
          )}

          {hasFile && (
            <FilePill
              name={first.meta.name ?? "file"}
              size={first.size ?? 0}
              mimeType={first.meta.type ?? ""}
              onClear={canSend ? resetSend : undefined}
            />
          )}

          <ErrorMessage message={error} />

          {!isUploading && !shareLink && (
            <>
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="flex cursor-pointer select-none items-center gap-1.5 whitespace-nowrap text-xs text-neutral-500">
                  <input
                    type="checkbox"
                    checked={passwordEnabled}
                    onChange={(e) => {
                      setPasswordEnabled(e.target.checked);
                      if (!e.target.checked) setPassword("");
                    }}
                    className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-blue-500"
                  />
                  Password protect
                </label>
                {passwordEnabled && (
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password…"
                    autoComplete="new-password"
                    className="min-w-[160px] flex-1 rounded-lg border border-[#2d2d2d] bg-[#181818] px-3 py-1.5 text-[13px] text-neutral-200 outline-none transition-colors placeholder:text-[#3a3a3a] focus:border-blue-500"
                  />
                )}
              </div>
              <TtlSelector selected={ttl} onChange={setTtl} />
            </>
          )}

          {isUploading && (
            <ProgressBlock
              variant="upload"
              pct={uploadPct}
              label={uploadLabel}
              speed={speed}
              eta={eta}
              partsLabel={partsLabel}
            />
          )}

          {shareLink && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-1.5 text-[13px] text-neutral-500">
                <span className="size-1.5 shrink-0 rounded-full bg-green-500" />
                Upload complete &mdash; share this link
              </div>
              <div className="flex gap-2">
                <div
                  className="min-w-0 flex-1 cursor-text truncate rounded-lg border border-[#2d2d2d] bg-[#181818] px-3 py-2.5 font-mono text-[13px] text-neutral-200"
                  title={shareLink}
                >
                  {shareLink}
                </div>
                <button
                  type="button"
                  onClick={copyLink}
                  className="w-auto shrink-0 cursor-pointer rounded-lg border border-[#2d2d2d] bg-[#181818] px-4 py-2.5 text-[13px] font-medium text-neutral-200 transition-colors hover:bg-[#2d2d2d] active:scale-[0.97]"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              {expiryLabel && (
                <div className="text-xs text-[#3a3a3a]">{expiryLabel}</div>
              )}
            </div>
          )}

          {!shareLink && (
            <button
              type="button"
              onClick={() => {
                void uppy.upload().catch(() => {});
              }}
              disabled={!canSend}
              className="w-full rounded-lg border-none bg-blue-500 px-3 py-3.5 text-sm font-semibold text-white transition-[opacity,transform] hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none disabled:opacity-35"
            >
              {isUploading ? "Uploading…" : "Send File"}
            </button>
          )}

          {shareLink && (
            <button
              type="button"
              onClick={resetSend}
              className="w-auto rounded-lg border border-[#2d2d2d] bg-[#181818] px-4 py-2.5 text-[13px] font-medium text-neutral-500 transition-colors hover:border-neutral-600 hover:text-neutral-200"
            >
              New Transfer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

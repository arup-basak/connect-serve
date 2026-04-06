import Uppy, { type Meta } from "@uppy/core";
import { useUppyState } from "@uppy/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_FILE_SIZE_DEFAULT } from "../../lib/api-common";
import {
  CHUNK_SIZE,
  formatEta,
  formatExpiryLabel,
  formatSpeed,
  fileEmoji,
  formatBytes,
} from "../../lib/transfer-utils";
import ConnectWorkerUpload from "../../lib/uppy-connect-worker-upload";
import ErrorMessage from "../ui/ErrorMessage";
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

  const [dragCount, setDragCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadStartRef = useRef(0);

  const connectOptsRef = useRef({ workerUrl, ttl, password: "" as string });
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
    const onRestrict = (_file: unknown, err: Error) => setError(err.message);
    const onUploadErr = (_file: unknown, err: Error) => setError(err.message);
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
      const partNum = Math.min(totalParts, Math.ceil(progress.bytesUploaded / CHUNK_SIZE) || 1);
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

  function handleFileSelect(file: File) {
    uppy.cancelAll();
    setError("");
    try {
      uppy.addFile({
        name: file.name,
        type: file.type || "application/octet-stream",
        data: file,
        source: "local",
        size: file.size,
      });
    } catch {
      // restriction-failed event handles error display
    }
  }

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
    setDragCount(0);
  }

  function copyLink() {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const canSend = hasFile && !isUploading && !shareLink;
  const isDragging = dragCount > 0;

  return (
    <div className="flex flex-col gap-4">

        {/* ── Drop zone (no file selected, not done) ── */}
        {!hasFile && !shareLink && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
                e.target.value = "";
              }}
            />
            <div
              onDragEnter={(e) => { e.preventDefault(); setDragCount(c => c + 1); }}
              onDragLeave={() => setDragCount(c => Math.max(0, c - 1))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setDragCount(0);
                const f = e.dataTransfer.files[0];
                if (f) handleFileSelect(f);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-3 py-12 px-6 select-none ${
                isDragging
                  ? "border-blue-500 bg-blue-500/[0.06]"
                  : "border-white/[0.09] hover:border-white/20 bg-[#161616]/40 hover:bg-[#161616]/70"
              }`}
            >
              {/* Icon */}
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                isDragging ? "bg-blue-500/15" : "bg-white/[0.05]"
              }`}>
                <svg
                  width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke={isDragging ? "#60a5fa" : "currentColor"}
                  strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                  className={isDragging ? "" : "text-white/40"}
                >
                  <polyline points="16 16 12 12 8 16" />
                  <line x1="12" y1="12" x2="12" y2="21" />
                  <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
                </svg>
              </div>

              {/* Text */}
              <div className="text-center">
                <p className={`text-sm font-medium transition-colors ${
                  isDragging ? "text-blue-400" : "text-white/50"
                }`}>
                  {isDragging ? "Release to select" : "Drop your file here"}
                </p>
                <p className="text-xs text-white/25 mt-1">
                  or <span className={`transition-colors ${isDragging ? "text-blue-400" : "text-blue-500 hover:text-blue-400"}`}>click to browse</span> &mdash; up to 512 MB
                </p>
              </div>
            </div>
          </>
        )}

        {/* ── File selected (not uploading, not done) ── */}
        {hasFile && !shareLink && (
          <div className={`flex items-center gap-3 bg-[#161616] border rounded-xl px-3.5 py-3 transition-colors ${
            isUploading ? "border-white/[0.07]" : "border-white/10"
          }`}>
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-base flex-shrink-0">
              {fileEmoji(first?.meta.name ?? "")}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#e0e0e0] truncate">{first?.meta.name ?? "file"}</p>
              <p className="text-[11px] text-white/35 mt-0.5">
                {formatBytes(first?.size ?? 0)} &middot; {first?.meta.type || "file"}
              </p>
            </div>
            {canSend && (
              <button
                type="button"
                onClick={resetSend}
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-white/25 hover:text-white/70 hover:bg-white/[0.06] transition-colors text-lg leading-none"
                title="Remove"
              >
                &times;
              </button>
            )}
          </div>
        )}

        <ErrorMessage message={error} />

        {/* ── Options (before upload) ── */}
        {hasFile && !isUploading && !shareLink && (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-white/40 cursor-pointer select-none flex-shrink-0 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={passwordEnabled}
                  onChange={(e) => {
                    setPasswordEnabled(e.target.checked);
                    if (!e.target.checked) setPassword("");
                  }}
                  className="accent-blue-500 cursor-pointer flex-shrink-0 w-3.5 h-3.5"
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
                  className="flex-1 min-w-[160px] bg-[#161616] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#e0e0e0] placeholder:text-white/20 outline-none focus:border-blue-500/40 transition-colors"
                />
              )}
            </div>
            <TtlSelector selected={ttl} onChange={setTtl} />
          </>
        )}

        {/* ── Progress ── */}
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

        {/* ── Share link ── */}
        {shareLink && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-xs text-white/40">Upload complete — share this link</span>
            </div>
            <div className="flex gap-2 items-stretch">
              <div
                title={shareLink}
                className="flex-1 min-w-0 bg-[#161616] border border-white/[0.07] rounded-xl px-4 py-3 font-mono text-xs text-white/70 truncate flex items-center"
              >
                {shareLink}
              </div>
              <button
                type="button"
                onClick={copyLink}
                className={`flex-shrink-0 border rounded-xl px-5 text-sm font-medium transition-all ${
                  copied
                    ? "bg-green-500/10 border-green-500/30 text-green-400"
                    : "bg-white/[0.05] border-white/10 hover:bg-white/[0.09] hover:border-white/20 text-white/50 hover:text-white/80"
                }`}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            {expiryLabel && (
              <p className="text-[11px] text-white/20 leading-relaxed">{expiryLabel}</p>
            )}
          </div>
        )}

        {/* ── Send / New Transfer button ── */}
        {!shareLink ? (
          <button
            type="button"
            onClick={() => { void uppy.upload().catch(() => {}); }}
            disabled={!canSend}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-25 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-xl transition-colors"
          >
            {isUploading ? "Uploading…" : hasFile ? "Send File" : "Choose a file above"}
          </button>
        ) : (
          <button
            type="button"
            onClick={resetSend}
            className="w-full bg-white/[0.05] border border-white/[0.07] hover:bg-white/[0.08] hover:border-white/15 text-white/50 hover:text-white/80 text-sm font-medium py-3 rounded-xl transition-colors"
          >
            New Transfer
          </button>
        )}

    </div>
  );
}

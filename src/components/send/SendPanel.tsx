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
    <div className="card">
      <div className="card-inner">
        {!hasFile && !shareLink && (
          <Dashboard
            uppy={uppy}
            theme="dark"
            proudlyDisplayPoweredByUppy={false}
            hideUploadButton
            height={260}
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
            <div className="pw-row">
              <label className="pw-label">
                <input
                  type="checkbox"
                  checked={passwordEnabled}
                  onChange={(e) => {
                    setPasswordEnabled(e.target.checked);
                    if (!e.target.checked) setPassword("");
                  }}
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
                  className="input"
                  style={{ flex: 1, minWidth: "160px" }}
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
          <div className="share-section">
            <div className="share-success">
              <span className="share-success-dot" />
              Upload complete — share this link
            </div>
            <div className="share-link-row">
              <div className="share-link-display" title={shareLink}>
                {shareLink}
              </div>
              <button
                type="button"
                onClick={copyLink}
                className="btn btn-secondary btn-inline"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            {expiryLabel && <div className="share-expiry">{expiryLabel}</div>}
          </div>
        )}

        {!shareLink && (
          <button
            type="button"
            onClick={() => { void uppy.upload().catch(() => {}); }}
            disabled={!canSend}
            className="btn btn-primary"
          >
            {isUploading ? "Uploading…" : "Send File"}
          </button>
        )}

        {shareLink && (
          <button
            type="button"
            onClick={resetSend}
            className="btn btn-secondary"
          >
            New Transfer
          </button>
        )}
      </div>
    </div>
  );
}

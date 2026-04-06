import { useCallback, useEffect, useRef, useState } from "react";
import { downloadViaBlob, streamToDisk } from "./download-utils";
import { formatBytes, formatSpeed } from "./transfer-utils";

export type ReceiveState = "idle" | "polling" | "ready" | "downloading" | "done" | "error";
export type DotState = "waiting" | "ready" | "done" | "error";

export interface FileMeta {
  fileName: string;
  fileSize: number;
  mimeType: string;
  passwordProtected?: boolean;
}

export interface ReceiveHookResult {
  state: ReceiveState;
  dotState: DotState;
  statusLabel: string;
  fileMeta: FileMeta | null;
  passwordProtected: boolean;
  password: string;
  setPassword: (p: string) => void;
  error: string;
  downloadPct: number;
  downloadLabel: string;
  downloadReceived: string;
  downloadSpeed: string;
  startPolling: (sessionId: string) => void;
  startDownload: () => void;
}

export function useReceive(workerUrl: string): ReceiveHookResult {
  const [state, setState] = useState<ReceiveState>("idle");
  const [dotState, setDotState] = useState<DotState>("waiting");
  const [statusLabel, setStatusLabel] = useState("Waiting for upload to finish…");
  const [fileMeta, setFileMeta] = useState<FileMeta | null>(null);
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [downloadPct, setDownloadPct] = useState(0);
  const [downloadLabel, setDownloadLabel] = useState("Downloading…");
  const [downloadReceived, setDownloadReceived] = useState("—");
  const [downloadSpeed, setDownloadSpeed] = useState("—");

  const sessionIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      const res = await fetch(`${workerUrl}/status?session=${sid}`);
      const data = await res.json() as any;

      if (data.expired) {
        stopPolling();
        setDotState("error");
        setStatusLabel("Link expired.");
        setError("This link has expired. Ask the sender for a new one.");
        setState("error");
        return;
      }

      if (data.ready) {
        stopPolling();
        const meta: FileMeta = {
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          passwordProtected: !!data.passwordProtected,
        };
        setFileMeta(meta);
        setPasswordProtected(!!data.passwordProtected);
        setDotState("ready");
        setStatusLabel("Ready to download");
        setState("ready");
      }
    } catch {
      // transient — keep polling
    }
  }, [workerUrl, stopPolling]);

  const startPolling = useCallback(
    (sessionId: string) => {
      sessionIdRef.current = sessionId;
      setState("polling");
      setDotState("waiting");
      setStatusLabel("Waiting for upload to finish…");
      setFileMeta(null);
      setPasswordProtected(false);
      setPassword("");
      setError("");
      setDownloadPct(0);

      poll();
      pollTimerRef.current = setInterval(poll, 2500);
    },
    [poll]
  );

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  const startDownload = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid || !fileMeta) return;

    setState("downloading");
    setDownloadLabel("Downloading…");
    setError("");

    try {
      const dlUrl =
        `${workerUrl}/download?session=${sid}` +
        (passwordProtected && password ? `&password=${encodeURIComponent(password)}` : "");

      const res = await fetch(dlUrl);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Download failed" })) as any;
        if (res.status === 401 || res.status === 403) {
          setError("Incorrect password. Please try again.");
          setState("ready");
          return;
        }
        throw new Error(err.error || `Download failed (${res.status})`);
      }

      const totalBytes = parseInt(res.headers.get("Content-Length") || "0", 10);
      const cd = res.headers.get("Content-Disposition") || "";
      const nameMatch = cd.match(/filename="?([^"]+)"?/);
      const suggestedName = nameMatch ? nameMatch[1] : fileMeta.fileName;
      const mimeType = res.headers.get("Content-Type") || "application/octet-stream";

      const onProgress = ({ received, total, bps, pct }: { received: number; total: number; bps: number; pct: number }) => {
        setDownloadPct(pct);
        setDownloadReceived(
          formatBytes(received) + (total ? " / " + formatBytes(total) : "")
        );
        setDownloadSpeed(formatSpeed(bps));
      };

      if ("showSaveFilePicker" in window) {
        await streamToDisk(res, suggestedName, totalBytes, onProgress);
      } else {
        await downloadViaBlob(res, suggestedName, mimeType, totalBytes, onProgress);
      }

      setDownloadPct(100);
      setDownloadLabel("Done");
      setDotState("done");
      setStatusLabel("Download complete");
      setState("done");
    } catch (e: any) {
      setError(e.message || "Download failed.");
      setState("ready");
    }
  }, [workerUrl, fileMeta, passwordProtected, password]);

  return {
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
  };
}

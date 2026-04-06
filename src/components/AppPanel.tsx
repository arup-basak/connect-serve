import Uppy, { type Meta } from "@uppy/core";
import { useUppyState } from "@uppy/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adjectives, animals, uniqueNamesGenerator } from "unique-names-generator";
import { MAX_FILE_SIZE_DEFAULT } from "../lib/api-common";
import {
  CHUNK_SIZE,
  fileEmoji,
  formatBytes,
  formatEta,
  formatExpiryLabel,
  formatSpeed,
} from "../lib/transfer-utils";
import ConnectWorkerUpload from "../lib/uppy-connect-worker-upload";
import ErrorMessage from "./ui/ErrorMessage";
import FilePill from "./ui/FilePill";
import ProgressBlock from "./ui/ProgressBlock";
import TtlSelector, { TTL_DEFAULT } from "./ui/TtlSelector";

type Mode = "cloud" | "local";
type SendState = "idle" | "creating-offer" | "waiting" | "connecting" | "transferring" | "done" | "error";
type RecvState = "idle" | "accepting" | "connecting" | "receiving" | "done" | "error";

const DC_CHUNK = 65536;

interface Device { id: string; name: string; }
interface IncomingTransfer {
  roomId: string;
  senderName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  passwordProtected?: boolean;
}

function loadOrCreateName(): string {
  try {
    const stored = localStorage.getItem("local-device-name");
    if (stored) return stored;
    const name = uniqueNamesGenerator({
      dictionaries: [adjectives, animals],
      separator: " ",
      style: "capital",
      seed: Math.floor(Math.random() * 1_000_000),
    });
    localStorage.setItem("local-device-name", name);
    return name;
  } catch {
    return uniqueNamesGenerator({ dictionaries: [adjectives, animals], separator: " ", style: "capital" });
  }
}

function waitForIce(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") { resolve(); return; }
    const h = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", h);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", h);
    setTimeout(() => { pc.removeEventListener("icegatheringstatechange", h); resolve(); }, 2000);
  });
}

interface AppPanelProps {
  workerUrl: string;
}

export default function AppPanel({ workerUrl }: AppPanelProps) {

  // ── mode ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("cloud");

  // ── shared file ───────────────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [dragCount, setDragCount] = useState(0);
  const [fileError, setFileError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── shared password ───────────────────────────────────────────────────────
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword] = useState("");

  // ── cloud state ───────────────────────────────────────────────────────────
  const [ttl, setTtl] = useState(TTL_DEFAULT);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadLabel, setUploadLabel] = useState("Uploading…");
  const [uploadSpeed, setUploadSpeed] = useState("—");
  const [uploadEta, setUploadEta] = useState("—");
  const [partsLabel, setPartsLabel] = useState("0");
  const [shareLink, setShareLink] = useState("");
  const [expiryLabel, setExpiryLabel] = useState("");
  const [copied, setCopied] = useState(false);
  const uploadStartRef = useRef(0);

  const connectOptsRef = useRef({ workerUrl, ttl, password: "" as string });
  connectOptsRef.current = { workerUrl, ttl, password: passwordEnabled ? password : "" };

  const uppy = useMemo(
    () => new Uppy<Meta, Record<string, unknown>>({
      id: "app-panel",
      autoProceed: false,
      restrictions: { maxNumberOfFiles: 1, maxFileSize: MAX_FILE_SIZE_DEFAULT },
    }),
    []
  );
  const uppyFiles = useUppyState(uppy, (s) => Object.values(s.files));
  const isUploading = Boolean(uppyFiles[0]?.progress.uploadStarted && !uppyFiles[0]?.progress.uploadComplete);

  useEffect(() => {
    uppy.use(ConnectWorkerUpload, { getConnectOptions: () => connectOptsRef.current });
    return () => { const p = uppy.getPlugin("ConnectWorkerUpload"); if (p) uppy.removePlugin(p); };
  }, [uppy]);

  useEffect(() => {
    const onRestrict = (_f: unknown, err: Error) => setFileError(err.message);
    const onUploadErr = (_f: unknown, err: Error) => setFileError(err.message);
    const onUploadSuccess = (_f: unknown, resp: { body?: { shareLink?: string; expiresAt?: string } }) => {
      const body = resp?.body;
      if (body?.shareLink) {
        setShareLink(body.shareLink);
        setExpiryLabel(formatExpiryLabel(body.expiresAt ?? ""));
      }
    };
    const onUploadStart = () => { uploadStartRef.current = Date.now(); setUploadLabel("Uploading…"); };
    const onFinalising = () => setUploadLabel("Finalising…");
    const onProgress = (f: { size: number | null }, progress: { bytesUploaded: number; bytesTotal: number }) => {
      const total = progress.bytesTotal || f.size || 1;
      const pct = Math.round((progress.bytesUploaded / total) * 100);
      const elapsed = (Date.now() - uploadStartRef.current) / 1000;
      const bps = elapsed > 0 ? progress.bytesUploaded / elapsed : 0;
      const remaining = bps > 0 ? (total - progress.bytesUploaded) / bps : Infinity;
      setUploadPct(pct);
      setUploadSpeed(formatSpeed(bps));
      setUploadEta(formatEta(remaining));
      const fileSize = f.size ?? total;
      const totalParts = Math.ceil(fileSize / CHUNK_SIZE);
      const partNum = Math.min(totalParts, Math.ceil(progress.bytesUploaded / CHUNK_SIZE) || 1);
      setPartsLabel(`${partNum} / ${totalParts}`);
    };
    uppy.on("restriction-failed", onRestrict);
    uppy.on("upload-error", onUploadErr);
    uppy.on("upload-success", onUploadSuccess);
    uppy.on("upload-start", onUploadStart);
    const ul = uppy as { on: (ev: string, fn: () => void) => void; off: (ev: string, fn: () => void) => void };
    ul.on("connect-finalising", onFinalising);
    uppy.on("upload-progress", onProgress);
    return () => {
      uppy.off("restriction-failed", onRestrict);
      uppy.off("upload-error", onUploadErr);
      uppy.off("upload-success", onUploadSuccess);
      uppy.off("upload-start", onUploadStart);
      ul.off("connect-finalising", onFinalising);
      uppy.off("upload-progress", onProgress);
    };
  }, [uppy]);

  // ── local: identity ───────────────────────────────────────────────────────
  const [myDeviceId, setMyDeviceId] = useState("");
  const [myDeviceName, setMyDeviceName] = useState<string>(loadOrCreateName);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(myDeviceName);
  const myDeviceIdRef = useRef("");
  const myDeviceNameRef = useRef(myDeviceName);
  myDeviceNameRef.current = myDeviceName;

  // ── local: send state ──────────────────────────────────────────────────────
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendPct, setSendPct] = useState(0);
  const [sendSpeed, setSendSpeed] = useState("—");
  const [sendEta, setSendEta] = useState("—");
  const [sendError, setSendError] = useState("");

  // ── local: receive state ───────────────────────────────────────────────────
  const [incoming, setIncoming] = useState<IncomingTransfer | null>(null);
  const [recvState, setRecvState] = useState<RecvState>("idle");
  const [recvMeta, setRecvMeta] = useState<{ name: string; size: number; mimeType: string } | null>(null);
  const [recvPct, setRecvPct] = useState(0);
  const [recvSpeed, setRecvSpeed] = useState("—");
  const [recvReceived, setRecvReceived] = useState("—");
  const [recvError, setRecvError] = useState("");
  const [recvPassword, setRecvPassword] = useState("");

  const pcSendRef = useRef<RTCPeerConnection | null>(null);
  const dcSendRef = useRef<RTCDataChannel | null>(null);
  const pcRecvRef = useRef<RTCPeerConnection | null>(null);
  const sendPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── device registration (always active) ──────────────────────────────────
  useEffect(() => {
    let heartbeatId: ReturnType<typeof setInterval> | null = null;
    const register = async () => {
      try {
        const r = await fetch(`${workerUrl}/local-devices`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "register", name: myDeviceNameRef.current }),
        });
        const data = await r.json() as { deviceId: string };
        myDeviceIdRef.current = data.deviceId;
        setMyDeviceId(data.deviceId);
        heartbeatId = setInterval(async () => {
          try {
            await fetch(`${workerUrl}/local-devices`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "heartbeat", deviceId: myDeviceIdRef.current, name: myDeviceNameRef.current }),
            });
          } catch { /**/ }
        }, 25000);
      } catch { /**/ }
    };
    void register();
    return () => {
      if (heartbeatId) clearInterval(heartbeatId);
      if (myDeviceIdRef.current) {
        void fetch(`${workerUrl}/local-devices`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unregister", deviceId: myDeviceIdRef.current }),
        });
      }
    };
  }, [workerUrl]);

  const fetchDevices = useCallback(async () => {
    try {
      const r = await fetch(`${workerUrl}/local-devices`);
      const data = await r.json() as { devices: Device[] };
      setDevices(data.devices.filter((d) => d.id !== myDeviceIdRef.current));
    } catch { /**/ }
  }, [workerUrl]);

  useEffect(() => {
    if (!myDeviceId) return;
    void fetchDevices();
    const id = setInterval(() => void fetchDevices(), 5000);
    return () => clearInterval(id);
  }, [myDeviceId, fetchDevices]);

  useEffect(() => {
    if (!myDeviceId || recvState !== "idle") return;
    const poll = async () => {
      try {
        const r = await fetch(`${workerUrl}/local-signal?deviceId=${myDeviceId}`);
        const data = await r.json() as { incoming: IncomingTransfer | null };
        setIncoming(data.incoming);
      } catch { /**/ }
    };
    void poll();
    const id = setInterval(() => void poll(), 3000);
    return () => clearInterval(id);
  }, [workerUrl, myDeviceId, recvState]);

  // ── file handling ─────────────────────────────────────────────────────────
  function handleFileSelect(f: File) {
    setFileError("");
    setFile(f);
    setShareLink("");
    setSendState("idle");
    setSendError("");
  }

  // ── cloud actions ──────────────────────────────────────────────────────────
  function startCloudUpload() {
    if (!file) return;
    setFileError("");
    uppy.cancelAll();
    uppy.clear();
    try {
      uppy.addFile({
        name: file.name,
        type: file.type || "application/octet-stream",
        data: file,
        source: "local",
        size: file.size,
      });
    } catch {
      return;
    }
    void uppy.upload().catch(() => {});
  }

  function resetCloud() {
    uppy.cancelAll();
    uppy.clear();
    setFile(null);
    setFileError("");
    setUploadPct(0);
    setUploadLabel("Uploading…");
    setUploadSpeed("—");
    setUploadEta("—");
    setPartsLabel("0");
    setShareLink("");
    setExpiryLabel("");
    setCopied(false);
    setPasswordEnabled(false);
    setPassword("");
  }

  function copyLink() {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── local send actions ─────────────────────────────────────────────────────
  function resetLocalSend(clearFile = true) {
    if (sendPollRef.current) { clearInterval(sendPollRef.current); sendPollRef.current = null; }
    dcSendRef.current?.close(); pcSendRef.current?.close();
    pcSendRef.current = null; dcSendRef.current = null;
    if (clearFile) { setFile(null); setPasswordEnabled(false); setPassword(""); }
    setSelectedId(null);
    setSendPct(0); setSendSpeed("—"); setSendEta("—");
    setSendError(""); setSendState("idle");
  }

  function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setMyDeviceName(trimmed);
    try { localStorage.setItem("local-device-name", trimmed); } catch { /**/ }
    setEditingName(false);
    if (myDeviceIdRef.current) {
      void fetch(`${workerUrl}/local-devices`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "heartbeat", deviceId: myDeviceIdRef.current, name: trimmed }),
      });
    }
  }

  const startLocalTransfer = useCallback(async () => {
    if (!file || !selectedId) return;
    setSendError(""); setSendState("creating-offer");
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pcSendRef.current = pc;
      const dc = pc.createDataChannel("file", { ordered: true });
      dcSendRef.current = dc;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIce(pc);
      const res = await fetch(`${workerUrl}/local-signal`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          offerSdp: pc.localDescription!.sdp,
          targetDeviceId: selectedId,
          senderName: myDeviceNameRef.current,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
          password: passwordEnabled ? password : undefined,
        }),
      });
      if (!res.ok) throw new Error("Signaling failed");
      const { roomId } = await res.json() as { roomId: string };
      setSendState("waiting");
      sendPollRef.current = setInterval(async () => {
        if (!pcSendRef.current) return;
        try {
          const r = await fetch(`${workerUrl}/local-signal?roomId=${roomId}`);
          const data = await r.json() as { answerSdp?: string };
          if (data.answerSdp && !pc.remoteDescription) {
            if (sendPollRef.current) { clearInterval(sendPollRef.current); sendPollRef.current = null; }
            setSendState("connecting");
            await pc.setRemoteDescription({ type: "answer", sdp: data.answerSdp });
            await new Promise<void>((resolve) => {
              if (dc.readyState === "open") { resolve(); return; }
              dc.addEventListener("open", () => resolve(), { once: true });
            });
            setSendState("transferring");
            const start = Date.now();
            dc.send(JSON.stringify({ type: "meta", name: file.name, size: file.size, mimeType: file.type || "application/octet-stream" }));
            let offset = 0;
            while (offset < file.size) {
              while (dc.bufferedAmount > 2 * 1024 * 1024) await new Promise(r => setTimeout(r, 10));
              const chunk = await file.slice(offset, offset + DC_CHUNK).arrayBuffer();
              dc.send(chunk); offset += chunk.byteLength;
              const elapsed = (Date.now() - start) / 1000;
              const bps = elapsed > 0 ? offset / elapsed : 0;
              const rem = bps > 0 ? (file.size - offset) / bps : Infinity;
              setSendPct(Math.round((offset / file.size) * 100));
              setSendSpeed(formatSpeed(bps));
              setSendEta(rem < 60 ? Math.ceil(rem) + "s" : Math.ceil(rem / 60) + "m");
            }
            dc.send(JSON.stringify({ type: "done" }));
            setSendState("done");
          }
        } catch (e: unknown) {
          setSendError(e instanceof Error ? e.message : "Transfer failed");
          setSendState("error");
        }
      }, 1000);
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : "Transfer failed");
      setSendState("error");
    }
  }, [file, selectedId, workerUrl, password, passwordEnabled]);

  // ── local receive actions ──────────────────────────────────────────────────
  function resetRecv() {
    pcRecvRef.current?.close(); pcRecvRef.current = null;
    setIncoming(null); setRecvMeta(null);
    setRecvPct(0); setRecvSpeed("—"); setRecvReceived("—");
    setRecvError(""); setRecvState("idle");
    setRecvPassword("");
  }

  async function acceptTransfer() {
    if (!incoming) return;
    setRecvError(""); setRecvState("accepting");
    try {
      const r = await fetch(`${workerUrl}/local-signal?roomId=${incoming.roomId}`);
      if (!r.ok) throw new Error("Room expired");
      const data = await r.json() as { offerSdp?: string };
      if (!data.offerSdp) throw new Error("Offer not available");
      setRecvState("connecting");
      const pc = new RTCPeerConnection({ iceServers: [] });
      pcRecvRef.current = pc;
      pc.addEventListener("datachannel", (evt) => {
        const dc = evt.channel;
        const chunks: ArrayBuffer[] = [];
        let meta: { name: string; size: number; mimeType: string } | null = null;
        let receivedBytes = 0;
        const start = Date.now();
        dc.addEventListener("message", (e) => {
          if (typeof e.data === "string") {
            const msg = JSON.parse(e.data) as { type: string; name?: string; size?: number; mimeType?: string };
            if (msg.type === "meta") {
              meta = { name: msg.name!, size: msg.size!, mimeType: msg.mimeType! };
              setRecvMeta(meta); setRecvState("receiving");
            } else if (msg.type === "done" && meta) {
              const blob = new Blob(chunks, { type: meta.mimeType });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = meta.name; a.click();
              setTimeout(() => URL.revokeObjectURL(url), 60000);
              setRecvState("done");
            }
          } else {
            const buf = e.data as ArrayBuffer;
            chunks.push(buf); receivedBytes += buf.byteLength;
            if (meta) {
              const elapsed = (Date.now() - start) / 1000;
              const bps = elapsed > 0 ? receivedBytes / elapsed : 0;
              setRecvPct(Math.round((receivedBytes / meta.size) * 100));
              setRecvSpeed(formatSpeed(bps));
              setRecvReceived(formatBytes(receivedBytes) + " / " + formatBytes(meta.size));
            }
          }
        });
      });
      await pc.setRemoteDescription({ type: "offer", sdp: data.offerSdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIce(pc);
      const answerRes = await fetch(`${workerUrl}/local-signal`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          roomId: incoming.roomId,
          answerSdp: pc.localDescription!.sdp,
          password: incoming.passwordProtected ? recvPassword : undefined,
        }),
      });
      if (!answerRes.ok) {
        const err = await answerRes.json() as { error?: string };
        throw new Error(err.error ?? "Connection failed");
      }
    } catch (e: unknown) {
      setRecvError(e instanceof Error ? e.message : "Connection failed");
      setRecvState("error");
    }
  }

  useEffect(() => () => {
    if (sendPollRef.current) clearInterval(sendPollRef.current);
    dcSendRef.current?.close(); pcSendRef.current?.close(); pcRecvRef.current?.close();
  }, []);

  // ── derived ───────────────────────────────────────────────────────────────
  const isDragging = dragCount > 0;
  const hasFile = !!file;
  const selectedDevice = devices.find((d) => d.id === selectedId);
  const canLocalSend = hasFile && !!selectedId && sendState === "idle";
  const canCloudSend = hasFile && !isUploading && !shareLink;
  const localBusy = sendState !== "idle" && sendState !== "error";

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">

      {/* ══ SEND SECTION ══════════════════════════════════════════════════════ */}
      <div className="p-6 flex flex-col gap-4">

        {/* Drop zone — hidden when file is selected or upload is done */}
        {!hasFile && !shareLink && sendState === "idle" && (
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
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${isDragging ? "bg-blue-500/15" : "bg-white/[0.05]"}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke={isDragging ? "#60a5fa" : "currentColor"}
                  strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                  className={isDragging ? "" : "text-white/40"}
                >
                  <polyline points="16 16 12 12 8 16" />
                  <line x1="12" y1="12" x2="12" y2="21" />
                  <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
                </svg>
              </div>
              <div className="text-center">
                <p className={`text-sm font-medium transition-colors ${isDragging ? "text-blue-400" : "text-white/50"}`}>
                  {isDragging ? "Release to select" : "Drop your file here"}
                </p>
                <p className="text-xs text-white/25 mt-1">
                  or <span className={`transition-colors ${isDragging ? "text-blue-400" : "text-blue-500 hover:text-blue-400"}`}>click to browse</span> &mdash; up to 512 MB for Cloud
                </p>
              </div>
            </div>
          </>
        )}

        {/* File pill */}
        {hasFile && !shareLink && (
          <div className={`flex items-center gap-3 bg-[#161616] border rounded-xl px-3.5 py-3 transition-colors ${
            isUploading || localBusy ? "border-white/[0.07]" : "border-white/10"
          }`}>
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-base flex-shrink-0">
              {fileEmoji(file!.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#e0e0e0] truncate">{file!.name}</p>
              <p className="text-[11px] text-white/35 mt-0.5">
                {formatBytes(file!.size)} &middot; {file!.type || "file"}
              </p>
            </div>
            {!isUploading && !localBusy && (
              <button
                type="button"
                onClick={() => { setFile(null); setFileError(""); setSendError(""); setSendState("idle"); resetCloud(); }}
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-white/25 hover:text-white/70 hover:bg-white/[0.06] transition-colors text-lg leading-none"
                title="Remove"
              >
                &times;
              </button>
            )}
          </div>
        )}

        <ErrorMessage message={fileError} />

        {/* Options — shown after file picked and before sending */}
        {hasFile && !isUploading && !shareLink && sendState === "idle" && (
          <>
            {/* Mode toggle */}
            <div className="flex gap-1 p-1 bg-[#161616] border border-white/[0.07] rounded-xl">
              {(["cloud", "local"] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setSendError(""); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                    mode === m
                      ? "bg-white/[0.09] text-white border border-white/10"
                      : "text-white/30 hover:text-white/55"
                  }`}
                >
                  {m === "cloud" ? "☁  Cloud" : "⇌  Local"}
                </button>
              ))}
            </div>

            {/* Password */}
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs text-white/40 cursor-pointer select-none flex-shrink-0 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={passwordEnabled}
                  onChange={(e) => { setPasswordEnabled(e.target.checked); if (!e.target.checked) setPassword(""); }}
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

            {/* Cloud: TTL */}
            {mode === "cloud" && <TtlSelector selected={ttl} onChange={setTtl} />}

            {/* Local: device list */}
            {mode === "local" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-widest text-white/30 uppercase">Nearby devices</span>
                  <button
                    type="button"
                    onClick={() => void fetchDevices()}
                    className="text-white/25 hover:text-white/50 text-sm transition-colors leading-none"
                    title="Refresh"
                  >↻</button>
                </div>
                {!myDeviceId ? (
                  <div className="flex items-center gap-2 py-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs text-white/30">Registering…</span>
                  </div>
                ) : devices.length === 0 ? (
                  <p className="text-xs text-white/30 py-2 leading-relaxed">No devices found. Ask the recipient to open this page.</p>
                ) : (
                  <div className="flex flex-col rounded-xl border border-white/10 overflow-hidden">
                    {devices.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedId(d.id === selectedId ? null : d.id)}
                        className={`flex items-center gap-3 px-3.5 py-3 text-left transition-colors border-b border-white/[0.06] last:border-0 ${
                          d.id === selectedId ? "bg-blue-500/10" : "hover:bg-white/[0.04]"
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                        <span className="flex-1 text-sm text-white/80">{d.name}</span>
                        {d.id === selectedId && <span className="text-blue-400 text-sm">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {sendError && (
              <p className="text-xs text-red-400 bg-red-500/[0.07] border border-red-500/20 rounded-lg px-3 py-2">
                {sendError}
              </p>
            )}
          </>
        )}

        {/* Local in-progress states */}
        {sendState === "creating-offer" && (
          <div className="flex items-center gap-2 py-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
            <span className="text-sm text-white/50">Setting up connection…</span>
          </div>
        )}
        {sendState === "waiting" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              <span className="text-sm text-white/50">
                Waiting for <span className="text-white/80">{selectedDevice?.name ?? "receiver"}</span> to accept…
              </span>
            </div>
            <button type="button" onClick={() => resetLocalSend(false)} className="text-sm text-white/30 hover:text-white/60 transition-colors text-left">Cancel</button>
          </div>
        )}
        {sendState === "connecting" && (
          <div className="flex items-center gap-2 py-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
            <span className="text-sm text-white/50">Connecting…</span>
          </div>
        )}
        {sendState === "transferring" && (
          <ProgressBlock variant="upload" pct={sendPct} label="Sending…" speed={sendSpeed} eta={sendEta} partsLabel={`${sendPct}%`} />
        )}
        {sendState === "done" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-sm text-white/50">Transfer complete</span>
            </div>
          </div>
        )}
        {sendState === "error" && (
          <p className="text-xs text-red-400 bg-red-500/[0.07] border border-red-500/20 rounded-lg px-3 py-2">
            {sendError || "Transfer failed"}
          </p>
        )}

        {/* Cloud upload progress */}
        {isUploading && (
          <ProgressBlock variant="upload" pct={uploadPct} label={uploadLabel} speed={uploadSpeed} eta={uploadEta} partsLabel={partsLabel} />
        )}

        {/* Cloud share link */}
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
            {expiryLabel && <p className="text-[11px] text-white/20 leading-relaxed">{expiryLabel}</p>}
          </div>
        )}

        {/* Action button */}
        {mode === "cloud" && !shareLink && (
          <button
            type="button"
            onClick={startCloudUpload}
            disabled={!canCloudSend}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-25 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-xl transition-colors"
          >
            {isUploading ? "Uploading…" : hasFile ? "Send via Cloud" : "Choose a file above"}
          </button>
        )}
        {mode === "cloud" && shareLink && (
          <button
            type="button"
            onClick={resetCloud}
            className="w-full bg-white/[0.05] border border-white/[0.07] hover:bg-white/[0.08] hover:border-white/[0.15] text-white/50 hover:text-white/80 text-sm font-medium py-3 rounded-xl transition-colors"
          >
            New Transfer
          </button>
        )}
        {mode === "local" && (sendState === "idle" || sendState === "error") && (
          <button
            type="button"
            disabled={!canLocalSend && sendState !== "error"}
            onClick={() => {
              if (sendState === "error") { resetLocalSend(false); return; }
              void startLocalTransfer();
            }}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-xl transition-colors"
          >
            {sendState === "error" ? "Try again" : selectedDevice ? `Send to ${selectedDevice.name}` : hasFile ? "Select a device above" : "Choose a file above"}
          </button>
        )}
        {mode === "local" && sendState === "done" && (
          <button
            type="button"
            onClick={() => resetLocalSend()}
            className="w-full bg-white/[0.05] border border-white/[0.07] hover:bg-white/[0.08] hover:border-white/[0.15] text-white/50 hover:text-white/80 text-sm font-medium py-3 rounded-xl transition-colors"
          >
            New Transfer
          </button>
        )}

      </div>

      {/* ══ IDENTITY + RECEIVE SECTION ════════════════════════════════════════ */}
      <div className="border-t border-white/[0.05]">

        {/* Identity bar */}
        <div className="flex items-center gap-2.5 px-6 py-3.5 border-b border-white/[0.05]">
          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          {editingName ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") { setNameInput(myDeviceName); setEditingName(false); }
                }}
                maxLength={32}
                autoFocus
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500/60"
              />
              <button type="button" onClick={saveName} className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">Save</button>
              <button type="button" onClick={() => { setNameInput(myDeviceName); setEditingName(false); }} className="flex-shrink-0 text-white/30 hover:text-white/60 text-sm transition-colors px-1">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm text-white/50 flex-shrink-0">You are</span>
              <span className="text-sm font-medium text-white truncate">{myDeviceName}</span>
              <button type="button" onClick={() => { setNameInput(myDeviceName); setEditingName(true); }} className="flex-shrink-0 text-[11px] text-white/25 hover:text-white/50 transition-colors ml-auto">Rename</button>
            </div>
          )}
        </div>

        {/* Incoming transfer */}
        <div className="p-5 flex flex-col gap-3">
          <p className="text-[11px] font-semibold tracking-widest text-white/30 uppercase">Incoming</p>

          {recvState === "idle" && !incoming && (
            <div className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0 mt-1" />
              <p className="text-xs text-white/30 leading-relaxed">Waiting for an incoming transfer…</p>
            </div>
          )}

          {recvState === "idle" && incoming && (
            <div className="flex flex-col gap-3 bg-blue-500/[0.07] border border-blue-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                <span className="text-sm text-white/60">
                  <span className="text-white font-medium">{incoming.senderName}</span> wants to send you a file
                </span>
              </div>
              <div className="bg-white/[0.04] rounded-lg px-3 py-2.5 flex items-center gap-2.5 min-w-0">
                <span className="text-base flex-shrink-0">{fileEmoji(incoming.fileName)}</span>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate font-medium">{incoming.fileName}</p>
                  <p className="text-xs text-white/40 mt-0.5">{formatBytes(incoming.fileSize)}</p>
                </div>
              </div>
              {incoming.passwordProtected && (
                <input
                  type="password"
                  value={recvPassword}
                  onChange={(e) => setRecvPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && recvPassword) void acceptTransfer(); }}
                  placeholder="🔒 Enter password to accept…"
                  autoComplete="current-password"
                  className="w-full bg-[#161616] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-[#e0e0e0] placeholder:text-white/30 outline-none focus:border-blue-500/40 transition-colors"
                />
              )}
              {recvError && (
                <p className="text-xs text-red-400 bg-red-500/[0.07] border border-red-500/20 rounded-lg px-3 py-2">{recvError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void acceptTransfer()}
                  disabled={incoming.passwordProtected ? !recvPassword : false}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => { setIncoming(null); setRecvError(""); setRecvPassword(""); }}
                  className="px-4 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/70 text-sm rounded-lg transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {(recvState === "accepting" || recvState === "connecting") && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              <span className="text-sm text-white/50">
                {recvState === "accepting" ? "Connecting to sender…" : "Establishing connection…"}
              </span>
            </div>
          )}

          {recvState === "receiving" && recvMeta && (
            <div className="flex flex-col gap-3">
              <FilePill name={recvMeta.name} size={recvMeta.size} mimeType={recvMeta.mimeType} />
              <ProgressBlock variant="download" pct={recvPct} label="Receiving…" received={recvReceived} speed={recvSpeed} />
            </div>
          )}

          {recvState === "done" && recvMeta && (
            <div className="flex flex-col gap-3">
              <FilePill name={recvMeta.name} size={recvMeta.size} mimeType={recvMeta.mimeType} />
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-sm text-white/50">File saved to downloads</span>
              </div>
              <button type="button" onClick={resetRecv} className="text-sm text-white/30 hover:text-white/60 transition-colors text-left">Done</button>
            </div>
          )}

          {recvState === "error" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-red-400 bg-red-500/[0.07] border border-red-500/20 rounded-lg px-3 py-2">
                {recvError || "Connection failed"}
              </p>
              <button type="button" onClick={resetRecv} className="text-sm text-white/30 hover:text-white/60 transition-colors text-left">Try again</button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

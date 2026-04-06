import { useCallback, useEffect, useRef, useState } from "react";
import { uniqueNamesGenerator, adjectives, animals } from "unique-names-generator";
import FilePill from "../ui/FilePill";
import ProgressBlock from "../ui/ProgressBlock";
import { formatBytes, formatSpeed } from "../../lib/transfer-utils";

interface LocalPanelProps {
  workerUrl: string;
}

interface Device {
  id: string;
  name: string;
}

interface IncomingTransfer {
  roomId: string;
  senderName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  passwordProtected?: boolean;
}

type SendState = "idle" | "creating-offer" | "waiting" | "connecting" | "transferring" | "done" | "error";
type RecvState = "idle" | "accepting" | "connecting" | "receiving" | "done" | "error";

const DC_CHUNK = 65536;

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
    const h = () => { if (pc.iceGatheringState === "complete") { pc.removeEventListener("icegatheringstatechange", h); resolve(); } };
    pc.addEventListener("icegatheringstatechange", h);
    setTimeout(() => { pc.removeEventListener("icegatheringstatechange", h); resolve(); }, 2000);
  });
}

export default function LocalPanel({ workerUrl }: LocalPanelProps) {
  // ── identity ──────────────────────────────────────────────────────────────
  const [myDeviceId, setMyDeviceId] = useState("");
  const [myDeviceName, setMyDeviceName] = useState<string>(loadOrCreateName);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(myDeviceName);
  const myDeviceIdRef = useRef("");
  const myDeviceNameRef = useRef(myDeviceName);
  myDeviceNameRef.current = myDeviceName;

  // ── send state ────────────────────────────────────────────────────────────
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sendPassword, setSendPassword] = useState("");
  const [sendPasswordEnabled, setSendPasswordEnabled] = useState(false);
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendPct, setSendPct] = useState(0);
  const [sendSpeed, setSendSpeed] = useState("—");
  const [sendEta, setSendEta] = useState("—");
  const [sendError, setSendError] = useState("");

  // ── receive state ─────────────────────────────────────────────────────────
  const [incoming, setIncoming] = useState<IncomingTransfer | null>(null);
  const [recvState, setRecvState] = useState<RecvState>("idle");
  const [recvMeta, setRecvMeta] = useState<{ name: string; size: number; mimeType: string } | null>(null);
  const [recvPct, setRecvPct] = useState(0);
  const [recvSpeed, setRecvSpeed] = useState("—");
  const [recvReceived, setRecvReceived] = useState("—");
  const [recvError, setRecvError] = useState("");

  const pcSendRef = useRef<RTCPeerConnection | null>(null);
  const dcSendRef = useRef<RTCDataChannel | null>(null);
  const pcRecvRef = useRef<RTCPeerConnection | null>(null);
  const sendPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── device registration ───────────────────────────────────────────────────
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

  // ── device list polling ───────────────────────────────────────────────────
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

  // ── incoming polling ──────────────────────────────────────────────────────
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

  // ── name save ─────────────────────────────────────────────────────────────
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

  // ── send ──────────────────────────────────────────────────────────────────
  function resetSend() {
    if (sendPollRef.current) { clearInterval(sendPollRef.current); sendPollRef.current = null; }
    dcSendRef.current?.close(); pcSendRef.current?.close();
    pcSendRef.current = null; dcSendRef.current = null;
    setFile(null); setSelectedId(null);
    setSendPct(0); setSendSpeed("—"); setSendEta("—");
    setSendError(""); setSendState("idle");
  }

  const startTransfer = useCallback(async () => {
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
          action: "create", offerSdp: pc.localDescription!.sdp,
          targetDeviceId: selectedId, senderName: myDeviceNameRef.current,
          fileName: file.name, fileSize: file.size, mimeType: file.type || "application/octet-stream",
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
        } catch (e: unknown) { setSendError(e instanceof Error ? e.message : "Transfer failed"); setSendState("error"); }
      }, 1000);
    } catch (e: unknown) { setSendError(e instanceof Error ? e.message : "Transfer failed"); setSendState("error"); }
  }, [file, selectedId, workerUrl]);

  // ── receive ───────────────────────────────────────────────────────────────
  function resetRecv() {
    pcRecvRef.current?.close(); pcRecvRef.current = null;
    setIncoming(null); setRecvMeta(null);
    setRecvPct(0); setRecvSpeed("—"); setRecvReceived("—");
    setRecvError(""); setRecvState("idle");
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
      await fetch(`${workerUrl}/local-signal`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "answer", roomId: incoming.roomId, answerSdp: pc.localDescription!.sdp }),
      });
    } catch (e: unknown) { setRecvError(e instanceof Error ? e.message : "Connection failed"); setRecvState("error"); }
  }

  useEffect(() => () => {
    if (sendPollRef.current) clearInterval(sendPollRef.current);
    dcSendRef.current?.close(); pcSendRef.current?.close(); pcRecvRef.current?.close();
  }, []);

  const selectedDevice = devices.find((d) => d.id === selectedId);
  const canSend = !!file && !!selectedId && sendState === "idle";

  return (
    <>
      {/* ── Identity bar ── */}
      <div className="flex items-center gap-2.5 px-6 py-3.5 border-t border-white/[0.05]">
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
            <button
              type="button"
              onClick={saveName}
              className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setNameInput(myDeviceName); setEditingName(false); }}
              className="flex-shrink-0 text-white/30 hover:text-white/60 text-sm transition-colors px-1"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm text-white/50 flex-shrink-0">You are</span>
            <span className="text-sm font-medium text-white truncate">{myDeviceName}</span>
            <button
              type="button"
              onClick={() => { setNameInput(myDeviceName); setEditingName(true); }}
              className="flex-shrink-0 text-[11px] text-white/25 hover:text-white/50 transition-colors ml-auto"
            >
              Rename
            </button>
          </div>
        )}
      </div>

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-white/[0.05]">

        {/* ── SEND column ── */}
        <div className="flex flex-col gap-4 p-5 sm:border-r border-white/[0.07]">
          <p className="text-[11px] font-semibold tracking-widest text-white/30 uppercase">Send</p>

          {sendState === "idle" && (
            <>
              {/* File picker */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
              />
              {file ? (
                <FilePill name={file.name} size={file.size} mimeType={file.type} onClear={() => setFile(null)} />
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-xl border-2 border-dashed border-white/10 hover:border-white/20 transition-colors py-7 flex flex-col items-center gap-1.5 group"
                >
                  <span className="text-xl">📂</span>
                  <span className="text-sm text-white/40 group-hover:text-white/60 transition-colors">Choose a file</span>
                </button>
              )}

              {/* Device list */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-widest text-white/30 uppercase">Nearby</span>
                  <button
                    type="button"
                    onClick={() => void fetchDevices()}
                    className="text-white/25 hover:text-white/50 text-sm transition-colors leading-none"
                    title="Refresh"
                  >
                    ↻
                  </button>
                </div>

                {!myDeviceId ? (
                  <div className="flex items-center gap-2 py-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs text-white/30">Registering…</span>
                  </div>
                ) : devices.length === 0 ? (
                  <p className="text-xs text-white/30 py-2 leading-relaxed">
                    No devices found. Ask the recipient to open the Local tab.
                  </p>
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
                        {d.id === selectedId && (
                          <span className="text-blue-400 text-sm">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {sendError && (
                <p className="text-xs text-red-400 bg-red-500/[0.07] border border-red-500/20 rounded-lg px-3 py-2">
                  {sendError}
                </p>
              )}

              <button
                type="button"
                disabled={!canSend}
                onClick={() => { void startTransfer(); }}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
              >
                {selectedDevice ? `Send to ${selectedDevice.name}` : file ? "Select a device above" : "Choose a file first"}
              </button>
            </>
          )}

          {sendState === "creating-offer" && (
            <div className="flex items-center gap-2 py-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              <span className="text-sm text-white/50">Setting up connection…</span>
            </div>
          )}

          {sendState === "waiting" && file && (
            <div className="flex flex-col gap-3">
              <FilePill name={file.name} size={file.size} mimeType={file.type} />
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                <span className="text-sm text-white/50">
                  Waiting for <span className="text-white/80">{selectedDevice?.name ?? "receiver"}</span> to accept…
                </span>
              </div>
              <button type="button" onClick={resetSend} className="text-sm text-white/30 hover:text-white/60 transition-colors text-left">
                Cancel
              </button>
            </div>
          )}

          {sendState === "connecting" && file && (
            <div className="flex flex-col gap-3">
              <FilePill name={file.name} size={file.size} mimeType={file.type} />
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                <span className="text-sm text-white/50">Connecting…</span>
              </div>
            </div>
          )}

          {sendState === "transferring" && file && (
            <div className="flex flex-col gap-3">
              <FilePill name={file.name} size={file.size} mimeType={file.type} />
              <ProgressBlock variant="upload" pct={sendPct} label="Sending…" speed={sendSpeed} eta={sendEta} partsLabel={`${sendPct}%`} />
            </div>
          )}

          {sendState === "done" && file && (
            <div className="flex flex-col gap-3">
              <FilePill name={file.name} size={file.size} mimeType={file.type} />
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-sm text-white/50">Transfer complete</span>
              </div>
              <button type="button" onClick={resetSend} className="text-sm text-white/30 hover:text-white/60 transition-colors text-left">
                Send another file
              </button>
            </div>
          )}

          {sendState === "error" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-red-400 bg-red-500/[0.07] border border-red-500/20 rounded-lg px-3 py-2">
                {sendError || "Transfer failed"}
              </p>
              <button type="button" onClick={resetSend} className="text-sm text-white/30 hover:text-white/60 transition-colors text-left">
                Try again
              </button>
            </div>
          )}
        </div>

        {/* ── RECEIVE column ── */}
        <div className="flex flex-col gap-4 p-5 border-t sm:border-t-0 border-white/[0.07]">
          <p className="text-[11px] font-semibold tracking-widest text-white/30 uppercase">Receive</p>

          {recvState === "idle" && !incoming && (
            <div className="flex items-start gap-2 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0 mt-1" />
              <p className="text-xs text-white/30 leading-relaxed">
                Waiting for an incoming transfer. Keep this tab open so others can find you.
              </p>
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
                <span className="text-base flex-shrink-0">📄</span>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate font-medium">{incoming.fileName}</p>
                  <p className="text-xs text-white/40 mt-0.5">{formatBytes(incoming.fileSize)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void acceptTransfer()}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => setIncoming(null)}
                  className="px-4 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/70 text-sm rounded-lg transition-colors"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {(recvState === "accepting" || recvState === "connecting") && (
            <div className="flex items-center gap-2 py-2">
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
              <button type="button" onClick={resetRecv} className="text-sm text-white/30 hover:text-white/60 transition-colors text-left">
                Done
              </button>
            </div>
          )}

          {recvState === "error" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-red-400 bg-red-500/[0.07] border border-red-500/20 rounded-lg px-3 py-2">
                {recvError || "Connection failed"}
              </p>
              <button type="button" onClick={resetRecv} className="text-sm text-white/30 hover:text-white/60 transition-colors text-left">
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

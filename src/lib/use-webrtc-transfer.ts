import { useState, useRef, useCallback } from "react";
import { formatSpeed } from "./transfer-utils";

const CHUNK_SIZE = 16384; // 16 KB — standard RTCDataChannel chunk size
const ICE_TIMEOUT_MS = 5000;
const POLL_MS = 800;
const MAX_POLL_ATTEMPTS = 30; // 30 × 800 ms = 24 s

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export type RTCState =
  | "idle"
  | "creating"
  | "waiting"
  | "connecting"
  | "transferring"
  | "receiving"
  | "done"
  | "error";

export interface RTCProgress {
  transferred: number;
  total: number;
  pct: number;
  speedLabel: string;
}

export interface ReceivedFile {
  name: string;
  size: number;
  mimeType: string;
  url: string;
}

export interface UseWebRTCTransfer {
  state: RTCState;
  roomId: string | null;
  role: "sender" | "receiver" | null;
  progress: RTCProgress | null;
  error: string | null;
  receivedFile: ReceivedFile | null;
  createRoom: (file: File) => void;
  joinRoom: (roomId: string) => void;
  reset: () => void;
}

function waitForIce(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const t = setTimeout(resolve, ICE_TIMEOUT_MS);
    const handler = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(t);
        pc.removeEventListener("icegatheringstatechange", handler);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", handler);
  });
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function sendFile(
  file: File,
  dc: RTCDataChannel,
  onProgress: (p: RTCProgress) => void
): Promise<void> {
  const total = file.size;
  const startTime = Date.now();

  dc.send(
    JSON.stringify({
      type: "meta",
      name: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
    })
  );

  let offset = 0;
  while (offset < total) {
    // Backpressure — pause if the send buffer is saturated
    while (dc.bufferedAmount > 1024 * 1024) {
      await sleep(30);
    }

    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const buf = await slice.arrayBuffer();
    dc.send(buf);
    offset += buf.byteLength;

    const elapsed = (Date.now() - startTime) / 1000;
    const bps = elapsed > 0 ? offset / elapsed : 0;
    onProgress({
      transferred: offset,
      total,
      pct: Math.round((offset / total) * 100),
      speedLabel: formatSpeed(bps),
    });
  }

  dc.send(JSON.stringify({ type: "done" }));
}

export function useWebRTCTransfer(): UseWebRTCTransfer {
  const [state, setState] = useState<RTCState>("idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [role, setRole] = useState<"sender" | "receiver" | null>(null);
  const [progress, setProgress] = useState<RTCProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receivedFile, setReceivedFile] = useState<ReceivedFile | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  const reset = useCallback(() => {
    stopPolling();
    pcRef.current?.close();
    pcRef.current = null;
    setState("idle");
    setRoomId(null);
    setRole(null);
    setProgress(null);
    setError(null);
    setReceivedFile(null);
  }, []);

  const createRoom = useCallback((file: File) => {
    setState("creating");
    setRole("sender");
    setError(null);

    void (async () => {
      try {
        // 1. Create room in KV
        const res = await fetch("/rtc/room", { method: "POST" });
        if (!res.ok) throw new Error("Failed to create room");
        const { roomId: id } = (await res.json()) as { roomId: string };
        setRoomId(id);

        // 2. Set up peer connection + data channel
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;
        const dc = pc.createDataChannel("file-transfer", { ordered: true });

        // 3. Create offer → wait for ICE gathering → store in KV
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitForIce(pc);

        await fetch("/rtc/signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: id, type: "offer", sdp: pc.localDescription }),
        });

        setState("waiting");

        // 4. Poll KV for answer
        let answerApplied = false;
        pollRef.current = setInterval(() => {
          void (async () => {
            try {
              const data = (await fetch(`/rtc/signal?room=${id}`).then((r) =>
                r.json()
              )) as { answer?: { type: string; sdp: string }; error?: string };

              if (data.error) {
                stopPolling();
                setError("Room expired — please try again");
                setState("error");
                return;
              }
              if (data.answer && !answerApplied) {
                answerApplied = true;
                stopPolling();
                setState("connecting");
                await pc.setRemoteDescription(
                  data.answer as RTCSessionDescriptionInit
                );
              }
            } catch {
              // transient network error — keep polling
            }
          })();
        }, POLL_MS);

        // 5. When data channel opens, send the file
        dc.onopen = () => {
          setState("transferring");
          void sendFile(file, dc, setProgress)
            .then(() => setState("done"))
            .catch((err: Error) => {
              setError(err.message);
              setState("error");
            });
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed") {
            stopPolling();
            setError("WebRTC connection failed — check your network");
            setState("error");
          }
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setState("error");
      }
    })();
  }, []);

  const joinRoom = useCallback((id: string) => {
    setState("connecting");
    setRole("receiver");
    setRoomId(id.toUpperCase().trim());
    setError(null);

    void (async () => {
      try {
        // 1. Poll until offer appears
        let offer: { type: string; sdp: string } | undefined;
        for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
          const data = (await fetch(`/rtc/signal?room=${id.toUpperCase().trim()}`).then(
            (r) => r.json()
          )) as { offer?: { type: string; sdp: string }; error?: string };

          if (data.error) throw new Error("Room not found or expired");
          if (data.offer) { offer = data.offer; break; }
          await sleep(POLL_MS);
        }
        if (!offer) throw new Error("Sender is not ready yet — try again");

        // 2. Create peer connection + set remote description
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;

        await pc.setRemoteDescription(offer as RTCSessionDescriptionInit);

        // 3. Create answer → wait for ICE → store in KV
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await waitForIce(pc);

        await fetch("/rtc/signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: id.toUpperCase().trim(),
            type: "answer",
            sdp: pc.localDescription,
          }),
        });

        // 4. Wait for the sender's data channel
        pc.ondatachannel = (event) => {
          const dc = event.channel;
          setState("receiving");

          const chunks: ArrayBuffer[] = [];
          let fileMeta: { name: string; size: number; mimeType: string } | null = null;
          const startTime = Date.now();
          let received = 0;

          dc.onmessage = (e) => {
            if (typeof e.data === "string") {
              const msg = JSON.parse(e.data) as {
                type: string;
                name?: string;
                size?: number;
                mimeType?: string;
              };
              if (msg.type === "meta") {
                fileMeta = {
                  name: msg.name!,
                  size: msg.size!,
                  mimeType: msg.mimeType!,
                };
              } else if (msg.type === "done" && fileMeta) {
                const blob = new Blob(chunks, { type: fileMeta.mimeType });
                setReceivedFile({
                  ...fileMeta,
                  url: URL.createObjectURL(blob),
                });
                setState("done");
              }
            } else {
              const buf = e.data as ArrayBuffer;
              chunks.push(buf);
              received += buf.byteLength;
              const elapsed = (Date.now() - startTime) / 1000;
              const bps = elapsed > 0 ? received / elapsed : 0;
              const total = fileMeta?.size ?? 0;
              setProgress({
                transferred: received,
                total,
                pct: total > 0 ? Math.round((received / total) * 100) : 0,
                speedLabel: formatSpeed(bps),
              });
            }
          };
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed") {
            setError("WebRTC connection failed — check your network");
            setState("error");
          }
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setState("error");
      }
    })();
  }, []);

  return { state, roomId, role, progress, error, receivedFile, createRoom, joinRoom, reset };
}

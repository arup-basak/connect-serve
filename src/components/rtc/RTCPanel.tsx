import { useRef, useState } from "react";
import { useWebRTCTransfer } from "../../lib/use-webrtc-transfer";
import { formatBytes } from "../../lib/transfer-utils";
import ErrorMessage from "../ui/ErrorMessage";
import FilePill from "../ui/FilePill";
import ProgressBlock from "../ui/ProgressBlock";
import StatusDot from "../ui/StatusDot";

type Mode = "send" | "receive" | null;

const STATE_LABELS: Record<string, string> = {
  creating: "Creating room…",
  waiting: "Waiting for peer to join…",
  connecting: "Connecting…",
  transferring: "Transferring…",
  receiving: "Receiving…",
  done: "Done",
  error: "Error",
};

export default function RTCPanel() {
  const [mode, setMode] = useState<Mode>(null);
  const [file, setFile] = useState<File | null>(null);
  const [joinId, setJoinId] = useState("");
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    state,
    roomId,
    role,
    progress,
    error,
    receivedFile,
    createRoom,
    joinRoom,
    reset,
  } = useWebRTCTransfer();

  function handleReset() {
    reset();
    setMode(null);
    setFile(null);
    setJoinId("");
    setCopied(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }

  function handleSend() {
    if (!file) return;
    setMode("send");
    createRoom(file);
  }

  function handleJoin() {
    const id = joinId.trim().toUpperCase();
    if (!id) return;
    setMode("receive");
    joinRoom(id);
  }

  function copyRoomId() {
    if (!roomId) return;
    void navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadFile() {
    if (!receivedFile) return;
    const a = document.createElement("a");
    a.href = receivedFile.url;
    a.download = receivedFile.name;
    a.click();
  }

  const isActive = state !== "idle";
  const isDone = state === "done";
  const isError = state === "error";

  // ── Mode selection ────────────────────────────────────────────────────────
  if (!mode && state === "idle") {
    return (
      <div className="card">
        <div className="card-inner">
          <div className="panel-header">
            <p className="panel-title">Direct P2P Transfer</p>
            <p className="panel-desc">
              Files transfer directly between browsers via WebRTC — nothing stored on the server.
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => setMode("send")}
            >
              Send a file
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setMode("receive")}
            >
              Receive a file
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Sender: file picker (before room is created) ──────────────────────────
  if (mode === "send" && state === "idle") {
    return (
      <div className="card">
        <div className="card-inner">
          <div className="panel-header">
            <p className="panel-title">Send a file</p>
            <p className="panel-desc">Pick a file — you'll get a room code to share with the receiver.</p>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "8px",
              padding: "32px 16px",
              textAlign: "center",
              cursor: "pointer",
              color: "var(--fg-mute)",
              fontSize: "var(--t-sm)",
              transition: "border-color 0.15s",
            }}
          >
            {file ? null : "Drop a file here or click to browse"}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          {file && (
            <FilePill
              name={file.name}
              size={file.size}
              mimeType={file.type}
              onClear={() => setFile(null)}
            />
          )}

          <div style={{ display: "flex", gap: "12px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={handleReset}
            >
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={!file}
              onClick={handleSend}
            >
              Create Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Receiver: enter room ID (before joining) ──────────────────────────────
  if (mode === "receive" && state === "idle") {
    return (
      <div className="card">
        <div className="card-inner">
          <div className="panel-header">
            <p className="panel-title">Receive a file</p>
            <p className="panel-desc">Enter the room code shared by the sender.</p>
          </div>

          <div className="link-row">
            <input
              type="text"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="Room code (e.g. A3FX7K)"
              maxLength={6}
              autoComplete="off"
              spellCheck={false}
              className="input"
              style={{ fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={joinId.trim().length < 4}
              className="btn btn-primary btn-inline"
              style={{ width: "auto", padding: "10px 20px" }}
            >
              Join
            </button>
          </div>

          <button type="button" className="btn btn-secondary" onClick={handleReset}>
            Back
          </button>
        </div>
      </div>
    );
  }

  // ── Active transfer (sender or receiver) ──────────────────────────────────
  return (
    <div className="card">
      <div className="card-inner">
        {/* Room ID badge (sender only, while waiting) */}
        {role === "sender" && roomId && !isDone && !isError && (
          <div>
            <p
              style={{
                color: "var(--fg-mute)",
                fontSize: "var(--t-sm)",
                margin: "0 0 8px",
              }}
            >
              Share this room code with the receiver
            </p>
            <div className="share-link-row">
              <div
                className="share-link-display"
                style={{ fontFamily: "monospace", letterSpacing: "0.15em", fontSize: "1.4rem" }}
              >
                {roomId}
              </div>
              <button
                type="button"
                onClick={copyRoomId}
                className="btn btn-secondary btn-inline"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* Status dot */}
        {!isDone && !isError && (
          <StatusDot
            state="waiting"
            label={STATE_LABELS[state] ?? state}
          />
        )}

        {/* File info pill (sender) */}
        {role === "sender" && file && (
          <FilePill name={file.name} size={file.size} mimeType={file.type} />
        )}

        {/* Transfer progress */}
        {progress && (state === "transferring" || state === "receiving") && (
          <ProgressBlock
            variant={role === "sender" ? "upload" : "download"}
            pct={progress.pct}
            label={role === "sender" ? "Sending…" : "Receiving…"}
            speed={progress.speedLabel}
            received={
              role === "receiver"
                ? `${formatBytes(progress.transferred)} / ${formatBytes(progress.total)}`
                : undefined
            }
          />
        )}

        <ErrorMessage message={error ?? ""} />

        {/* Receiver done — show download */}
        {isDone && receivedFile && (
          <div>
            <div className="done-row" style={{ marginBottom: "12px" }}>
              <span className="done-dot" />
              Transfer complete
            </div>
            <FilePill
              name={receivedFile.name}
              size={receivedFile.size}
              mimeType={receivedFile.mimeType}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={downloadFile}
            >
              Save {receivedFile.name}
            </button>
          </div>
        )}

        {/* Sender done */}
        {isDone && !receivedFile && (
          <div className="done-row">
            <span className="done-dot" />
            File sent successfully
          </div>
        )}

        {(isDone || isError) && (
          <button type="button" className="btn btn-secondary" onClick={handleReset}>
            New Transfer
          </button>
        )}

        {isActive && !isDone && !isError && (
          <button type="button" className="btn btn-secondary" onClick={handleReset}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

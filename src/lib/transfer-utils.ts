export const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB — R2 multipart minimum

export function formatBytes(b: number): string {
  if (!b || b === 0) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), u.length - 1);
  return (b / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + u[i];
}

export function formatSpeed(bps: number): string {
  return formatBytes(bps) + "/s";
}

export function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return Math.ceil(seconds) + "s";
  return Math.ceil(seconds / 60) + "m";
}

export function fileEmoji(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "📄",
    zip: "🗜️",
    gz: "🗜️",
    tar: "🗜️",
    "7z": "🗜️",
    rar: "🗜️",
    mp4: "🎬",
    mov: "🎬",
    avi: "🎬",
    mkv: "🎬",
    mp3: "🎵",
    wav: "🎵",
    flac: "🎵",
    aac: "🎵",
    jpg: "🖼️",
    jpeg: "🖼️",
    png: "🖼️",
    gif: "🖼️",
    webp: "🖼️",
    svg: "🖼️",
    dmg: "💿",
    pkg: "📦",
    exe: "⚙️",
    app: "⚙️",
    js: "📝",
    ts: "📝",
    json: "📝",
    md: "📝",
    txt: "📝",
    xls: "📊",
    xlsx: "📊",
    csv: "📊",
    doc: "📃",
    docx: "📃",
  };
  return map[ext] ?? "📄";
}

export function formatExpiryLabel(expiresAt: string | number): string {
  const exp = new Date(expiresAt);
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  const diffH = diffMs / 3600000;
  let duration: string;
  if (diffH < 1) duration = Math.round(diffMs / 60000) + " min";
  else if (diffH < 24)
    duration =
      Math.round(diffH) + " hour" + (Math.round(diffH) !== 1 ? "s" : "");
  else
    duration =
      Math.round(diffH / 24) +
      " day" +
      (Math.round(diffH / 24) !== 1 ? "s" : "");
  const formatted = exp.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `• Deletes in ${duration} (${formatted})  • Max one recipient`;
}

import { fileEmoji, formatBytes } from "../../lib/transfer-utils";

interface FilePillProps {
  name: string;
  size: number;
  mimeType: string;
  onClear?: () => void;
}

export default function FilePill({ name, size, mimeType, onClear }: FilePillProps) {
  return (
    <div className="file-pill">
      <div className="file-pill-icon">{fileEmoji(name)}</div>
      <div className="file-pill-info">
        <div className="file-pill-name">{name}</div>
        <div className="file-pill-meta">
          {formatBytes(size)} &middot; {mimeType || "file"}
        </div>
      </div>
      {onClear && (
        <button type="button" onClick={onClear} className="file-pill-clear" title="Remove">
          &times;
        </button>
      )}
    </div>
  );
}

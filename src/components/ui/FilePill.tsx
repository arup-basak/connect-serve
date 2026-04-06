import { fileEmoji, formatBytes } from "../../lib/transfer-utils";

interface FilePillProps {
  name: string;
  size: number;
  mimeType: string;
  onClear?: () => void;
}

export default function FilePill({ name, size, mimeType, onClear }: FilePillProps) {
  return (
    <div className="flex items-center gap-3 bg-[#161616] border border-white/10 rounded-xl px-3.5 py-3">
      <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 rounded bg-blue-500/10 text-[15px]">
        {fileEmoji(name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#e0e0e0] truncate">{name}</div>
        <div className="text-[11px] text-white/35 mt-0.5">
          {formatBytes(size)} &middot; {mimeType || "file"}
        </div>
      </div>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          title="Remove"
          className="flex-shrink-0 bg-transparent border-none text-white/35 hover:text-[#e0e0e0] text-lg leading-none p-1 cursor-pointer transition-colors"
        >
          &times;
        </button>
      )}
    </div>
  );
}

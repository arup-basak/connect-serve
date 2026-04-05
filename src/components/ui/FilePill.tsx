import { fileEmoji, formatBytes } from "../../lib/transfer-utils";

interface FilePillProps {
  name: string;
  size: number;
  mimeType: string;
  onClear?: () => void;
}

export default function FilePill({ name, size, mimeType, onClear }: FilePillProps) {
  return (
    <div className="flex flex-row items-center gap-3 rounded-[10px] border border-[#2d2d2d] bg-[#181818] px-4 py-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1d3a6e] text-sm">
        {fileEmoji(name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="mt-0.5 text-xs text-neutral-500">
          {formatBytes(size)} · {mimeType || "file"}
        </div>
      </div>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="w-auto shrink-0 cursor-pointer border-none bg-transparent p-1 text-lg leading-none text-neutral-500 hover:text-neutral-200"
          title="Remove"
        >
          &times;
        </button>
      )}
    </div>
  );
}

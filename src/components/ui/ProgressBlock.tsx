type ProgressVariant = "upload" | "download";

interface ProgressBlockProps {
  variant: ProgressVariant;
  pct: number;
  label: string;
  speed?: string;
  eta?: string;
  partsLabel?: string;
  received?: string;
}

export default function ProgressBlock({
  variant,
  pct,
  label,
  speed,
  eta,
  partsLabel,
  received,
}: ProgressBlockProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/35">{label}</span>
        <span className="text-sm font-semibold text-[#e0e0e0]">{pct}%</span>
      </div>
      <div className="h-1 bg-[#1e1e1e] rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-4">
        {variant === "upload" ? (
          <>
            <div className="text-[11px] text-white/35">
              Speed <strong className="text-[#e0e0e0] font-medium">{speed ?? "—"}</strong>
            </div>
            <div className="text-[11px] text-white/35">
              ETA <strong className="text-[#e0e0e0] font-medium">{eta ?? "—"}</strong>
            </div>
            <div className="text-[11px] text-white/35">
              Parts <strong className="text-[#e0e0e0] font-medium">{partsLabel ?? "0"}</strong>
            </div>
          </>
        ) : (
          <>
            <div className="text-[11px] text-white/35">
              Received <strong className="text-[#e0e0e0] font-medium">{received ?? "—"}</strong>
            </div>
            <div className="text-[11px] text-white/35">
              Speed <strong className="text-[#e0e0e0] font-medium">{speed ?? "—"}</strong>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

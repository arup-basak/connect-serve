type ProgressVariant = "upload" | "download";

interface ProgressBlockProps {
  variant: ProgressVariant;
  pct: number;
  label: string;
  // upload stats
  speed?: string;
  eta?: string;
  partsLabel?: string;
  // download stats
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
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-neutral-500">{label}</span>
        <span className="text-[13px] font-semibold text-neutral-200">{pct}%</span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-[3px] bg-[#181818]">
        <div
          className="h-full rounded-[3px] bg-blue-500 transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-4">
        {variant === "upload" ? (
          <>
            <div className="text-xs text-neutral-500">
              Speed <span className="font-medium text-neutral-200">{speed ?? "—"}</span>
            </div>
            <div className="text-xs text-neutral-500">
              ETA <span className="font-medium text-neutral-200">{eta ?? "—"}</span>
            </div>
            <div className="text-xs text-neutral-500">
              Parts <span className="font-medium text-neutral-200">{partsLabel ?? "0"}</span>
            </div>
          </>
        ) : (
          <>
            <div className="text-xs text-neutral-500">
              Received <span className="font-medium text-neutral-200">{received ?? "—"}</span>
            </div>
            <div className="text-xs text-neutral-500">
              Speed <span className="font-medium text-neutral-200">{speed ?? "—"}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

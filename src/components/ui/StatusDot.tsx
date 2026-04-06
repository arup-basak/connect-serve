export type DotState = "waiting" | "ready" | "done" | "error";

interface StatusDotProps {
  state: DotState;
  label: string;
}

export default function StatusDot({ state, label }: StatusDotProps) {
  const dotClass =
    state === "waiting"
      ? "w-2 h-2 rounded-full bg-amber-400 animate-pulse"
      : state === "ready" || state === "done"
      ? "w-2 h-2 rounded-full bg-green-500"
      : "w-2 h-2 rounded-full bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className={dotClass} />
      <span className="text-sm text-white/35">{label}</span>
    </div>
  );
}

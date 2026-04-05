export type DotState = "waiting" | "ready" | "done" | "error";

interface StatusDotProps {
  state: DotState;
  label: string;
}

const dotClass: Record<DotState, string> = {
  waiting:
    "size-2 shrink-0 animate-[connect-pulse_1.4s_ease-in-out_infinite] rounded-full bg-amber-500",
  ready: "size-2 shrink-0 rounded-full bg-green-500",
  done: "size-2 shrink-0 rounded-full bg-green-500",
  error: "size-2 shrink-0 rounded-full bg-red-500",
};

export default function StatusDot({ state, label }: StatusDotProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={dotClass[state]} />
      <span className="text-[13px] text-neutral-500">{label}</span>
    </div>
  );
}

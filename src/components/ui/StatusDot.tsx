export type DotState = "waiting" | "ready" | "done" | "error";

interface StatusDotProps {
  state: DotState;
  label: string;
}

export default function StatusDot({ state, label }: StatusDotProps) {
  return (
    <div className="status-row">
      <div className={`status-dot ${state}`} />
      <span className="status-label">{label}</span>
    </div>
  );
}

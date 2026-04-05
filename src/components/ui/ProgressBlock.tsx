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
    <div className="progress">
      <div className="progress-header">
        <span className="progress-label">{label}</span>
        <span className="progress-pct">{pct}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="progress-stats">
        {variant === "upload" ? (
          <>
            <div className="progress-stat">
              Speed <strong>{speed ?? "—"}</strong>
            </div>
            <div className="progress-stat">
              ETA <strong>{eta ?? "—"}</strong>
            </div>
            <div className="progress-stat">
              Parts <strong>{partsLabel ?? "0"}</strong>
            </div>
          </>
        ) : (
          <>
            <div className="progress-stat">
              Received <strong>{received ?? "—"}</strong>
            </div>
            <div className="progress-stat">
              Speed <strong>{speed ?? "—"}</strong>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { ALLOWED_TTLS, TTL_DEFAULT } from "../../lib/api-common";

const TTL_LABELS: Record<number, string> = {
  [15 * 60]:          "15 min",
  [60 * 60]:          "1 hour",
  [6 * 60 * 60]:      "6 hours",
  [24 * 60 * 60]:     "1 day",
  [3 * 24 * 60 * 60]: "3 days",
  [7 * 24 * 60 * 60]: "7 days",
};

interface TtlSelectorProps {
  selected: number;
  onChange: (ttl: number) => void;
}

export default function TtlSelector({ selected, onChange }: TtlSelectorProps) {
  return (
    <div className="ttl-row">
      <span className="ttl-row-label">Delete after</span>
      <div className="ttl-pills">
        {[...ALLOWED_TTLS].map((ttl) => (
          <button
            key={ttl}
            type="button"
            onClick={() => onChange(ttl)}
            className={`ttl-pill${selected === ttl ? " active" : ""}`}
          >
            {TTL_LABELS[ttl]}
          </button>
        ))}
      </div>
    </div>
  );
}

export { TTL_DEFAULT };

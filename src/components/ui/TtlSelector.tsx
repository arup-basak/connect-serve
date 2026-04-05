import { ALLOWED_TTLS, TTL_DEFAULT } from "../../lib/api-common";

const TTL_LABELS: Record<number, string> = {
  [15 * 60]: "15 min",
  [60 * 60]: "1 hour",
  [6 * 60 * 60]: "6 hours",
  [24 * 60 * 60]: "1 day",
  [3 * 24 * 60 * 60]: "3 days",
  [7 * 24 * 60 * 60]: "7 days",
};

interface TtlSelectorProps {
  selected: number;
  onChange: (ttl: number) => void;
}

export default function TtlSelector({ selected, onChange }: TtlSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="shrink-0 whitespace-nowrap text-xs text-neutral-500">Delete after</span>
      <div className="flex flex-wrap gap-1">
        {[...ALLOWED_TTLS].map((ttl) => (
          <button
            key={ttl}
            type="button"
            onClick={() => onChange(ttl)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              selected === ttl
                ? "border-blue-500 bg-[#1d3a6e]/50 text-blue-400"
                : "border-[#2d2d2d] bg-[#181818] text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
            }`}
          >
            {TTL_LABELS[ttl]}
          </button>
        ))}
      </div>
    </div>
  );
}

export { TTL_DEFAULT };

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
    <div className="flex items-center flex-wrap gap-2">
      <span className="text-[11px] font-semibold tracking-widest text-white/30 uppercase flex-shrink-0 whitespace-nowrap">
        Delete after
      </span>
      <div className="flex flex-wrap gap-1">
        {[...ALLOWED_TTLS].map((ttl) => (
          <button
            key={ttl}
            type="button"
            onClick={() => onChange(ttl)}
            className={
              selected === ttl
                ? "bg-blue-500/10 border border-blue-500/40 text-blue-400 text-[11px] font-medium px-3 py-1 rounded-full cursor-pointer transition-colors"
                : "bg-[#161616] border border-white/10 hover:border-white/20 text-white/35 hover:text-[#e0e0e0] text-[11px] font-medium px-3 py-1 rounded-full cursor-pointer transition-colors"
            }
          >
            {TTL_LABELS[ttl]}
          </button>
        ))}
      </div>
    </div>
  );
}

export { TTL_DEFAULT };

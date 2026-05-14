interface AppTopbarProps {
  logo?: string;
  backHref?: string;
  backLabel?: string;
}

export default function AppTopbar({
  logo = "Connect",
  backHref = "/",
  backLabel = "← Back to app",
}: AppTopbarProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
      <span className="text-sm font-semibold text-[#e0e0e0]">{logo}</span>
      <a href={backHref} className="text-sm text-white/50 hover:text-white/80 transition-colors">{backLabel}</a>
    </div>
  );
}

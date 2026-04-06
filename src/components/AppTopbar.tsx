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
    <div className="docs-topbar">
      <span className="logo">{logo}</span>
      <a href={backHref} className="nav-link">{backLabel}</a>
    </div>
  );
}

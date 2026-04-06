import { useState } from "react";
import ReceivePanel from "./receive/ReceivePanel";
import SendPanel from "./send/SendPanel";

interface HomeAppProps {
  workerUrl: string;
}

export default function HomeApp({ workerUrl }: HomeAppProps) {
  const [activeTab, setActiveTab] = useState<"send" | "receive">("send");

  return (
    <div className="app-root">
      <div className="app-topbar">
        <span className="logo">Connect</span>
        <nav className="nav-links">
          <a href="/docs" className="nav-link">API Docs</a>
        </nav>
      </div>

      <div className="app-body">
        <div className="tabs">
          <button
            type="button"
            onClick={() => setActiveTab("send")}
            className={`tab${activeTab === "send" ? " active" : ""}`}
          >
            Send
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("receive")}
            className={`tab${activeTab === "receive" ? " active" : ""}`}
          >
            Receive
          </button>
        </div>

        {/* Always mounted to preserve state across tab switches */}
        <div className={activeTab !== "send" ? "hidden" : ""}>
          <SendPanel workerUrl={workerUrl} />
        </div>
        <div className={activeTab !== "receive" ? "hidden" : ""}>
          <ReceivePanel workerUrl={workerUrl} />
        </div>
      </div>

      <footer className="app-footer">
        connect &middot; files expire in 1 hour &middot; max 512 MB &middot;{" "}
        <a href="/docs">API docs</a>
      </footer>
    </div>
  );
}

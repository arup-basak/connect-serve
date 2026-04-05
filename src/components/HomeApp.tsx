import { useState } from "react";
import ReceivePanel from "./receive/ReceivePanel";
import SendPanel from "./send/SendPanel";

interface HomeAppProps {
  workerUrl: string;
}

export default function HomeApp({ workerUrl }: HomeAppProps) {
  const [activeTab, setActiveTab] = useState<"send" | "receive">("send");

  function tabClass(tab: "send" | "receive") {
    return activeTab === tab
      ? "rounded-md px-5 py-1.5 text-[13px] font-medium text-neutral-200 bg-[#111] shadow-[0_1px_4px_rgba(0,0,0,0.4)] transition-colors"
      : "rounded-md px-5 py-1.5 text-[13px] font-medium text-neutral-500 transition-colors";
  }

  return (
    <>
      {/* Topbar */}
      <div className="flex w-full max-w-[680px] items-center justify-between px-6 pb-0 pt-6">
        <div className="text-[13px] font-bold uppercase tracking-[0.14em] text-blue-500">
          Connect
        </div>
        <div className="flex gap-5">
          <a
            href="/docs"
            className="text-[13px] text-neutral-500 no-underline transition-colors hover:text-neutral-200"
          >
            API Docs
          </a>
        </div>
      </div>

      <div className="flex w-full max-w-[680px] flex-col gap-5 px-6 pb-12 pt-7">
        {/* Tabs */}
        <div className="flex w-fit gap-1 rounded-[10px] border border-[#222] bg-[#181818] p-1">
          <button type="button" onClick={() => setActiveTab("send")} className={tabClass("send")}>
            Send
          </button>
          <button type="button" onClick={() => setActiveTab("receive")} className={tabClass("receive")}>
            Receive
          </button>
        </div>

        {/* Panels — always mounted to preserve state across tab switches */}
        <div className={activeTab === "send" ? "" : "hidden"}>
          <SendPanel workerUrl={workerUrl} />
        </div>
        <div className={activeTab === "receive" ? "" : "hidden"}>
          <ReceivePanel workerUrl={workerUrl} />
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-8 pt-0 text-center text-xs text-[#3a3a3a]">
        connect &middot; files expire in 1 hour &middot; max 512 MB &middot;{" "}
        <a
          href="/docs"
          className="text-neutral-500 no-underline transition-colors hover:text-neutral-200"
        >
          API docs
        </a>
      </div>
    </>
  );
}

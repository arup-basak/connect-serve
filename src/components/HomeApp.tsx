import AppPanel from "./AppPanel";

interface HomeAppProps {
  workerUrl: string;
}

export default function HomeApp({ workerUrl }: HomeAppProps) {
  return (
    <div className="min-h-screen bg-[#080808] text-[#e0e0e0] flex flex-col items-center">

      {/* Header */}
      <header className="w-full max-w-lg mx-auto px-6 pt-7 pb-1 flex justify-between items-center">
        <span className="text-[11px] font-bold tracking-[0.22em] text-blue-500 uppercase select-none">
          Connect
        </span>
        <a href="/docs" className="text-[11px] text-white/20 hover:text-white/50 transition-colors tracking-wide">
          API docs
        </a>
      </header>

      {/* Unified card */}
      <main className="w-full max-w-lg mx-auto px-6 py-6 flex-1">
        <div className="bg-[#0f0f0f] border border-white/[0.07] rounded-2xl overflow-hidden">
          <AppPanel workerUrl={workerUrl} />
        </div>
      </main>

      {/* Footer */}
      <footer className="pb-10 text-center text-[11px] text-white/[0.12]">
        connect · files expire in 1 hour · max 512 MB ·{" "}
        <a href="/docs" className="hover:text-white/35 transition-colors">API docs</a>
      </footer>

    </div>
  );
}

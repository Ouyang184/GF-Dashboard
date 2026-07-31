import { X } from "lucide-react";

function QwenMark() {
  return (
    <div className="grid size-10 shrink-0 place-items-center bg-gradient-to-br from-violet-600 via-fuchsia-500 to-cyan-400 text-lg font-black text-white">
      Q
    </div>
  );
}

export function FloatingHeader() {
  return (
    <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <QwenMark />
      <p className="min-w-0 flex-1 truncate text-base font-semibold text-slate-950">Qwen AI</p>
      <button
        type="button"
        onClick={() => window.close()}
        className="grid size-9 place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-900"
        aria-label="Close"
      >
        <X className="size-5" />
      </button>
    </header>
  );
}

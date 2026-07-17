import { useEffect, useState } from "react";

/**
 * Concept #1 — Ambient part ejection on floor-map tiles.
 * Preview: a mini 4x2 grid of "machines"; running (green) tiles drop a tiny
 * molded part every few seconds. Purely decorative — reads as "the floor is alive".
 */
const TILES = [
  { id: "301", running: true,  d: 0 },
  { id: "305", running: true,  d: 0.7 },
  { id: "306", running: false, d: 0 },
  { id: "307", running: true,  d: 1.4 },
  { id: "419", running: true,  d: 0.3 },
  { id: "423", running: false, d: 0 },
  { id: "513", running: true,  d: 1.1 },
  { id: "523", running: true,  d: 0.5 },
];

export function AmbientTileEject() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setTick((t) => t + 1), 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 via-background to-emerald-500/5 p-4">
      <style>{`
        @keyframes at-drop { 0%{transform:translateY(0);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:translateY(22px);opacity:0} }
        @keyframes at-pulse { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.4)} }
        @media (prefers-reduced-motion: reduce) { .at-anim * { animation: none !important; } }
      `}</style>
      <div className="at-anim grid grid-cols-4 gap-3">
        {TILES.map((t) => (
          <div
            key={t.id}
            className={`relative aspect-square rounded-md border text-[10px] font-mono flex items-start justify-center pt-1 ${
              t.running
                ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-100"
                : "bg-muted/40 border-border text-muted-foreground"
            }`}
          >
            <span>{t.id}</span>
            {t.running && (
              <span
                className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400"
                style={{ animation: `at-pulse 2s ease-in-out ${t.d}s infinite` }}
              />
            )}
            {t.running && (
              <span
                key={tick}
                className="absolute left-1/2 top-1/2 h-2 w-3 -translate-x-1/2 rounded-sm bg-primary"
                style={{ animation: `at-drop 3.2s cubic-bezier(.5,0,.7,1) ${t.d}s infinite` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Floor map · parts drop from running tiles</span>
        <span className="font-mono tabular-nums text-emerald-500 font-semibold">6 / 8 running</span>
      </div>
    </div>
  );
}
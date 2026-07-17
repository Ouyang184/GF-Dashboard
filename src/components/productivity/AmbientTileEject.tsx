import { useEffect, useState } from "react";

/**
 * Concept #1 — Ambient part ejection on floor-map tiles.
 * Preview: a mini 4x2 grid of "machines"; running (green) tiles drop a tiny
 * molded part every few seconds. Purely decorative — reads as "the floor is alive".
 */
type Tile = { id: string; running: boolean; d: number; part?: string; cycle?: number; oee?: number };
const TILES: Tile[] = [
  { id: "301", running: true,  d: 0.0, part: "P-4471", cycle: 42, oee: 91 },
  { id: "305", running: true,  d: 0.7, part: "P-2210", cycle: 55, oee: 87 },
  { id: "306", running: false, d: 0 },
  { id: "307", running: true,  d: 1.4, part: "P-8802", cycle: 38, oee: 94 },
  { id: "419", running: true,  d: 0.3, part: "P-5519", cycle: 61, oee: 82 },
  { id: "423", running: false, d: 0 },
  { id: "513", running: true,  d: 1.1, part: "P-1130", cycle: 47, oee: 89 },
  { id: "523", running: true,  d: 0.5, part: "P-6644", cycle: 52, oee: 85 },
];

export function AmbientTileEject() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setTick((t) => t + 1), 3200);
    return () => clearInterval(id);
  }, []);

  const running = TILES.filter((t) => t.running).length;
  const totalParts = 240 + tick * 6;

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 via-background to-emerald-500/5 p-4">
      <style>{`
        @keyframes at-drop { 0%{transform:translateY(-4px);opacity:0} 8%{opacity:1} 85%{opacity:1;transform:translateY(28px)} 100%{transform:translateY(34px);opacity:0} }
        @keyframes at-pulse { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.4)} }
        @keyframes at-sweep { 0%{transform:translateX(-30px)} 100%{transform:translateX(120%)} }
        @keyframes at-bar   { 0%,100%{transform:scaleY(.6)} 50%{transform:scaleY(1)} }
        @keyframes at-cyc   { 0%{stroke-dashoffset:100} 100%{stroke-dashoffset:0} }
        @media (prefers-reduced-motion: reduce) { .at-anim * { animation: none !important; } }
      `}</style>
      <div className="mb-3 flex items-center justify-between text-[10px] font-mono">
        <span className="text-muted-foreground uppercase tracking-wider">Bay 3 · Floor Grid</span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-500">LIVE</span>
        </span>
      </div>
      <div className="at-anim relative grid grid-cols-4 gap-3">
        {/* sweeping scan line */}
        <span
          className="pointer-events-none absolute top-0 h-full w-8 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent"
          style={{ animation: "at-sweep 6s linear infinite" }}
        />
        {TILES.map((t) => (
          <div
            key={t.id}
            className={`relative aspect-square overflow-hidden rounded-md border text-[10px] font-mono ${
              t.running
                ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-100"
                : "bg-muted/40 border-border/60 text-muted-foreground"
            }`}
          >
            {/* header row */}
            <div className="flex items-center justify-between px-1 pt-0.5">
              <span className="font-semibold">{t.id}</span>
              {t.running ? (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                  style={{ animation: `at-pulse 2s ease-in-out ${t.d}s infinite` }}
                />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
              )}
            </div>

            {t.running ? (
              <>
                <div className="px-1 text-[8px] leading-tight opacity-90">{t.part}</div>
                <div className="px-1 text-[7px] leading-tight opacity-70">{t.cycle}s cyc</div>
                {/* mini activity bars */}
                <div className="absolute bottom-4 left-1 right-1 flex h-3 items-end gap-[2px]">
                  {[0.1, 0.35, 0.6, 0.85, 1.1].map((d, i) => (
                    <span
                      key={i}
                      className="flex-1 origin-bottom rounded-sm bg-emerald-400/70"
                      style={{ animation: `at-bar 1.8s ease-in-out ${d}s infinite`, height: "100%" }}
                    />
                  ))}
                </div>
                {/* oee footer */}
                <div className="absolute bottom-0 left-0 right-0 border-t border-emerald-500/30 px-1 text-[7px] flex items-center justify-between bg-emerald-950/30">
                  <span className="opacity-70">OEE</span>
                  <span className="font-bold">{t.oee}%</span>
                </div>
                {/* dropping part */}
                <span
                  key={tick}
                  className="absolute left-1/2 top-3 h-2 w-3 -translate-x-1/2 rounded-sm bg-primary shadow-[0_0_6px_hsl(var(--primary))]"
                  style={{ animation: `at-drop 3.2s cubic-bezier(.5,0,.7,1) ${t.d}s infinite` }}
                />
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-0.5">
                <span className="text-[7px] uppercase tracking-wider text-muted-foreground/60">idle</span>
                <span className="h-px w-6 bg-muted-foreground/30" />
              </div>
            )}

            {t.running && (
              <span
                className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-emerald-400/20"
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-mono">
        <div className="rounded-md border border-border/60 bg-muted/30 p-1.5">
          <div className="text-muted-foreground uppercase tracking-wider text-[8px]">Running</div>
          <div className="font-bold text-emerald-500">{running} / {TILES.length}</div>
        </div>
        <div className="rounded-md border border-border/60 bg-muted/30 p-1.5">
          <div className="text-muted-foreground uppercase tracking-wider text-[8px]">Parts / hr</div>
          <div className="font-bold text-primary tabular-nums">{totalParts}</div>
        </div>
        <div className="rounded-md border border-border/60 bg-muted/30 p-1.5">
          <div className="text-muted-foreground uppercase tracking-wider text-[8px]">Avg OEE</div>
          <div className="font-bold text-foreground">88%</div>
        </div>
      </div>
    </div>
  );
}
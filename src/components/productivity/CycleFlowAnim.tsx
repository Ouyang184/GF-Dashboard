import { useEffect, useState } from "react";

/**
 * Concept #3 — Abstract cycle flow / "heartbeat".
 * A schematic ribbon: pellets stream in → mold node pulses on each beat →
 * finished parts stream out. Minimal, brand-forward, feels rhythmic.
 */
export function CycleFlowAnim() {
  const [beats, setBeats] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setBeats((b) => b + 1), 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-r from-primary/5 via-background to-primary/10 p-4">
      <style>{`
        @keyframes cf-in    { 0%{transform:translateX(0);opacity:0} 20%{opacity:1} 100%{transform:translateX(160px);opacity:1} }
        @keyframes cf-out   { 0%{transform:translateX(0);opacity:0} 20%{opacity:1} 100%{transform:translateX(180px);opacity:0} }
        @keyframes cf-beat  { 0%,60%,100%{transform:scale(1);filter:brightness(1)} 15%{transform:scale(1.25);filter:brightness(1.7)} 30%{transform:scale(.95)} }
        @keyframes cf-ring  { 0%{transform:scale(.6);opacity:.9} 100%{transform:scale(2.2);opacity:0} }
        @media (prefers-reduced-motion: reduce) { .cf-anim * { animation: none !important; } }
      `}</style>
      <div className="cf-anim relative h-40 w-full">
        {/* rail */}
        <div className="absolute left-6 right-6 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        {/* incoming pellets */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2">
          {[0, 0.4, 0.8, 1.2].map((d, i) => (
            <span
              key={i}
              className="absolute h-1.5 w-1.5 rounded-full bg-primary/70"
              style={{ animation: `cf-in 2s linear ${d}s infinite` }}
            />
          ))}
          <span className="absolute -left-2 -top-4 text-[10px] font-mono text-muted-foreground">IN</span>
        </div>

        {/* mold heartbeat node */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-primary/50" style={{ animation: "cf-ring 2s ease-out infinite" }} />
            <span className="absolute inset-0 rounded-full border border-primary/30" style={{ animation: "cf-ring 2s ease-out 1s infinite" }} />
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-lg shadow-primary/40"
              style={{ animation: "cf-beat 2s ease-in-out infinite" }}
            >
              MOLD
            </div>
          </div>
        </div>

        {/* outgoing parts */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2">
          {[0, 0.5, 1.0, 1.5].map((d, i) => (
            <span
              key={i}
              className="absolute -left-40 h-2 w-3 rounded-sm bg-primary"
              style={{ animation: `cf-out 2s linear ${d + 0.4}s infinite` }}
            />
          ))}
          <span className="absolute -right-1 -top-4 text-[10px] font-mono text-muted-foreground">OUT</span>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Cycle heartbeat · schematic</span>
        <span className="font-mono tabular-nums text-primary font-semibold">
          {beats.toString().padStart(4, "0")} beats
        </span>
      </div>
    </div>
  );
}
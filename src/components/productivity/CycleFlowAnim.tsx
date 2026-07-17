import { useEffect, useState } from "react";

/**
 * Concept #3 — Abstract cycle flow / "heartbeat".
 * A schematic ribbon: pellets stream in → mold node pulses on each beat →
 * finished parts stream out. Minimal, brand-forward, feels rhythmic.
 */
export function CycleFlowAnim() {
  const [beats, setBeats] = useState(0);
  const [temp, setTemp] = useState(218);
  const [press, setPress] = useState(1180);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setBeats((b) => b + 1), 2000);
    const jitter = setInterval(() => {
      setTemp(216 + Math.round(Math.random() * 6));
      setPress(1150 + Math.round(Math.random() * 90));
    }, 1200);
    return () => { clearInterval(id); clearInterval(jitter); };
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-r from-primary/5 via-background to-primary/10 p-4">
      <style>{`
        @keyframes cf-in    { 0%{transform:translateX(0);opacity:0} 20%{opacity:1} 100%{transform:translateX(160px);opacity:1} }
        @keyframes cf-out   { 0%{transform:translateX(0);opacity:0} 20%{opacity:1} 100%{transform:translateX(180px);opacity:0} }
        @keyframes cf-beat  { 0%,60%,100%{transform:scale(1);filter:brightness(1)} 15%{transform:scale(1.25);filter:brightness(1.7)} 30%{transform:scale(.95)} }
        @keyframes cf-ring  { 0%{transform:scale(.6);opacity:.9} 100%{transform:scale(2.2);opacity:0} }
        @keyframes cf-ecg   { from{stroke-dashoffset:0} to{stroke-dashoffset:-320} }
        @keyframes cf-spin  { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes cf-blink { 0%,100%{opacity:.4} 50%{opacity:1} }
        @media (prefers-reduced-motion: reduce) { .cf-anim * { animation: none !important; } }
      `}</style>

      {/* top telemetry strip */}
      <div className="mb-3 flex items-center justify-between text-[10px] font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ animation: "cf-blink 1.4s ease-in-out infinite" }} />
            <span className="text-emerald-500">CYCLE OK</span>
          </span>
          <span className="text-muted-foreground">MC-305 · P-2210</span>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>MELT <span className="text-rose-400 font-bold tabular-nums">{temp}°C</span></span>
          <span>PRESS <span className="text-primary font-bold tabular-nums">{press}bar</span></span>
        </div>
      </div>

      <div className="cf-anim relative h-40 w-full">
        {/* rail */}
        <div className="absolute left-6 right-6 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        {/* rail ticks */}
        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 flex justify-between opacity-40">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="h-2 w-px bg-primary/60" />
          ))}
        </div>

        {/* ECG waveform behind the beat */}
        <svg className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-16 w-[calc(100%-3rem)]" viewBox="0 0 320 60" preserveAspectRatio="none">
          <path
            d="M0 30 L40 30 L48 20 L56 40 L64 10 L72 50 L80 30 L160 30 L168 22 L176 38 L184 12 L192 48 L200 30 L320 30"
            fill="none"
            className="stroke-primary/40"
            strokeWidth="1"
            strokeDasharray="320"
            style={{ animation: "cf-ecg 4s linear infinite" }}
          />
        </svg>

        {/* incoming pellets */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2">
          {[0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75].map((d, i) => (
            <span
              key={i}
              className="absolute h-1.5 w-1.5 rounded-full bg-primary/70 shadow-[0_0_4px_hsl(var(--primary))]"
              style={{ animation: `cf-in 2s linear ${d}s infinite` }}
            />
          ))}
          <span className="absolute -left-2 -top-6 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">Feed ▸</span>
          <span className="absolute -left-2 top-4 text-[8px] font-mono text-primary/70">ABS pellets</span>
        </div>

        {/* mold heartbeat node */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-primary/50" style={{ animation: "cf-ring 2s ease-out infinite" }} />
            <span className="absolute inset-0 rounded-full border border-primary/30" style={{ animation: "cf-ring 2s ease-out 1s infinite" }} />
            {/* rotating dashed gear ring */}
            <span
              className="absolute inset-[-6px] rounded-full border-2 border-dashed border-primary/40"
              style={{ animation: "cf-spin 8s linear infinite" }}
            />
            <div
              className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-[9px] font-bold shadow-lg shadow-primary/40"
              style={{ animation: "cf-beat 2s ease-in-out infinite" }}
            >
              <span>MOLD</span>
              <span className="text-[7px] font-mono opacity-80 tabular-nums">{(beats % 60).toString().padStart(2, "0")}s</span>
            </div>
          </div>
        </div>

        {/* outgoing parts */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2">
          {[0, 0.4, 0.8, 1.2, 1.6].map((d, i) => (
            <span
              key={i}
              className="absolute -left-40 h-2 w-3 rounded-sm bg-primary shadow-[0_0_6px_hsl(var(--primary))]"
              style={{ animation: `cf-out 2s linear ${d + 0.4}s infinite` }}
            />
          ))}
          <span className="absolute -right-1 -top-6 text-[9px] font-mono text-muted-foreground uppercase tracking-wider">▸ Ship</span>
          <span className="absolute -right-1 top-4 text-[8px] font-mono text-primary/70">P-2210</span>
        </div>
      </div>

      {/* bottom KPI strip */}
      <div className="mt-2 grid grid-cols-4 gap-2 text-[10px] font-mono">
        <div className="rounded border border-border/60 bg-muted/30 px-2 py-1">
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground">Beats</div>
          <div className="font-bold text-primary tabular-nums">{beats.toString().padStart(4, "0")}</div>
        </div>
        <div className="rounded border border-border/60 bg-muted/30 px-2 py-1">
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground">Cycle</div>
          <div className="font-bold text-foreground tabular-nums">2.00s</div>
        </div>
        <div className="rounded border border-border/60 bg-muted/30 px-2 py-1">
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground">Yield</div>
          <div className="font-bold text-emerald-500 tabular-nums">99.2%</div>
        </div>
        <div className="rounded border border-border/60 bg-muted/30 px-2 py-1">
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground">Uptime</div>
          <div className="font-bold text-foreground tabular-nums">96%</div>
        </div>
      </div>
    </div>
  );
}
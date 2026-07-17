import { useEffect, useState } from "react";

/**
 * Concept #2 — Engel-style horizontal injection-molding press (side profile).
 * Detailed: control cabinet, hopper + barrel/screw injection unit, tie bars,
 * moving platen clamp, mold cavity glow, conveyor eject.
 * Loop: screw retracts (dosing) → clamp closes → injection + mold glow →
 *       clamp opens → part ejects onto conveyor. Counter ticks each cycle.
 */
export function MoldingPressAnim() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setCount((c) => c + 1), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-muted/40 to-background p-4">
      <style>{`
        @keyframes mp-platen  { 0%,15%{transform:translateX(0)} 28%,60%{transform:translateX(28px)} 72%,100%{transform:translateX(0)} }
        @keyframes mp-screw   { 0%,25%{transform:translateX(0)} 35%,55%{transform:translateX(14px)} 70%,100%{transform:translateX(0)} }
        @keyframes mp-glow    { 0%,32%{opacity:0} 42%,58%{opacity:1} 70%,100%{opacity:0} }
        @keyframes mp-pellet  { 0%{transform:translateY(-6px);opacity:0} 20%{opacity:1} 60%,100%{transform:translateY(14px);opacity:0} }
        @keyframes mp-part    { 0%,62%{transform:translateX(0);opacity:0} 64%{opacity:1} 100%{transform:translateX(220px);opacity:1} }
        @keyframes mp-belt    { from{stroke-dashoffset:0} to{stroke-dashoffset:-24} }
        @keyframes mp-led     { 0%,50%{opacity:.3} 25%,75%{opacity:1} }
        @media (prefers-reduced-motion: reduce) {
          .mp-anim * { animation: none !important; }
        }
      `}</style>
      <svg viewBox="0 0 520 180" className="mp-anim w-full h-44">
        {/* machine bed */}
        <rect x="10" y="130" width="500" height="14" rx="2" className="fill-muted-foreground/40" />
        <rect x="10" y="144" width="500" height="4" className="fill-muted-foreground/20" />
        {/* feet */}
        <rect x="30" y="148" width="14" height="10" className="fill-muted-foreground/40" />
        <rect x="240" y="148" width="14" height="10" className="fill-muted-foreground/40" />
        <rect x="380" y="148" width="14" height="10" className="fill-muted-foreground/40" />

        {/* control cabinet (Engel signature) */}
        <rect x="14" y="46" width="46" height="84" rx="3" className="fill-muted/70 stroke-border" strokeWidth="1.2" />
        <rect x="20" y="52" width="34" height="22" rx="1" className="fill-primary/80" />
        <text x="37" y="66" textAnchor="middle" className="fill-background" fontSize="8" fontWeight="700">ENGEL</text>
        <circle cx="24" cy="82" r="2" className="fill-emerald-400" style={{ animation: "mp-led 2s ease-in-out infinite" }} />
        <circle cx="32" cy="82" r="2" className="fill-amber-400" style={{ animation: "mp-led 2s ease-in-out .5s infinite" }} />
        <circle cx="40" cy="82" r="2" className="fill-rose-400" style={{ animation: "mp-led 2s ease-in-out 1s infinite" }} />
        <rect x="20" y="90" width="34" height="6" rx="1" className="fill-muted-foreground/40" />
        <rect x="20" y="100" width="34" height="6" rx="1" className="fill-muted-foreground/40" />
        <rect x="20" y="110" width="34" height="14" rx="1" className="fill-foreground/20" />

        {/* hopper */}
        <polygon points="86,10 130,10 122,32 94,32" className="fill-muted-foreground/50 stroke-border" strokeWidth="1" />
        <rect x="94" y="32" width="28" height="6" className="fill-muted-foreground/60" />
        {/* pellets falling into hopper */}
        <g>
          <circle cx="104" cy="18" r="1.6" className="fill-primary" style={{ animation: "mp-pellet 4s ease-in infinite" }} />
          <circle cx="110" cy="14" r="1.6" className="fill-primary" style={{ animation: "mp-pellet 4s ease-in .3s infinite" }} />
          <circle cx="116" cy="18" r="1.6" className="fill-primary" style={{ animation: "mp-pellet 4s ease-in .6s infinite" }} />
        </g>

        {/* injection unit — barrel + screw (slides during injection) */}
        <g style={{ animation: "mp-screw 4s ease-in-out infinite" }}>
          {/* barrel */}
          <rect x="70" y="70" width="140" height="28" rx="4" className="fill-muted/80 stroke-border" strokeWidth="1.2" />
          {/* heater bands */}
          <rect x="90" y="68" width="6" height="32" className="fill-rose-400/70" />
          <rect x="120" y="68" width="6" height="32" className="fill-rose-400/70" />
          <rect x="150" y="68" width="6" height="32" className="fill-rose-400/70" />
          <rect x="180" y="68" width="6" height="32" className="fill-rose-400/70" />
          {/* screw drive motor */}
          <rect x="60" y="66" width="14" height="36" rx="2" className="fill-foreground/60" />
          {/* nozzle */}
          <polygon points="210,78 224,84 210,90" className="fill-foreground/70" />
        </g>

        {/* tie bars (4 rods spanning platens) */}
        <line x1="225" y1="70" x2="405" y2="70" strokeWidth="3" className="stroke-muted-foreground/60" />
        <line x1="225" y1="108" x2="405" y2="108" strokeWidth="3" className="stroke-muted-foreground/60" />

        {/* fixed platen (left of mold) */}
        <rect x="228" y="58" width="14" height="66" rx="2" className="fill-foreground/70" />

        {/* stationary mold half */}
        <rect x="242" y="66" width="34" height="50" rx="2" className="fill-muted/80 stroke-border" strokeWidth="1.2" />

        {/* moving mold half + moving platen (translates to close) */}
        <g style={{ animation: "mp-platen 4s ease-in-out infinite" }}>
          <rect x="304" y="66" width="34" height="50" rx="2" className="fill-muted/80 stroke-border" strokeWidth="1.2" />
          <rect x="338" y="58" width="14" height="66" rx="2" className="fill-foreground/70" />
          {/* toggle links to clamp cylinder */}
          <line x1="352" y1="80" x2="378" y2="72" strokeWidth="3" className="stroke-foreground/60" />
          <line x1="352" y1="102" x2="378" y2="110" strokeWidth="3" className="stroke-foreground/60" />
        </g>

        {/* clamp cylinder / rear platen */}
        <rect x="378" y="56" width="24" height="72" rx="3" className="fill-muted/70 stroke-border" strokeWidth="1.2" />
        <circle cx="390" cy="92" r="4" className="fill-foreground/50" />

        {/* mold cavity glow (between mold halves) */}
        <rect x="276" y="82" width="28" height="18" rx="1" className="fill-primary" style={{ animation: "mp-glow 4s ease-in-out infinite" }} />

        {/* conveyor belt */}
        <line x1="245" y1="128" x2="500" y2="128" strokeWidth="4" className="stroke-muted-foreground/60" strokeDasharray="8 4" style={{ animation: "mp-belt 1s linear infinite" }} />
        {/* conveyor rollers */}
        <circle cx="250" cy="128" r="4" className="fill-muted-foreground/70" />
        <circle cx="495" cy="128" r="4" className="fill-muted-foreground/70" />

        {/* ejected part */}
        <g style={{ animation: "mp-part 4s ease-out infinite" }}>
          <rect x="280" y="118" width="14" height="8" rx="2" className="fill-primary" />
        </g>

        {/* labels */}
        <text x="140" y="112" textAnchor="middle" className="fill-muted-foreground" fontSize="7">INJECTION UNIT</text>
        <text x="315" y="140" textAnchor="middle" className="fill-muted-foreground" fontSize="7">CLAMP</text>
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Engel horizontal press · demo cycle</span>
        <span className="font-mono tabular-nums text-primary font-semibold">
          {count.toString().padStart(4, "0")} parts
        </span>
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";

/**
 * Concept #2 — Side-profile injection-molding press.
 * Loop: clamp closes → mold glows → clamp opens → part slides down conveyor → counter ticks.
 * Pure CSS/SVG, no deps. Respects prefers-reduced-motion.
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
        @keyframes mp-clamp-l { 0%,20%{transform:translateX(0)} 30%,60%{transform:translateX(18px)} 70%,100%{transform:translateX(0)} }
        @keyframes mp-clamp-r { 0%,20%{transform:translateX(0)} 30%,60%{transform:translateX(-18px)} 70%,100%{transform:translateX(0)} }
        @keyframes mp-glow    { 0%,25%{opacity:0} 40%,55%{opacity:1} 70%,100%{opacity:0} }
        @keyframes mp-part    { 0%,60%{transform:translateX(0);opacity:0} 62%{opacity:1} 100%{transform:translateX(260px);opacity:1} }
        @keyframes mp-belt    { from{stroke-dashoffset:0} to{stroke-dashoffset:-24} }
        @media (prefers-reduced-motion: reduce) {
          .mp-anim * { animation: none !important; }
        }
      `}</style>
      <svg viewBox="0 0 480 160" className="mp-anim w-full h-40">
        {/* base */}
        <rect x="20" y="120" width="440" height="10" rx="2" className="fill-muted-foreground/30" />
        {/* press frame */}
        <rect x="60" y="40" width="180" height="80" rx="6" className="fill-muted/60 stroke-border" strokeWidth="1.5" />
        {/* mold cavity glow */}
        <rect x="120" y="70" width="60" height="20" rx="2" className="fill-primary" style={{ animation: "mp-glow 4s ease-in-out infinite" }} />
        {/* left clamp */}
        <rect x="90" y="60" width="30" height="40" rx="2" className="fill-foreground/70" style={{ animation: "mp-clamp-l 4s ease-in-out infinite" }} />
        {/* right clamp */}
        <rect x="180" y="60" width="30" height="40" rx="2" className="fill-foreground/70" style={{ animation: "mp-clamp-r 4s ease-in-out infinite" }} />
        {/* hopper */}
        <polygon points="130,20 200,20 180,40 150,40" className="fill-muted-foreground/40" />
        {/* conveyor belt */}
        <line x1="240" y1="115" x2="460" y2="115" strokeWidth="4" className="stroke-muted-foreground/60" strokeDasharray="8 4" style={{ animation: "mp-belt 1s linear infinite" }} />
        {/* ejected part */}
        <g style={{ animation: "mp-part 4s ease-out infinite" }}>
          <rect x="200" y="102" width="14" height="10" rx="2" className="fill-primary" />
        </g>
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Live cycle · demo loop</span>
        <span className="font-mono tabular-nums text-primary font-semibold">
          {count.toString().padStart(4, "0")} parts
        </span>
      </div>
    </div>
  );
}
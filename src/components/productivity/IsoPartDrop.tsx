import { useEffect, useState } from "react";

/**
 * Concept #4 — Isometric part drop.
 * Loop: pellets fall into hopper → mold pulses → molded part spring-drops into bin.
 * Bin fill rises across loops and resets. Pure SVG/CSS.
 */
export function IsoPartDrop() {
  const [fill, setFill] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setFill((f) => (f >= 8 ? 0 : f + 1)), 3000);
    return () => clearInterval(id);
  }, []);

  const fillH = fill * 5; // px in the bin

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-muted/40 via-background to-primary/5 p-4">
      <style>{`
        @keyframes ip-pellet { 0%{transform:translateY(-30px);opacity:0} 15%{opacity:1} 40%,100%{transform:translateY(20px);opacity:0} }
        @keyframes ip-pulse  { 0%,30%{transform:scale(1);filter:brightness(1)} 45%{transform:scale(1.08);filter:brightness(1.5)} 60%,100%{transform:scale(1);filter:brightness(1)} }
        @keyframes ip-drop   { 0%,55%{transform:translateY(0);opacity:0} 60%{opacity:1;transform:translateY(0)} 85%{transform:translateY(58px)} 92%{transform:translateY(52px)} 100%{transform:translateY(58px);opacity:1} }
        @media (prefers-reduced-motion: reduce) {
          .ip-anim * { animation: none !important; }
        }
      `}</style>
      <svg viewBox="0 0 240 220" className="ip-anim w-full h-56">
        {/* ground shadow */}
        <ellipse cx="120" cy="200" rx="80" ry="10" className="fill-foreground/10" />

        {/* hopper (isometric-ish) */}
        <polygon points="80,20 160,20 140,55 100,55" className="fill-muted-foreground/40 stroke-border" strokeWidth="1" />
        <polygon points="80,20 100,55 100,60 80,25" className="fill-muted-foreground/60" />

        {/* pellets */}
        <g>
          {[0, 0.4, 0.8].map((d, i) => (
            <circle key={i} cx={110 + i * 10} cy="30" r="2.5" className="fill-primary" style={{ animation: `ip-pellet 3s ease-in ${d}s infinite` }} />
          ))}
        </g>

        {/* mold body (iso block) */}
        <g style={{ transformOrigin: "120px 100px", animation: "ip-pulse 3s ease-in-out infinite" }}>
          <polygon points="70,75 120,60 170,75 170,120 120,135 70,120" className="fill-muted/80 stroke-border" strokeWidth="1.2" />
          <polygon points="70,75 120,90 170,75 120,60" className="fill-muted-foreground/30" />
          <polygon points="120,90 170,75 170,120 120,135" className="fill-muted-foreground/20" />
          <rect x="110" y="95" width="20" height="6" rx="1" className="fill-primary/70" />
        </g>

        {/* dropping part */}
        <g style={{ animation: "ip-drop 3s cubic-bezier(.5,0,.7,1) infinite" }}>
          <rect x="112" y="130" width="16" height="10" rx="2" className="fill-primary" />
        </g>

        {/* bin */}
        <polygon points="70,175 170,175 160,205 80,205" className="fill-muted/60 stroke-border" strokeWidth="1.2" />
        {/* bin fill */}
        <rect x="82" y={200 - fillH} width="76" height={fillH} className="fill-primary/60 transition-all duration-500" />
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Cycle demo · isometric</span>
        <span className="font-mono tabular-nums text-primary font-semibold">
          Bin {Math.round((fill / 8) * 100)}%
        </span>
      </div>
    </div>
  );
}
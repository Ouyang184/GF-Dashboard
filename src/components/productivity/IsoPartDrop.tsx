import { useEffect, useState } from "react";

/**
 * Concept #4 — Isometric part drop.
 * Loop: pellets fall into hopper → mold pulses → molded part spring-drops into bin.
 * Bin fill rises across loops and resets. Pure SVG/CSS.
 */
export function IsoPartDrop() {
  const [fill, setFill] = useState(0);
  const [count, setCount] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => {
      setFill((f) => (f >= 8 ? 0 : f + 1));
      setCount((c) => c + 1);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const fillH = fill * 5; // px in the bin

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-muted/40 via-background to-primary/5 p-4">
      <style>{`
        @keyframes ip-pellet { 0%{transform:translateY(-30px);opacity:0} 15%{opacity:1} 40%,100%{transform:translateY(20px);opacity:0} }
        @keyframes ip-pulse  { 0%,30%{transform:scale(1);filter:brightness(1)} 45%{transform:scale(1.08);filter:brightness(1.5)} 60%,100%{transform:scale(1);filter:brightness(1)} }
        @keyframes ip-drop   { 0%,55%{transform:translateY(0);opacity:0} 60%{opacity:1;transform:translateY(0)} 85%{transform:translateY(58px)} 92%{transform:translateY(52px)} 100%{transform:translateY(58px);opacity:1} }
        @keyframes ip-rot    { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes ip-arm    { 0%,50%{transform:translate(0,0)} 65%{transform:translate(0,20px)} 80%{transform:translate(40px,20px)} 95%,100%{transform:translate(0,0)} }
        @keyframes ip-clamp  { 0%,55%{transform:scaleX(1)} 68%,85%{transform:scaleX(.5)} 100%{transform:scaleX(1)} }
        @keyframes ip-steam  { 0%{transform:translateY(0) scale(.4);opacity:0} 30%{opacity:.7} 100%{transform:translateY(-24px) scale(1.3);opacity:0} }
        @keyframes ip-scan   { 0%{transform:translateY(0);opacity:0} 20%,80%{opacity:1} 100%{transform:translateY(70px);opacity:0} }
        @keyframes ip-blink  { 0%,100%{opacity:.3} 50%{opacity:1} }
        @media (prefers-reduced-motion: reduce) {
          .ip-anim * { animation: none !important; }
        }
      `}</style>

      {/* top info bar */}
      <div className="mb-2 flex items-center justify-between text-[10px] font-mono">
        <span className="text-muted-foreground uppercase tracking-wider">MC-513 · Iso view</span>
        <span className="flex items-center gap-1 text-emerald-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" style={{ animation: "ip-blink 1.4s ease-in-out infinite" }} />
          RUNNING
        </span>
      </div>

      <svg viewBox="0 0 280 240" className="ip-anim w-full h-64">
        {/* iso floor tile grid */}
        <defs>
          <pattern id="ip-floor" width="20" height="10" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)">
            <path d="M0 0 H20 M0 10 H20" className="stroke-muted-foreground/15" strokeWidth="0.5" />
            <path d="M0 0 V10 M20 0 V10" className="stroke-muted-foreground/15" strokeWidth="0.5" />
          </pattern>
        </defs>
        <polygon points="20,220 260,220 240,235 40,235" fill="url(#ip-floor)" />
        {/* ground shadow */}
        <ellipse cx="140" cy="220" rx="100" ry="10" className="fill-foreground/10" />

        {/* material silo (behind hopper) */}
        <rect x="30" y="20" width="30" height="60" rx="2" className="fill-muted-foreground/30 stroke-border" strokeWidth="0.8" />
        <ellipse cx="45" cy="20" rx="15" ry="4" className="fill-muted-foreground/40" />
        <rect x="42" y="30" width="2" height="40" className="fill-emerald-400/60" />
        <text x="45" y="55" textAnchor="middle" className="fill-muted-foreground" fontSize="4.5">ABS</text>
        {/* feed pipe from silo to hopper */}
        <path d="M60 30 Q 80 30 90 20" fill="none" className="stroke-muted-foreground/50" strokeWidth="2.5" />

        {/* hopper (isometric-ish) */}
        <polygon points="90,20 170,20 150,55 110,55" className="fill-muted-foreground/40 stroke-border" strokeWidth="1" />
        <polygon points="90,20 110,55 110,60 90,25" className="fill-muted-foreground/60" />
        <rect x="88" y="16" width="84" height="6" rx="1" className="fill-muted-foreground/60 stroke-border" strokeWidth="0.4" />
        {/* hopper sight glass */}
        <rect x="166" y="26" width="3" height="24" className="fill-primary/70 stroke-border" strokeWidth="0.3" />

        {/* pellets */}
        <g>
          {[0, 0.25, 0.5, 0.75, 1.0].map((d, i) => (
            <circle key={i} cx={115 + i * 8} cy="28" r="2.2" className="fill-primary" style={{ animation: `ip-pellet 3s ease-in ${d}s infinite` }} />
          ))}
        </g>
        {/* pellet pile inside hopper */}
        <path d="M112 50 Q 130 44 148 50 L148 54 L112 54 Z" className="fill-primary/50" />

        {/* barrel + heater band to mold */}
        <rect x="150" y="60" width="30" height="12" rx="2" className="fill-muted/80 stroke-border" strokeWidth="0.6" />
        <rect x="158" y="58" width="4" height="16" className="fill-rose-500/70" />
        <rect x="170" y="58" width="4" height="16" className="fill-rose-500/70" />
        <text x="165" y="82" textAnchor="middle" className="fill-rose-400" fontSize="4">218°C</text>

        {/* mold body (iso block) */}
        <g style={{ transformOrigin: "140px 110px", animation: "ip-pulse 3s ease-in-out infinite" }}>
          {/* left mold half */}
          <polygon points="80,85 140,70 140,140 80,125" className="fill-muted/80 stroke-border" strokeWidth="1.2" />
          {/* right mold half */}
          <polygon points="140,70 200,85 200,125 140,140" className="fill-muted/70 stroke-border" strokeWidth="1.2" />
          {/* top face */}
          <polygon points="80,85 140,70 200,85 140,100" className="fill-muted-foreground/30" />
          {/* cavity glow */}
          <rect x="130" y="100" width="20" height="8" rx="1" className="fill-primary/80" />
          {/* cooling ports */}
          <circle cx="90" cy="95" r="1.5" className="fill-sky-400/80" />
          <circle cx="90" cy="115" r="1.5" className="fill-sky-400/80" />
          <circle cx="190" cy="95" r="1.5" className="fill-sky-400/80" />
          <circle cx="190" cy="115" r="1.5" className="fill-sky-400/80" />
          {/* ejector pins */}
          <line x1="200" y1="100" x2="210" y2="103" className="stroke-foreground/50" strokeWidth="1" />
          <line x1="200" y1="115" x2="210" y2="118" className="stroke-foreground/50" strokeWidth="1" />
          {/* mold label */}
          <text x="140" y="130" textAnchor="middle" className="fill-muted-foreground" fontSize="5">MOLD · 2-cav</text>
        </g>

        {/* steam puffs on open */}
        {[0, 0.3, 0.6].map((d, i) => (
          <circle key={i} cx={130 + i * 8} cy={82} r="3" className="fill-sky-200/50" style={{ animation: `ip-steam 3s ease-out ${1.8 + d}s infinite` }} />
        ))}

        {/* overhead rail + robotic arm */}
        <line x1="90" y1="50" x2="230" y2="50" className="stroke-muted-foreground/60" strokeWidth="2" />
        <g style={{ animation: "ip-arm 3s ease-in-out infinite" }}>
          <rect x="135" y="48" width="12" height="6" rx="1" className="fill-foreground/70" />
          <line x1="141" y1="54" x2="141" y2="82" className="stroke-foreground/70" strokeWidth="2.5" />
          {/* gripper */}
          <g style={{ transformOrigin: "141px 86px", animation: "ip-clamp 3s ease-in-out infinite" }}>
            <rect x="135" y="82" width="12" height="3" className="fill-primary/80" />
            <rect x="135" y="86" width="3" height="6" className="fill-primary/80" />
            <rect x="144" y="86" width="3" height="6" className="fill-primary/80" />
          </g>
        </g>

        {/* dropping part */}
        <g style={{ animation: "ip-drop 3s cubic-bezier(.5,0,.7,1) infinite" }}>
          <rect x="132" y="140" width="16" height="10" rx="2" className="fill-primary stroke-primary" strokeWidth="0.5" />
          <rect x="134" y="142" width="4" height="6" rx="1" className="fill-primary-foreground/40" />
          <rect x="142" y="142" width="4" height="6" rx="1" className="fill-primary-foreground/40" />
        </g>

        {/* vision scanner beam */}
        <rect x="130" y="150" width="20" height="1" className="fill-emerald-400/70" style={{ animation: "ip-scan 3s ease-in-out infinite" }} />
        <rect x="128" y="148" width="24" height="4" rx="1" className="fill-foreground/60" />
        <text x="120" y="152" textAnchor="end" className="fill-emerald-400" fontSize="4">QC ✓</text>

        {/* bin */}
        <polygon points="90,180 190,180 180,215 100,215" className="fill-muted/70 stroke-border" strokeWidth="1.2" />
        {/* bin rim */}
        <polygon points="90,180 190,180 186,183 94,183" className="fill-muted-foreground/40" />
        {/* bin label */}
        <rect x="120" y="200" width="40" height="8" rx="1" className="fill-background stroke-border" strokeWidth="0.4" />
        <text x="140" y="206" textAnchor="middle" className="fill-foreground" fontSize="4.5" fontWeight="700">BIN A-13</text>
        {/* bin fill */}
        <rect x="102" y={210 - fillH} width="76" height={fillH} className="fill-primary/60 transition-all duration-500" />
        {/* fill level ticks */}
        {[0.25, 0.5, 0.75].map((p, i) => (
          <line key={i} x1="90" y1={210 - p * 40} x2="94" y2={210 - p * 40} className="stroke-muted-foreground/60" strokeWidth="0.5" />
        ))}

        {/* forklift silhouette at the edge */}
        <g transform="translate(215, 200)" className="fill-amber-500/70">
          <rect x="0" y="0" width="14" height="10" rx="1" />
          <rect x="-8" y="4" width="8" height="2" />
          <circle cx="3" cy="12" r="2" className="fill-foreground/70" />
          <circle cx="11" cy="12" r="2" className="fill-foreground/70" />
        </g>
      </svg>

      {/* footer KPIs */}
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-mono">
        <div className="rounded border border-border/60 bg-muted/30 px-2 py-1">
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground">Cycles</div>
          <div className="font-bold text-primary tabular-nums">{count.toString().padStart(4, "0")}</div>
        </div>
        <div className="rounded border border-border/60 bg-muted/30 px-2 py-1">
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground">Bin fill</div>
          <div className="font-bold text-foreground tabular-nums">{Math.round((fill / 8) * 100)}%</div>
        </div>
        <div className="rounded border border-border/60 bg-muted/30 px-2 py-1">
          <div className="text-[8px] uppercase tracking-wider text-muted-foreground">Scrap</div>
          <div className="font-bold text-emerald-500 tabular-nums">0.8%</div>
        </div>
      </div>
    </div>
  );
}
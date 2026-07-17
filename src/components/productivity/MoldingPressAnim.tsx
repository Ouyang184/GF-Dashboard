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
  const [phase, setPhase] = useState<"DOSE" | "CLAMP" | "INJECT" | "COOL" | "EJECT">("DOSE");
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setCount((c) => c + 1), 4000);
    const phases: Array<typeof phase> = ["DOSE", "CLAMP", "INJECT", "COOL", "EJECT"];
    let i = 0;
    const pid = setInterval(() => { i = (i + 1) % phases.length; setPhase(phases[i]); }, 800);
    return () => { clearInterval(id); clearInterval(pid); };
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-muted/40 to-background p-4">
      <style>{`
        @keyframes mp-platen  { 0%,15%{transform:translateX(0)} 28%,60%{transform:translateX(28px)} 72%,100%{transform:translateX(0)} }
        @keyframes mp-screw   { 0%,25%{transform:translateX(0)} 35%,55%{transform:translateX(14px)} 70%,100%{transform:translateX(0)} }
        @keyframes mp-screw-rot { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes mp-glow    { 0%,32%{opacity:0} 42%,58%{opacity:1} 70%,100%{opacity:0} }
        @keyframes mp-melt    { 0%,35%{stroke-dashoffset:60} 45%,58%{stroke-dashoffset:0} 70%,100%{stroke-dashoffset:60} }
        @keyframes mp-pellet  { 0%{transform:translateY(-6px);opacity:0} 20%{opacity:1} 60%,100%{transform:translateY(14px);opacity:0} }
        @keyframes mp-part    { 0%,62%{transform:translateX(0);opacity:0} 64%{opacity:1} 100%{transform:translateX(220px);opacity:1} }
        @keyframes mp-belt    { from{stroke-dashoffset:0} to{stroke-dashoffset:-24} }
        @keyframes mp-led     { 0%,50%{opacity:.3} 25%,75%{opacity:1} }
        @keyframes mp-steam   { 0%{transform:translateY(0) scale(.6);opacity:0} 30%{opacity:.7} 100%{transform:translateY(-24px) scale(1.4);opacity:0} }
        @keyframes mp-hydro   { 0%,20%{transform:translateX(0)} 35%,55%{transform:translateX(-10px)} 70%,100%{transform:translateX(0)} }
        @keyframes mp-gauge   { 0%,30%{transform:rotate(-60deg)} 45%,60%{transform:rotate(55deg)} 75%,100%{transform:rotate(-60deg)} }
        @keyframes mp-arm     { 0%,60%{transform:translate(0,0)} 68%{transform:translate(0,10px)} 78%{transform:translate(30px,10px)} 90%,100%{transform:translate(0,0)} }
        @media (prefers-reduced-motion: reduce) {
          .mp-anim * { animation: none !important; }
        }
      `}</style>
      <svg viewBox="0 0 520 220" className="mp-anim w-full h-56">
        {/* factory floor grid */}
        <defs>
          <pattern id="mp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0 H0 V20" fill="none" className="stroke-muted-foreground/10" strokeWidth="0.5" />
          </pattern>
          <linearGradient id="mp-barrel" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="hsl(var(--muted))" />
            <stop offset="0.5" stopColor="hsl(var(--foreground))" stopOpacity="0.15" />
            <stop offset="1" stopColor="hsl(var(--muted))" />
          </linearGradient>
        </defs>
        <rect x="0" y="150" width="520" height="70" fill="url(#mp-grid)" />
        <line x1="0" y1="150" x2="520" y2="150" className="stroke-border" strokeWidth="0.5" />

        {/* machine bed */}
        <rect x="10" y="130" width="500" height="14" rx="2" className="fill-muted-foreground/40" />
        <rect x="10" y="144" width="500" height="4" className="fill-muted-foreground/20" />
        {/* bed bolts */}
        {[30, 80, 140, 220, 300, 360, 420, 480].map((x) => (
          <circle key={x} cx={x} cy={137} r={1.5} className="fill-foreground/40" />
        ))}
        {/* feet */}
        <rect x="30" y="148" width="14" height="10" className="fill-muted-foreground/40" />
        <rect x="240" y="148" width="14" height="10" className="fill-muted-foreground/40" />
        <rect x="380" y="148" width="14" height="10" className="fill-muted-foreground/40" />
        <rect x="470" y="148" width="14" height="10" className="fill-muted-foreground/40" />

        {/* control cabinet (Engel signature) */}
        <rect x="14" y="30" width="46" height="100" rx="3" className="fill-muted/70 stroke-border" strokeWidth="1.2" />
        <rect x="20" y="36" width="34" height="22" rx="1" className="fill-primary/80" />
        <text x="37" y="50" textAnchor="middle" className="fill-background" fontSize="8" fontWeight="700">ENGEL</text>
        <text x="37" y="58" textAnchor="middle" className="fill-background/80" fontSize="4.5">e-victory 310</text>
        {/* HMI screen showing phase */}
        <rect x="20" y="62" width="34" height="16" rx="1" className="fill-emerald-500/20 stroke-emerald-500/60" strokeWidth="0.5" />
        <text x="37" y="72" textAnchor="middle" className="fill-emerald-300" fontSize="5.5" fontWeight="700">{phase}</text>
        <circle cx="24" cy="82" r="2" className="fill-emerald-400" style={{ animation: "mp-led 2s ease-in-out infinite" }} />
        <circle cx="32" cy="82" r="2" className="fill-amber-400" style={{ animation: "mp-led 2s ease-in-out .5s infinite" }} />
        <circle cx="40" cy="82" r="2" className="fill-rose-400" style={{ animation: "mp-led 2s ease-in-out 1s infinite" }} />
        <rect x="20" y="90" width="34" height="6" rx="1" className="fill-muted-foreground/40" />
        <rect x="20" y="100" width="34" height="6" rx="1" className="fill-muted-foreground/40" />
        <rect x="20" y="110" width="34" height="14" rx="1" className="fill-foreground/20" />
        {/* emergency stop button */}
        <circle cx="48" cy="118" r="3" className="fill-rose-500 stroke-rose-700" strokeWidth="0.6" />
        {/* stack light tower */}
        <rect x="34" y="14" width="6" height="16" className="fill-muted-foreground/50" />
        <circle cx="37" cy="10" r="3" className="fill-rose-500" style={{ animation: "mp-led 1.6s ease-in-out infinite" }} />
        <circle cx="37" cy="4" r="3" className="fill-amber-400" style={{ animation: "mp-led 1.6s ease-in-out .4s infinite" }} />

        {/* hopper */}
        <rect x="82" y="4" width="52" height="8" rx="1" className="fill-muted-foreground/60 stroke-border" strokeWidth="0.6" />
        <polygon points="86,12 130,12 122,34 94,34" className="fill-muted-foreground/50 stroke-border" strokeWidth="1" />
        {/* hopper level indicator */}
        <rect x="128" y="16" width="3" height="14" className="fill-emerald-400/70 stroke-border" strokeWidth="0.4" />
        <rect x="94" y="34" width="28" height="6" className="fill-muted-foreground/60" />
        {/* dryer/vacuum tube */}
        <path d="M 108 4 Q 108 -6 130 -4" fill="none" className="stroke-muted-foreground/50" strokeWidth="2" />
        {/* pellets falling into hopper */}
        <g>
          {[[100,20,0],[106,16,0.2],[112,20,0.4],[118,16,0.6],[114,22,0.8],[108,18,1.0]].map(([x,y,d],i) => (
            <circle key={i} cx={x} cy={y} r="1.6" className="fill-primary" style={{ animation: `mp-pellet 4s ease-in ${d}s infinite` }} />
          ))}
        </g>
        {/* pellet pile at bottom of hopper */}
        <path d="M96 30 Q108 26 120 30 L120 33 L96 33 Z" className="fill-primary/50" />

        {/* injection unit — barrel + screw (slides during injection) */}
        <g style={{ animation: "mp-screw 4s ease-in-out infinite" }}>
          {/* barrel */}
          <rect x="70" y="70" width="140" height="28" rx="4" fill="url(#mp-barrel)" className="stroke-border" strokeWidth="1.2" />
          {/* screw thread inside barrel */}
          <path d="M74 84 Q 84 80 94 84 T 114 84 T 134 84 T 154 84 T 174 84 T 194 84" fill="none" className="stroke-foreground/40" strokeWidth="1" strokeDasharray="4 60" style={{ animation: "mp-melt 4s ease-in-out infinite" }} />
          {/* heater bands */}
          {[90, 120, 150, 180].map((x) => (
            <g key={x}>
              <rect x={x} y="66" width="6" height="36" className="fill-rose-500/70 stroke-rose-700/40" strokeWidth="0.4" />
              <rect x={x-1} y="66" width="8" height="2" className="fill-rose-700/60" />
              <rect x={x-1} y="100" width="8" height="2" className="fill-rose-700/60" />
              {/* temperature reading */}
              <text x={x+3} y="63" textAnchor="middle" className="fill-rose-400" fontSize="4">220°</text>
            </g>
          ))}
          {/* screw drive motor */}
          <rect x="52" y="64" width="20" height="40" rx="2" className="fill-foreground/70 stroke-border" strokeWidth="0.5" />
          <g style={{ transformOrigin: "62px 84px", animation: "mp-screw-rot 3s linear infinite" }}>
            <circle cx="62" cy="84" r="8" className="fill-foreground/40 stroke-foreground/70" strokeWidth="0.8" />
            <line x1="62" y1="76" x2="62" y2="92" className="stroke-primary" strokeWidth="1.4" />
            <line x1="54" y1="84" x2="70" y2="84" className="stroke-primary" strokeWidth="1.4" />
          </g>
          {/* nozzle */}
          <polygon points="210,78 224,84 210,90" className="fill-foreground/70" />
          <rect x="222" y="82" width="4" height="4" className="fill-primary/80" style={{ animation: "mp-glow 4s ease-in-out infinite" }} />
        </g>

        {/* tie bars (4 rods spanning platens) */}
        <line x1="225" y1="66" x2="405" y2="66" strokeWidth="3" className="stroke-muted-foreground/60" />
        <line x1="225" y1="76" x2="405" y2="76" strokeWidth="2" className="stroke-muted-foreground/50" />
        <line x1="225" y1="106" x2="405" y2="106" strokeWidth="2" className="stroke-muted-foreground/50" />
        <line x1="225" y1="116" x2="405" y2="116" strokeWidth="3" className="stroke-muted-foreground/60" />

        {/* fixed platen (left of mold) */}
        <rect x="228" y="54" width="14" height="72" rx="2" className="fill-foreground/70 stroke-border" strokeWidth="0.5" />
        <circle cx="235" cy="60" r="1.5" className="fill-background/40" />
        <circle cx="235" cy="122" r="1.5" className="fill-background/40" />

        {/* stationary mold half */}
        <rect x="242" y="66" width="34" height="50" rx="2" className="fill-muted/80 stroke-border" strokeWidth="1.2" />
        {/* cooling lines (blue) */}
        <circle cx="248" cy="72" r="1.2" className="fill-sky-400/80" />
        <circle cx="270" cy="72" r="1.2" className="fill-sky-400/80" />
        <circle cx="248" cy="110" r="1.2" className="fill-sky-400/80" />
        <circle cx="270" cy="110" r="1.2" className="fill-sky-400/80" />
        <path d="M248 72 Q 240 91 248 110" fill="none" className="stroke-sky-400/50" strokeWidth="0.8" strokeDasharray="2 2" />

        {/* moving mold half + moving platen (translates to close) */}
        <g style={{ animation: "mp-platen 4s ease-in-out infinite" }}>
          <rect x="304" y="66" width="34" height="50" rx="2" className="fill-muted/80 stroke-border" strokeWidth="1.2" />
          {/* ejector pins visible on back of mold */}
          {[74, 84, 94, 104].map((y) => (
            <rect key={y} x="335" y={y} width="4" height="1.5" className="fill-foreground/50" />
          ))}
          <rect x="338" y="54" width="14" height="72" rx="2" className="fill-foreground/70 stroke-border" strokeWidth="0.5" />
          {/* toggle links to clamp cylinder */}
          <line x1="352" y1="72" x2="366" y2="80" strokeWidth="3" className="stroke-foreground/70" />
          <line x1="366" y1="80" x2="378" y2="70" strokeWidth="3" className="stroke-foreground/70" />
          <line x1="352" y1="110" x2="366" y2="102" strokeWidth="3" className="stroke-foreground/70" />
          <line x1="366" y1="102" x2="378" y2="112" strokeWidth="3" className="stroke-foreground/70" />
          <circle cx="366" cy="80" r="2" className="fill-primary" />
          <circle cx="366" cy="102" r="2" className="fill-primary" />
        </g>

        {/* clamp cylinder / rear platen */}
        <rect x="378" y="52" width="24" height="76" rx="3" className="fill-muted/70 stroke-border" strokeWidth="1.2" />
        <circle cx="390" cy="92" r="5" className="fill-foreground/60 stroke-border" strokeWidth="0.5" />
        {/* hydraulic cylinder */}
        <g style={{ animation: "mp-hydro 4s ease-in-out infinite" }}>
          <rect x="402" y="86" width="30" height="12" rx="2" className="fill-muted-foreground/60 stroke-border" strokeWidth="0.6" />
          <rect x="430" y="88" width="24" height="8" rx="1" className="fill-foreground/50" />
        </g>
        {/* pressure gauge */}
        <g transform="translate(410,66)">
          <circle r="6" className="fill-background stroke-border" strokeWidth="0.6" />
          <line x1="0" y1="0" x2="0" y2="-4" className="stroke-rose-500" strokeWidth="1" style={{ transformOrigin: "center", animation: "mp-gauge 4s ease-in-out infinite" }} />
          <circle r="0.8" className="fill-foreground" />
        </g>

        {/* mold cavity glow (between mold halves) */}
        <rect x="276" y="82" width="28" height="18" rx="1" className="fill-primary" style={{ animation: "mp-glow 4s ease-in-out infinite" }} />
        {/* steam / vent puffs when mold opens */}
        {[0, 0.3, 0.6].map((d, i) => (
          <circle key={i} cx={280 + i * 8} cy={70} r="3" className="fill-sky-200/40" style={{ animation: `mp-steam 4s ease-out ${2.5 + d}s infinite` }} />
        ))}

        {/* conveyor belt */}
        <rect x="240" y="124" width="260" height="10" rx="2" className="fill-muted/60 stroke-border" strokeWidth="0.5" />
        <line x1="245" y1="129" x2="500" y2="129" strokeWidth="3" className="stroke-foreground/50" strokeDasharray="8 4" style={{ animation: "mp-belt 1s linear infinite" }} />
        {/* conveyor rollers */}
        {[250, 300, 350, 400, 450, 495].map((x) => (
          <circle key={x} cx={x} cy={129} r={x === 250 || x === 495 ? 5 : 3} className="fill-muted-foreground/70 stroke-border" strokeWidth="0.5" />
        ))}
        {/* conveyor support legs */}
        <line x1="250" y1="134" x2="250" y2="150" strokeWidth="2" className="stroke-muted-foreground/60" />
        <line x1="495" y1="134" x2="495" y2="150" strokeWidth="2" className="stroke-muted-foreground/60" />

        {/* ejected part */}
        <g style={{ animation: "mp-part 4s ease-out infinite" }}>
          <rect x="280" y="118" width="16" height="8" rx="2" className="fill-primary stroke-primary" strokeWidth="0.5" />
          <rect x="282" y="119" width="4" height="6" rx="1" className="fill-primary-foreground/30" />
          <rect x="290" y="119" width="4" height="6" rx="1" className="fill-primary-foreground/30" />
        </g>

        {/* robotic take-out arm above mold */}
        <g style={{ animation: "mp-arm 4s ease-in-out infinite" }}>
          <rect x="285" y="40" width="20" height="4" rx="1" className="fill-foreground/70" />
          <line x1="295" y1="44" x2="295" y2="62" strokeWidth="2" className="stroke-foreground/70" />
          <rect x="290" y="62" width="10" height="4" rx="1" className="fill-primary/70" />
        </g>
        {/* overhead rail for robot */}
        <line x1="260" y1="38" x2="340" y2="38" strokeWidth="2" className="stroke-muted-foreground/60" />

        {/* collection bin at end of conveyor */}
        <polygon points="498,132 520,132 516,150 502,150" className="fill-muted/70 stroke-border" strokeWidth="0.8" />

        {/* labels */}
        <text x="140" y="118" textAnchor="middle" className="fill-muted-foreground" fontSize="6.5">INJECTION UNIT</text>
        <text x="315" y="146" textAnchor="middle" className="fill-muted-foreground" fontSize="6.5">CLAMP</text>
        <text x="440" y="146" textAnchor="middle" className="fill-muted-foreground" fontSize="6.5">CONVEYOR</text>
        <text x="108" y="46" textAnchor="middle" className="fill-muted-foreground" fontSize="5.5">HOPPER</text>
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Engel e-victory 310 · {phase.toLowerCase()} phase</span>
        <span className="font-mono tabular-nums text-primary font-semibold">
          {count.toString().padStart(4, "0")} parts
        </span>
      </div>
    </div>
  );
}
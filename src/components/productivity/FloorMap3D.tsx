import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, RoundedBox, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import {
  PLANT_ROOMS,
  PLANT_MACHINES,
  PLANT_SILOS,
  PLANT_WIDTH,
  PLANT_DEPTH,
  ROOM_COLORS,
  type PlantMachine,
  type PlantRoom,
} from "@/data/plant-layout";
import type { FloorMapEntry } from "@/hooks/use-dashboard-data";

type MachineStatus = "running" | "deviation" | "idle";

type Props = {
  floorMap?: FloorMapEntry[] | Record<string, FloorMapEntry>;
  deviations?: Record<string, boolean>;
};

// Convert plant-space (x,z with origin at top-left) to world-space centered on 0.
const CX = PLANT_WIDTH / 2;
const CZ = PLANT_DEPTH / 2;
const toWorld = (x: number, z: number) => [x - CX, z - CZ] as const;

export default function FloorMap3D({ floorMap, deviations }: Props) {
  const byMachine = useMemo(() => {
    const entries: FloorMapEntry[] = Array.isArray(floorMap)
      ? floorMap
      : floorMap
        ? Object.values(floorMap)
        : [];
    const m = new Map<string, FloorMapEntry>();
    for (const e of entries) {
      const k = String(e.machine ?? "").trim();
      if (k) m.set(k, e);
    }
    return m;
  }, [floorMap]);

  const [hovered, setHovered] = useState<{
    machine: PlantMachine;
    status: MachineStatus;
    entry?: FloorMapEntry;
  } | null>(null);

  return (
    <div className="relative w-full">
      <div className="w-full h-[520px] sm:h-[640px] rounded-xl border-2 border-border/70 bg-background/40 overflow-hidden">
        <Canvas
          shadows
          camera={{ position: [60, 55, 65], fov: 40 }}
          dpr={[1, 2]}
        >
          <color attach="background" args={["#0e1116"]} />
          <fog attach="fog" args={["#0e1116", 90, 220]} />
          <ambientLight intensity={0.55} />
          <directionalLight
            position={[40, 70, 30]}
            intensity={1.1}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <hemisphereLight args={["#dbeafe", "#111827", 0.35]} />

          <Suspense fallback={null}>
            <Slab />
            <FloorLanes />
            <PerimeterFence />
            <CeilingLights />
            <Forklifts />
            <PalletStacks />
            <ContactShadows position={[0, 0.03, 0]} opacity={0.45} scale={220} blur={2.6} far={20} />
            <Environment preset="warehouse" />
            {PLANT_ROOMS.map((r) => (
              <Room key={r.id} room={r} />
            ))}
            {PLANT_SILOS.map((s) => (
              <SiloCluster key={s.id} silo={s} />
            ))}
            {PLANT_MACHINES.map((m) => {
              const entry = byMachine.get(m.id);
              const isDeviation = !!deviations?.[m.fullId] || !!deviations?.[m.id];
              const status: MachineStatus = isDeviation
                ? "deviation"
                : entry
                  ? "running"
                  : "idle";
              return (
                <Machine
                  key={m.fullId}
                  machine={m}
                  status={status}
                  entry={entry}
                  onHover={(h) =>
                    setHovered(h ? { machine: m, status, entry } : null)
                  }
                />
              );
            })}
          </Suspense>

          <OrbitControls
            enablePan
            enableZoom
            enableDamping
            maxPolarAngle={Math.PI / 2.2}
            minDistance={20}
            maxDistance={180}
            target={[0, 0, 0]}
          />
        </Canvas>
      </div>

      {/* Legend + hover panel overlay */}
      <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-2">
        <div className="pointer-events-auto rounded-md border border-border/60 bg-background/85 backdrop-blur px-3 py-2 text-[11px] shadow">
          <div className="font-semibold mb-1 text-foreground">Machines</div>
          <div className="flex flex-col gap-1 text-muted-foreground">
            <LegendDot color="#22c55e" label="Running" />
            <LegendDot color="#ef4444" label="Deviation flagged" />
            <LegendDot color="#4b5563" label="Not running / no data" />
          </div>
        </div>
      </div>

      {hovered && (
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-sm rounded-md border border-border/70 bg-background/95 backdrop-blur px-3 py-2 text-xs shadow-lg">
          <div className="font-mono font-bold text-sm text-foreground">
            {hovered.machine.id}
            <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground font-sans">
              {hovered.machine.cell}
            </span>
          </div>
          <div
            className={`mt-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              hovered.status === "running"
                ? "text-emerald-500"
                : hovered.status === "deviation"
                  ? "text-red-500"
                  : "text-muted-foreground"
            }`}
          >
            {hovered.status === "running"
              ? `Running · ${hovered.entry?.jobCount ?? 0} job${hovered.entry?.jobCount === 1 ? "" : "s"}`
              : hovered.status === "deviation"
                ? "Deviation flagged"
                : "Not running"}
          </div>
          {hovered.entry?.jobs?.slice(0, 3).map((j, i) => (
            <div key={i} className="mt-1 text-[11px] text-muted-foreground">
              <div className="text-foreground">
                {j.partNumber}
                {j.partDescription ? ` — ${j.partDescription}` : ""}
              </div>
              <div>
                MC: {j.masterCard || "—"} · Tech: {j.productionTech || "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block size-2.5 rounded-sm"
        style={{ background: color }}
      />
      {label}
    </div>
  );
}

function Slab() {
  return (
    <group>
      {/* Outer apron */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
        <planeGeometry args={[PLANT_WIDTH + 60, PLANT_DEPTH + 60]} />
        <meshStandardMaterial color="#0b0d11" roughness={1} />
      </mesh>
      {/* Plant concrete slab */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <planeGeometry args={[PLANT_WIDTH + 12, PLANT_DEPTH + 12]} />
        <meshStandardMaterial color="#1c2028" roughness={0.92} metalness={0.05} />
      </mesh>
    </group>
  );
}

function FloorLanes() {
  // Painted safety walkways: yellow border stripes around plant perimeter
  const t = 0.35;
  const w = PLANT_WIDTH + 4;
  const d = PLANT_DEPTH + 4;
  const y = 0.01;
  const stripe = "#d4a017";
  return (
    <group>
      <mesh position={[0, y, -d / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, t]} />
        <meshStandardMaterial color={stripe} emissive={stripe} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, y, d / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, t]} />
        <meshStandardMaterial color={stripe} emissive={stripe} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[-w / 2, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[t, d]} />
        <meshStandardMaterial color={stripe} emissive={stripe} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[w / 2, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[t, d]} />
        <meshStandardMaterial color={stripe} emissive={stripe} emissiveIntensity={0.15} />
      </mesh>
      {/* Central aisle dashes */}
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh
          key={i}
          position={[-PLANT_WIDTH / 2 + 4 + i * 6, y, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[2.4, 0.2]} />
          <meshStandardMaterial color="#e8e8ea" opacity={0.55} transparent />
        </mesh>
      ))}
    </group>
  );
}

function PerimeterFence() {
  const w = PLANT_WIDTH + 10;
  const d = PLANT_DEPTH + 10;
  const h = 0.9;
  const mat = <meshStandardMaterial color="#2a3140" roughness={0.7} metalness={0.4} />;
  return (
    <group>
      <mesh position={[0, h / 2, -d / 2]}>
        <boxGeometry args={[w, h, 0.15]} />
        {mat}
      </mesh>
      <mesh position={[0, h / 2, d / 2]}>
        <boxGeometry args={[w, h, 0.15]} />
        {mat}
      </mesh>
      <mesh position={[-w / 2, h / 2, 0]}>
        <boxGeometry args={[0.15, h, d]} />
        {mat}
      </mesh>
      <mesh position={[w / 2, h / 2, 0]}>
        <boxGeometry args={[0.15, h, d]} />
        {mat}
      </mesh>
    </group>
  );
}

function CeilingLights() {
  const lights: Array<[number, number]> = [];
  for (let x = -PLANT_WIDTH / 2 + 10; x <= PLANT_WIDTH / 2 - 10; x += 20) {
    for (let z = -PLANT_DEPTH / 2 + 8; z <= PLANT_DEPTH / 2 - 8; z += 16) {
      lights.push([x, z]);
    }
  }
  return (
    <group>
      {lights.map(([x, z], i) => (
        <group key={i} position={[x, 14, z]}>
          <mesh>
            <boxGeometry args={[3.2, 0.15, 0.5]} />
            <meshStandardMaterial
              color="#fff7d6"
              emissive="#fff2b0"
              emissiveIntensity={1.4}
            />
          </mesh>
          <pointLight color="#fff2c8" intensity={0.35} distance={22} decay={2} />
        </group>
      ))}
    </group>
  );
}

function Forklifts() {
  const forklifts: Array<[number, number, number]> = [
    [-40, 0, 22],
    [10, 0, -20],
    [35, 0, 24],
  ];
  return (
    <group>
      {forklifts.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, (i * Math.PI) / 3, 0]}>
          {/* body */}
          <mesh castShadow position={[0, 0.55, 0]}>
            <boxGeometry args={[1.4, 0.9, 2.2]} />
            <meshStandardMaterial color="#e0a500" roughness={0.5} metalness={0.3} />
          </mesh>
          {/* mast */}
          <mesh castShadow position={[0, 1.6, 1.15]}>
            <boxGeometry args={[0.9, 2.0, 0.15]} />
            <meshStandardMaterial color="#1a1d24" metalness={0.7} roughness={0.35} />
          </mesh>
          {/* forks */}
          <mesh position={[-0.3, 0.15, 1.65]}>
            <boxGeometry args={[0.15, 0.08, 1.0]} />
            <meshStandardMaterial color="#2a2f3a" metalness={0.8} />
          </mesh>
          <mesh position={[0.3, 0.15, 1.65]}>
            <boxGeometry args={[0.15, 0.08, 1.0]} />
            <meshStandardMaterial color="#2a2f3a" metalness={0.8} />
          </mesh>
          {/* wheels */}
          {[
            [-0.65, 0.25, -0.7],
            [0.65, 0.25, -0.7],
            [-0.65, 0.25, 0.7],
            [0.65, 0.25, 0.7],
          ].map(([wx, wy, wz], j) => (
            <mesh key={j} position={[wx, wy, wz]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.25, 0.25, 0.2, 12]} />
              <meshStandardMaterial color="#0d0f14" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function PalletStacks() {
  const stacks: Array<[number, number]> = [
    [-50, -22], [-50, -14], [-50, -6], [-50, 2], [-50, 10], [-50, 18],
    [50, -22], [50, -14], [50, -6], [50, 2], [50, 10], [50, 18],
  ];
  return (
    <group>
      {stacks.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {/* pallet */}
          <mesh castShadow position={[0, 0.15, 0]}>
            <boxGeometry args={[2.2, 0.25, 2.2]} />
            <meshStandardMaterial color="#8a5a2b" roughness={0.9} />
          </mesh>
          {/* boxes */}
          <mesh castShadow position={[0, 0.9, 0]}>
            <boxGeometry args={[1.9, 1.1, 1.9]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#b98a4a" : "#a67a3f"}
              roughness={0.85}
            />
          </mesh>
          {i % 3 === 0 && (
            <mesh castShadow position={[0, 2.05, 0]}>
              <boxGeometry args={[1.6, 0.9, 1.6]} />
              <meshStandardMaterial color="#c99a5c" roughness={0.85} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

function Room({ room }: { room: PlantRoom }) {
  const color = ROOM_COLORS[room.category];
  const [wx, wz] = toWorld(room.x + room.w / 2, room.z + room.d / 2);
  const h = room.height ?? 0.6;
  return (
    <group position={[wx, 0, wz]}>
      {/* Floor pad slightly raised */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.w, room.d]} />
        <meshStandardMaterial color={color} roughness={0.9} opacity={0.75} transparent />
      </mesh>
      {/* Low walls as thin frame */}
      <WallFrame w={room.w} d={room.d} h={h} color={color} />
      {/* Floating label */}
      <Html
        center
        distanceFactor={30}
        position={[0, h + 0.6, 0]}
        style={{
          pointerEvents: "none",
          whiteSpace: "nowrap",
          fontSize: 11,
          padding: "2px 6px",
          borderRadius: 4,
          background: "rgba(15,17,22,0.75)",
          color: "#e5e7eb",
          border: "1px solid rgba(255,255,255,0.08)",
          fontFamily: "ui-sans-serif, system-ui",
        }}
      >
        {room.label}
      </Html>
    </group>
  );
}

function WallFrame({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  const t = 0.15;
  return (
    <group>
      <mesh position={[0, h / 2, -d / 2]}>
        <boxGeometry args={[w, h, t]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, h / 2, d / 2]}>
        <boxGeometry args={[w, h, t]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[-w / 2, h / 2, 0]}>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[w / 2, h / 2, 0]}>
        <boxGeometry args={[t, h, d]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
    </group>
  );
}

function SiloCluster({ silo }: { silo: (typeof PLANT_SILOS)[number] }) {
  const [wx, wz] = toWorld(silo.x, silo.z);
  return (
    <group position={[wx, 0, wz]}>
      {Array.from({ length: silo.count }).map((_, i) => (
        <mesh
          key={i}
          castShadow
          position={[(i - (silo.count - 1) / 2) * (silo.radius * 2.1), silo.radius * 2, 0]}
        >
          <cylinderGeometry args={[silo.radius, silo.radius, silo.radius * 4, 20]} />
          <meshStandardMaterial color="#8b8f96" roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

const STATUS_COLOR: Record<MachineStatus, string> = {
  running: "#22c55e",
  deviation: "#ef4444",
  idle: "#4b5563",
};

function Machine({
  machine,
  status,
  entry,
  onHover,
}: {
  machine: PlantMachine;
  status: MachineStatus;
  entry?: FloorMapEntry;
  onHover: (h: boolean) => void;
}) {
  const [wx, wz] = toWorld(machine.x, machine.z);
  const [hover, setHover] = useState(false);
  const ref = useRef<THREE.Group>(null!);
  const baseY = 0.55;
  useFrame((_, dt) => {
    if (!ref.current) return;
    const target = hover ? baseY + 0.35 : baseY;
    ref.current.position.y += (target - ref.current.position.y) * Math.min(1, dt * 8);
  });
  const color = STATUS_COLOR[status];
  return (
    <group
      ref={ref}
      position={[wx, baseY, wz]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        onHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        onHover(false);
        document.body.style.cursor = "";
      }}
    >
      <RoundedBox args={[1.2, 1.1, 1.6]} radius={0.12} smoothness={3} castShadow>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={status === "running" ? 0.35 : status === "deviation" ? 0.5 : 0.05}
          roughness={0.4}
          metalness={0.15}
        />
      </RoundedBox>
      {/* Base pad */}
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[1.4, 0.1, 1.8]} />
        <meshStandardMaterial color="#22272f" roughness={0.9} />
      </mesh>
      {/* Machine ID label */}
      <Html
        center
        distanceFactor={22}
        position={[0, 1.05, 0]}
        style={{
          pointerEvents: "none",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 11,
          fontWeight: 700,
          padding: "1px 5px",
          borderRadius: 3,
          background: "rgba(0,0,0,0.75)",
          color: "#fff",
          border: `1px solid ${color}`,
          whiteSpace: "nowrap",
        }}
      >
        {machine.id}
        {entry && entry.jobCount > 1 ? ` ·${entry.jobCount}` : ""}
      </Html>
    </group>
  );
}

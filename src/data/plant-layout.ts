// Hand-modeled plant layout derived from GFLR_Plant_Layout_07-17-2026.pdf.
// Not CAD-accurate — a stylized 3D representation of the same rooms + cells.
//
// Coordinate system: +x = east (right on the PDF), +z = south (down on the PDF).
// Origin (0,0) is the top-left corner of the main plant rectangle.

export type RoomCategory =
  | "warehouse"
  | "molding"
  | "extrusion"
  | "fabrication"
  | "utility"
  | "office"
  | "storage";

export type PlantRoom = {
  id: string;
  label: string;
  category: RoomCategory;
  x: number;
  z: number;
  w: number;
  d: number;
  height?: number;
};

export type PlantMachine = {
  id: string;
  fullId: string;
  cell: string;
  x: number;
  z: number;
};

export type PlantSiloCluster = {
  id: string;
  label: string;
  x: number;
  z: number;
  count: number;
  radius: number;
};

export const PLANT_WIDTH = 120;
export const PLANT_DEPTH = 62;

export const PLANT_ROOMS: PlantRoom[] = [
  { id: "grinder-room", label: "Grinder Room", category: "utility", x: 8,  z: 2,  w: 8,  d: 8 },
  { id: "tool-room",    label: "Tool Room",    category: "utility", x: 17, z: 2,  w: 12, d: 8 },
  { id: "rest-room",    label: "Rest Room",    category: "office",  x: 32, z: 2,  w: 6,  d: 5 },
  { id: "qc-office",    label: "Q.C. Office",  category: "office",  x: 60, z: 2,  w: 8,  d: 6 },
  { id: "office",       label: "Office",       category: "office",  x: 69, z: 2,  w: 6,  d: 6 },
  { id: "fabrication",  label: "Fabrication",  category: "fabrication", x: 76, z: 2, w: 10, d: 8 },
  { id: "facility-maint", label: "Facility Equip. Maint.", category: "utility", x: 17, z: 11, w: 55, d: 3 },

  { id: "die-storage",   label: "Die Storage",  category: "storage",  x: 8,  z: 15, w: 6, d: 22 },
  { id: "tool-room-storage", label: "Tool Storage", category: "storage", x: 15, z: 15, w: 4, d: 22 },

  { id: "eng-extrusion", label: "ENG. Extrusion", category: "extrusion", x: 20, z: 15, w: 8, d: 15 },
  { id: "vinyls-extrusion", label: "Vinyls Extrusion", category: "extrusion", x: 20, z: 31, w: 8, d: 6 },

  { id: "fuseal",   label: "Fuseal Cell", category: "molding", x: 29, z: 15, w: 12, d: 22 },
  { id: "sd1",      label: "SD Cell 1",   category: "molding", x: 42, z: 15, w: 8,  d: 12 },
  { id: "sd2",      label: "SD Cell 2",   category: "molding", x: 42, z: 28, w: 8,  d: 15 },
  { id: "md",       label: "MD Cell",     category: "molding", x: 51, z: 15, w: 8,  d: 10 },
  { id: "ld",       label: "LD Cell",     category: "molding", x: 51, z: 26, w: 8,  d: 17 },

  { id: "coil-collar", label: "Coil & Collar", category: "molding", x: 20, z: 38, w: 20, d: 8 },

  { id: "inspection", label: "Inspection", category: "office", x: 41, z: 44, w: 6, d: 5 },
  { id: "packaging",  label: "Packaging & Assembly", category: "fabrication", x: 60, z: 15, w: 14, d: 14 },
  { id: "fab-wip",    label: "Fab Area WIP", category: "fabrication", x: 60, z: 30, w: 14, d: 8 },

  { id: "line-10", label: "Line-10", category: "fabrication", x: 60, z: 40, w: 26, d: 3 },
  { id: "line-2",  label: "Line-2",  category: "fabrication", x: 60, z: 44, w: 26, d: 3 },
  { id: "line-11", label: "Line-11", category: "fabrication", x: 60, z: 48, w: 26, d: 3 },

  { id: "pump-room",    label: "Pump Room",    category: "utility", x: 2,  z: 48, w: 5,  d: 10 },
  { id: "control-room", label: "Control Room", category: "utility", x: 8,  z: 48, w: 12, d: 5 },
  { id: "booster-room", label: "Booster Room", category: "utility", x: 21, z: 48, w: 10, d: 6 },
  { id: "mixer-blender", label: "Mixer / Blender", category: "utility", x: 32, z: 48, w: 8, d: 6 },
  { id: "extrusion",    label: "Extrusion",    category: "extrusion", x: 8, z: 55, w: 20, d: 4 },
  { id: "shredder",     label: "Shredder",     category: "utility", x: 2, z: 55, w: 5, d: 4 },

  { id: "warehouse-a", label: "Warehouse", category: "warehouse", x: 88, z: 4,  w: 30, d: 20 },
  { id: "warehouse-b", label: "Warehouse", category: "warehouse", x: 88, z: 26, w: 30, d: 20 },
  { id: "pipe-storage", label: "Pipe Storage", category: "storage", x: 76, z: 30, w: 10, d: 15 },
];

export const PLANT_SILOS: PlantSiloCluster[] = [
  { id: "silo-mold", label: "Silos — Mold Compound", x: 44, z: 52, count: 6, radius: 1.2 },
  { id: "silo-pipe", label: "Silos — Pipe Compound", x: 15, z: 60, count: 8, radius: 1.0 },
  { id: "silo-resin", label: "Silos — Resin", x: 30, z: 60, count: 4, radius: 1.0 },
];

function grid(cellX: number, cellZ: number, ids: string[], cols: number, dx = 1.6, dz = 2.2, padX = 1.2, padZ = 1.4): Omit<PlantMachine, "cell">[] {
  return ids.map((full, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    return {
      fullId: full,
      id: full.replace(/(IM|EM|AM)\d*$/i, "").trim(),
      x: cellX + padX + c * dx,
      z: cellZ + padZ + r * dz,
    };
  });
}

const build = (): PlantMachine[] => {
  const out: PlantMachine[] = [];
  const push = (cell: string, machines: Omit<PlantMachine, "cell">[]) =>
    machines.forEach((m) => out.push({ ...m, cell }));

  push("ENG. Extrusion", grid(20, 15, ["11EM00", "2EM20", "10EM00", "4EM20"], 1, 1.6, 3.2));
  push("Vinyls Extrusion", grid(20, 31, ["1EM10"], 1));
  push("Coil & Collar", grid(20, 38, ["419AM0", "417AM0", "415AM0", "413AM0", "COIL5", "COIL6"], 3, 2.2, 2.2));
  push("Fuseal Cell", grid(29, 15, ["310IM30", "307IM30", "306IM30", "305IM30", "301IM30", "109IM00"], 2, 2.4, 3.0));
  push("SD Cell 1", grid(42, 15, ["222IM10", "213IM10", "212IM10", "423IM10", "101IM10"], 1, 1.6, 2.0));
  push("SD Cell 2", grid(42, 28, ["113IM00", "210IM00", "209IM00", "114IM00", "433IM10", "104IM10", "115IM00"], 1, 1.6, 1.9));
  push("MD Cell", grid(51, 15, ["201IM40", "512IM40", "443IM10", "513IM40"], 2, 2.2, 2.6));
  push("LD Cell", grid(51, 26, ["523IM40", "202IM50", "913IM50", "102IM50"], 2, 2.2, 3.2));

  return out;
};

export const PLANT_MACHINES: PlantMachine[] = build();

export const ROOM_COLORS: Record<RoomCategory, string> = {
  warehouse: "#c9a373",
  molding: "#3a4152",
  extrusion: "#3f4a55",
  fabrication: "#4a4a54",
  utility: "#40474e",
  office: "#4d5666",
  storage: "#5c5548",
};

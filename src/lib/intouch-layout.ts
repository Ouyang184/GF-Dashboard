// Calibration rectangles for the +GF+ InTouch board screenshot.
// All values are fractions (0-1) of the source image dimensions.
// Tune by eye against a captured screenshot.

export type Rect = { x: number; y: number; w: number; h: number };

export type TileSpec = {
  id: string;            // machine ID (must match FLOOR_LAYOUT)
  rect: Rect;            // bounding box on the source image
};

// Bounding boxes for each machine tile on the reference InTouch board.
// Derived from the user-supplied reference screenshot (~1920×1043).
export const INTOUCH_TILES: TileSpec[] = [
  // ENG. Extrusion (left column)
  { id: "11EM00", rect: { x: 0.000, y: 0.022, w: 0.155, h: 0.115 } },
  { id: "2EM20",  rect: { x: 0.000, y: 0.137, w: 0.155, h: 0.110 } },
  { id: "10EM00", rect: { x: 0.000, y: 0.247, w: 0.155, h: 0.110 } },
  { id: "4EM20",  rect: { x: 0.000, y: 0.357, w: 0.155, h: 0.110 } },

  // Coil & Collar
  { id: "419AM0", rect: { x: 0.000, y: 0.460, w: 0.155, h: 0.115 } },
  { id: "417AM0", rect: { x: 0.000, y: 0.575, w: 0.155, h: 0.110 } },
  { id: "415AM0", rect: { x: 0.000, y: 0.685, w: 0.155, h: 0.105 } },
  { id: "413AM0", rect: { x: 0.000, y: 0.790, w: 0.155, h: 0.115 } },
  { id: "COIL6",  rect: { x: 0.155, y: 0.575, w: 0.155, h: 0.110 } },
  { id: "COIL5",  rect: { x: 0.155, y: 0.685, w: 0.155, h: 0.105 } },

  // Vinyls Extrusion
  { id: "1EM10",  rect: { x: 0.405, y: 0.000, w: 0.110, h: 0.225 } },

  // Fuseal Cell
  { id: "310IM30", rect: { x: 0.385, y: 0.420, w: 0.155, h: 0.110 } },
  { id: "307IM30", rect: { x: 0.235, y: 0.545, w: 0.155, h: 0.110 } },
  { id: "306IM30", rect: { x: 0.385, y: 0.545, w: 0.155, h: 0.115 } },
  { id: "305IM30", rect: { x: 0.385, y: 0.660, w: 0.155, h: 0.115 } },
  { id: "301IM30", rect: { x: 0.235, y: 0.790, w: 0.155, h: 0.115 } },
  { id: "109IM00", rect: { x: 0.385, y: 0.790, w: 0.155, h: 0.115 } },

  // SD Cell 1
  { id: "222IM10", rect: { x: 0.530, y: 0.300, w: 0.140, h: 0.110 } },
  { id: "213IM10", rect: { x: 0.530, y: 0.410, w: 0.140, h: 0.115 } },
  { id: "212IM10", rect: { x: 0.530, y: 0.525, w: 0.140, h: 0.115 } },
  { id: "423IM10", rect: { x: 0.530, y: 0.660, w: 0.140, h: 0.110 } },
  { id: "101IM10", rect: { x: 0.530, y: 0.790, w: 0.140, h: 0.115 } },

  // SD Cell 2
  { id: "113IM00", rect: { x: 0.670, y: 0.115, w: 0.150, h: 0.110 } },
  { id: "210IM00", rect: { x: 0.670, y: 0.225, w: 0.150, h: 0.110 } },
  { id: "209IM00", rect: { x: 0.670, y: 0.335, w: 0.150, h: 0.110 } },
  { id: "114IM00", rect: { x: 0.670, y: 0.445, w: 0.150, h: 0.110 } },
  { id: "433IM10", rect: { x: 0.670, y: 0.555, w: 0.150, h: 0.115 } },
  { id: "104IM10", rect: { x: 0.670, y: 0.670, w: 0.150, h: 0.115 } },
  { id: "115IM00", rect: { x: 0.670, y: 0.785, w: 0.150, h: 0.120 } },

  // MD Cell
  { id: "201IM40", rect: { x: 0.820, y: 0.000, w: 0.085, h: 0.160 } },
  { id: "512IM40", rect: { x: 0.905, y: 0.000, w: 0.085, h: 0.160 } },
  { id: "443IM10", rect: { x: 0.820, y: 0.225, w: 0.085, h: 0.155 } },
  { id: "513IM40", rect: { x: 0.905, y: 0.225, w: 0.085, h: 0.155 } },

  // LD Cell
  { id: "523IM40", rect: { x: 0.820, y: 0.470, w: 0.085, h: 0.160 } },
  { id: "202IM50", rect: { x: 0.905, y: 0.470, w: 0.085, h: 0.160 } },
  { id: "913IM50", rect: { x: 0.820, y: 0.700, w: 0.085, h: 0.190 } },
  { id: "102IM50", rect: { x: 0.905, y: 0.700, w: 0.085, h: 0.190 } },
];
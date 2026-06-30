import { INTOUCH_TILES } from "./intouch-layout";

export type IntouchStatus = "ok" | "warn" | "fail" | "na" | "qc" | "unknown";

export type IntouchTileResult = {
  id: string;
  status: IntouchStatus;
  hex: string; // sampled hex color
};

export type IntouchSnapshot = {
  sampledAt: number;
  results: Record<string, IntouchTileResult>;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function classify(r: number, g: number, b: number): IntouchStatus {
  // Normalize to 0-1
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  let h = 0;
  if (d > 0.0001) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  // Low saturation => white/grey/empty
  if (s < 0.18) return "unknown";

  if (h >= 90 && h <= 165) return "ok";     // green => running
  if (h >= 40 && h < 75) return "warn";     // yellow => change wait
  if (h < 20 || h > 340) return "fail";     // red => alarm
  if (h >= 180 && h <= 220) return "na";    // blue => not scheduled
  if (h >= 260 && h <= 310) return "qc";    // purple => QC buyoff
  return "unknown";
}

function rgbToHex(r: number, g: number, b: number) {
  const to = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

// Sample the dominant non-white color from a tile region.
function sampleTileColor(
  img: HTMLImageElement,
  rect: { x: number; y: number; w: number; h: number },
): { r: number; g: number; b: number } {
  const canvas = document.createElement("canvas");
  const tw = Math.max(1, Math.round(img.naturalWidth * rect.w));
  const th = Math.max(1, Math.round(img.naturalHeight * rect.h));
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { r: 255, g: 255, b: 255 };
  ctx.drawImage(
    img,
    img.naturalWidth * rect.x,
    img.naturalHeight * rect.y,
    img.naturalWidth * rect.w,
    img.naturalHeight * rect.h,
    0,
    0,
    tw,
    th,
  );
  const data = ctx.getImageData(0, 0, tw, th).data;
  // Bucket pixels by coarse hue/sat to find dominant non-white color
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // skip near-white, near-black, and near-grey
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max > 235 && min > 220) continue; // white
    if (max < 40) continue;                // black/text
    if (max - min < 25) continue;          // grey
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const cur = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    cur.r += r; cur.g += g; cur.b += b; cur.n += 1;
    buckets.set(key, cur);
  }
  let best: { r: number; g: number; b: number; n: number } | null = null;
  for (const v of buckets.values()) {
    if (!best || v.n > best.n) best = v;
  }
  if (!best) return { r: 255, g: 255, b: 255 };
  return {
    r: Math.round(best.r / best.n),
    g: Math.round(best.g / best.n),
    b: Math.round(best.b / best.n),
  };
}

export async function runIntouchOcr(imageSrc: string): Promise<IntouchSnapshot> {
  const img = await loadImage(imageSrc);
  const results: Record<string, IntouchTileResult> = {};
  for (const tile of INTOUCH_TILES) {
    const { r, g, b } = sampleTileColor(img, tile.rect);
    const status = classify(r, g, b);
    results[tile.id] = { id: tile.id, status, hex: rgbToHex(r, g, b) };
  }
  return { sampledAt: Date.now(), results };
}
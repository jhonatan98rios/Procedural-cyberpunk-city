import type { Building, BuildingParams, Part } from '../types';
import { createRng } from '../utils/prng';

const SIGN_WORDS = [
  'SUSHI', 'RAMEN', 'CYBER', 'NEON', 'VOID', 'TECH',
  'DATA', 'PULSE', 'SYNTH', 'GRID', 'NOODLE', 'GHOST',
  'BYTE', 'DRIFT', 'SLICE', 'CHROME', 'EDGE', 'HACK',
];

const PALETTES: Record<string, string[]> = {
  cyberpunk: ['#1a1a2e', '#00ffff', '#0f3460', '#e94560', '#ff00ff'],
  brutalist: ['#4a4a4a', '#6b6b6b', '#2d2d2d', '#8a8a8a', '#1a1a1a'],
  glass: ['#1b2838', '#2a475e', '#c7d5e0', '#66c0f4', '#171a21'],
};

function pickPalette(
  palette: string | string[] | undefined,
  rng: () => number,
): string[] {
  if (Array.isArray(palette)) return palette;
  const keys = Object.keys(PALETTES);
  const key = palette ?? keys[Math.floor(rng() * keys.length)];
  return PALETTES[key] ?? PALETTES.cyberpunk;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function generateBuilding(
  params: BuildingParams = {},
  seed: number,
): Building {
  const rng = createRng(seed);
  const palette = pickPalette(params.palette, rng);

  const floors = params.floors ?? Math.floor(lerp(2, 20, rng()));
  const floorHeight = params.floorHeight ?? 1;
  const width = params.width ?? lerp(1.5, 3, rng());
  const depth = params.depth ?? lerp(1.5, 3, rng());
  const height = floors * floorHeight;
  const acProb = params.acProbability ?? 0.7;
  const signProb = params.signProbability ?? 0.3;
  const windowW = params.windowStyle === 'wide' ? 0.4 : params.windowStyle === 'narrow' ? 0.15 : 0.25;

  const parts: Part[] = [];

  // body
  parts.push({
    type: 'box',
    position: [0, height / 2, 0],
    rotation: [0, 0, 0],
    scale: [width, height, depth],
    color: palette[0],
  });

  // door — centered on front face at ground level
  const doorW = width * 0.25;
  const doorH = floorHeight * 1.8;
  const doorD = 0.1;
  parts.push({
    type: 'box',
    position: [0, doorH / 2, depth / 2 + doorD / 2],
    rotation: [0, 0, 0],
    scale: [doorW, doorH, doorD],
    color: palette[3],
  });

  // windows — grid on front face
  const frontZ = depth / 2 + 0.05;
  const windowAreaW = width * 0.8;
  const windowAreaH = height - floorHeight * 2; // leave space at bottom for door
  const cols = Math.max(2, Math.floor(windowAreaW / (windowW * 2)));
  const rows = Math.max(1, floors - 1);
  const stepX = windowAreaW / cols;
  const stepY = windowAreaH / rows;
  const startX = -windowAreaW / 2 + stepX / 2;
  const startY = floorHeight * 1.5 + stepY / 2; // above door zone

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // skip a column if it overlaps the door area
      const wx = startX + c * stepX;
      const skipDoor =
        r === 0 && Math.abs(wx) < doorW * 0.7;
      if (skipDoor) continue;

      const wy = startY + r * stepY;
      const lit = rng() > 0.3;
      parts.push({
        type: 'plane',
        position: [wx, wy, frontZ],
        rotation: [0, 0, 0],
        scale: [windowW, windowW * 1.3, 1],
        color: lit ? palette[1] : '#111111',
        emissive: lit ? palette[1] : undefined,
      });

      // AC unit below window
      if (rng() < acProb) {
        parts.push({
          type: 'box',
          position: [wx, wy - windowW * 0.6, frontZ + 0.08],
          rotation: [0, 0, 0],
          scale: [windowW * 0.7, 0.1, 0.2],
          color: palette[2],
        });
      }
    }
  }

  // LED sign — on the upper part of the building, above windows
  if (rng() < signProb) {
    const signW = width * 0.6;
    const signH = floorHeight * 0.6;
    const signY = height - floorHeight * 0.3;
    const signText =
      params.signText ?? SIGN_WORDS[Math.floor(rng() * SIGN_WORDS.length)];
    parts.push({
      type: 'plane',
      position: [0, signY, frontZ + 0.1],
      rotation: [0, 0, 0],
      scale: [signW, signH, 1],
      color: palette[4],
      emissive: palette[4],
      text: signText,
    });
  }

  return {
    id: `bld-${seed}`,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    parts,
  };
}

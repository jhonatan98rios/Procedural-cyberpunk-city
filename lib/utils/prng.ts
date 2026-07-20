// Seeded PRNG — mulberry32, 7 lines, no dependencies.
// Deterministic across all JS runtimes: same seed = same sequence.

export type Rng = () => number;

export function createRng(seed: number): Rng {
  return function mulberry32(): number {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

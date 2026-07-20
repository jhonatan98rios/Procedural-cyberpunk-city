# Feature: Core Types and Building Generator

> **Status**: `draft`

First building block: data model for 3D objects composed from primitives, plus a procedural building generator that produces a parameterizable building with body, door, windows, AC units, and LED signs. JSON-serializable by design — a `City` of hundreds of buildings IS the save file.

## What

Define the core `Part`/`Building`/`City` types and implement `generateBuilding()` — a pure, deterministic function that composes a building from Three.js-compatible primitives.

## Acceptance Criteria

- [ ] AC1: Types compile without errors in strict TypeScript
      Verify: `npx tsc --noEmit`
- [ ] AC2: `generateBuilding()` with fixed seed produces deterministic output (same seed + same params = same JSON)
      Verify: `node -e "const { generateBuilding } = require('./dist/generator'); const a = generateBuilding({floors: 10}, 42); const b = generateBuilding({floors: 10}, 42); console.assert(JSON.stringify(a) === JSON.stringify(b), 'not deterministic'); console.log('pass');"`
- [ ] AC3: `generateBuilding()` with different seeds produces different output
      Verify: same script, compare `generateBuilding({}, 42)` vs `generateBuilding({}, 43)`, assert JSON differs
- [ ] AC4: Building output contains at minimum: one body part, at least one window part, at least one door part, at least one LED sign part
      Verify: `node -e "... console.assert(parts.some(p => p.type === 'box' && p.scale[1] > 5), 'no body'); ..."`
- [ ] AC5: Generated `Building` serializes to JSON and deserializes back, properties intact
      Verify: `node -e "const b = generateBuilding({}, 42); const json = JSON.stringify(b); const b2 = JSON.parse(json); console.assert(b2.id === b.id && b2.parts.length === b.parts.length);"`
- [ ] AC6: LED sign parts carry `text` and `emissive` fields
      Verify: `node -e "... const signs = parts.filter(p => p.text); console.assert(signs.length > 0 && signs.every(s => s.emissive));"`
- [ ] AC7: Floors range is respected — `generateBuilding({}, seed)` always produces 2–20 floors when `floors` is not passed; when `floors: 3`, total height = 3 × floorHeight
      Verify: `node -e "const b = generateBuilding({}, 42); const body = b.parts.find(p => p.type === 'box' && p.scale[1] > 2); const h = body.scale[1]; console.assert(h >= 2 && h <= 20, 'height out of range: ' + h);"`
- [ ] AC8: Different palettes produce different color assignments; same palette + same seed = same colors
      Verify: `node -e "const a = generateBuilding({palette: 'cyberpunk'}, 42); const b = generateBuilding({palette: 'brutalist'}, 42); console.assert(a.parts[0].color !== b.parts[0].color, 'palettes should differ'); const c = generateBuilding({palette: 'cyberpunk'}, 42); console.assert(a.parts[0].color === c.parts[0].color, 'same palette should match');"``

## TDD

Each AC follows Red → Green → Anchor, per `wiki::red-green-tdd::mental-model`.

1. Red: run the `Verify` command and confirm it fails.
2. Green: make the minimal change until `Verify` passes.
3. Anchor: update the Glossary table so the change is reachable.

## Details

### Scope

- `lib/types.ts` — `Part`, `Building`, `City` types, all plain TS interfaces/types
- `lib/utils/prng.ts` — seeded PRNG (mulberry32 or equivalent), exported as `createRng(seed: number) → () => number`
- `lib/generator/building.ts` — `generateBuilding(params: BuildingParams, seed: number) → Building`
- `lib/generator/body.ts` — body part generation
- `lib/generator/facade.ts` — window grid, door, AC units
- `lib/generator/details.ts` — LED signs, decorative elements
- Three.js types imported only for reference (`@types/three`), no runtime dependency in lib

### Building Anatomy (first archetype)

```
           ┌─────────────┐
           │   LED sign  │  ← PlaneGeometry, emissive, text="..."
           ├─────────────┤
  windows →│■ ■ ■ ■ ■ ■ ■│  ← PlaneGeometry, grid on front face
  ACs     →│[─] [─] [─]  │  ← thin BoxGeometry below each window
           │■ ■ ■ ■ ■ ■ ■│
           │[─] [─] [─]  │
  door    →│  ┌──┐       │  ← BoxGeometry, centered at ground
           │  │  │       │
           └──┴──┴───────┘
           ◄── body ────►    ← BoxGeometry, main building volume
```

### Parameters

```typescript
interface BuildingParams {
  width?: number;       // default 2, range 1-4
  depth?: number;       // default 2, range 1-4
  floors?: number;      // default random 2-20, drives window rows and total height
  floorHeight?: number; // default 1, height per floor (total height = floors × floorHeight)
  windowStyle?: 'regular' | 'wide' | 'narrow';  // default 'regular'
  acProbability?: number;  // 0-1, chance per window, default 0.7
  signProbability?: number;  // 0-1, chance of having signs, default 0.3
  signText?: string;    // default random from cyberpunk-themed word pool
  palette?: 'cyberpunk' | 'brutalist' | 'glass' | string[];  // default 'cyberpunk'
}
```

### Height and floors

- `floors` range: **2–20**. When not specified, the generator picks a random value in this range using the seed.
- Total building height = `floors × floorHeight` (default floorHeight = 1 unit).
- Fewer floors (2–5): low-rise, wider proportions, fewer windows per column, flat roof dominates.
- More floors (15–20): tower-like, narrower proportions, full window grid, LED signs more likely.
- The same seed + same floors = same height. The generator does not add random jitter to the floor count — variation comes from `floors` being part of params or chosen by a higher-level city generator (future feature).

### Colors

- `palette` accepts a named preset or a custom `string[]` of hex colors.
- Built-in presets (each is a 5-color array picked via seed):

| Preset | Vibe | Sample colors |
|--------|------|---------------|
| `cyberpunk` | Neon, dark, saturated | `#ff00ff`, `#00ffff`, `#1a1a2e`, `#e94560`, `#0f3460` |
| `brutalist` | Concrete, muted, grey | `#4a4a4a`, `#6b6b6b`, `#2d2d2d`, `#8a8a8a`, `#1a1a1a` |
| `glass` | Blue, reflective, corporate | `#1b2838`, `#2a475e`, `#c7d5e0`, `#66c0f4`, `#171a21` |

- Body color: first color in palette.
- Windows: second color (or emissive variant of first for lit windows).
- AC units: third color (desaturated).
- Door: fourth color.
- LED signs: fifth color as emissive.
- When palette is a custom array, colors are used in rotation. If fewer colors than needed, wrap around.
- The generator assigns colors deterministically — same seed + same palette = same color assignments.

### Deterministic PRNG

Use mulberry32 — 7 lines of code, well-tested, no dependency. Seeds produce identical sequences on any JS runtime.

```typescript
function mulberry32(seed: number): () => number {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
```

### Constraints

- All generators are pure functions: no side effects, no DOM, no Three.js runtime
- `Part` uses world-space transforms (position/rotation/scale is absolute, no parent-child)
- Color strings are CSS hex (`"#ff00ff"`) or CSS named (`"cyan"`)
- Max 500 parts per building (to keep serialization size reasonable)

### Out of Scope

- Rendering to Three.js (separate feature)
- City layout and block generation (separate feature)
- Roof variations beyond flat (separate feature)
- Multiple facade faces (front only for now)
- Text rendering on signs (just carries `text` string; renderer decides)

---

## Dependencies

### Feature Dependencies

- None (this is the first feature)

### External Dependencies

- `typescript` (dev, already installed)
- `@types/three` (to be installed, type-only reference)

---

## Technical Considerations

### Performance

- Generator should produce a building in < 5ms (so 500 buildings < 2.5s)
- Building JSON should be < 50KB (so 500 buildings < 25MB, acceptable)

### Backward Compatibility

- Types should be forward-compatible: unknown properties ignored on deserialization
- Seed determinism is a contract — changing the generator algorithm requires a version field

---

## API Contract

```text
generateBuilding(params: BuildingParams, seed: number) → Building

BuildingParams:
  All fields optional with sensible defaults.
  Unknown fields ignored (forward compat).

Building:
  { id: string, position: [0,0,0], rotation: [0,0,0], parts: Part[] }

Part:
  { type: 'box'|'plane'|'cylinder', position: [x,y,z],
    rotation: [rx,ry,rz], scale: [sx,sy,sz], color: '#rrggbb',
    emissive?: '#rrggbb', text?: string }

City:
  { seed: number, buildings: Building[] }
```

---

## Glossary

| Location | Type | Description |
|----------|------|-------------|
| `code::lib/types.ts::Part` | source | Core geometry part — a single primitive with world-space transform and material |
| `code::lib/types.ts::Building` | source | Collection of parts forming one building |
| `code::lib/types.ts::City` | source | Collection of buildings forming a city — the save file format |
| `code::lib/types.ts::BuildingParams` | source | Parameters controlling building generation |
| `code::lib/generator/building.ts::generateBuilding` | source | Main entrypoint: params + seed → Building |
| `code::lib/generator/body.ts::generateBody` | source | Main building volume (BoxGeometry) |
| `code::lib/generator/facade.ts::generateFacade` | source | Windows, door, AC units on front face |
| `code::lib/generator/details.ts::generateDetails` | source | LED signs, decorative elements |
| `code::lib/utils/prng.ts::createRng` | source | Seeded PRNG factory (mulberry32) |
| `wiki::procedural-generation::mental-model` | wiki | Generation pipeline: seed → layout → blocks → buildings → parts |
| `wiki::building-system::mental-model` | wiki | Building anatomy: body, facade, roof, details hierarchy |

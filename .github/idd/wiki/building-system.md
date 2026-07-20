# Building System

## Summary

Procedural generation system for individual buildings from Three.js primitives. Each building is a composition of body, facade, roof, and decorative details. Variation is controlled by parameters + seed, ensuring visual diversity without manual assets.

## Mental Model

A building is a hierarchy of geometric parts:

```
Building
├── Body (BoxGeometry) — main structure
│   ├── Base (optional, wider)
│   ├── Segments[] (multiple stacked segments)
│   └── Setbacks (upper-floor recesses)
├── Facade (surface details)
│   ├── Windows[] (PlaneGeometry with variation)
│   ├── Ledges[] (thin BoxGeometry)
│   └── Panels[] (color/material variation)
├── Roof (building top)
│   ├── Flat (default)
│   ├── Angled (rotated BoxGeometry)
│   ├── Antenna (thin CylinderGeometry)
│   └── AC units, helipads, domes
└── Details (decorative elements)
    ├── Neon signs (PlaneGeometry + emissive)
    ├── Pipes (external CylinderGeometry)
    └── Billboards (PlaneGeometry with solid color)
```

### Per-building parameters

| Parameter | Range | Description |
|-----------|-------|-------------|
| floors | 2-20 | Number of floors. Total height = floors × floorHeight. Drives window row count and proportions |
| floorHeight | 0.8-1.5 | Height per floor in world units, default 1 |
| width | 1-4 | Base width |
| depth | 1-4 | Base depth |
| windowStyle | enum | 'regular', 'wide', or 'narrow' |
| acProbability | 0-1 | Chance an AC unit appears below a window |
| signProbability | 0-1 | Chance of LED sign(s) |
| signText | string | Text on LED sign, or random from word pool |
| palette | preset | string[] | Color palette: 'cyberpunk', 'brutalist', 'glass', or custom hex array |

### Color system

Buildings use a 5-color palette assigned deterministically:

| Slot | Used for |
|------|----------|
| 0 | Body (main structure) |
| 1 | Windows (or lit window variant) |
| 2 | AC units, pipes, mechanical |
| 3 | Door, entry features |
| 4 | LED signs, neon accents (emissive) |

Three built-in presets (`cyberpunk`, `brutalist`, `glass`) plus custom `string[]` accepted.

### Procedural variation

- **Height**: controlled by zone + random perturbation
- **Width/Depth**: variation within block with minimum setback
- **Segments**: taller buildings get more segments, each can have setback
- **Facade**: window grid with perturbation (some dark, varied colors)
- **Roof**: selected by seed, increased chance for commercial buildings
- **Details**: density proportional to style (neon = more signs, industrial = more pipes)

## Anchors

- `code::lib/building-generator.ts::generateBuilding` — individual building generation (TODO)
- `code::lib/building-generator.ts::BuildingParams` — parameters interface (TODO)
- `code::lib/facade-generator.ts::generateFacade` — facade generation (TODO)
- `code::lib/roof-generator.ts::generateRoof` — roof generation (TODO)
- `wiki::procedural-generation::mental-model` — full pipeline
- `wiki::city-system::mental-model` — how buildings are organized in the city

## Decisions

- **2026-07-20**: Three.js primitives directly, no GLTF/OBJ. Keeps bundle small and full control over geometry.
- **2026-07-20**: No textures — everything is solid color/material. Consistent with minimalist cyberpunk aesthetic and avoids asset loading.

## Open Questions

- Instancing strategy: `InstancedMesh` per geometry type (e.g., all windows share geometry) vs geometry merging per block?
- Emissive materials for neon: how many additional lights can WebGL handle before degrading?
- Highly detailed facades (200+ windows per building) × 500 buildings = 100k polygons. Concerning or irrelevant on modern hardware?

## Evidence

- `architecture.md` — Capabilities, Open Questions about instancing and LOD
- `wiki::procedural-generation::mental-model` — layered generation architecture
- Interview with author — 2026-07-20

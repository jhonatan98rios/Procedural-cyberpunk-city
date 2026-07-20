# Procedural Generation

## Summary

All urban geometry is generated at runtime from parameters and seeds, with no pre-modeled 3D assets. The system combines Three.js primitives (BoxGeometry, CylinderGeometry, PlaneGeometry) to build buildings, streets, and urban elements procedurally. Each seed deterministically produces the same city.

## Mental Model

A city is a composition tree:

```
Seed → CityLayout → Blocks[] → Buildings[] → GeometryParts[]
```

- **Seed** (number): drives all pseudo-random variation. Same seed = same city.
- **CityLayout**: block grid with streets in between. Defines density and zoning.
- **Block**: set of buildings in a city block, with setback and height rules.
- **Building**: a building composed of main body + facade variations + roof + details.
- **GeometryParts**: Three.js primitives with applied transforms (position, rotation, scale, material).

The generator is **pure**: functions that take parameters + seed and return data structures.
Rendering is separate: structures are converted to Three.js `Mesh`/`InstancedMesh` in a distinct step.

### Invariants

- Same seed + same parameters = same geometry (deterministic)
- No external assets loaded (no GLTF, textures, models)
- Library does not depend on React, Next.js, or DOM
- Generation and rendering are separate stages

## Anchors

- `code::lib/city-generator.ts::generateCity` — main generation entrypoint (TODO)
- `code::lib/building-generator.ts::generateBuilding` — individual building generation (TODO)
- `wiki::city-system::mental-model` — city composition
- `wiki::building-system::mental-model` — building composition

## Open Questions

- Seeds: use `number` or a stateful PRNG library (mulberry32, xoshiro)?
- Parameterization: flat config object or builder pattern?
- Color palette system: HSL manipulated procedurally or predefined palettes?

## Evidence

- `architecture.md` — system description and runtime topology
- Interview with author — 2026-07-20

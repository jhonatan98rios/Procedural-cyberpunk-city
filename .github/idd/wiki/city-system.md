# City System

## Summary

Urban layout system that organizes blocks and streets in a procedural grid. Defines the city's macro-structure: grid size, street width, block density, and zone type distribution (commercial, industrial, residential) which influence building generation parameters.

## Mental Model

A city is a 2D grid where each cell is either a **block** or a **street**.

```
Grid N×M:
  - 0,0: corner (two street sides)
  - 1,0: horizontal street
  - 0,1: vertical street
  - 1,1: block (contains N buildings)
```

### Layout rules

1. Streets occupy alternating rows and columns (offset grid)
2. Street width is globally configurable
3. Blocks have variable size with procedural perturbation
4. Each block has a `zoneType` that affects:
   - Average building height
   - Density (how many buildings per block)
   - Color palette and materials
   - Facade and roof style

### Zoning

| Zone | Height | Density | Style |
|------|--------|---------|-------|
| Commercial | Tall (20-60 floors) | High | Glass, neon, signs |
| Industrial | Low-Medium (3-15 floors) | Medium | Concrete, metal, smokestacks |
| Residential | Medium-Tall (10-40 floors) | High | Concrete, windows, satellite dishes |

Zone transitions can be smooth (gradient) or sharp (distinct districts).

## Anchors

- `code::lib/city-layout.ts::generateCityLayout` — block grid generation (TODO)
- `code::lib/zone-types.ts::ZoneType` — zoning enum/type (TODO)
- `wiki::procedural-generation::mental-model` — full generation pipeline
- `wiki::building-system::mental-model` — how each building is generated

## Decisions

- **2026-07-20**: Grid-based layout over organic/radial. Grid is simpler, predictable, and scales better for hundreds of blocks. Organic layout can come later as a variation.

## Open Questions

- Non-flat terrain support (elevation)? Start flat.
- Curved or diagonal streets? No — pure grid first.
- Water, bridges, parks? Out of initial scope.

## Evidence

- `architecture.md` — Capabilities lists "block and urban grid composition"
- Interview with author — 2026-07-20

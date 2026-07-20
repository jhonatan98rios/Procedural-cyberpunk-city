# Architecture

## Summary

Procedural cyberpunk city generation system for the browser. A TypeScript library that composes urban objects (buildings, streets, infrastructure) from Three.js primitives, targeting massive scale (hundreds of buildings), high performance, and visual impact. The library lives inside a Next.js project that serves as an interactive showcase. All geometry is generated at runtime — no pre-modeled assets.

## Mode

- Mode: greenfield
- Source: interview
- Last Updated: 2026-07-20

## Projects

| Name | Path | Role | Notes |
|------|------|------|-------|
| procedural-city-lib | `lib/` | Core procedural 3D generation library | Geometry composition engine, block system, facade generation |
| showcase | `app/` | Interactive Next.js showcase | Renders generated city, camera controls, parameter UI |

## Capabilities

- Procedural building generation from Three.js primitives (BoxGeometry, CylinderGeometry, etc.)
- Block and urban grid composition
- Rendering hundreds of buildings with acceptable performance
- Parametric visual variation (height, width, facade style, colors, lighting)
- Modularity: each urban element is an independent module
- Web showcase with interactive controls (orbit, parameters, regeneration)

## Runtime Topology

Browser-only. Three.js renders via WebGL. Next.js delivers the static bundle + RSC if needed.

| Component | Type | Runtime Or Host | Notes |
|-----------|------|-----------------|-------|
| procedural-city-lib | TypeScript library | Browser (WebGL) | No Node.js runtime dependency |
| showcase | Next.js App Router | Browser + Vercel/Node | RSC pages + client components for 3D canvas |
| Three.js | Dependency | Browser | WebGL renderer, no server-side scene rendering |

## Data Stores

| Name | Type | Used By | Notes |
|------|------|---------|-------|
| Generation parameters | In-memory (JS objects) | procedural-city-lib | Seeds, dimensions, palettes, styles — all ephemeral |
| UI state | React state / URL search params | showcase | Optional parameter persistence in URL |

## Integrations

| System | Direction | Purpose | Notes |
|--------|-----------|---------|-------|
| three.js | Inbound (dependency) | 3D engine and geometric primitives | Core of the lib; use directly, don't wrap in own abstractions |
| @react-three/fiber | Inbound (optional) | React ↔ Three.js bridge | Evaluate whether it simplifies or adds unnecessary overhead |
| Next.js | Host | Showcase delivery | SSG/SSR for page shell; canvas is client-only |

## Open Questions

- Instancing strategy: `InstancedMesh` vs geometry merging vs custom shader? Memory and draw call impact with 500+ buildings.
- LOD (Level of Detail): needed at city scale or is frustum culling enough?
- Lighting: runtime baked (lightmaps) vs dynamic? Dynamic lights don't scale well with hundreds of buildings.
- Deterministic seed system for consistent city regeneration.
- @react-three/fiber: adds heavy dependency. Start with vanilla Three.js on canvas, migrate if needed.

## Evidence

- `package.json` — Next.js 16, React 19, TypeScript, Tailwind CSS (base project)
- Interview with project author — 2026-07-20

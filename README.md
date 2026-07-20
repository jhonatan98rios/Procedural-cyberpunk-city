# Procedural Cyberpunk City

TypeScript library for procedural generation of cyberpunk 3D cities using Three.js primitives. Interactive showcase built with Next.js.

## Concept

All urban geometry — buildings, blocks, streets, facade details — is generated procedurally at runtime. No pre-modeled 3D assets, no textures. Each seed deterministically produces the same city. The library is pure (no React/Next.js dependency) and lives inside this repository as a showcase.

### Scale

- **500+ buildings** in scene with viable performance (instancing strategy)
- Urban grid with **procedural layout** and zoning (commercial, industrial, residential)
- Buildings with **parametric variation**: height, segments, setbacks, facade styles, roofs, decorative details
- **Cyberpunk aesthetic**: neon, concrete, metal, glass — solid colors and emissive materials

### Stack

| Layer | Technology |
|-------|------------|
| 3D Engine | Three.js (WebGL) |
| Procedural library | Pure TypeScript |
| Showcase | Next.js 16 + React 19 + Tailwind CSS 4 |

## Structure

```
lib/                     ← Core library (to be implemented)
├── city-generator.ts    Entrypoint: full city generation
├── city-layout.ts       Block grid and streets
├── building-generator.ts Individual building generation
├── facade-generator.ts  Facades, windows, details
├── roof-generator.ts    Building tops
├── types.ts             Public interfaces and types
└── utils/               PRNG, geometry helpers, palettes

app/                     ← Next.js showcase
├── page.tsx             Main page
├── layout.tsx           Base layout
└── _components/         React components (canvas, controls)

.github/idd/             ← IDD documentation
├── architecture.md      Architecture and runtime
├── conventions.md       Code conventions
├── learned.md           Learned rules
└── wiki/                Domain articles
```

## Development

```bash
npm install
npm run dev      # Next.js dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

## Roadmap

1. [ ] Add `three` and `@types/three` as dependencies
2. [ ] Implement `lib/city-generator.ts` — generation pipeline
3. [ ] Implement `lib/building-generator.ts` — buildings
4. [ ] Create Three.js canvas in showcase React component
5. [ ] Orbital camera system and controls
6. [ ] Instancing strategy for scale

---

*Greenfield project — July 2026*

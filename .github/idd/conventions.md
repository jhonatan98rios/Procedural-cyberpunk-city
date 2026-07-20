# Conventions

## Summary

Strict TypeScript, Next.js App Router with isolated client components for WebGL, Tailwind CSS 4 for showcase styling, ESLint with default Next.js config. 3D library code is pure TypeScript with a single dependency on three.js — no coupling with React or Next.js.

## Languages And Tooling

| Area | Choice | Notes |
|------|--------|-------|
| Languages | TypeScript 5 (strict) | Existing `tsconfig.json` |
| Package Managers | npm | `package-lock.json` present |
| Frameworks | Next.js 16 (App Router) | Showcase only; lib is framework-agnostic |
| Linters And Formatters | ESLint 9 + eslint-config-next | Default Next.js config |
| CSS | Tailwind CSS 4 + PostCSS | Showcase only; lib emits no CSS |
| Test Tooling | TBD | No test runner installed yet |
| 3D Engine | three.js | To be added as dependency |

## Formatting

- Indentation: 2 spaces (Next.js/JSX convention)
- Quotes: Single quotes for TS, double for JSX attributes
- Semicolons: Yes (TypeScript default)
- File Organization: One component/class per file

## Naming

- Files: `kebab-case.ts` for modules, `PascalCase.tsx` for React components
- Functions: `camelCase`
- Classes: `PascalCase`
- Types/Interfaces: `PascalCase`, no `I` prefix
- Tests: `*.test.ts` or `*.spec.ts` (TBD)

## Imports And Boundaries

- Lib (`lib/`) must not import from `app/` or from React/Next.js
- Lib depends exclusively on three.js and browser APIs (WebGL, Math)
- Showcase (`app/`) imports from lib and React/Next.js/three.js
- Relative imports within the same project
- Path aliases via `tsconfig.json` for `@/` pointing to project root

## Testing

- Unit tests for procedural generation functions (deterministic output with same seed)
- Visual tests or geometry snapshots (tooling TBD)
- No framework chosen yet; use whatever is simplest and most direct

## Logging And Errors

- Lib: no `console.log` in production; use `throw` for parameter errors
- Showcase: `console.warn`/`console.error` for development debugging
- No structured logging system — project has no backend

## Library Patterns

| Library Or Tool | Approved Usage Pattern | Avoid |
|-----------------|------------------------|-------|
| three.js | Use directly — `BoxGeometry`, `MeshStandardMaterial`, `InstancedMesh` | Unnecessary wrappers around Three.js primitives |
| React | Client components only where needed (canvas, controls) | Wrapping the 3D lib in hooks/contexts without need |
| Tailwind CSS | Utility classes in showcase components | Custom CSS when Tailwind already covers it |

## Component Locations

| Component Type | Preferred Location | Notes |
|----------------|--------------------|-------|
| 3D Library (core) | `lib/` | Pure TypeScript + three.js modules |
| React components (showcase) | `app/_components/` | Isolated client components |
| Shared types | `lib/types.ts` | Lib input/output interfaces |
| Utilities | `lib/utils/` | Stateless helper functions |

## Anti-Patterns

- Abstract classes or factories with a single concrete implementation
- Wrapping Three.js primitives behind custom interfaces (unnecessary abstraction)
- React hooks that encapsulate procedural logic (lib is pure, React is just showcase)
- YAML/JSON config for values that never change in production

## Evidence

- `package.json` — Next.js 16.2.10, React 19.2.4, TypeScript 5, ESLint 9, Tailwind CSS 4
- `tsconfig.json` — Default create-next-app configuration
- `eslint.config.mjs` — Default eslint-config-next config
- `.cursorrules` — IDD operating contract active

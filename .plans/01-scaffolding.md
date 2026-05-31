# Phase 1 — Scaffolding & blank canvas

> Read `.plans/00-OVERVIEW.md` and `docs/IMPLEMENTATION_STATE.md` first. Implement only this phase. Do NOT commit/push — stop and report with a screenshot.

## Goal
A running Turborepo monorepo with a React + Vite + React Router SPA, TailwindCSS, shadcn initialized (vendored into `packages/ui`), the package skeleton, and a full-viewport canvas that paints a dotted-grid background and resizes correctly with devicePixelRatio. No model, tools, or persistence yet.

## Scope
**In:**
- Turborepo + npm workspaces (`apps/*`, `packages/*`). `turbo.json`, root `package.json`, `tsconfig.base.json`.
- `packages/config`: shared `tsconfig`, eslint flat config, tailwind preset, vitest config.
- `apps/web`: Vite + React + TypeScript + React Router (one route `/` → `BoardRoute`). Tailwind wired.
- `packages/ui`: shadcn initialized (`components.json`), one shadcn `Button` vendored to prove the pipeline.
- `packages/engine` (skeleton): `render/Renderer.ts` (canvas + DPR-correct resize + dotted-grid paint), `render/loop.ts` (flag-gated rAF loop, no-op when not dirty).
- `packages/persistence` + `packages/engine` other folders: empty index stubs so imports resolve.
- `apps/web/src/components/CanvasHost.tsx`: mounts ONE `<canvas>`, hands ref to `Renderer`, attaches `ResizeObserver` + DPR-change `matchMedia` listener, starts the loop.

**Out:** any element model, store, tools, selection, persistence, multiple canvases (overlay comes in Phase 2).

## Technical approach
- All installs: `npm install --ignore-scripts`. shadcn components are **vendored** (copied source) into `packages/ui`, not added as a runtime dep.
- Workspaces in root `package.json`: `"workspaces": ["apps/*", "packages/*"]`. Each package has its own `package.json` with a name like `@freedraw/engine`, `@freedraw/ui`, `@freedraw/config`, `@freedraw/persistence`; app is `@freedraw/web`.
- `turbo.json` pipeline: `build` (depends on `^build`), `dev` (persistent, no cache), `test`, `lint`, `typecheck`.
- `Renderer.resize()`: read CSS size from the canvas client rect, set `canvas.width = cssW * dpr`, `canvas.height = cssH * dpr`, set CSS size via style, `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`. This is the ONE place DPR is handled.
- Grid: draw a light dotted grid in world-ish space (Phase 2 adds the camera; for now a static screen-space grid is fine). Keep it cheap.
- Loop: `requestAnimationFrame`; only repaint when a `needsRender` flag is set; set it on resize. Expose `markDirty()`.
- TypeScript `strict: true` across all packages via the shared base config.

## Key files
- `turbo.json`, `package.json`, `tsconfig.base.json`, `.gitignore` (add `node_modules`, `dist`, `.turbo`)
- `packages/config/{tsconfig.base.json, eslint.config.js, tailwind-preset.js, vitest.config.ts, package.json}`
- `apps/web/{package.json, vite.config.ts, index.html, tailwind.config.js, postcss.config.js}`
- `apps/web/src/{main.tsx, App.tsx, index.css}`, `apps/web/src/routes/BoardRoute.tsx`, `apps/web/src/components/CanvasHost.tsx`
- `packages/ui/{package.json, components.json, src/index.ts, src/components/ui/button.tsx, src/lib/utils.ts}`
- `packages/engine/{package.json, src/index.ts, src/render/Renderer.ts, src/render/loop.ts}`
- `packages/persistence/{package.json, src/index.ts}`

## Manual test steps (mark complete when all pass)
1. `npm install --ignore-scripts` succeeds; `npx turbo dev` starts the app with no console errors; visiting `/` shows the board.
2. The page shows a full-window dotted-grid canvas; resizing the window keeps the grid crisp and re-fills the viewport (no blur, no clipping).
3. On a HiDPI display (or browser zoom / 2× display) the grid lines stay sharp — DPR is applied.
4. A visible shadcn `Button` renders on the page (proves Tailwind + shadcn vendor pipeline).
5. `npx turbo build` builds all packages with **no type errors**.
6. Idle CPU: with the loop running but nothing dirty, no repaint happens (log paints; confirm none at idle).

## Definition of done
- [ ] Monorepo builds and runs; `/` route renders the canvas.
- [ ] DPR-correct, resize-correct dotted-grid canvas.
- [ ] shadcn Button renders (Tailwind + ui pipeline works).
- [ ] `turbo build` is green.
- [ ] Loop is flag-gated (no idle repaints).
- [ ] `docs/IMPLEMENTATION_STATE.md` updated: fill **How to run / test** (exact commands + app URL), record the established conventions (package names, aliases, registry patterns), and set Phase 1 = Done (awaiting user commit).

# FreeDraw — Phase 0: Shared Overview (read this first, every phase)

> **You are a phase-agent.** You have no memory of the planning session. Read this file, then read `docs/IMPLEMENTATION_STATE.md` (the as-built state), then your specific `.plans/0N-*.md`. Implement only your phase. Then update `docs/IMPLEMENTATION_STATE.md` and **stop — do NOT commit or push.** The user verifies and commits.

## What FreeDraw is

A lightweight, open-source, self-hostable diagramming web app (a lighter draw.io / Excalidraw). Single board, no auth, runs entirely in the browser, persists to IndexedDB so a refresh never loses work. Flowchart-style shapes, arrows that bind to shapes and stay attached, text labels, sticky notes, freehand, images, styling, pan/zoom. See `idea-examples/*.png` for the target UX (bottom-center toolbar, shapes popover, selection chrome with connection ports, bound labeled arrows).

## Mandated tech stack (non-negotiable)

- **Turborepo** monorepo + **npm workspaces**. Always install with `npm install --ignore-scripts`.
- **React + Vite + React Router** SPA (one route `/`).
- **TailwindCSS**.
- Drawing surface is **HTML5 Canvas 2D** (not SVG, not WebGL).
- **shadcn** components, **vendored** into `packages/ui` via the shadcn CLI (not a runtime dep — avoids postinstall under `--ignore-scripts`).
- **Yjs** (`yjs`) + **`y-indexeddb`** for state, undo/redo, and persistence.

## Mandated engineering rules (enforced in every phase)

- **No comments in code.** Code must be self-explanatory through naming and structure.
- **Early returns** over nested conditionals.
- **Fix root causes, not symptoms.** No hacky patches.
- **Clean architecture, reusable components, less code.** Offer refactors if they improve quality.
- **Low memory & CPU usage is a KEY factor.** This drives the rendering architecture below.
- **Tests where testable** (Vitest). Pure engine logic must have unit tests.
- Security, maintainability, scalability.
- Use logs for debugging.
- Keep any PR description ≤ 3 lines; attach a screenshot/recording when reporting a phase done.

## Monorepo layout (target end-state)

```
apps/web/                  React + Vite + Router SPA (the only app; route "/")
packages/engine/           framework-agnostic core — NO React, NO DOM chrome
  model/                   element types, factories, Yjs<->mirror sync, schema/migrations
  store/                   SceneStore: Y.Doc + plain-object mirror + subscribe + UndoManager
  render/                  Renderer, painter registry, rAF loop, dirty flag, two-canvas
  geometry/                vec/rect/matrix, Camera, hitTest, shapeOutline, intersectRay, snap
  tools/                   Tool state machine (select/shape/arrow/text/sticky/pencil/eraser/hand/image)
  connectors/              binding resolution + edge intersection + routing
  controller/              EditorController — wires store + renderer + tools + input
  input/                   InputManager (pointer/keyboard/wheel -> active tool)
packages/persistence/      y-indexeddb wiring + asset Blob store
packages/ui/               shadcn chrome (toolbar, popovers, pickers, actions bar, style panel)
packages/config/           shared tsconfig / eslint / tailwind preset / vitest config
```

> `packages/engine` MUST NOT import React or any DOM-chrome. It only touches `HTMLCanvasElement` / `CanvasRenderingContext2D` handed to it. This keeps React out of the render hot path and makes the engine unit-testable in Node.

## The core architectural pattern: Yjs source-of-truth + plain-object mirror

This is the single most important decision. **Yjs is the source of truth and the mutation target, but the renderer never reads Yjs directly.**

```
                 transact(fn)                observe (deep)
   Tools/UI  ───────────────►  Y.Doc  ───────────────────►  plain-object mirror  ──► Renderer reads this
                                 │                                  │
                          Y.UndoManager                     store.subscribe(cb)  ──► React chrome (coarse slices)
                                 │
                          y-indexeddb (autosave + load)
```

- **`Y.Doc` structure:**
  - `doc.getMap('elements')` → `Y.Map<elementId, Y.Map>` (each element is a `Y.Map` of its fields).
  - `doc.getArray('elementOrder')` → `Y.Array<elementId>` (z-order, low→high paint order).
  - `doc.getMap('appState')` → `Y.Map` holding `camera {x,y,zoom}` and `lastUsedStyle`.
- **The plain-object mirror** (lives in `SceneStore`): `{ elements: Record<id, Element>, order: id[], appState }`. A **single deep observer** (`elements.observeDeep`, `elementOrder.observe`, `appState.observe`) translates Yjs events into **targeted** mirror updates (only changed ids) and sets the render **dirty flag**. The renderer and hit-testing read ONLY the mirror — never `Y.Map.get()` per element per frame.
- **All mutations go through `store.transact(fn)`** which opens a `doc.transact(fn, ORIGIN)`. This guarantees one UndoManager entry per gesture. Use a consistent transaction `origin` so UndoManager tracks it; use `captureTimeout` (~500ms) plus `undoManager.stopCapturing()` at gesture boundaries (pointerup, tool switch) so each drag/edit is one undo step.
- **Ephemeral UI state** (`selectedIds`, `hoveredId`, in-progress drag previews, marquee rect) lives in the store/mirror but is **local-only** — NOT written into the Yjs element data (so it won't sync/persist/undo). Keep it in a separate `uiState` object in the store with its own subscribe channel.

### Why this matters for performance
Reading Yjs types every frame is expensive (proxy/get overhead, tombstones). The mirror is plain JS objects → cheap iteration, cheap culling, cheap hit-testing. CRDT cost is paid once per mutation (in the observer), not per frame.

## Data model (the mirror `Element` shape; Yjs stores the same fields)

`Element` is a discriminated union on `type`. Keep everything JSON-serializable.

```ts
type ElementId = string
type StrokeStyle = 'solid' | 'dashed' | 'dotted'

interface Style {
  stroke: string
  fill: string
  strokeWidth: number
  strokeStyle: StrokeStyle
  opacity: number
  roundness: number
  fontSize: number
  fontFamily: string
  textColor: string
  textAlign: 'left' | 'center' | 'right'
}

interface BaseElement {
  id: ElementId
  type: string
  x: number; y: number; width: number; height: number   // world-space AABB, top-left origin
  rotation: number                                       // radians, around center
  style: Style
  label?: { text: string; align: 'left' | 'center' | 'right'; verticalAlign: 'top' | 'middle' | 'bottom' }
}

type ShapeType =
  | 'rect' | 'roundRect' | 'ellipse' | 'diamond' | 'triangle'
  | 'cylinder' | 'hexagon' | 'parallelogram' | 'star' | 'cloud' | 'heart'

interface ShapeElement extends BaseElement { type: ShapeType }
interface StickyElement extends BaseElement { type: 'sticky' }
interface TextElement extends BaseElement { type: 'text'; text: string }
interface FreedrawElement extends BaseElement { type: 'freedraw'; points: Point[] }   // local-space polyline
interface ImageElement extends BaseElement { type: 'image'; assetId: string }

type Arrowhead = 'none' | 'triangle' | 'dot' | 'bar'
interface Binding { elementId: ElementId; anchor: { nx: number; ny: number }; gap: number }

interface ArrowElement extends BaseElement {
  type: 'arrow' | 'line'
  points: Point[]                       // derived geometry; [0]=start, [n-1]=end
  start?: Binding
  end?: Binding
  startArrowhead: Arrowhead
  endArrowhead: Arrowhead
  routing: 'straight' | 'orthogonal' | 'curved'
}
```

- **Bindings live on the arrow.** A **derived in-memory index** `Map<shapeId, Set<arrowId>>` (rebuilt on load, maintained on mutation, **NOT persisted**) answers "which arrows follow this shape" in O(1).
- **Arrow `points[]` are derived** from bindings when bound; bindings are the source of truth.
- **Labels are baked** onto shapes/stickies/arrows (`label` field) — no parent/child element relationships. Free `text` is a standalone element.
- **Images** reference `assetId`; the Blob lives in a separate IndexedDB `assets` store.
- **`schemaVersion`** is stored on `appState` for migrations.

## Rendering architecture (low-CPU mandate)

- **Two stacked canvases:**
  - **Scene layer** — the committed diagram. Repaints ONLY when the model changes.
  - **Overlay layer** — transparent, on top. Selection handles, connection ports, hover highlight, drag previews, snap guides, the "press Opt+→" ghost. Repaints on pointer move WITHOUT touching the scene layer.
- **One flag-gated `requestAnimationFrame` loop.** It paints at most once per frame, and only when `needsRender` (scene) / `needsOverlayRender` is set. At idle it paints nothing → ~0% CPU. Coalesces many pointermove mutations into one paint.
- **Viewport culling:** skip any element whose world AABB doesn't intersect the camera viewport.
- **Painter registry:** `painters[element.type](ctx, element, ctxState)`. Each shape type registers a painter. Shape outline geometry is shared between painter, hit-test, and connector intersection (`geometry/shapeOutline.ts`).
- **DPR:** backing store size = cssSize × devicePixelRatio. Set in ONE place (`Renderer.resize()`), recomputed on `ResizeObserver` and on a DPR-change `matchMedia` listener. `ctx.setTransform` folds in dpr × zoom.
- **Camera:** `Camera { x, y, zoom }`. `screen = (world - cameraOffset) * zoom`. Zoom-to-cursor (keep the world point under the cursor fixed). Clamp zoom (e.g. 0.1–8). Selection handles drawn in **screen space** so they're a constant size at any zoom.
- **Dirty granularity:** ship a **single `dirty` boolean** (full scene repaint when set) in V1. Dirty-rect clipping is a deferred optimization — do NOT add it until a measured large board needs it.

## Input & tools

- **`InputManager`** attaches `pointerdown/move/up`, `wheel`, `keydown/up` on the overlay canvas, uses pointer capture during drags, converts screen→world via `Camera`, builds a normalized `PointerInfo`, and forwards to the active tool.
- **Tools are a state machine.** Each implements `onActivate/onDeactivate/onPointerDown/onPointerMove/onPointerUp/onKeyDown` and reports whether it changed scene/overlay. `ToolManager` holds the active tool; switching tools is a discrete store action that drives the toolbar highlight.
- Tools: `SelectTool` (hit-test, move, marquee, resize/rotate handles, connection-port drag, Opt+Arrow spawn), `HandTool` (pan), `ShapeTool` (drag-to-create, parameterized by shapeType), `ArrowTool`/`LineTool`, `TextTool`, `StickyTool`, `PencilTool`, `EraserTool`, `ImageTool`.

## Hit-testing (CPU-cheap, all in world space; convert the pointer once)

1. **Handles first** — screen-space radius checks on selection handles / connection ports (these win over elements).
2. **Broad phase** — iterate `order` front-to-back (top-most first), reject elements whose AABB (expanded by `strokeWidth/2 + tolerance`) doesn't contain the point.
3. **Narrow phase** (only on AABB hits) — per-type precise test: rect/sticky/text = AABB; ellipse = normalized radius; polygon shapes = point-in-polygon on outline; arrows/lines/freedraw = distance-to-polyline ≤ `strokeWidth/2 + tolerance`. For unfilled shapes, hit only near the stroke band (configurable).
4. **No spatial index in V1** (linear scan + AABB reject is fine for hundreds of elements).

## Connectors & bindings (trickiest correctness)

- Bindings are source of truth; arrow `points[]` derived.
- On a shape `transact` (move/resize/rotate), gather its bound arrows from the index and recompute endpoints: for each bound endpoint, cast a ray from the other endpoint toward the anchor/center and **intersect the shape outline** via per-shape `intersectRay(shape, from)` (closed-form for rect/ellipse/diamond; polygon edge-intersect for the rest), pulled back by `gap`. Only the affected arrows recompute — O(moved × their arrows), not O(N).
- Hover a shape → overlay draws 4 edge-midpoint **connection ports**. Drag from a port → live arrow following the cursor; bind `end` on drop over a shape (nearest port/anchor) or leave free if dropped on empty canvas.
- V1: straight arrows + manual midpoint reshape (drag the midpoint handle to insert/move a waypoint). `orthogonal` auto-routing is modeled (`routing` field, multi-point `points[]`) but **deferred** post-V1.
- **Opt+Arrow spawn:** with one shape selected, Alt+ArrowKey creates a new shape offset in that direction + a bound arrow + selects the new shape. Pure composition of create + bind primitives.

## Undo/redo & persistence (Yjs)

- **`Y.UndoManager`** scoped to the `elements`/`elementOrder`/`appState` (excluding camera if you don't want camera moves undoable — decide and record in IMPLEMENTATION_STATE). `captureTimeout` ~500ms; `stopCapturing()` at gesture ends. `undo()`/`redo()` exposed via the store; `canUndo`/`canRedo` are coarse slices for the actions bar.
- **`y-indexeddb`** (`IndexeddbPersistence(docName, doc)`) gives autosave + load-on-boot for free. Wait for its `whenSynced`/`synced` event before starting the render loop so the board hydrates. Rebuild the derived binding index after hydrate.
- **Assets** (image Blobs) are NOT stored in the Y.Doc — keep them in a separate IndexedDB `assets` object store (`packages/persistence`). The element only holds `assetId`.
- **Camera** persists in `appState` so refresh restores the viewport.

## React boundary (keep it thin)

React may subscribe ONLY to coarse, low-frequency store slices: `activeTool`, `activeShapeType`, `selectionSummary` (count + shared style), `zoomPercent`, `canUndo/canRedo`. Bridge via `useSyncExternalStore`. If any chrome wants per-pointermove data, that's a smell — render it on the overlay canvas instead.

## Conventions

- TypeScript everywhere. `strict: true`. Path aliases per package (`@freedraw/engine`, `@freedraw/ui`, etc.).
- File naming: `PascalCase` for classes/components, `camelCase` for functions/modules.
- One painter per file under `render/painters/`; one tool per file under `tools/`. Register via a central registry — adding a shape/tool = add a file + one registry line.
- No comments. Tests live next to source as `*.test.ts` (engine) or in a `__tests__` folder; run with Vitest.
- Logs: use a tiny `logger` util; no stray `console.log` left in committed code paths (use the logger, gate by env).

## How to run / test (Phase 1 fills exact scripts into IMPLEMENTATION_STATE)

- Install: `npm install --ignore-scripts`
- Dev: `npx turbo dev` (or the app's dev script)
- Build (type-check gate): `npx turbo build`
- Test: `npx turbo test` (Vitest in `packages/engine`)

## Per-phase workflow (every agent)

1. Read this file → `docs/IMPLEMENTATION_STATE.md` → your `.plans/0N-*.md`.
2. Implement ONLY your phase's scope. Write tests for pure logic. Follow all rules above.
3. Run the build + tests + the phase's manual test steps. Capture a screenshot/recording of the working result.
4. Update `docs/IMPLEMENTATION_STATE.md`: phase status, as-built data model/contracts, any deviation from the plan **and why**, new conventions, how-to-test additions.
5. **Stop and report to the user with the screenshot. Do NOT `git commit` or `git push`.** The user verifies and commits.

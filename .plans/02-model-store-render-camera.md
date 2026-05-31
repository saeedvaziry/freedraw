# Phase 2 — Model, Yjs store, two-canvas renderer, camera (pan/zoom)

> Read `.plans/00-OVERVIEW.md` and `docs/IMPLEMENTATION_STATE.md` first. Implement only this phase. Do NOT commit/push — stop and report with a screenshot.

## Goal
A real `SceneStore` backed by a `Y.Doc` with a synced **plain-object mirror**, a two-canvas `Renderer` that paints elements from the mirror, working pan/zoom with a `Camera`, and viewport culling. No editing yet — seed 2–3 hard-coded elements to prove the pipeline end to end.

## Scope
**In:**
- Model types + factories + `schemaVersion` (per the data model in `.plans/00-OVERVIEW.md`).
- `SceneStore`: owns the `Y.Doc` (`elements` map, `elementOrder` array, `appState` map), builds and maintains the plain-object **mirror** via a single deep observer, exposes `getSnapshot()`, `subscribe(cb)`, `transact(fn)`, and a separate `uiState` channel (selection/hover — empty for now). Maintain the derived `shapeId -> Set<arrowId>` index structure (empty until arrows exist).
- `Camera` (`geometry/Camera.ts`): world↔screen, pan, zoom-to-cursor, clamp.
- `Renderer`: **two canvases** (scene + transparent overlay). Scene paints from the mirror with viewport culling; overlay paints nothing yet. DPR handled in `resize()`. Apply camera transform via `ctx.setTransform`.
- Painter registry (`render/painters/index.ts`) + a `rect` painter (others come in Phase 3).
- `EditorController`: wires store + renderer + camera + loop; subscribes the render dirty flag to store changes.
- `useSyncExternalStore` bridge in the app for a `ZoomIndicator` (coarse slice).
- Pan (wheel / space-drag / trackpad two-finger) and zoom (wheel/pinch toward cursor) — wired at the controller/input level (a minimal input hookup; full `InputManager`/tools land in Phase 3).
- **Unit tests:** `Camera` world↔screen round-trip, zoom-to-cursor fixed-point, culling AABB intersection, mirror sync (mutating the Y.Doc updates the mirror + sets dirty).

**Out:** tools/selection, real shapes beyond rect, persistence to disk (Y.Doc is in-memory this phase), undo.

## Technical approach
- **Mirror sync:** `elements.observeDeep`, `elementOrder.observe`, `appState.observe`. On event, update only changed mirror ids (add/update/delete), recompute `order`, set `needsRender`, notify subscribers. Never read Yjs in the render loop.
- **transact:** `store.transact(fn)` = `doc.transact(() => fn(txnApi), ORIGIN)` where `txnApi` provides helpers to add/update/remove elements and reorder. Seed elements through this path.
- **Camera in render:** `ctx.setTransform(dpr*zoom, 0, 0, dpr*zoom, -cam.x*dpr*zoom, -cam.y*dpr*zoom)` for the scene layer. Overlay will paint in screen space (Phase 4+).
- **Culling:** compute viewport world-rect from camera + canvas size; skip elements whose world AABB doesn't intersect.
- **Idle:** loop stays flag-gated; pan/zoom set the dirty flag.
- Keep ephemeral camera in `appState` mirror (persisted later in Phase 9) but don't wire IndexedDB yet.

## Key files
- `packages/engine/src/model/{types.ts, factory.ts, schema.ts}`
- `packages/engine/src/store/SceneStore.ts` (+ mirror sync, transact, uiState)
- `packages/engine/src/geometry/{vec.ts, rect.ts, matrix.ts, Camera.ts}`
- `packages/engine/src/render/{Renderer.ts (extend), painters/index.ts, painters/rect.ts}`
- `packages/engine/src/controller/EditorController.ts`
- `apps/web/src/components/CanvasHost.tsx` (two canvases) + `apps/web/src/components/ZoomIndicator.tsx`
- Tests: `packages/engine/src/geometry/Camera.test.ts`, `store/SceneStore.test.ts`

## Manual test steps
1. 2–3 seeded rectangles appear at their correct world positions on load.
2. Pan (space-drag or wheel) moves all rects together; zoom (wheel/pinch) zooms toward the cursor — the point under the cursor stays fixed.
3. The `ZoomIndicator` updates and respects clamped min/max zoom.
4. Rects stay crisp at high zoom and on HiDPI.
5. Idle CPU ~0 (loop paints nothing when not dirty — verify via paint log).
6. `npx turbo test` passes (Camera + store + culling tests green).

## Definition of done
- [ ] Yjs-backed store with synced plain-object mirror; renderer reads only the mirror.
- [ ] Two-canvas renderer (overlay present, empty); DPR + camera transform correct.
- [ ] Pan + zoom-to-cursor working; ZoomIndicator via `useSyncExternalStore`.
- [ ] Viewport culling in place.
- [ ] Unit tests green (`turbo test`); `turbo build` green.
- [ ] `docs/IMPLEMENTATION_STATE.md` updated: data model as-built, Y.Doc structure + transaction origin, `SceneStore`/`Camera` contracts, deviations.

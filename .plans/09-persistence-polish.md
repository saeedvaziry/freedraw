# Phase 9 — Persistence (y-indexeddb) & polish

> Read `.plans/00-OVERVIEW.md` and `docs/IMPLEMENTATION_STATE.md` first. Implement only this phase. Do NOT commit/push — stop and report with a screenshot/recording.

## Goal
Everything survives a refresh: the Y.Doc autosaves and loads from IndexedDB via `y-indexeddb`, image assets persist and rehydrate, the camera/viewport restores, schema migrations run on load. Final polish pass (snap guides, shortcuts, empty state, performance smoke check).

## Scope
**In:**
- Wire **`IndexeddbPersistence(docName, doc)`** (from `y-indexeddb`) in `packages/persistence` / `EditorController.init()`. Autosave is automatic; on boot, wait for `synced`/`whenSynced` BEFORE starting the render loop so the board hydrates. After hydrate: rebuild the derived `shapeId -> Set<arrowId>` binding index and restore `camera` from `appState`.
- Asset rehydrate: on load, for each `image` element, read its Blob from the `assets` store (built in Phase 8) and decode to `ImageBitmap` into the cache.
- **Schema migrations:** a migration runner keyed by `appState.schemaVersion`; on load, migrate older docs forward; bump version. Validate the loaded structure (treat persisted data as untrusted — if corrupt/incompatible and unmigratable, start a fresh board, optionally keeping a backup key).
- Polish:
  - Finalize keyboard shortcuts (tool hotkeys, zoom-to-fit, zoom 100%, select-all, duplicate, delete, undo/redo).
  - Refine snap guides / alignment guides.
  - Empty-board state (subtle hint when the board is empty).
  - Performance smoke check: ~300 elements pan/zoom stays ~60fps; idle = near-0% CPU (loop paints nothing). Confirm culling + flag-gated loop hold up. If a measured bottleneck appears, only then consider dirty-rect clipping (otherwise leave deferred).
- **Unit tests:** serialize/deserialize round-trip, migration from a prior schemaVersion fixture, corrupt-data → fresh board, binding-index rebuild after hydrate.

**Out:** export/import, sharing, real-time collaboration (post-V1).

## Technical approach
- `y-indexeddb` handles document autosave/load — do NOT hand-roll document persistence. Keep assets in the separate `assets` object store (Phase 8) since Blobs don't belong in the Y.Doc.
- Boot sequence in `EditorController.init()`: create doc → attach `IndexeddbPersistence` → `await persistence.whenSynced` → run migrations → build mirror → rebuild binding index → restore camera → start render loop.
- Flush safety: `y-indexeddb` persists transactionally, but still test the close-tab-and-reopen path.
- Migrations: a small ordered list of `(fromVersion) => transform(doc)` steps; run sequentially until current.
- Corrupt/incompatible: catch, log, start fresh (don't crash the app); preserve a backup copy of the raw data if feasible.

## Key files
- `packages/persistence/src/{db.ts, documentPersistence.ts}` (y-indexeddb wiring) + reuse `assetRepo.ts`
- `packages/persistence/src/migrations/index.ts`
- `packages/engine/src/controller/EditorController.ts` (boot sequence)
- `packages/engine/src/model/{serialize.ts, schema.ts}` (migration runner + validation)
- App: finalize `useKeyboard.ts`, empty-state component, zoom-to-fit
- Tests: `model/serialize.test.ts`, `model/migrations.test.ts`

## Manual test steps
1. Build a diagram (shapes, bound labeled arrows, a sticky, a pencil stroke, an image), refresh → everything reappears identically, including pan/zoom position and bound-arrow attachment.
2. Move shapes, wait ~1s, refresh → latest positions persisted; bound arrows still attached.
3. Insert an image, refresh → image still renders (asset Blob persisted + rehydrated to ImageBitmap).
4. Close the tab mid-edit and reopen → last state present.
5. Clear IndexedDB in devtools → app loads a clean empty board with no errors (and shows the empty-state hint).
6. Performance: create ~300 elements, pan/zoom → smooth ~60fps; idle → near-0% CPU. `npx turbo test` + `npx turbo build` green.

## Definition of done
- [ ] `y-indexeddb` autosave + load-on-boot; render loop starts after sync.
- [ ] Camera restore; binding index rebuilt after hydrate; assets rehydrated.
- [ ] Schema migration runner + corrupt-data fallback to fresh board.
- [ ] Polish: shortcuts, snap guides, empty state, performance smoke check passing.
- [ ] Tests + build green.
- [ ] `docs/IMPLEMENTATION_STATE.md` updated: persistence API, boot sequence, migration list + current schemaVersion, performance notes, V1 marked complete.
```

## After this phase
V1 is feature-complete. Post-V1 candidates (record in IMPLEMENTATION_STATE "deferred"): export PNG/SVG + JSON import/export, orthogonal auto-routing, dirty-rect clipping, real-time collaboration via a Yjs network provider.

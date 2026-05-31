# Phase 4 — Selection, transform handles, undo/redo, actions bar

> Read `.plans/00-OVERVIEW.md` and `docs/IMPLEMENTATION_STATE.md` first. Implement only this phase. Do NOT commit/push — stop and report with a screenshot/recording.

## Goal
Select elements (click, shift-click, marquee), show selection chrome (8 resize handles + rotate handle), move/resize/rotate, delete & duplicate, and a contextual actions bar (undo, redo, delete, duplicate, more — see `idea-examples/5.png`). Wire **`Y.UndoManager`** for undo/redo with one history entry per gesture.

## Scope
**In:**
- `SelectTool`: click to select, shift-click to toggle, empty-canvas drag = marquee (select intersecting), drag inside selection = move, drag a handle = resize/rotate. Track `hoveredId` on move (overlay-only repaint).
- Hit-testing (`geometry/hitTest.ts`): handles first → broad-phase AABB reject (front-to-back) → narrow-phase per-type (reuse `shapeOutline` + point-in-polygon / normalized-radius / distance-to-polyline). World space, convert pointer once.
- Overlay painting of selection box + 8 resize handles + rotate handle (screen space, zoom-independent size). Hover highlight.
- **`Y.UndoManager`** wiring in `SceneStore`: scope to `elements`/`elementOrder`/`appState` (decide camera inclusion and record it), `captureTimeout ~500ms`, `stopCapturing()` on pointerup/tool switch so each gesture is one step. Expose `undo()/redo()/canUndo/canRedo`.
- Actions bar UI (`packages/ui`): undo, redo, delete, duplicate, more (overflow). Buttons disable appropriately (undo disabled at history start).
- Keyboard: Delete/Backspace (delete), Cmd/Ctrl+D (duplicate), Cmd/Ctrl+Z (undo), Shift+Cmd/Ctrl+Z (redo), Cmd/Ctrl+A (select all), Escape (clear selection).
- **Unit tests:** hit-test per shape (inside/outside/near-edge), undo/redo round-trips (move/resize/rotate/delete/duplicate each = one step), multi-select move = one undo step, marquee intersection.

**Out:** arrows/connectors (Phase 5 — but Delete must already be structured so Phase 5 can cascade to bound arrows), text editing, styling panel, persistence.

## Technical approach
- Selection lives in `uiState.selectedIds` (local-only, not in Y.Doc). Selection AABB computed each overlay frame.
- Resize updates `x/y/width/height` (scale `freedraw.points` and `fontSize` proportionally for those types). Rotate updates `rotation` around the selection center. Handle hit-tests are screen-space radius checks.
- One history entry per gesture: begin on pointerdown (`undoManager.stopCapturing()` to break from the previous), accumulate moves within the same `doc.transact` origin during the drag, and `stopCapturing()` again on pointerup.
- Duplicate = clone selected elements with an offset, new ids, append to order, select the clones — all in one transact.
- Delete removes selected elements in one transact (structure the delete path so Phase 5 can also remove/unbind bound arrows).

## Key files
- `packages/engine/src/tools/SelectTool.ts`
- `packages/engine/src/geometry/hitTest.ts`
- `packages/engine/src/render/overlay/selection.ts`
- `packages/engine/src/store/SceneStore.ts` (UndoManager wiring, undo/redo API, canUndo/canRedo slices)
- `packages/ui/src/actions-bar/ActionsBar.tsx`
- App keyboard hook (`apps/web/src/hooks/useKeyboard.ts`)
- Tests: `geometry/hitTest.test.ts`, `store/undo.test.ts`

## Manual test steps
1. Click a shape → selection box + 8 resize handles + rotate handle appear (matches `idea-examples/2.png` chrome, minus connection ports which come in Phase 5).
2. Drag to move; drag a corner to resize; drag the rotate handle to rotate. Shift-click adds to selection; empty-canvas drag marquee-selects.
3. Delete removes the selection; Cmd/Ctrl+D duplicates with an offset; Cmd/Ctrl+A selects all.
4. Undo reverses move/resize/rotate/delete/duplicate exactly; Redo re-applies. Moving 5 shapes undoes in ONE step.
5. Actions bar buttons work and disable appropriately (undo disabled at history start).
6. `npx turbo test` + `npx turbo build` green.

## Definition of done
- [ ] Full selection + transform (move/resize/rotate/marquee/multi-select).
- [ ] Tiered hit-testing with unit tests.
- [ ] `Y.UndoManager` wired; one entry per gesture; actions bar reflects canUndo/canRedo.
- [ ] Delete/duplicate + keyboard shortcuts.
- [ ] Tests + build green.
- [ ] `docs/IMPLEMENTATION_STATE.md` updated: hit-test contract, UndoManager scope + capture strategy, delete path note for Phase 5, deviations.

# Phase 5 — Arrows & the connector/binding system

> Read `.plans/00-OVERVIEW.md` and `docs/IMPLEMENTATION_STATE.md` first. Implement only this phase. Do NOT commit/push — stop and report with a screenshot/recording. This is the trickiest phase — favor correctness and the deterministic binding model.

## Goal
Draw arrows/lines with snap guides; bind arrows to shapes via hover connection ports; arrows stay attached when shapes move/resize/rotate; reshape arrows (endpoints + midpoint waypoint); and the **Opt+Arrow** spawn-connected-shape gesture (`idea-examples/2.png`, `3.png`, `4.png`).

## Scope
**In:**
- `ArrowTool` / `LineTool`: drag-to-create with snap guides; arrowheads on the arrow.
- Arrow painter: polyline (straight, multi-point capable) + arrowheads (`none|triangle|dot|bar`) per end.
- **Connection ports:** on hover (and on selection) the overlay draws 4 edge-midpoint round ports for a shape. Drag from a port → live arrow following the cursor; candidate target shapes highlight; bind `end` on drop over a shape (nearest port/anchor), or leave the endpoint free if dropped on empty canvas.
- **Binding system** (`connectors/`): `Binding {elementId, anchor{nx,ny}, gap}` on the arrow; `intersectRay(shape, from)` per shape type (closed-form for rect/roundRect/ellipse/diamond; polygon edge-intersect for the rest) reusing `shapeOutline`. Resolve bound endpoints by casting from the other endpoint toward the anchor/center and intersecting the outline, pulled back by `gap`.
- **Binding index** maintenance in the store: `Map<shapeId, Set<arrowId>>`, rebuilt on load, updated on add/remove/bind/unbind. On a shape `transact`, recompute ONLY the affected bound arrows' endpoints (in the same transact).
- Arrow selection chrome: endpoint square handles + a midpoint reshape handle that inserts/moves a waypoint (`idea-examples/3.png`). Dragging an endpoint off a shape unbinds it; onto a shape binds it.
- **Cascade delete:** deleting a shape removes (or unbinds — pick one, default: remove) its bound arrows, all in one undo step (extends the Phase 4 delete path).
- **Opt+Arrow spawn:** single shape selected + Alt+ArrowKey → create a new shape offset in that direction + a bound arrow from source edge to new shape's opposite edge + select the new shape. Pure composition of create + bind.
- Basic snapping/guides (`geometry/snap.ts`): snap to other shapes' centers/edges and to straight angles while drawing/dragging endpoints (overlay guide lines).
- **Unit tests:** `intersectRay` per shape (ray from several directions lands on the correct edge point), binding resolution after move/resize/rotate, index maintenance, cascade delete, Opt+Arrow geometry.

**Out:** arrow text labels (Phase 6), orthogonal auto-routing (deferred post-V1; keep `routing` field + multi-point `points[]` forward-compatible), styling panel (Phase 7).

## Technical approach
- Bindings are the source of truth; `points[]` are derived whenever a bound shape changes or the arrow is reshaped.
- Only affected arrows recompute (via the index) — never the whole scene.
- Free (unbound) arrows keep their literal `points[]`.
- Live drag previews and port/guide rendering happen on the **overlay** layer.
- Keep `intersectRay` cheap and pure → heavily unit-tested.

## Key files
- `packages/engine/src/tools/{ArrowTool.ts, LineTool.ts}` (+ SelectTool extensions for port-drag, endpoint/midpoint reshape, Opt+Arrow)
- `packages/engine/src/connectors/{binding.ts, resolve.ts, intersect.ts}`
- `packages/engine/src/render/painters/arrow.ts`
- `packages/engine/src/render/overlay/{ports.ts, arrowHandles.ts, guides.ts}`
- `packages/engine/src/geometry/snap.ts`
- `packages/engine/src/store/SceneStore.ts` (index maintenance + recompute-on-move)
- Tests: `connectors/intersect.test.ts`, `connectors/resolve.test.ts`, `store/bindingIndex.test.ts`

## Manual test steps
1. Arrow tool: drag between two empty points → a straight arrow with an arrowhead; snap guides appear while drawing.
2. Hover a shape → 4 round ports appear; drag from one to another shape → a bound arrow connects them (like `4.png`, without a label yet).
3. Move either bound shape → the arrow stays attached and re-lands on the edge facing the arrow; resize/rotate the shape → still attached.
4. Select an arrow → endpoint + midpoint handles; drag the midpoint to bend it into a waypoint; drag an endpoint off the shape → it unbinds.
5. Delete a shape → its bound arrows are removed (or unbound per the chosen rule) in ONE undo step.
6. Select a shape, press Opt/Alt+→ → a new connected shape spawns to the right with a binding arrow; the new shape is selected. `npx turbo test` + `build` green.

## Definition of done
- [ ] Arrows/lines drawable with arrowheads + snap guides.
- [ ] Connection ports + drag-to-connect; bindings stay attached on move/resize/rotate.
- [ ] Endpoint/midpoint reshape; bind/unbind by dragging endpoints.
- [ ] Cascade delete in one undo step; Opt+Arrow spawn.
- [ ] `intersectRay` + resolution + index unit tests green; `build` green.
- [ ] `docs/IMPLEMENTATION_STATE.md` updated: `intersectRay` contract, binding/index APIs, cascade-delete rule chosen, snap behavior, deviations.

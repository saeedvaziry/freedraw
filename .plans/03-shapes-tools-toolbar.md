# Phase 3 — Shapes: tools, drawing, toolbar & shapes popover

> Read `.plans/00-OVERVIEW.md` and `docs/IMPLEMENTATION_STATE.md` first. Implement only this phase. Do NOT commit/push — stop and report with a screenshot/recording.

## Goal
Draw every shape type by picking a tool/shape and dragging on the canvas. Build the bottom-center toolbar and the shapes palette popover (see `idea-examples/5.png` and `3.png`). Introduce the `InputManager` and `ToolManager` (the tool state machine) that the rest of the app builds on.

## Scope
**In:**
- `Tool` interface + `ToolManager` (active tool; switching is a discrete store action driving toolbar highlight).
- `InputManager`: pointer/keyboard/wheel on the overlay canvas → world coords via `Camera` → active tool. Pointer capture during drag.
- `ShapeTool` (parameterized by `shapeType`): drag-to-create. `onPointerDown` starts an element (preview on overlay), `onPointerMove` resizes the preview, `onPointerUp` commits via `store.transact`.
- `HandTool` (pan) — moved out of the temporary Phase-2 hookup into a real tool.
- Painters for ALL shapes: `rect, roundRect, ellipse, diamond, triangle, cylinder, hexagon, parallelogram, star, cloud, heart`.
- `geometry/shapeOutline.ts`: per-shape outline (polygon/path) shared by painter (and later hit-test + connectors).
- UI (`packages/ui`): bottom-center `Toolbar` (select, hand, pencil, eraser, arrow, text, sticky, image, shapes) with active highlight; `ShapesPopover` palette. Wire tool/shape selection to the store.

**Out:** selection/transform (Phase 4), arrows (Phase 5), text labels (Phase 6), persistence. Pencil/eraser/sticky/image/text/arrow toolbar buttons may exist but only their tools' Phase scopes are wired later — for now they can be present-but-inert except the shape + hand tools. (Record which buttons are inert in IMPLEMENTATION_STATE.)

## Technical approach
- Tool state machine: each tool implements `onActivate/onDeactivate/onPointerDown/onPointerMove/onPointerUp/onKeyDown` returning dirty flags. `ToolManager.setActive(toolId, opts)`.
- `ShapeTool` previews the in-progress shape on the **overlay** layer (cheap) and commits the final element to the scene via `transact` on pointerup. Constrain-square with Shift (optional, nice-to-have).
- Outline functions return the shape's path points (or a canvas Path2D builder). Painters consume the same outline so shape geometry has ONE source.
- Toolbar/popover are shadcn components in `packages/ui`, subscribing only to coarse slices (`activeTool`, `activeShapeType`).
- Adding a shape type = add an outline + a painter + a popover entry; keep it data-driven (a shapes registry array).
- **Unit tests:** outline generators (vertex counts/bounds), `ShapeTool` create math (drag rect → element x/y/w/h), point-in-polygon for a couple of shapes (groundwork for Phase 4 hit-test).

## Key files
- `packages/engine/src/tools/{Tool.ts, ToolManager.ts, ShapeTool.ts, HandTool.ts}`
- `packages/engine/src/input/InputManager.ts`
- `packages/engine/src/render/painters/*` (all shape painters) + registry entries
- `packages/engine/src/geometry/shapeOutline.ts`
- `packages/ui/src/toolbar/{Toolbar.tsx, ToolButton.tsx, ShapesPopover.tsx}` + a `shapes` registry
- App wiring in `CanvasHost` / controller
- Tests: `geometry/shapeOutline.test.ts`, `tools/ShapeTool.test.ts`

## Manual test steps
1. The bottom toolbar renders with select/hand/pencil/eraser/arrow/text/sticky/image/shapes; the active tool is highlighted (matches `5.png`).
2. Open the shapes popover, pick a diamond, drag on the canvas → a diamond is created at the dragged bounds.
3. Create one of each shape type; all render correctly (cylinder, hexagon, star, cloud, heart, etc.).
4. Switch to the Hand tool → dragging pans instead of drawing.
5. Created shapes keep correct world coords and stay crisp across pan/zoom.
6. `npx turbo test` + `npx turbo build` green.

## Definition of done
- [ ] `Tool`/`ToolManager`/`InputManager` in place and documented as contracts.
- [ ] All shapes drawable via toolbar + popover; previews on overlay, commit on pointerup.
- [ ] Shared `shapeOutline` used by painters.
- [ ] Tests + build green.
- [ ] `docs/IMPLEMENTATION_STATE.md` updated: `Tool` interface, painter/tool/shape registry patterns, which toolbar buttons are still inert, deviations.

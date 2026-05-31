# Phase 6 — Text: shape labels, free text tool, arrow labels

> Read `.plans/00-OVERVIEW.md` and `docs/IMPLEMENTATION_STATE.md` first. Implement only this phase. Do NOT commit/push — stop and report with a screenshot/recording.

## Goal
Double-click a shape to add/edit a centered label; the Text tool for standalone text; inline editable arrow labels (`idea-examples/4.png`). In-canvas editing uses a DOM `<textarea>` overlay positioned in screen space.

## Scope
**In:**
- `TextTool`: click → create a standalone `text` element → immediately edit.
- Double-click to edit a label on shapes/stickies; double-click an arrow to add/edit its mid-arrow label.
- A DOM editing overlay (`TextEditorOverlay`): a positioned `<textarea>` matching the element's screen rect, font, size, and zoom; commits the string back to the model on blur/Escape/Enter-rules.
- Text painter: wrapping within width, alignment, `fontSize/fontFamily/textColor/textAlign`. Measured-layout cache per element (invalidate on text/style/width change) so we don't re-measure every frame.
- Arrow label rendering at the polyline midpoint with a small background plate (`4.png`); moves/rotates with the arrow; double-click editable.
- Label hit-testing so double-click finds the right target.
- **Unit tests:** text wrapping/measurement layout, label commit updates model, arrow-label midpoint placement, layout-cache invalidation.

**Out:** rich text / multiple fonts beyond a small set, persistence (Phase 9), styling panel (Phase 7 adds font controls).

## Technical approach
- **Editing via DOM overlay, not canvas text input** — gives IME, caret, selection, accessibility for free, and far less code. The overlay is driven by controller events (begin-edit → mount textarea at the element's screen rect with matching styles; commit → write to `label.text`/`text` via one `transact`, then repaint via the canvas painter).
- Exact alignment: compute the textarea's position/size/font from the element world rect × camera so there's no visual jump between editing and committed render. Test at 100% and zoomed.
- Layout cache keyed by element id + a content/style hash; the painter reads cached lines.
- Editing is one undo step (open edit = `stopCapturing`, commit = `stopCapturing`).

## Key files
- `packages/engine/src/tools/TextTool.ts`
- `packages/engine/src/text/{measure.ts, layout.ts}` + an overlay contract type
- `apps/web/src/components/TextEditorOverlay.tsx`
- `packages/engine/src/render/painters/text.ts` (+ label rendering used by shape/arrow painters)
- SelectTool: double-click → begin-edit dispatch
- Tests: `text/layout.test.ts`, `text/measure.test.ts`

## Manual test steps
1. Double-click a shape → caret/box appears; type, click away → label renders centered, wrapped within the shape, crisp at any zoom.
2. Text tool → click → type → standalone text element, selectable/movable.
3. Double-click an arrow → type → label renders mid-arrow with a background plate (`4.png`); it moves/rotates with the arrow.
4. Re-edit an existing label (double-click) → text pre-fills; editing is one undo step.
5. The editing overlay aligns exactly with the canvas text (no jump on commit) at 100% and zoomed.
6. `npx turbo test` + `npx turbo build` green.

## Definition of done
- [ ] Shape labels, free text, and arrow labels all editable via the DOM overlay.
- [ ] Canvas text painter with wrapping/alignment + layout cache.
- [ ] No visual jump between edit and committed render at any zoom.
- [ ] One undo step per edit; tests + build green.
- [ ] `docs/IMPLEMENTATION_STATE.md` updated: text model (label vs text element), overlay contract, layout-cache strategy, deviations.

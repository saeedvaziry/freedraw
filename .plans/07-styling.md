# Phase 7 — Styling controls (color, stroke, fill, arrowheads, …)

> Read `.plans/00-OVERVIEW.md` and `docs/IMPLEMENTATION_STATE.md` first. Implement only this phase. Do NOT commit/push — stop and report with a screenshot/recording.

## Goal
A contextual style panel (shadcn) to change stroke color, stroke width, stroke style (solid/dashed/dotted), fill, opacity, roundness, font size/family/color, and arrow-specific props (arrowheads, routing). New elements inherit the last-used style.

## Scope
**In:**
- Style panel UI (`packages/ui`): color pickers (stroke, fill, text), stroke-width slider, stroke-style toggle, opacity slider, roundness control, font controls, and arrow controls (start/end arrowhead, thickness, routing) shown contextually based on selection type.
- Bind the panel to the selection: subscribe ONLY to the selected-style slice (coarse → rare React renders). Multi-select applies to all selected in one undo step.
- `updateStyle(ids, patch)` command via `transact`. Slider drags coalesce into one undo entry (stopCapturing at drag start/end).
- `appState.lastUsedStyle`: updated when the user changes style; applied to newly created elements (shapes, arrows, text, sticky).
- Painters honor all style props (`setLineDash` for dashed/dotted, opacity, roundness, arrowheads already exist from Phase 5) — no structural painter changes beyond reading props.
- **Unit tests:** `updateStyle` patches the right elements, multi-select edit = one undo step, lastUsedStyle applied on create, dashed/dotted line-dash mapping.

**Out:** gradients/patterns, custom font uploads, persistence (Phase 9).

## Technical approach
- The panel reads a derived `selectionStyle` slice (shared values across the selection, or "mixed" indicators). Editing dispatches `updateStyle`.
- Slider/drag interactions: begin = `stopCapturing`, stream updates within one transact origin, end = `stopCapturing` → one history entry.
- `lastUsedStyle` is read by element factories at create time (Phases 3/5/6/8 factories should already pull from a default style; centralize that here so all creation paths use `appState.lastUsedStyle`).
- Keep the panel placement non-intrusive (floating, contextual to selection), consistent with the dark toolbar aesthetic in `idea-examples/5.png`.

## Key files
- `packages/ui/src/style-panel/{StylePanel.tsx, ColorPicker.tsx, StrokeControls.tsx, ArrowControls.tsx, FontControls.tsx}`
- `packages/engine/src/commands/updateStyle.ts` (or a store method)
- `packages/engine/src/store/SceneStore.ts` (lastUsedStyle read/write + selectionStyle slice)
- Element factories updated to read `lastUsedStyle`
- Tests: `commands/updateStyle.test.ts`

## Manual test steps
1. Select a shape → panel shows its stroke/fill/width; change stroke color → updates live.
2. Set stroke width + dashed → renders dashed at the chosen width; set fill → shape fills; change opacity → applies.
3. Multi-select several shapes → one style change applies to all in ONE undo step.
4. Select an arrow → change arrowheads (e.g. start=dot, end=triangle) + thickness + color.
5. Draw a NEW shape/arrow after styling → it inherits the last-used style.
6. `npx turbo test` + `npx turbo build` green.

## Definition of done
- [ ] Contextual style panel for shapes/text/arrows; multi-select edits in one undo step.
- [ ] All style props honored by painters; dashed/dotted/opacity/roundness work.
- [ ] `lastUsedStyle` applied on all creation paths.
- [ ] Tests + build green.
- [ ] `docs/IMPLEMENTATION_STATE.md` updated: style panel contract, selectionStyle slice, lastUsedStyle flow, deviations.

# Phase 8 — Sticky notes & image insertion

> Read `.plans/00-OVERVIEW.md` and `docs/IMPLEMENTATION_STATE.md` first. Implement only this phase. Do NOT commit/push — stop and report with a screenshot/recording.

## Scope decision (2026-05-31)
**Pencil (freehand) and eraser are DROPPED.** They are not in the toolbar and FreeDraw is a flowchart-style diagramming tool where freehand is not core. The `freedraw` element type stays in the model/hit-test as harmless latent capability; no tool exposes it.

This phase now activates the **two toolbar buttons that already exist but are inert** (`sticky`, `image` — wired to `NoopTool` via `ToolManager.INERT_TOOLS`).

## Goal
Make the existing sticky and image toolbar buttons functional:
- **Sticky**: click → a yellow sticky element with an immediately-editable label (reuse the Phase 6 text overlay / `beginEdit`).
- **Image**: file picker, clipboard paste, and drag-drop. Blob stored in a separate IndexedDB `assets` store (`packages/persistence` `assetRepo`); the element holds `assetId`. Decode to `ImageBitmap` once, cache by `assetId` for fast repaint. Validate MIME type and cap byte size.

## What already works (do NOT rebuild)
- `hitTest` already narrow-phases `sticky`/`image` as AABB (`geometry/hitTest.ts:119`) → selection, move, marquee, resize, rotate already function once the elements exist.
- `StylePanelHost` already treats `image`/`sticky` as roundable and shows the style panel for them.
- `ToolId` union already includes `'sticky'` and `'image'`; toolbar already renders both buttons.
- Undo/transact/order/selection all type-agnostic — new elements participate for free.

## What's missing (build this)
### Sticky
- `model/factory.ts`: `createSticky(init)` — a `StickyElement` (`type: 'sticky'`) with a default **yellow** fill (e.g. fill `#fef08a`, stroke `#eab308`), a sensible default size (~160×120), `roundness` for soft corners, and a default centered/middle label. Export it from `engine` index.
- `render/painters/sticky.ts`: paint a filled rounded rect (reuse `getOutline('roundRect', element)` + `traceOutline`, honoring `style.opacity/fill/stroke/strokeWidth/roundness`) then `paintLabel(ctx, element)`. Register `sticky` in `painters/index.ts`. The Renderer's `withoutText` already strips `label` while editing — no extra work.
- `tools/StickyTool.ts`: on left pointerdown, create a sticky centered on `info.world` with `getLastUsedStyle()` merged over the yellow defaults (do NOT let last-used stroke/fill erase the yellow unless the user picked one — keep sticky's own fill default; mirror how `createText` forces `textAlign:'center'`), `addElement` in one `transact` (with `stopCapturing` bracketing), select it, switch UI to `select`, and `beginEdit({ target: 'label', ... })` exactly like `TextTool` does for text. Register it in `ToolManager` (remove `'sticky'` from `INERT_TOOLS`, add a `StickyTool` instance + `resolve` case).

### Image
- `packages/persistence/src/db.ts` + `assetRepo.ts`: minimal IndexedDB wrapper, one `assets` object store keyed by `assetId` → `Blob`. API: `putAsset(id, blob): Promise<void>`, `getAsset(id): Promise<Blob | undefined>`, `deleteAsset(id)`. Export from `packages/persistence/src/index.ts` (currently empty `export {}`). No external deps — hand-rolled `indexedDB` is fine and avoids postinstall under `--ignore-scripts`. Guard for absent `indexedDB` (tests/SSR) by injecting the factory or feature-detecting.
- `model/factory.ts`: `createImage({ assetId, x, y, width, height, ... })` → `ImageElement`. Fit huge naturals into the viewport (cap longest side, preserve aspect). Export from `engine` index.
- `assets/imageCache.ts` (engine): module-level `Map<assetId, ImageBitmap>` + an in-flight `Map<assetId, Promise>`. `getBitmap(assetId)` returns the cached bitmap or `undefined` and kicks off decode (via an injected loader that resolves a `Blob`) → `createImageBitmap` → cache → request a repaint. Keep the engine DOM-chrome-free: the loader (blob fetch) and the "repaint" callback are injected by the controller/app, not imported here.
- `render/painters/image.ts`: draw the cached `ImageBitmap` into the element rect (`drawImage` with the element's x/y/width/height, honoring opacity). If not yet cached, paint a neutral placeholder rect and trigger decode so the next frame draws it. Register `image` in `painters/index.ts`.
- Wiring in the app (`CanvasHost` / a small `useImageInsert` hook):
  - Toolbar `image` button: open a hidden `<input type=file accept="image/*">`; on pick → validate → insert.
  - `paste` (document/window): read image items from `ClipboardData` → validate → insert at viewport center.
  - drag-drop on the canvas container: `dragover` preventDefault + `drop` reads `dataTransfer.files`, inserts at the drop world point.
  - Insert flow: validate MIME ∈ image/*, byte size ≤ a cap (e.g. 10 MB) — reject with a non-blocking log/toast otherwise; `createImageBitmap(blob)` for natural size; `putAsset(id, blob)`; `createImage(...)` fit-to-viewport; `transact(addElement)`; select; switch to `select` tool. Seed the imageCache with the just-decoded bitmap so it renders immediately.
  - Provide the imageCache its blob-loader (`assetRepo.getAsset`) and repaint callback (controller `markDirty`/equivalent) at controller construction so images reload after a refresh (Phase 9 hydrates the doc; assets already persist here).
- Remove `'image'` from `ToolManager.INERT_TOOLS`. Image has no canvas drag-create gesture, so its toolbar button triggers the file picker rather than activating a canvas tool — keep the tool resolution as a `NoopTool`/select-fallback and drive insertion from the React layer, OR make `setActive('image')` immediately open the picker then fall back to select. Pick the cleaner option and record it in IMPLEMENTATION_STATE.

## Security
- Reject non-image MIME and oversized blobs before any decode/store. Never eval/inject pasted content. Only `createImageBitmap` on validated image blobs.

## Unit tests (Vitest, engine; jsdom/fake-indexeddb where needed)
- `model/factory.test.ts`: `createSticky` yellow default + editable-label defaults; `createImage` fit-to-viewport math (huge natural → capped, aspect preserved; small natural → unchanged).
- `assets/imageCache.test.ts`: returns undefined then caches after decode; dedupes concurrent decode of the same id; repaint callback fired once.
- `packages/persistence` `assetRepo.test.ts`: put→get round-trips a Blob; get missing → undefined; delete removes. (Use `fake-indexeddb` or an injected in-memory factory — do NOT require a real browser.)
- Image insert validation: rejects non-image MIME and over-cap size (pure validator function, unit-tested).

## Key files
- `packages/engine/src/model/factory.ts` (+ `createSticky`, `createImage`)
- `packages/engine/src/tools/StickyTool.ts`, `tools/ToolManager.ts`
- `packages/engine/src/render/painters/{sticky.ts, image.ts}`, `painters/index.ts`
- `packages/engine/src/assets/imageCache.ts`
- `packages/persistence/src/{db.ts, assetRepo.ts, index.ts}`
- App: `apps/web/src/components/CanvasHost.tsx` (+ a `useImageInsert` hook), toolbar wiring for the image button
- Tests as listed above

## Manual test steps
1. Sticky → click → yellow sticky appears with an immediately-editable label; type, click away → label centered.
2. Image: pick a file, AND paste an image, AND drag-drop a file → each appears, crisp, movable/resizable.
3. Sticky and image both participate in selection/transform/undo/styling like other elements.
4. Oversized / non-image input is rejected gracefully (logged, no crash).
5. `npx turbo test` + `npx turbo build` green.

## Definition of done
- [ ] Sticky tool functional (yellow, editable label); `'sticky'` removed from INERT_TOOLS.
- [ ] Image picker + paste + drag-drop functional; `assets` store + `assetRepo` + `imageCache`; MIME/size validation; `'image'` no longer inert.
- [ ] Sticky & image integrate with selection/transform/undo/styling.
- [ ] Pencil/eraser intentionally NOT built (documented).
- [ ] Tests + build green.
- [ ] `docs/IMPLEMENTATION_STATE.md` updated: assetRepo API, imageCache strategy, image fit-to-viewport rule, security limits, image-button UX choice, and the pencil/eraser drop with reason.

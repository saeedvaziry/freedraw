export { Renderer } from './render/renderer.js'
export type { GridStyle, OverlayState, SpawnPreview } from './render/renderer.js'
export { invertColor } from './render/invert.js'
export { createRenderLoop } from './render/loop.js'
export type { RenderLoopHandle } from './render/loop.js'

export { Camera, clampZoom, MIN_ZOOM, MAX_ZOOM } from './geometry/camera.js'
export type { CameraState as CameraStateGeom } from './geometry/camera.js'

export { SceneStore, TRANSACTION_ORIGIN, CAMERA_ORIGIN } from './store/scene-store.js'
export type { TransactionApi, UiState, ToolId, PasteElementsOptions } from './store/scene-store.js'
export {
  SCENE_CLIPBOARD_VERSION,
  clipboardCenter,
  createSceneClipboard,
  cloneSceneClipboard,
  stringifySceneClipboard,
  parseSceneClipboard,
  isSceneClipboardPayload,
} from './store/clipboard.js'
export type { SceneClipboardPayload, SceneClipboardClone } from './store/clipboard.js'
export { deriveSelectionStyle, MIXED } from './store/selection-style.js'
export type { SelectionStyle, StyleValue } from './store/selection-style.js'

export { parseDiagram, serializeDiagram } from './diagram/index.js'
export { importDiagram } from './diagram/import.js'
export type { ParseOptions, DiagramParseResult } from './diagram/index.js'
export type { SerializeReport } from './diagram/serialize.js'
export type { DiagramError, Direction } from './diagram/ast.js'

export { EditorController } from './controller/editor-controller.js'
export type { ExportImageOptions } from './controller/editor-controller.js'
export {
  renderSceneToCanvas,
  canvasToBlob,
  exportImageAssetIds,
  EXPORT_DEFAULT_PADDING,
  EXPORT_DEFAULT_SCALE,
  EXPORT_JPG_QUALITY,
} from './render/export-scene.js'
export type { ExportFormat, ExportOptions } from './render/export-scene.js'

export { ToolManager } from './tools/tool-manager.js'
export { ShapeTool } from './tools/shape-tool.js'
export { HandTool } from './tools/hand-tool.js'
export { SelectTool } from './tools/select-tool.js'
export { ArrowTool } from './tools/arrow-tool.js'
export { TextTool } from './tools/text-tool.js'
export { FreedrawTool } from './tools/freedraw-tool.js'

export {
  layoutText,
  wrapText,
  lineHeightFor,
  LayoutCache,
  layoutKey,
  fontString,
  HANDWRITTEN_FONT_FAMILY,
  canvasMeasureContext,
  approximateMeasureContext,
  offscreenMeasureContext,
} from './text/index.js'
export type {
  TextLayout,
  TextLayoutInput,
  TextAlign,
  VerticalAlign,
  MeasureContext,
} from './text/index.js'
export { polylineMidpoint } from './text/arrow-label.js'
export type { EditRequest, EditTarget, EditListener } from './text/edit.js'

export { snapEndpoint, snapToShapes, shapeAnchors, SNAP_DISTANCE } from './geometry/snap.js'
export type { SnapGuide, SnapResult } from './geometry/snap.js'
export type { Tool, ToolContext, ToolResult, PointerInfo } from './tools/tool.js'
export { InputManager } from './input/input-manager.js'
export { pinchSample, pinchDelta } from './input/pinch.js'
export type { PinchSample, PinchDelta } from './input/pinch.js'

export { selectionFrameFor } from './geometry/selection-frame.js'
export {
  GRID_SIZE,
  GRID_SNAP_SIZE,
  GRID_MAJOR_EVERY,
  GRID_MIN_SCREEN_SPACING,
  defaultGridConfig,
  gridLineValues,
  gridStepForZoom,
  isMajorGridValue,
  snapPointToGrid,
  snapValueToGrid,
} from './geometry/grid.js'
export type { GridConfig } from './geometry/grid.js'
export { resizedBounds, resizeElements, rotationFor } from './geometry/transform.js'
export {
  resizeHandlesScreen,
  rotateHandleScreen,
  handleAtScreen,
  RESIZE_HANDLE_IDS,
} from './geometry/handles.js'
export type { SelectionFrame, HandleId, ResizeHandleId, Handle } from './geometry/handles.js'

export { getOutline, traceOutline, pointInPolygon } from './geometry/shape-outline.js'
export type { Outline } from './geometry/shape-outline.js'

export {
  hitTest,
  hitTestElement,
  selectionBounds,
  marqueeHits,
  elementBounds,
  elementCenter,
} from './geometry/hit-test.js'

export {
  createShape,
  createArrow,
  createText,
  createSticky,
  createImage,
  createFreedraw,
  createId,
  pointsBounds,
  fitToViewport,
  TEXT_DEFAULT_WIDTH,
  TEXT_DEFAULT_HEIGHT,
  STICKY_DEFAULT_WIDTH,
  STICKY_DEFAULT_HEIGHT,
  STICKY_COLORS,
  DEFAULT_STICKY_COLOR,
} from './model/factory.js'
export type {
  ShapeInit,
  ArrowInit,
  TextInit,
  StickyInit,
  StickyColor,
  ImageInit,
  FreedrawInit,
} from './model/factory.js'

export { ImageCache } from './assets/image-cache.js'
export type {
  BlobLoader,
  BitmapDecoder,
  RepaintCallback,
  ImageCacheConfig,
} from './assets/image-cache.js'
export { validateImageInput, MAX_IMAGE_BYTES } from './assets/image-input.js'
export type { ImageInputValidation, ImageInputRejection } from './assets/image-input.js'

export { StickyTool } from './tools/sticky-tool.js'

export {
  intersectRay,
  anchorPoint,
  anchorFromPoint,
  createBinding,
  DEFAULT_GAP,
  resolveArrowPoints,
  arrowNeedsResolve,
  arrowRoute,
  spawnConnectedShape,
} from './connectors/index.js'
export type { SpawnDirection, SpawnMenuRequest } from './connectors/index.js'
export { SCHEMA_VERSION, defaultStyle, defaultAppState } from './model/schema.js'
export { migrateDoc, seedAppState, readSchemaVersion, migrations } from './model/migrations.js'
export type { Migration } from './model/migrations.js'
export { isValidScene, serializeScene, applyScene } from './model/serialize.js'
export type { SerializedScene } from './model/serialize.js'
export { contentBounds, fitCamera, FIT_PADDING } from './geometry/fit.js'
export type {
  Element,
  ElementId,
  ShapeElement,
  ShapeType,
  ArrowElement,
  TextElement,
  StickyElement,
  FreedrawElement,
  ImageElement,
  Style,
  StrokeStyle,
  Arrowhead,
  Binding,
  Label,
  AppState,
  CameraState,
  SceneSnapshot,
  Point,
} from './model/types.js'

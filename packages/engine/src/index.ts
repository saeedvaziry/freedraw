export { Renderer } from './render/Renderer.js'
export type { GridStyle, OverlayState, SpawnPreview } from './render/Renderer.js'
export { invertColor } from './render/invert.js'
export { createRenderLoop } from './render/loop.js'
export type { RenderLoopHandle } from './render/loop.js'

export { Camera, clampZoom, MIN_ZOOM, MAX_ZOOM } from './geometry/Camera.js'
export type { CameraState as CameraStateGeom } from './geometry/Camera.js'

export { SceneStore, TRANSACTION_ORIGIN, CAMERA_ORIGIN } from './store/SceneStore.js'
export type { TransactionApi, UiState, ToolId, PasteElementsOptions } from './store/SceneStore.js'
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
export { deriveSelectionStyle, MIXED } from './store/selectionStyle.js'
export type { SelectionStyle, StyleValue } from './store/selectionStyle.js'

export { EditorController } from './controller/EditorController.js'
export type { ExportImageOptions } from './controller/EditorController.js'
export {
  renderSceneToCanvas,
  canvasToBlob,
  exportImageAssetIds,
  EXPORT_DEFAULT_PADDING,
  EXPORT_DEFAULT_SCALE,
  EXPORT_JPG_QUALITY,
} from './render/exportScene.js'
export type { ExportFormat, ExportOptions } from './render/exportScene.js'

export { ToolManager } from './tools/ToolManager.js'
export { ShapeTool } from './tools/ShapeTool.js'
export { HandTool } from './tools/HandTool.js'
export { SelectTool } from './tools/SelectTool.js'
export { ArrowTool } from './tools/ArrowTool.js'
export { TextTool } from './tools/TextTool.js'
export { FreedrawTool } from './tools/FreedrawTool.js'

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
export { polylineMidpoint } from './text/arrowLabel.js'
export type { EditRequest, EditTarget, EditListener } from './text/edit.js'

export { snapEndpoint, snapToShapes, shapeAnchors, SNAP_DISTANCE } from './geometry/snap.js'
export type { SnapGuide, SnapResult } from './geometry/snap.js'
export { alignMovingBounds, ALIGNMENT_SNAP_DISTANCE } from './geometry/alignment.js'
export type { AlignmentResult } from './geometry/alignment.js'
export type { Tool, ToolContext, ToolResult, PointerInfo } from './tools/Tool.js'
export { InputManager } from './input/InputManager.js'
export { pinchSample, pinchDelta } from './input/pinch.js'
export type { PinchSample, PinchDelta } from './input/pinch.js'

export { selectionFrameFor } from './geometry/selectionFrame.js'
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

export { getOutline, traceOutline, pointInPolygon } from './geometry/shapeOutline.js'
export type { Outline } from './geometry/shapeOutline.js'

export {
  hitTest,
  hitTestElement,
  selectionBounds,
  marqueeHits,
  elementBounds,
  elementCenter,
} from './geometry/hitTest.js'

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

export { ImageCache } from './assets/imageCache.js'
export type {
  BlobLoader,
  BitmapDecoder,
  RepaintCallback,
  ImageCacheConfig,
} from './assets/imageCache.js'
export { validateImageInput, MAX_IMAGE_BYTES } from './assets/imageInput.js'
export type { ImageInputValidation, ImageInputRejection } from './assets/imageInput.js'

export { StickyTool } from './tools/StickyTool.js'

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

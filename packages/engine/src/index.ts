export { Renderer } from './render/renderer.js'
export type { GridStyle, OverlayState, SpawnPreview } from './render/renderer.js'
export {
  DEFAULT_CANVAS_COLORS,
  resolveCanvasColors,
  overlayColorsFrom,
} from './render/color-config.js'
export type { CanvasColors, CanvasColorOverrides, OverlayColors } from './render/color-config.js'
export { invertColor } from './render/invert.js'
export { createRenderLoop } from './render/loop.js'
export type { RenderLoopHandle } from './render/loop.js'

export { Camera, clampZoom, MIN_ZOOM, MAX_ZOOM } from './geometry/camera.js'
export type { CameraState as CameraStateGeom } from './geometry/camera.js'

export { SceneStore, TRANSACTION_ORIGIN } from './store/scene-store.js'
export type {
  TransactionApi,
  UiState,
  LocalAppState,
  ToolId,
  PasteElementsOptions,
} from './store/scene-store.js'
export { shallowEqual } from './store/scene-store.js'
export type { StoreChannel, StoreSelector, SelectOptions } from './store/scene-store.js'
export {
  SCENE_CLIPBOARD_VERSION,
  clipboardCenter,
  createSceneClipboard,
  cloneSceneClipboard,
  stringifySceneClipboard,
  parseSceneClipboard,
  isSceneClipboardPayload,
  isSceneElement,
} from './store/clipboard.js'
export type { SceneClipboardPayload, SceneClipboardClone } from './store/clipboard.js'
export {
  SCENE_FILE_TYPE,
  SCENE_FILE_VERSION,
  SCENE_FILE_EXTENSION,
  SCENE_FILE_MIME,
  createSceneFile,
  stringifySceneFile,
  parseSceneFile,
  isSceneFile,
} from './store/scene-file.js'
export type { SceneFile } from './store/scene-file.js'
export { buildStencil, STENCIL_VERSION } from './store/stencil.js'
export type { Stencil, Template, StencilKind, BuildStencilOptions } from './store/stencil.js'
export {
  buildStencilFromSelection,
  renderStencilThumbnail,
  STENCIL_THUMBNAIL_SCALE,
  STENCIL_THUMBNAIL_PADDING,
} from './store/stencil-thumbnail.js'
export type { StencilThumbnailOptions } from './store/stencil-thumbnail.js'
export { builtinStencils, builtinTemplates } from './library/index.js'
export type { BuiltinStencil, BuiltinTemplate, LibraryCategory } from './library/index.js'
export { deriveSelectionStyle, MIXED } from './store/selection-style.js'
export type { SelectionStyle, StyleValue } from './store/selection-style.js'

export { parseDiagram, serializeDiagram } from './diagram/index.js'
export { importDiagram } from './diagram/import.js'
export type { ParseOptions, DiagramParseResult } from './diagram/index.js'
export type { SerializeReport } from './diagram/serialize.js'
export type { DiagramError, Direction } from './diagram/ast.js'

export { EditorController } from './controller/editor-controller.js'
export type {
  ExportImageOptions,
  ExportImageResult,
  ExportSvgOptions,
  ExportSvgResult,
  FlowContext,
} from './controller/editor-controller.js'
export type {
  CursorListener,
  CursorStyleListener,
  CameraListener,
  InteractionListener,
  TransientKind,
  TransientListener,
} from './controller/editor-controller.js'
export { paintPresence } from './render/overlay/presence.js'
export type {
  PresenceOverlay,
  PresenceCursor,
  PresenceHalo,
  PresenceGhost,
} from './render/overlay/presence.js'
export {
  renderSceneExport,
  renderSceneSvg,
  canvasToBlob,
  exportImageAssetIds,
  exportTooLarge,
  maxExportScale,
  EXPORT_DEFAULT_PADDING,
  EXPORT_DEFAULT_SCALE,
  EXPORT_JPG_QUALITY,
  EXPORT_MAX_CANVAS_DIMENSION,
  EXPORT_MAX_CANVAS_AREA,
} from './render/export-scene.js'
export type {
  ExportFormat,
  ExportOptions,
  ExportSize,
  ExportFailure,
  ExportRenderResult,
  ExportSvgRenderOptions,
  SvgRenderResult,
} from './render/export-scene.js'
export { CanvasDrawTarget, SvgDrawTarget, setSvgFontFaces } from './render/draw-target.js'
export type {
  DrawTarget,
  DrawTransform,
  SvgDrawTargetConfig,
  SvgFontFace,
  ImageHrefResolver,
} from './render/draw-target.js'

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
export type {
  Tool,
  ToolContext,
  ToolResult,
  PointerInfo,
  ContextMenuRequest,
  SelectionInteraction,
} from './tools/tool.js'
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
  resizeCursor,
  ROTATE_CURSOR,
} from './geometry/handles.js'
export type {
  SelectionFrame,
  HandleId,
  ResizeHandleId,
  Handle,
  ResizeCursor,
} from './geometry/handles.js'

export { getOutline, traceOutline, pointInPolygon } from './geometry/shape-outline.js'
export type { Outline } from './geometry/shape-outline.js'

export {
  hitTest,
  hitTestElement,
  selectionBounds,
  marqueeHits,
  elementBounds,
  elementCenter,
  expandGroupSelection,
  groupMembers,
} from './geometry/hit-test.js'
export { alignDeltas, distributeDeltas } from './geometry/arrange.js'
export type { AlignEdge, DistributeAxis, ArrangeTarget, ArrangeDelta } from './geometry/arrange.js'

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
  routeArrow,
  resolveArrowPoints,
  arrowRoute,
  spawnConnectedShape,
} from './connectors/index.js'
export type { SpawnDirection } from './connectors/index.js'
export { SCHEMA_VERSION, defaultStyle, defaultAppState } from './model/schema.js'
export { migrateDoc, seedAppState, readSchemaVersion, migrations } from './model/migrations.js'
export type { Migration } from './model/migrations.js'
export { isValidScene, serializeScene, applyScene } from './model/serialize.js'
export type { SerializedScene } from './model/serialize.js'
export { isArrowElement } from './model/guards.js'
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
  Slide,
  CameraState,
  SceneSnapshot,
  Point,
} from './model/types.js'

export { FONT_WEIGHT_NORMAL, FONT_WEIGHT_BOLD } from './model/schema.js'
export type { FontStyle } from './model/types.js'

export {
  SceneIndex,
  SpatialIndex,
  elementIndexBounds,
  sceneAlignSource,
  SPATIAL_CELL_SIZE,
  SPATIAL_MARGIN,
} from './geometry/spatial-index.js'
export type { SceneScope, SceneAlignSourceInput } from './geometry/spatial-index.js'
export { isBoldWeight, NORMAL_FONT_WEIGHT, BOLD_THRESHOLD } from './text/index.js'
export type { FontEmphasis } from './text/index.js'
export { sceneToAst, inferDiagramDirection } from './diagram/scene-graph.js'
export type { SceneGraph, SceneGraphOptions } from './diagram/scene-graph.js'
export { canTidy, planTidy, tidyDiagram } from './diagram/tidy.js'
export type { TidyMove, TidyOptions, TidyPlan } from './diagram/tidy.js'
export type { PresenceLaser } from './render/overlay/presence.js'
export {
  PRESENCE_LASER_CORE_ALPHA,
  PRESENCE_LASER_CORE_WIDTH,
  PRESENCE_LASER_GLOW_ALPHA,
  PRESENCE_LASER_GLOW_WIDTH,
  PRESENCE_LASER_HEAD_RADIUS,
  PRESENCE_LASER_TAIL_SCALE,
} from './render/overlay/presence.js'

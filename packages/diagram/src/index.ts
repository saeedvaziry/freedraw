export { parseDiagram, serializeDiagram } from '@freedraw/engine/diagram'
export type {
  ParseOptions,
  DiagramParseResult,
  SerializeReport,
  Direction,
  DiagramError,
  LayoutOptions,
} from '@freedraw/engine/diagram'

export { defaultStyle, defaultAppState } from '@freedraw/engine/model/schema'
export type {
  Element,
  ElementId,
  ArrowElement,
  ShapeElement,
  Style,
  SceneSnapshot,
  Point,
} from '@freedraw/engine/model/types'

export { buildScene, buildSceneFromElements } from './scene.js'
export type { BuildSceneOptions, DiagramScene } from './scene.js'

export { defaultDiagramStyle, defaultDiagramLayout } from './style.js'

export { resolveDiagramArrows } from './resolve.js'

export { renderToCanvas, renderToDataURL, renderToBlob, mount } from './render.js'
export type { RenderOptions, RenderFromCodeOptions } from './render.js'

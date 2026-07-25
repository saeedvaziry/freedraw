import type { Camera } from '../geometry/camera.js'
import type { Rect } from '../geometry/rect.js'
import type { SnapGuide } from '../geometry/snap.js'
import type { SceneStore } from '../store/scene-store.js'
import type { Element, ElementId, Point, ShapeType } from '../model/types.js'
import type { SpawnDirection } from '../connectors/spawn.js'
import type { SpawnPreview } from '../render/renderer.js'
import type { EditRequest } from '../text/edit.js'

export interface PointerInfo {
  world: Point
  screen: Point
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  button: number
}

export interface ContextMenuRequest {
  screen: Point
  sourceId: ElementId | null
}

export type SelectionInteraction = 'marquee' | 'transform'

export interface ToolContext {
  store: SceneStore
  camera: Camera
  setPreview(element: Element | null): void
  setSpawnPreview(preview: SpawnPreview | null): void
  setTransient?(elements: Element[] | null): void
  setMarquee(rect: Rect | null): void
  setTransforming?(active: boolean): void
  setGuides(guides: SnapGuide[]): void
  setPortTarget(id: ElementId | null): void
  emitCameraInput?(): void
  beginEdit(request: EditRequest): void
  requestContextMenu?(request: ContextMenuRequest): void
  spawnChildAndEdit(sourceId: ElementId, direction: SpawnDirection, type?: ShapeType): void
}

export interface ToolResult {
  scene?: boolean
  overlay?: boolean
}

export interface Tool {
  readonly id: string
  onActivate?(ctx: ToolContext): void
  onDeactivate?(ctx: ToolContext): void
  onPointerDown?(info: PointerInfo, ctx: ToolContext): ToolResult | void
  onPointerMove?(info: PointerInfo, ctx: ToolContext): ToolResult | void
  onPointerUp?(info: PointerInfo, ctx: ToolContext): ToolResult | void
  onDoubleClick?(info: PointerInfo, ctx: ToolContext): ToolResult | void
  onContextMenu?(info: PointerInfo, ctx: ToolContext): boolean | ToolResult | void
  onKeyDown?(event: KeyboardEvent, ctx: ToolContext): ToolResult | void
}

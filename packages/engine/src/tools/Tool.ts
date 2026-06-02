import type { Camera } from '../geometry/Camera.js'
import type { Rect } from '../geometry/rect.js'
import type { SnapGuide } from '../geometry/snap.js'
import type { SceneStore } from '../store/SceneStore.js'
import type { Element, ElementId, Point } from '../model/types.js'
import type { SpawnMenuRequest } from '../connectors/spawn.js'
import type { SpawnPreview } from '../render/Renderer.js'
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

export interface ToolContext {
  store: SceneStore
  camera: Camera
  setPreview(element: Element | null): void
  setSpawnPreview(preview: SpawnPreview | null): void
  setMarquee(rect: Rect | null): void
  setGuides(guides: SnapGuide[]): void
  setPortTarget(id: ElementId | null): void
  beginEdit(request: EditRequest): void
  requestSpawnMenu(request: SpawnMenuRequest): void
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
  onContextMenu?(info: PointerInfo, ctx: ToolContext): boolean | void
  onKeyDown?(event: KeyboardEvent, ctx: ToolContext): ToolResult | void
}

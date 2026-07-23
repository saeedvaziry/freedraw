import { SCHEMA_VERSION } from '../model/schema.js'
import { serializeScene, type SerializedScene } from '../model/serialize.js'
import { createSceneClipboard, isSceneElement } from './clipboard.js'
import type { Element, ElementId, SceneSnapshot } from '../model/types.js'

export const SCENE_FILE_TYPE = 'freedraw'
export const SCENE_FILE_VERSION = SCHEMA_VERSION
export const SCENE_FILE_EXTENSION = 'freedraw.json'
export const SCENE_FILE_MIME = 'application/json'

export interface SceneFile extends SerializedScene {
  type: typeof SCENE_FILE_TYPE
  version: number
}

export function createSceneFile(
  snapshot: SceneSnapshot,
  ids?: Iterable<ElementId> | null,
): SceneFile | null {
  const scene = ids ? subsetScene(snapshot, ids) : serializeScene(snapshot)
  if (!scene || scene.order.length === 0) return null
  return {
    type: SCENE_FILE_TYPE,
    version: snapshot.appState.schemaVersion,
    ...scene,
  }
}

export function stringifySceneFile(file: SceneFile): string {
  return JSON.stringify(file, null, 2)
}

export function parseSceneFile(value: string): SceneFile | null {
  if (value.trim().length === 0) return null
  try {
    const parsed = JSON.parse(value) as unknown
    return isSceneFile(parsed) ? normalizeSceneFile(parsed) : null
  } catch {
    return null
  }
}

export function isSceneFile(value: unknown): value is SceneFile {
  if (!isObject(value)) return false
  if (value.type !== SCENE_FILE_TYPE) return false
  if (typeof value.version !== 'number' || !Number.isFinite(value.version)) return false
  if (!isObject(value.appState)) return false
  if (!Array.isArray(value.order)) return false
  if (!value.order.every((id) => typeof id === 'string')) return false
  if (!isObject(value.elements)) return false
  for (const [id, element] of Object.entries(value.elements)) {
    if (!isSceneElement(element) || element.id !== id) return false
  }
  return true
}

function subsetScene(snapshot: SceneSnapshot, ids: Iterable<ElementId>): SerializedScene | null {
  const payload = createSceneClipboard(snapshot, ids)
  if (!payload) return null
  const elements: Record<ElementId, Element> = {}
  for (const element of payload.elements) elements[element.id] = element
  return {
    elements,
    order: payload.elements.map((element) => element.id),
    appState: snapshot.appState,
  }
}

function normalizeSceneFile(file: SceneFile): SceneFile {
  const seen = new Set<ElementId>()
  const order: ElementId[] = []
  for (const id of file.order) {
    if (seen.has(id) || !Object.hasOwn(file.elements, id)) continue
    seen.add(id)
    order.push(id)
  }
  for (const id of Object.keys(file.elements)) {
    if (!seen.has(id)) order.push(id)
  }
  return { ...file, order }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

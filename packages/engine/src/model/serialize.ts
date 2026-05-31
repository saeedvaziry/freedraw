import * as Y from 'yjs'
import type { Element, ElementId, SceneSnapshot } from './types.js'

export interface SerializedScene {
  elements: Record<ElementId, Element>
  order: ElementId[]
  appState: SceneSnapshot['appState']
}

function isElement(value: unknown): value is Element {
  if (typeof value !== 'object' || value === null) return false
  const element = value as Record<string, unknown>
  return (
    typeof element.id === 'string' &&
    typeof element.type === 'string' &&
    typeof element.x === 'number' &&
    typeof element.y === 'number' &&
    typeof element.width === 'number' &&
    typeof element.height === 'number' &&
    typeof element.style === 'object' &&
    element.style !== null
  )
}

export function isValidScene(doc: Y.Doc): boolean {
  const elements = doc.getMap('elements')
  const order = doc.getArray('elementOrder')
  if (!(elements instanceof Y.Map) || !(order instanceof Y.Array)) return false
  for (const value of elements.values()) {
    if (!(value instanceof Y.Map)) return false
    if (!isElement(value.toJSON())) return false
  }
  for (const id of order.toArray()) {
    if (typeof id !== 'string') return false
  }
  return true
}

export function serializeScene(snapshot: SceneSnapshot): SerializedScene {
  return {
    elements: snapshot.elements,
    order: snapshot.order,
    appState: snapshot.appState,
  }
}

export function applyScene(doc: Y.Doc, scene: SerializedScene): void {
  const elements = doc.getMap<Y.Map<unknown>>('elements')
  const order = doc.getArray<ElementId>('elementOrder')
  const appState = doc.getMap('appState')
  doc.transact(() => {
    elements.clear()
    order.delete(0, order.length)
    for (const [id, element] of Object.entries(scene.elements)) {
      const map = new Y.Map<unknown>()
      for (const [key, value] of Object.entries(element)) map.set(key, value)
      elements.set(id, map)
    }
    order.push(scene.order)
    for (const [key, value] of Object.entries(scene.appState)) appState.set(key, value)
  })
}

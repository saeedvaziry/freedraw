import type { Point } from '../model/types.js'
import type { SceneStore } from '../store/SceneStore.js'
import type { DiagramError } from './ast.js'
import { parseDiagram } from './index.js'

type Store = Pick<SceneStore, 'transact' | 'stopCapturing' | 'setUiState' | 'getLastUsedStyle'>

export function importDiagram(store: Store, text: string, origin: Point): DiagramError[] {
  const { elements, errors } = parseDiagram(text, { origin, style: store.getLastUsedStyle() })
  if (errors.length > 0) return errors

  store.transact((api) => {
    for (const element of elements) api.addElement(element)
  })
  store.stopCapturing()
  store.setUiState({ selectedIds: new Set(elements.map((element) => element.id)) })
  return []
}

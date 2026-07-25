import { Camera } from '../geometry/camera.js'
import type { Element, Point } from '../model/types.js'
import type { SceneStore } from '../store/scene-store.js'
import type { PointerInfo, ToolContext } from './tool.js'

export const camera = new Camera({ x: 0, y: 0, zoom: 1 })

export function pointerAt(point: Point): PointerInfo {
  return { screen: point, world: point, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, button: 0 }
}

export interface Harness {
  store: SceneStore
  ctx: ToolContext
  transient: (Element[] | null)[]
  updates: () => number
  history: () => number
}

export function harness(store: SceneStore): Harness {
  const transient: (Element[] | null)[] = []
  let updates = 0
  let history = 0
  store.doc.on('update', () => {
    updates += 1
  })
  store.subscribeHistory(() => {
    history += 1
  })
  return {
    store,
    transient,
    updates: () => updates,
    history: () => history,
    ctx: {
      store,
      camera,
      setPreview: () => {},
      setSpawnPreview: () => {},
      setTransient: (elements) => {
        transient.push(elements)
      },
      setMarquee: () => {},
      setTransforming: () => {},
      setGuides: () => {},
      setPortTarget: () => {},
      beginEdit: () => {},
      spawnChildAndEdit: () => {},
    },
  }
}

import * as Y from 'yjs'
import { isValidScene, migrateDoc, SceneStore, seedAppState } from '@freedraw/engine'
import { applyBase64Update } from '@/lib/persistence'

export interface VersionPreview {
  store: SceneStore
  destroy(): void
}

export class VersionPreviewError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VersionPreviewError'
  }
}

export function createVersionPreview(state: string): VersionPreview {
  const doc = new Y.Doc()

  try {
    applyBase64Update(doc, state)
  } catch (cause) {
    doc.destroy()
    throw new VersionPreviewError(`This version could not be decoded: ${String(cause)}`)
  }

  if (!isValidScene(doc)) {
    doc.destroy()
    throw new VersionPreviewError('This version does not contain a readable board')
  }

  try {
    migrateDoc(doc)
  } catch (cause) {
    doc.destroy()
    throw new VersionPreviewError(`This version could not be migrated: ${String(cause)}`)
  }

  seedAppState(doc)

  const store = new SceneStore(doc)
  let destroyed = false

  return {
    store,
    destroy: () => {
      if (destroyed) return
      destroyed = true
      store.destroy()
      doc.destroy()
    },
  }
}

import * as Y from 'yjs'
import { encodeDocAsBase64, updateRemotePage } from './page-api.js'

const SAVE_DELAY_MS = 800

export type SyncStatus = 'saved' | 'saving' | 'offline'

export interface PageSync {
  flush(): Promise<void>
  destroy(): void
  getStatus(): SyncStatus
  subscribe(listener: () => void): () => void
}

export function createPageSync(
  doc: Y.Doc,
  pagePublicId: string,
  initialDocument: string | null,
): PageSync {
  let timer: number | null = null
  let destroyed = false
  let saving = false
  let queued = false
  let lastSavedDocument = initialDocument ?? ''
  let status: SyncStatus = 'saved'
  const listeners = new Set<() => void>()

  const setStatus = (next: SyncStatus): void => {
    if (status === next) return
    status = next
    listeners.forEach((listener) => listener())
  }

  const save = async (): Promise<void> => {
    if (destroyed) return
    if (saving) {
      queued = true
      return
    }

    saving = true

    try {
      do {
        queued = false
        const document = encodeDocAsBase64(doc)

        if (document !== lastSavedDocument) {
          setStatus('saving')
          await updateRemotePage(pagePublicId, { document })
          lastSavedDocument = document
        }
      } while (queued && !destroyed)
      if (!destroyed) setStatus('saved')
    } catch (error) {
      queued = true
      setStatus('offline')
      console.warn('Failed to save page', error)
    } finally {
      saving = false
      if (queued && !destroyed) schedule()
    }
  }

  const schedule = (): void => {
    if (destroyed) return
    if (timer !== null) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = null
      void save()
    }, SAVE_DELAY_MS)
  }

  const onUpdate = (): void => schedule()
  doc.on('update', onUpdate)
  schedule()

  return {
    flush: save,
    destroy() {
      destroyed = true
      if (timer !== null) window.clearTimeout(timer)
      doc.off('update', onUpdate)
      listeners.clear()
    },
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

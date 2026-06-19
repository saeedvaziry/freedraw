import * as Y from 'yjs'
import { encodeDocAsBase64, updateRemotePage } from './page-api.js'

const SAVE_DELAY_MS = 800

export interface PageSync {
  flush(): Promise<void>
  destroy(): void
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
          await updateRemotePage(pagePublicId, { document })
          lastSavedDocument = document
        }
      } while (queued && !destroyed)
    } catch (error) {
      queued = true
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
    },
  }
}

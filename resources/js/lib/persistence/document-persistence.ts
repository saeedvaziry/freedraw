import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'

export const DOCUMENT_DB_NAME = 'freedraw-doc'

export interface DocumentPersistence {
  readonly doc: Y.Doc
  /** Absent for ephemeral (in-memory) persistence such as public read-only shares. */
  readonly provider?: IndexeddbPersistence
  whenSynced: Promise<void>
  clear(): Promise<void>
  destroy(): void
}

export function createDocumentPersistence(
  doc: Y.Doc = new Y.Doc(),
  name: string = DOCUMENT_DB_NAME,
): DocumentPersistence {
  const provider = new IndexeddbPersistence(name, doc)
  return {
    doc,
    provider,
    whenSynced: provider.whenSynced.then(() => undefined),
    clear: () => provider.clearData(),
    destroy: () => provider.destroy(),
  }
}

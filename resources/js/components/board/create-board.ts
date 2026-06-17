import * as Y from 'yjs'
import { isValidScene, migrateDoc, SceneStore, seedAppState } from '@freedraw/engine'
import { createDocumentPersistence, type DocumentPersistence } from '@/lib/persistence'

export interface Board {
  store: SceneStore
  persistence: DocumentPersistence
}

const BACKUP_KEY = 'freedraw:corrupt-backup'

function backupCorruptDoc(doc: Y.Doc): void {
  try {
    const update = Y.encodeStateAsUpdate(doc)
    const base64 = btoa(String.fromCharCode(...update))
    localStorage.setItem(BACKUP_KEY, base64)
  } catch (error) {
    console.warn('Failed to back up corrupt board data', error)
  }
}

async function hydrate(doc: Y.Doc): Promise<boolean> {
  if (!isValidScene(doc)) {
    console.warn('Persisted board data is invalid; starting a fresh board')
    backupCorruptDoc(doc)
    return false
  }
  try {
    migrateDoc(doc)
  } catch (error) {
    console.warn('Board migration failed; starting a fresh board', error)
    backupCorruptDoc(doc)
    return false
  }
  return true
}

export async function createBoard(): Promise<Board> {
  const persistence = createDocumentPersistence()
  await persistence.whenSynced

  if (!(await hydrate(persistence.doc))) {
    await persistence.clear()
    persistence.destroy()
    const fresh = createDocumentPersistence()
    await fresh.whenSynced
    seedAppState(fresh.doc)
    return { store: new SceneStore(fresh.doc), persistence: fresh }
  }

  seedAppState(persistence.doc)
  return { store: new SceneStore(persistence.doc), persistence }
}

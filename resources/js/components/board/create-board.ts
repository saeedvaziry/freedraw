import * as Y from 'yjs'
import { isValidScene, migrateDoc, SceneStore, seedAppState } from '@freedraw/engine'
import {
  applyBase64Update,
  createDocumentPersistence,
  createPageSync,
  createRemotePage,
  DOCUMENT_DB_NAME,
  documentHasContent,
  encodeDocAsBase64,
  type DocumentPersistence,
  type PageSync,
} from '@/lib/persistence'
import type { BoardPage } from '@/types'

export interface Board {
  store: SceneStore
  persistence: DocumentPersistence
  sync?: PageSync
  page: BoardPage | null
}

export interface BoardContext {
  userId: number | null
  organizationId: number | null
  initialPage: BoardPage | null
}

export type CreateBoardResult = Board | { redirectTo: string }

const BACKUP_KEY = 'freedraw:corrupt-backup'
// Set after a successful promotion create but BEFORE the local board is cleared,
// so a reload that interrupts the clear() doesn't create the page a second time.
const PROMOTED_KEY = 'freedraw:promoted-page'
let promotionPromise: Promise<BoardPage | null> | null = null
let initialPageCreation:
  | {
      organizationId: number | null
      promise: Promise<BoardPage>
    }
  | null = null

function backupCorruptDoc(doc: Y.Doc): void {
  try {
    localStorage.setItem(BACKUP_KEY, encodeDocAsBase64(doc))
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

function isAuthenticatedContext(context: BoardContext): boolean {
  return Boolean(context.userId && context.organizationId)
}

async function createAnonymousBoard(): Promise<Board> {
  const persistence = createDocumentPersistence()
  await persistence.whenSynced

  if (!(await hydrate(persistence.doc))) {
    await persistence.clear()
    persistence.destroy()
    const fresh = createDocumentPersistence()
    await fresh.whenSynced
    seedAppState(fresh.doc)
    return { store: new SceneStore(fresh.doc), persistence: fresh, page: null }
  }

  seedAppState(persistence.doc)
  return { store: new SceneStore(persistence.doc), persistence, page: null }
}

function readPromotedMarker(): BoardPage | null {
  try {
    const raw = localStorage.getItem(PROMOTED_KEY)
    return raw ? (JSON.parse(raw) as BoardPage) : null
  } catch {
    return null
  }
}

function writePromotedMarker(page: BoardPage): void {
  try {
    localStorage.setItem(PROMOTED_KEY, JSON.stringify(page))
  } catch (error) {
    console.warn('Failed to record promoted page', error)
  }
}

function clearPromotedMarker(): void {
  try {
    localStorage.removeItem(PROMOTED_KEY)
  } catch {
    // Ignore: a leftover marker is only read again after a successful clear().
  }
}

async function promoteAnonymousBoard(): Promise<BoardPage | null> {
  const persistence = createDocumentPersistence(new Y.Doc(), DOCUMENT_DB_NAME)
  await persistence.whenSynced

  try {
    // A previous attempt created the page but didn't finish clearing the local
    // board (reload/crash mid-clear). Finish the clear and reuse that page
    // instead of creating a duplicate.
    const promoted = readPromotedMarker()
    if (promoted) {
      await persistence.clear()
      clearPromotedMarker()
      return promoted
    }

    if (!(await hydrate(persistence.doc))) {
      await persistence.clear()
      return null
    }

    seedAppState(persistence.doc)

    if (!documentHasContent(persistence.doc)) {
      return null
    }

    const page = await createRemotePage({
      title: 'Untitled page',
      document: encodeDocAsBase64(persistence.doc),
    })

    // Record the page before clearing so an interrupted clear() is recoverable
    // without re-creating the page.
    writePromotedMarker(page)
    await persistence.clear()
    clearPromotedMarker()

    return page
  } finally {
    persistence.destroy()
  }
}

function promoteAnonymousBoardOnce(): Promise<BoardPage | null> {
  promotionPromise ??= promoteAnonymousBoard().finally(() => {
    promotionPromise = null
  })

  return promotionPromise
}

function createInitialPageOnce(organizationId: number | null): Promise<BoardPage> {
  if (initialPageCreation?.organizationId === organizationId) {
    return initialPageCreation.promise
  }

  const promise = createRemotePage({ title: 'Untitled page' }).finally(() => {
    if (initialPageCreation?.promise === promise) {
      initialPageCreation = null
    }
  })

  initialPageCreation = { organizationId, promise }

  return promise
}

async function createPageBoard(page: BoardPage): Promise<Board> {
  const doc = new Y.Doc()

  if (page.document) {
    try {
      applyBase64Update(doc, page.document)
    } catch (error) {
      console.warn('Failed to load page document; starting a fresh page', error)
    }
  }

  const persistence = createDocumentPersistence(doc, `${DOCUMENT_DB_NAME}:page:${page.publicId}`)
  await persistence.whenSynced

  if (!(await hydrate(persistence.doc))) {
    await persistence.clear()
    persistence.destroy()

    let freshDoc = new Y.Doc()
    if (page.document) {
      try {
        applyBase64Update(freshDoc, page.document)
      } catch (error) {
        console.warn('Failed to restore page document; starting a fresh page', error)
      }
    }
    if (!(await hydrate(freshDoc))) {
      freshDoc = new Y.Doc()
    }
    seedAppState(freshDoc)

    const fresh = createDocumentPersistence(freshDoc, `${DOCUMENT_DB_NAME}:page:${page.publicId}`)
    await fresh.whenSynced
    const sync = createPageSync(fresh.doc, page.publicId, page.document)

    return { store: new SceneStore(fresh.doc), persistence: fresh, sync, page }
  }

  seedAppState(persistence.doc)

  const sync = createPageSync(persistence.doc, page.publicId, page.document)

  return { store: new SceneStore(persistence.doc), persistence, sync, page }
}

async function createAuthenticatedBoard(context: BoardContext): Promise<CreateBoardResult> {
  const promotedPage = await promoteAnonymousBoardOnce()

  if (promotedPage) {
    return { redirectTo: promotedPage.url }
  }

  const page = context.initialPage ?? (await createInitialPageOnce(context.organizationId))

  if (!context.initialPage) {
    return { redirectTo: page.url }
  }

  return createPageBoard(page)
}

export async function createBoard(context: BoardContext): Promise<CreateBoardResult> {
  if (!isAuthenticatedContext(context)) {
    return createAnonymousBoard()
  }

  return createAuthenticatedBoard(context)
}

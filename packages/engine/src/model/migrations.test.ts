import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { migrateDoc, migrations, readSchemaVersion, seedAppState } from './migrations.js'
import { SCHEMA_VERSION } from './schema.js'

function docAtVersion(version: number | undefined): Y.Doc {
  const doc = new Y.Doc()
  if (version !== undefined) doc.getMap('appState').set('schemaVersion', version)
  return doc
}

describe('migrateDoc', () => {
  it('is identity when already at the current version', () => {
    const doc = docAtVersion(SCHEMA_VERSION)
    migrateDoc(doc)
    expect(readSchemaVersion(doc)).toBe(SCHEMA_VERSION)
  })

  it('runs ordered steps from a prior version and bumps to current', () => {
    const log: number[] = []
    const target = SCHEMA_VERSION + 2
    const step = (label: number) => (d: Y.Doc) => {
      log.push(label)
      d.getMap('appState').set('schemaVersion', label + 1)
    }
    const original = [...migrations]
    migrations[SCHEMA_VERSION] = step(SCHEMA_VERSION)
    migrations[SCHEMA_VERSION + 1] = step(SCHEMA_VERSION + 1)
    try {
      const doc = docAtVersion(SCHEMA_VERSION)
      runUpTo(doc, target)
      expect(log).toEqual([SCHEMA_VERSION, SCHEMA_VERSION + 1])
      expect(readSchemaVersion(doc)).toBe(target)
    } finally {
      migrations.length = 0
      migrations.push(...original)
    }
  })

  it('treats a doc with no schemaVersion as version 0 and bumps it', () => {
    const doc = docAtVersion(undefined)
    expect(readSchemaVersion(doc)).toBe(0)
    migrateDoc(doc)
    expect(readSchemaVersion(doc)).toBe(SCHEMA_VERSION)
  })
})

describe('sloppiness migration', () => {
  it('backfills sloppiness on elements and lastUsedStyle from version 1', () => {
    const doc = docAtVersion(1)
    const elements = doc.getMap('elements')
    const element = new Y.Map<unknown>()
    element.set('style', { stroke: '#000', strokeWidth: 2 })
    elements.set('a', element)
    doc.getMap('appState').set('lastUsedStyle', { stroke: '#000', strokeWidth: 2 })

    migrateDoc(doc)

    const migrated = (elements.get('a') as Y.Map<unknown>).get('style') as Record<string, unknown>
    expect(migrated.sloppiness).toBe(0)
    const lastUsed = doc.getMap('appState').get('lastUsedStyle') as Record<string, unknown>
    expect(lastUsed.sloppiness).toBe(0)
  })

  it('preserves an existing sloppiness value', () => {
    const doc = docAtVersion(1)
    const elements = doc.getMap('elements')
    const element = new Y.Map<unknown>()
    element.set('style', { stroke: '#000', sloppiness: 0.5 })
    elements.set('a', element)

    migrateDoc(doc)

    const migrated = (elements.get('a') as Y.Map<unknown>).get('style') as Record<string, unknown>
    expect(migrated.sloppiness).toBe(0.5)
  })
})

describe('seedAppState', () => {
  it('seeds defaults only for missing fields', () => {
    const doc = new Y.Doc()
    doc.getMap('appState').set('camera', { x: 5, y: 5, zoom: 2 })
    seedAppState(doc)
    const appState = doc.getMap('appState').toJSON()
    expect(appState.camera).toEqual({ x: 5, y: 5, zoom: 2 })
    expect(appState.schemaVersion).toBe(SCHEMA_VERSION)
    expect(appState.lastUsedStyle).toBeDefined()
  })
})

function runUpTo(doc: Y.Doc, target: number): void {
  const appState = doc.getMap('appState')
  for (let version = readSchemaVersion(doc); version < target; version += 1) {
    migrations[version]?.(doc)
  }
  if (readSchemaVersion(doc) !== target) appState.set('schemaVersion', target)
}

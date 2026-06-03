import * as Y from 'yjs'
import { SCHEMA_VERSION, defaultAppState } from './schema.js'

export type Migration = (doc: Y.Doc) => void

const addSloppiness: Migration = (doc) => {
  const elements = doc.getMap('elements')
  elements.forEach((value) => {
    if (!(value instanceof Y.Map)) return
    const style = value.get('style')
    if (isStyleObject(style) && style.sloppiness === undefined) {
      value.set('style', { ...style, sloppiness: 0 })
    }
  })
  const appState = doc.getMap('appState')
  const lastUsedStyle = appState.get('lastUsedStyle')
  if (isStyleObject(lastUsedStyle) && lastUsedStyle.sloppiness === undefined) {
    appState.set('lastUsedStyle', { ...lastUsedStyle, sloppiness: 0 })
  }
}

function isStyleObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const noop: Migration = () => {}

export const migrations: Migration[] = [noop, addSloppiness]

export function readSchemaVersion(doc: Y.Doc): number {
  const version = doc.getMap('appState').get('schemaVersion')
  return typeof version === 'number' ? version : 0
}

export function migrateDoc(doc: Y.Doc): void {
  const appState = doc.getMap('appState')
  const start = readSchemaVersion(doc)
  for (let version = start; version < SCHEMA_VERSION; version += 1) {
    const migration = migrations[version]
    if (migration) migration(doc)
  }
  if (readSchemaVersion(doc) !== SCHEMA_VERSION) {
    appState.set('schemaVersion', SCHEMA_VERSION)
  }
}

export function seedAppState(doc: Y.Doc): void {
  const appState = doc.getMap('appState')
  const defaults = defaultAppState()
  if (appState.get('schemaVersion') === undefined) {
    appState.set('schemaVersion', defaults.schemaVersion)
  }
  if (appState.get('camera') === undefined) appState.set('camera', defaults.camera)
  if (appState.get('lastUsedStyle') === undefined) {
    appState.set('lastUsedStyle', defaults.lastUsedStyle)
  }
}

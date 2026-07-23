import * as Y from 'yjs'
import { SCHEMA_VERSION, defaultAppState } from './schema.js'
import type { Binding, Point } from './types.js'

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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const noop: Migration = () => {}

const migrateArrowsToIntent: Migration = (doc) => {
  const elements = doc.getMap('elements')
  elements.forEach((value) => {
    if (!(value instanceof Y.Map)) return
    const type = value.get('type')
    if (type !== 'arrow' && type !== 'line') return

    value.delete('route')

    const points = value.get('points')
    const start = normalizeBinding(value.get('start'))
    const end = normalizeBinding(value.get('end'))
    if (start) value.set('start', start)
    if (end) value.set('end', end)

    if (Array.isArray(points) && (start || end)) {
      const first = points[0]
      const last = points[points.length - 1]
      if (isPoint(first) && isPoint(last)) value.set('points', [{ ...first }, { ...last }])
      value.set('routing', 'orthogonal')
      return
    }

    const routing = value.get('routing')
    value.set('routing', routing === 'orthogonal' ? 'orthogonal' : 'straight')
  })
}

const addGrouping: Migration = () => {}

export const migrations: Migration[] = [noop, addSloppiness, migrateArrowsToIntent, addGrouping]

export function readSchemaVersion(doc: Y.Doc): number {
  const version = doc.getMap('appState').get('schemaVersion')
  return typeof version === 'number' ? version : 0
}

function normalizeBinding(value: unknown): Binding | undefined {
  if (!isObject(value)) return undefined
  if (typeof value.elementId !== 'string') return undefined
  if (!isObject(value.anchor)) return undefined
  if (!isFiniteNumber(value.anchor.nx) || !isFiniteNumber(value.anchor.ny)) return undefined
  const anchor = { nx: value.anchor.nx, ny: value.anchor.ny }
  const gap = isFiniteNumber(value.gap) ? value.gap : 0
  const side = isBindingSide(value.side) ? value.side : anchorSide(anchor)
  return {
    elementId: value.elementId,
    anchor,
    gap,
    side,
  }
}

function anchorSide(anchor: { nx: number; ny: number }): Binding['side'] {
  const distToVerticalEdge = Math.min(anchor.nx, 1 - anchor.nx)
  const distToHorizontalEdge = Math.min(anchor.ny, 1 - anchor.ny)
  const axisX = distToVerticalEdge < distToHorizontalEdge
  if (axisX) return anchor.nx < 0.5 ? 'left' : 'right'
  return anchor.ny < 0.5 ? 'top' : 'bottom'
}

function isPoint(value: unknown): value is Point {
  return isObject(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
}

function isBindingSide(value: unknown): value is Binding['side'] {
  return value === 'left' || value === 'right' || value === 'top' || value === 'bottom'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
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
  if (appState.get('snapGuidesEnabled') === undefined) {
    appState.set('snapGuidesEnabled', defaults.snapGuidesEnabled)
  }
}

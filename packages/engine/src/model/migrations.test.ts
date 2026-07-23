import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { migrateDoc } from './migrations.js'
import { defaultStyle, SCHEMA_VERSION } from './schema.js'
import { SceneStore } from '../store/scene-store.js'

describe('migrateDoc', () => {
  it('migrates v2 arrows to v3 intent-only data', () => {
    const doc = new Y.Doc()
    const elements = doc.getMap<Y.Map<unknown>>('elements')
    const appState = doc.getMap('appState')
    appState.set('schemaVersion', 2)

    const arrow = new Y.Map<unknown>()
    arrow.set('id', 'arrow')
    arrow.set('type', 'arrow')
    arrow.set('x', 0)
    arrow.set('y', 0)
    arrow.set('width', 100)
    arrow.set('height', 100)
    arrow.set('rotation', 0)
    arrow.set('style', defaultStyle)
    arrow.set('points', [
      { x: 10, y: 10 },
      { x: 50, y: 40 },
      { x: 100, y: 10 },
    ])
    arrow.set('route', [
      { x: 10, y: 10 },
      { x: 10, y: 80 },
      { x: 100, y: 80 },
      { x: 100, y: 10 },
    ])
    arrow.set('start', { elementId: 'shape', anchor: { nx: 0.5, ny: 0 }, gap: 0 })
    arrow.set('endArrowhead', 'triangle')
    arrow.set('startArrowhead', 'none')
    arrow.set('routing', 'curved')
    elements.set('arrow', arrow)

    migrateDoc(doc)

    expect(appState.get('schemaVersion')).toBe(SCHEMA_VERSION)
    expect(arrow.get('route')).toBeUndefined()
    expect(arrow.get('points')).toEqual([
      { x: 10, y: 10 },
      { x: 100, y: 10 },
    ])
    expect(arrow.get('routing')).toBe('orthogonal')
    expect(arrow.get('start')).toEqual({
      elementId: 'shape',
      anchor: { nx: 0.5, ny: 0 },
      gap: 0,
      side: 'top',
    })
  })

  it('bumps v3 docs to the grouping schema version without mutating elements', () => {
    const doc = new Y.Doc()
    const elements = doc.getMap<Y.Map<unknown>>('elements')
    const appState = doc.getMap('appState')
    appState.set('schemaVersion', 3)

    const shape = new Y.Map<unknown>()
    shape.set('id', 'shape')
    shape.set('type', 'rect')
    shape.set('x', 0)
    shape.set('y', 0)
    shape.set('width', 100)
    shape.set('height', 80)
    shape.set('rotation', 0)
    shape.set('style', defaultStyle)
    elements.set('shape', shape)

    migrateDoc(doc)

    expect(appState.get('schemaVersion')).toBe(SCHEMA_VERSION)
    expect(shape.get('groupId')).toBeUndefined()
    expect(shape.get('locked')).toBeUndefined()
    expect(shape.get('type')).toBe('rect')
    expect(shape.get('width')).toBe(100)
  })

  it('migrates a v4 doc to the slides schema with an empty slide list', () => {
    const doc = new Y.Doc()
    doc.getMap('appState').set('schemaVersion', 4)

    migrateDoc(doc)

    expect(doc.getMap('appState').get('schemaVersion')).toBe(SCHEMA_VERSION)
    expect(new SceneStore(doc).getSnapshot().appState.slides).toEqual([])
  })

  it('is idempotent when run twice on a v4 doc', () => {
    const doc = new Y.Doc()
    doc.getMap('appState').set('schemaVersion', 4)

    migrateDoc(doc)
    migrateDoc(doc)

    expect(doc.getMap('appState').get('schemaVersion')).toBe(SCHEMA_VERSION)
    expect(new SceneStore(doc).getSnapshot().appState.slides).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { migrateDoc } from './migrations.js'
import { defaultStyle, SCHEMA_VERSION } from './schema.js'

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
})

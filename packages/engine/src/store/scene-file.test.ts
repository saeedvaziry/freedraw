import { describe, expect, it } from 'vitest'
import { createArrow, createShape } from '../model/factory.js'
import { SCHEMA_VERSION } from '../model/schema.js'
import type { Binding } from '../model/types.js'
import { SceneStore } from './scene-store.js'
import {
  createSceneFile,
  isSceneFile,
  parseSceneFile,
  stringifySceneFile,
  SCENE_FILE_TYPE,
} from './scene-file.js'

const shapeAt = (id: string, x: number): ReturnType<typeof createShape> =>
  createShape({ id, type: 'rect', x, y: 0, width: 40, height: 40 })

const bindingTo = (elementId: string): Binding => ({
  elementId,
  anchor: { nx: 0.5, ny: 0.5 },
  gap: 0,
  side: 'right',
})

function storeWithShapes(): SceneStore {
  const store = new SceneStore()
  store.transact((api) => {
    api.addElement(shapeAt('a', 0))
    api.addElement(shapeAt('b', 200))
    api.addElement(shapeAt('c', 400))
  })
  return store
}

describe('createSceneFile', () => {
  it('serializes the whole scene in document order', () => {
    const file = createSceneFile(storeWithShapes().getSnapshot())

    expect(file).not.toBeNull()
    expect(file!.type).toBe(SCENE_FILE_TYPE)
    expect(file!.version).toBe(SCHEMA_VERSION)
    expect(file!.order).toEqual(['a', 'b', 'c'])
    expect(Object.keys(file!.elements).sort()).toEqual(['a', 'b', 'c'])
  })

  it('returns null for an empty scene', () => {
    expect(createSceneFile(new SceneStore().getSnapshot())).toBeNull()
  })

  it('limits the file to the given ids, keeping document order', () => {
    const file = createSceneFile(storeWithShapes().getSnapshot(), ['c', 'a'])

    expect(file!.order).toEqual(['a', 'c'])
    expect(Object.keys(file!.elements).sort()).toEqual(['a', 'c'])
  })

  it('pulls in arrows whose endpoints are both selected', () => {
    const store = storeWithShapes()
    store.transact((api) => {
      api.addElement(
        createArrow({
          id: 'arrow',
          points: [
            { x: 0, y: 0 },
            { x: 200, y: 0 },
          ],
          start: bindingTo('a'),
          end: bindingTo('b'),
        }),
      )
    })

    const file = createSceneFile(store.getSnapshot(), ['a', 'b'])

    expect(file!.order).toEqual(['a', 'b', 'arrow'])
  })

  it('returns null when none of the ids exist', () => {
    expect(createSceneFile(storeWithShapes().getSnapshot(), ['missing'])).toBeNull()
  })
})

describe('parseSceneFile', () => {
  it('round-trips a serialized scene', () => {
    const file = createSceneFile(storeWithShapes().getSnapshot())
    const parsed = parseSceneFile(stringifySceneFile(file!))

    expect(parsed).toEqual(file)
  })

  it('rejects blank, malformed and foreign payloads', () => {
    expect(parseSceneFile('')).toBeNull()
    expect(parseSceneFile('{')).toBeNull()
    expect(parseSceneFile('{"type":"excalidraw","version":2}')).toBeNull()
    expect(parseSceneFile(JSON.stringify({ type: SCENE_FILE_TYPE, version: 1 }))).toBeNull()
  })

  it('rejects a file whose elements are not elements', () => {
    const file = createSceneFile(storeWithShapes().getSnapshot())!
    const broken = { ...file, elements: { ...file.elements, a: { id: 'a' } } }

    expect(isSceneFile(broken)).toBe(false)
  })

  it('rejects a file whose element key does not match its id', () => {
    const file = createSceneFile(storeWithShapes().getSnapshot())!
    const broken = { ...file, elements: { ...file.elements, z: file.elements.a! } }

    expect(isSceneFile(broken)).toBe(false)
  })

  it('drops dangling order entries and appends unordered elements', () => {
    const file = createSceneFile(storeWithShapes().getSnapshot())!
    const parsed = parseSceneFile(
      stringifySceneFile({ ...file, order: ['b', 'gone', 'b'] }),
    )

    expect(parsed!.order).toEqual(['b', 'a', 'c'])
  })
})

describe('importScene', () => {
  it('replaces the scene with the file contents', () => {
    const file = createSceneFile(storeWithShapes().getSnapshot(), ['a'])!
    const target = new SceneStore()
    target.transact((api) => api.addElement(shapeAt('existing', 0)))

    target.importScene(file)

    expect(target.getSnapshot().order).toEqual(['a'])
    expect(target.getSnapshot().elements.existing).toBeUndefined()
  })

  it('clears the selection and returns to the select tool', () => {
    const source = createSceneFile(storeWithShapes().getSnapshot())!
    const target = storeWithShapes()
    target.setUiState({ selectedIds: new Set(['a']), activeTool: 'freedraw' })

    target.importScene(source)

    expect(target.getUiState().selectedIds.size).toBe(0)
    expect(target.getUiState().activeTool).toBe('select')
  })

  it('is undoable as a single step', () => {
    const file = createSceneFile(storeWithShapes().getSnapshot(), ['a'])!
    const target = storeWithShapes()

    target.importScene(file)
    expect(target.getSnapshot().order).toEqual(['a'])

    target.undo()
    expect(target.getSnapshot().order).toEqual(['a', 'b', 'c'])
  })

  it('migrates an older file up to the current schema version', () => {
    const file = createSceneFile(storeWithShapes().getSnapshot())!
    const target = new SceneStore()

    target.importScene({ ...file, appState: { ...file.appState, schemaVersion: 1 } })

    expect(target.getSnapshot().appState.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('keeps local preferences and takes slides from the file', () => {
    const source = storeWithShapes()
    source.addSlide({ x: 0, y: 0, width: 10, height: 10 }, 'One')

    const target = storeWithShapes()
    target.setSnapGuidesEnabled(false)

    target.importScene(createSceneFile(source.getSnapshot())!)

    expect(target.getSlides().map((slide) => slide.name)).toEqual(['One'])
    expect(target.getSnapshot().appState.snapGuidesEnabled).toBe(false)
  })

  it('rebuilds the binding index for imported arrows', () => {
    const source = storeWithShapes()
    source.transact((api) => {
      api.addElement(
        createArrow({
          id: 'arrow',
          points: [
            { x: 0, y: 0 },
            { x: 200, y: 0 },
          ],
          start: bindingTo('a'),
          end: bindingTo('b'),
        }),
      )
    })

    const target = new SceneStore()
    target.importScene(createSceneFile(source.getSnapshot())!)

    expect([...target.arrowsForShape('a')]).toEqual(['arrow'])
  })
})

import { describe, expect, it } from 'vitest'
import { createArrow, createFreedraw, createShape } from '../model/factory.js'
import { SceneStore } from '../store/SceneStore.js'
import { serializeDiagram } from './serialize.js'

describe('serializeDiagram', () => {
  it('emits an edge between two labeled shapes', () => {
    const store = seeded((a, b) =>
      createArrow({
        points: [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
        ],
        start: { elementId: a, anchor: { nx: 1, ny: 0.5 }, gap: 6 },
        end: { elementId: b, anchor: { nx: 0, ny: 0.5 }, gap: 6 },
      }),
    )
    const { text } = serializeDiagram(store.getSnapshot())
    expect(text).toBe('flowchart LR\nstart[Start]\ndone[Done]\nstart --> done')
  })

  it('infers the direction from the dominant edge flow', () => {
    const store = new SceneStore()
    store.transact((api) => {
      const a = labeled('a', 'Top')
      const b = labeled('b', 'Bottom')
      b.y = 200
      api.addElement(a)
      api.addElement(b)
      api.addElement(
        createArrow({
          points: [
            { x: 0, y: 0 },
            { x: 0, y: 200 },
          ],
          start: { elementId: 'a', anchor: { nx: 0.5, ny: 1 }, gap: 6 },
          end: { elementId: 'b', anchor: { nx: 0.5, ny: 0 }, gap: 6 },
        }),
      )
    })
    const { text } = serializeDiagram(store.getSnapshot())
    expect(text.startsWith('flowchart TD')).toBe(true)
  })

  it('derives unique short ids from labels', () => {
    const store = new SceneStore()
    store.transact((api) => {
      api.addElement(labeled('a', 'Save'))
      api.addElement(labeled('b', 'Save'))
    })
    const { text } = serializeDiagram(store.getSnapshot())
    expect(text).toContain('save[Save]')
    expect(text).toContain('save2[Save]')
  })

  it('skips freedraw and unbound arrows', () => {
    const store = new SceneStore()
    store.transact((api) => {
      api.addElement(createFreedraw({ points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] }))
      api.addElement(
        createArrow({
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
          ],
        }),
      )
    })
    const { text, skipped } = serializeDiagram(store.getSnapshot())
    expect(skipped.map((entry) => entry.type).sort()).toEqual(['arrow', 'freedraw'])
    expect(text).toBe('flowchart TD')
  })
})

function labeled(id: string, text: string) {
  const shape = createShape({ id, x: 0, y: 0, width: 120, height: 80 })
  shape.label = { text, align: 'center', verticalAlign: 'middle' }
  return shape
}

function seeded(makeArrow: (a: string, b: string) => ReturnType<typeof createArrow>): SceneStore {
  const store = new SceneStore()
  const a = labeled('a', 'Start')
  const b = labeled('b', 'Done')
  b.x = 200
  store.transact((api) => {
    api.addElement(a)
    api.addElement(b)
    api.addElement(makeArrow('a', 'b'))
  })
  return store
}

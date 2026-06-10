import { describe, expect, it } from 'vitest'
import { SceneStore } from '../store/SceneStore.js'
import { importDiagram } from './import.js'
import { serializeDiagram } from './serialize.js'

function roundTrip(text: string): string {
  const store = new SceneStore()
  importDiagram(store, text, { x: 0, y: 0 })
  return serializeDiagram(store.getSnapshot()).text
}

describe('diagram round trip', () => {
  it('returns canonical text unchanged', () => {
    const canonical = ['flowchart TD', 'start[Start]', 'check{Check}', 'done[Done]', 'start --> check', 'check -->|ok| done'].join('\n')
    expect(roundTrip(canonical)).toBe(canonical)
  })

  it('is idempotent across two passes', () => {
    const once = roundTrip('A[One] --> B[Two] --> C[Three]')
    const twice = roundTrip(once)
    expect(twice).toBe(once)
  })

  it('preserves edge styles', () => {
    const text = roundTrip('a[A] -.-> b[B]')
    expect(text).toContain('a -.-> b')
  })
})

import { describe, expect, it } from 'vitest'
import { createShape } from '../model/factory.js'
import { createBinding, sideNormal } from './binding.js'

describe('connector bindings', () => {
  it('uses the connector approach to choose an ambiguous corner side', () => {
    const shape = createShape({ id: 'shape', x: 300, y: 0, width: 100, height: 100 })
    const binding = createBinding(shape, { x: 300, y: 100 }, 0, { x: 320, y: 140 })
    expect(binding.side).toBe('bottom')
  })

  it('stores sides in local shape space', () => {
    const shape = createShape({ id: 'shape', x: 0, y: 0, width: 100, height: 100, rotation: Math.PI / 2 })
    const normal = sideNormal(shape, 'top')
    expect(normal.x).toBeCloseTo(1)
    expect(normal.y).toBeCloseTo(0)
  })
})

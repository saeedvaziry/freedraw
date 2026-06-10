import { describe, expect, it } from 'vitest'
import { parse } from './parse.js'
import { layoutDiagram } from './layout.js'

describe('layoutDiagram', () => {
  it('stacks a chain into descending layers for TD', () => {
    const { ast } = parse('A --> B --> C')
    const { positions } = layoutDiagram(ast)
    expect(positions.get('A')!.y).toBeLessThan(positions.get('B')!.y)
    expect(positions.get('B')!.y).toBeLessThan(positions.get('C')!.y)
    expect(positions.get('A')!.x).toBe(positions.get('B')!.x)
  })

  it('spreads a chain horizontally for LR', () => {
    const { ast } = parse('flowchart LR\nA --> B --> C')
    const { positions } = layoutDiagram(ast)
    expect(positions.get('A')!.x).toBeLessThan(positions.get('B')!.x)
    expect(positions.get('A')!.y).toBe(positions.get('B')!.y)
  })

  it('places siblings in the same layer side by side', () => {
    const { ast } = parse('A --> B\nA --> C')
    const { positions } = layoutDiagram(ast)
    expect(positions.get('B')!.y).toBe(positions.get('C')!.y)
    expect(positions.get('B')!.x).not.toBe(positions.get('C')!.x)
  })

  it('centers a parent over its fanned-out children', () => {
    const { ast } = parse('A --> B\nA --> C\nA --> D')
    const { positions } = layoutDiagram(ast)
    const childCenter = (positions.get('B')!.x + positions.get('D')!.x) / 2
    expect(positions.get('A')!.x).toBe(childCenter)
    expect(positions.get('A')!.x).toBe(positions.get('C')!.x)
  })

  it('leaves a routing channel wider than a node between siblings', () => {
    const { ast } = parse('A --> B\nA --> C')
    const { positions } = layoutDiagram(ast)
    const gap = positions.get('C')!.x - (positions.get('B')!.x + positions.get('B')!.width)
    expect(gap).toBeGreaterThan(positions.get('B')!.width / 2)
  })

  it('is deterministic', () => {
    const { ast } = parse('A --> B --> C\nA --> C')
    const first = layoutDiagram(ast).positions
    const second = layoutDiagram(ast).positions
    expect([...first.entries()]).toEqual([...second.entries()])
  })

  it('handles cycles without looping forever', () => {
    const { ast } = parse('A --> B --> C --> A')
    const { positions } = layoutDiagram(ast)
    expect(positions.size).toBe(3)
  })

  it('separates disconnected components into bands', () => {
    const { ast } = parse('A --> B\nC --> D')
    const { positions } = layoutDiagram(ast)
    const first = Math.min(positions.get('A')!.y, positions.get('B')!.y)
    const second = Math.min(positions.get('C')!.y, positions.get('D')!.y)
    expect(second).toBeGreaterThan(first)
  })
})

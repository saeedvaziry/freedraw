import { describe, expect, it } from 'vitest'
import { parse } from './parse.js'
import { layoutDiagram, type NodeBox } from './layout.js'

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

  it('places a single child directly under its parent', () => {
    const { ast } = parse('A --> B\nA --> C\nB --> D')
    const { positions } = layoutDiagram(ast)
    const centerX = (id: string) => positions.get(id)!.x + positions.get(id)!.width / 2
    expect(centerX('D')).toBe(centerX('B'))
  })

  it('aligns a single-child chain on one axis', () => {
    const { ast } = parse('A --> B --> C')
    const { positions } = layoutDiagram(ast)
    const centerX = (id: string) => positions.get(id)!.x + positions.get(id)!.width / 2
    expect(centerX('A')).toBe(centerX('B'))
    expect(centerX('B')).toBe(centerX('C'))
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

  it('does not overlap nodes in reversed directions with varied sizes', () => {
    const overlaps = (a: NodeBox, b: NodeBox) =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

    for (const direction of ['RL', 'BT'] as const) {
      const { ast } = parse(`flowchart ${direction}\nN0[X] --> N1[A really quite long label here] --> N2[Y]`)
      const boxes = [...layoutDiagram(ast).positions.values()]
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          expect(overlaps(boxes[i]!, boxes[j]!)).toBe(false)
        }
      }
    }
  })

  it('orders layers toward the origin for reversed directions', () => {
    const rl = parse('flowchart RL\nA --> B --> C').ast
    const rlPositions = layoutDiagram(rl).positions
    expect(rlPositions.get('A')!.x).toBeGreaterThan(rlPositions.get('B')!.x)
    expect(rlPositions.get('B')!.x).toBeGreaterThan(rlPositions.get('C')!.x)

    const bt = parse('flowchart BT\nA --> B --> C').ast
    const btPositions = layoutDiagram(bt).positions
    expect(btPositions.get('A')!.y).toBeGreaterThan(btPositions.get('B')!.y)
    expect(btPositions.get('B')!.y).toBeGreaterThan(btPositions.get('C')!.y)
  })

  it('lays out a deep chain without overflowing the stack', () => {
    const ids = Array.from({ length: 20000 }, (_, position) => `n${position}`)
    const { ast } = parse(ids.join(' --> '))
    const { positions } = layoutDiagram(ast)
    expect(positions.size).toBe(ids.length)
    expect(positions.get('n0')!.y).toBeLessThan(positions.get(ids[ids.length - 1]!)!.y)
  })
})

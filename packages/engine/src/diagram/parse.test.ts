import { describe, expect, it } from 'vitest'
import { parse } from './parse.js'

describe('parse', () => {
  it('reads a header direction', () => {
    const { ast } = parse('flowchart LR\nA --> B')
    expect(ast.direction).toBe('LR')
  })

  it('defaults the direction to TD', () => {
    const { ast } = parse('A --> B')
    expect(ast.direction).toBe('TD')
  })

  it('expands chained edges into separate edges', () => {
    const { ast } = parse('A --> B --> C')
    expect(ast.edges).toHaveLength(2)
    expect(ast.edges.map((edge) => [edge.source, edge.target])).toEqual([
      ['A', 'B'],
      ['B', 'C'],
    ])
  })

  it('keeps a node body from its first mention', () => {
    const { ast } = parse('A[Start] --> B\nA --> C')
    const node = ast.nodes.find((candidate) => candidate.id === 'A')
    expect(node).toMatchObject({ shape: 'rect', text: 'Start' })
  })

  it('maps edge operators to arrow styles', () => {
    const { ast } = parse('A -.-> B')
    expect(ast.edges[0]?.style).toMatchObject({ type: 'arrow', strokeStyle: 'dotted', endArrowhead: 'triangle' })
  })

  it('parses a pipe edge label', () => {
    const { ast } = parse('A -->|yes| B')
    expect(ast.edges[0]?.label).toBe('yes')
  })

  it('parses diamond and hexagon nodes', () => {
    const { ast } = parse('A{Decision}\nB{{Prep}}')
    expect(ast.nodes.map((node) => node.shape)).toEqual(['diamond', 'hexagon'])
  })

  it('reports an edge with a missing target', () => {
    const { errors } = parse('A -->')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ line: 1 })
  })

  it('ignores comments and blank lines', () => {
    const { ast, errors } = parse('flowchart TD\n%% a comment\n\nA --> B')
    expect(errors).toHaveLength(0)
    expect(ast.edges).toHaveLength(1)
  })
})

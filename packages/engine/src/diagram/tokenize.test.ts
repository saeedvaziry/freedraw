import { describe, expect, it } from 'vitest'
import { tokenizeLine } from './tokenize.js'

describe('tokenizeLine', () => {
  it('matches the longest shape opener', () => {
    const { tokens } = tokenizeLine('A((Circle))', 1)
    expect(tokens).toEqual([{ kind: 'node', id: 'A', shape: expect.objectContaining({ shape: 'ellipse' }), text: 'Circle', column: 0 }])
  })

  it('prefers cylinder opener over rect opener', () => {
    const { tokens } = tokenizeLine('A[(DB)]', 1)
    expect(tokens[0]).toMatchObject({ kind: 'node', id: 'A', text: 'DB' })
    expect((tokens[0] as { shape: { shape: string } }).shape.shape).toBe('cylinder')
  })

  it('reads quoted text containing brackets', () => {
    const { tokens } = tokenizeLine('A["a (b) c"]', 1)
    expect(tokens[0]).toMatchObject({ text: 'a (b) c' })
  })

  it('reports an unterminated bracket with a column', () => {
    const { error } = tokenizeLine('A[oops', 3)
    expect(error).toMatchObject({ line: 3 })
    expect(error?.message).toContain('Unterminated')
  })

  it('tokenizes an edge with a pipe label', () => {
    const { tokens } = tokenizeLine('A -->|yes| B', 1)
    expect(tokens).toHaveLength(3)
    expect(tokens[1]).toMatchObject({ kind: 'edge', label: 'yes' })
  })

  it('tokenizes an inline edge label', () => {
    const { tokens } = tokenizeLine('A -- yes --> B', 1)
    expect(tokens[1]).toMatchObject({ kind: 'edge', label: 'yes' })
  })
})

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { builtinStencils, builtinTemplates, type Stencil } from '@freedraw/engine'
import { useLibrary } from './use-library.js'

const STORAGE_KEY = 'freedraw:stencil-library:v1'

function stencil(id: string, name: string): Stencil {
  return {
    version: 1,
    id,
    kind: 'stencil',
    name,
    payload: { elements: [], order: [] },
  } as unknown as Stencil
}

function store(...stencils: Stencil[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, stencils }))
}

function setup() {
  return renderHook(() => useLibrary())
}

function search(query: string) {
  const view = setup()
  act(() => {
    view.result.current.setQuery(query)
  })
  return view
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('useLibrary without a query', () => {
  it('offers every builtin template and stencil', () => {
    const { result } = setup()

    expect(result.current.query).toBe('')
    expect(result.current.templates).toEqual(builtinTemplates)
    expect(result.current.stencilGroups.flatMap((group) => group.stencils)).toHaveLength(
      builtinStencils.length,
    )
    expect(result.current.userStencils).toEqual([])
  })

  it('groups the stencils by category in a fixed order with readable labels', () => {
    const { result } = setup()

    expect(result.current.stencilGroups.map((group) => group.category)).toEqual([
      'flowchart',
      'uml',
      'erd',
      'kanban',
      'wireframe',
    ])
    expect(result.current.stencilGroups.map((group) => group.label)).toEqual([
      'Flowchart',
      'UML',
      'ERD',
      'Kanban',
      'Wireframe',
    ])
  })

  it('lists the stencils saved by the user', () => {
    store(stencil('mine/1', 'My arrow'))

    expect(setup().result.current.userStencils.map((item) => item.name)).toEqual(['My arrow'])
  })
})

describe('useLibrary searching', () => {
  it('matches templates by name and drops every group that has no hit', () => {
    const { result } = search('Login')

    expect(result.current.templates.map((template) => template.name)).toEqual(['Login form'])
    expect(result.current.stencilGroups).toEqual([])
  })

  it('matches a category by its label regardless of case', () => {
    const { result } = search('erd')

    expect(result.current.stencilGroups.map((group) => group.category)).toEqual(['erd'])
    expect(result.current.stencilGroups[0].stencils.map((item) => item.name)).toEqual([
      'Entity',
      'Relationship',
    ])
    expect(result.current.templates.map((template) => template.name)).toEqual([
      'One to many',
      'Many to many',
    ])
  })

  it('keeps the category order when a name matches across categories', () => {
    const { result } = search('card')

    expect(result.current.stencilGroups.map((group) => group.category)).toEqual([
      'kanban',
      'wireframe',
    ])
    expect(result.current.templates).toEqual([])
  })

  it('filters the user stencils too', () => {
    store(stencil('mine/1', 'My arrow'), stencil('mine/2', 'Other shape'))

    const { result } = search('arrow')

    expect(result.current.userStencils.map((item) => item.id)).toEqual(['mine/1'])
  })

  it('returns nothing at all for a query that matches nothing', () => {
    store(stencil('mine/1', 'My arrow'))

    const { result } = search('zzz-no-such-thing')

    expect(result.current.templates).toEqual([])
    expect(result.current.stencilGroups).toEqual([])
    expect(result.current.userStencils).toEqual([])
  })

  it('trims the query and reuses the memoised results for an equivalent one', () => {
    const { result } = search('uml')
    const templates = result.current.templates
    const groups = result.current.stencilGroups

    act(() => {
      result.current.setQuery('  uml  ')
    })

    expect(result.current.query).toBe('  uml  ')
    expect(result.current.templates).toBe(templates)
    expect(result.current.stencilGroups).toBe(groups)
  })
})

describe('useLibrary removing a user stencil', () => {
  it('forwards the removal to the stored library', () => {
    store(stencil('mine/1', 'My arrow'), stencil('mine/2', 'Other shape'))

    const { result } = setup()
    act(() => {
      result.current.removeStencil('mine/1')
    })

    expect(result.current.userStencils.map((item) => item.id)).toEqual(['mine/2'])
  })
})

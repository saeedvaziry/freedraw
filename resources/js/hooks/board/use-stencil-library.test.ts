import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Stencil } from '@freedraw/engine'
import { useStencilLibrary } from './use-stencil-library.js'

const STORAGE_KEY = 'freedraw:stencil-library:v1'
const CHANGE_EVENT = 'freedraw:stencil-library-change'

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

function stored(): { id: string; name: string }[] {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  return (JSON.parse(raw) as { stencils: { id: string; name: string }[] }).stencils
}

function setup() {
  return renderHook(() => useStencilLibrary())
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('useStencilLibrary reading', () => {
  it('starts empty when nothing was ever saved', () => {
    expect(setup().result.current.stencils).toEqual([])
  })

  it('reads the stencils that were stored earlier', () => {
    store(stencil('a', 'Alpha'), stencil('b', 'Beta'))

    expect(setup().result.current.stencils.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('falls back to an empty library for unreadable storage', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not json at all')

    expect(setup().result.current.stencils).toEqual([])
  })

  it('ignores a payload whose stencils are not a list', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, stencils: 'nope' }))

    expect(setup().result.current.stencils).toEqual([])
  })
})

describe('useStencilLibrary writing', () => {
  it('puts a saved stencil first and persists it', () => {
    store(stencil('a', 'Alpha'))

    const { result } = setup()
    act(() => {
      result.current.saveStencil(stencil('b', 'Beta'))
    })

    expect(result.current.stencils.map((item) => item.id)).toEqual(['b', 'a'])
    expect(stored().map((item) => item.id)).toEqual(['b', 'a'])
  })

  it('replaces an earlier copy of the same stencil instead of duplicating it', () => {
    store(stencil('a', 'Alpha'), stencil('b', 'Beta'))

    const { result } = setup()
    act(() => {
      result.current.saveStencil(stencil('b', 'Beta renamed'))
    })

    expect(result.current.stencils.map((item) => [item.id, item.name])).toEqual([
      ['b', 'Beta renamed'],
      ['a', 'Alpha'],
    ])
  })

  it('drops a removed stencil from state and from storage', () => {
    store(stencil('a', 'Alpha'), stencil('b', 'Beta'))

    const { result } = setup()
    act(() => {
      result.current.removeStencil('a')
    })

    expect(result.current.stencils.map((item) => item.id)).toEqual(['b'])
    expect(stored().map((item) => item.id)).toEqual(['b'])
  })

  it('leaves the library alone when removing an unknown id', () => {
    store(stencil('a', 'Alpha'))

    const { result } = setup()
    act(() => {
      result.current.removeStencil('missing')
    })

    expect(result.current.stencils.map((item) => item.id)).toEqual(['a'])
  })
})

describe('useStencilLibrary synchronisation', () => {
  it('mirrors a save made by another mounted copy', () => {
    const first = setup()
    const second = setup()

    act(() => {
      first.result.current.saveStencil(stencil('a', 'Alpha'))
    })

    expect(second.result.current.stencils.map((item) => item.id)).toEqual(['a'])
  })

  it('re-reads the library when another tab writes it', () => {
    const { result } = setup()

    store(stencil('a', 'From another tab'))
    act(() => {
      window.dispatchEvent(new Event('storage'))
    })

    expect(result.current.stencils.map((item) => item.name)).toEqual(['From another tab'])
  })

  it('detaches both listeners on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener')

    setup().unmount()

    const events = remove.mock.calls.map((call) => call[0])
    expect(events).toContain(CHANGE_EVENT)
    expect(events).toContain('storage')
    remove.mockRestore()
  })
})

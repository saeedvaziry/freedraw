import { builtinStencils, builtinTemplates, type Stencil } from '@freedraw/engine'
import { describe, expect, it } from 'vitest'
import { STENCIL_DRAG_MIME, buildStencilIndex } from './use-stencil-drop.js'

function userStencil(id: string, name: string): Stencil {
  return {
    id,
    name,
    payload: { elements: [], order: [] },
  } as unknown as Stencil
}

describe('buildStencilIndex', () => {
  it('resolves builtin templates and stencils by id', () => {
    const index = buildStencilIndex([])
    const template = builtinTemplates[0]
    const stencil = builtinStencils[0]

    expect(index.get(template.id)).toBe(template)
    expect(index.get(stencil.id)).toBe(stencil)
    expect(index.size).toBe(builtinTemplates.length + builtinStencils.length)
  })

  it('resolves user stencils', () => {
    const mine = userStencil('user/1', 'Mine')
    const index = buildStencilIndex([mine])

    expect(index.get('user/1')).toBe(mine)
  })

  it('lets a user stencil win over a builtin with the same id', () => {
    const clash = userStencil(builtinStencils[0].id, 'Override')
    const index = buildStencilIndex([clash])

    expect(index.get(clash.id)).toBe(clash)
  })

  it('returns undefined for unknown ids', () => {
    expect(buildStencilIndex([]).get('nope')).toBeUndefined()
  })
})

describe('STENCIL_DRAG_MIME', () => {
  it('is a custom mime so image drops stay on the image path', () => {
    expect(STENCIL_DRAG_MIME).toBe('application/x-freedraw-stencil')
    expect(STENCIL_DRAG_MIME.startsWith('image/')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { isSceneClipboardPayload, SCENE_CLIPBOARD_VERSION } from '../store/clipboard.js'
import { SceneStore } from '../store/scene-store.js'
import { builtinStencils, builtinTemplates } from './builtins.js'
import type { BuiltinStencil, LibraryCategory } from './builtins.js'

const CATEGORIES: LibraryCategory[] = ['flowchart', 'uml', 'erd', 'kanban', 'wireframe']

const allEntries: BuiltinStencil[] = [...builtinStencils, ...builtinTemplates]

describe('builtin library', () => {
  it('exposes both stencils and templates', () => {
    expect(builtinStencils.length).toBeGreaterThan(0)
    expect(builtinTemplates.length).toBeGreaterThan(0)
    expect(builtinStencils.every((entry) => entry.kind === 'stencil')).toBe(true)
    expect(builtinTemplates.every((entry) => entry.kind === 'template')).toBe(true)
  })

  it('uses unique stable ids', () => {
    const ids = allEntries.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => id.length > 0)).toBe(true)
  })

  it('tags every entry with a known category and name', () => {
    for (const entry of allEntries) {
      expect(CATEGORIES).toContain(entry.category)
      expect(entry.name.length).toBeGreaterThan(0)
    }
  })

  it('leaves thumbnails on-demand', () => {
    for (const entry of allEntries) expect(entry.thumbnail).toBeUndefined()
  })

  it('carries a valid non-empty clipboard payload', () => {
    for (const entry of allEntries) {
      expect(entry.payload.version).toBe(SCENE_CLIPBOARD_VERSION)
      expect(entry.payload.elements.length).toBeGreaterThan(0)
      expect(isSceneClipboardPayload(entry.payload)).toBe(true)
    }
  })

  it('inserts every entry cleanly into a scene', () => {
    for (const entry of allEntries) {
      const store = new SceneStore()
      const before = store.getSnapshot().order.length
      const ids = store.insertStencil(entry, { x: 0, y: 0 })
      expect(ids.length).toBe(entry.payload.elements.length)
      const snapshot = store.getSnapshot()
      expect(snapshot.order.length).toBe(before + entry.payload.elements.length)
      for (const id of ids) expect(snapshot.elements[id]).toBeDefined()
    }
  })
})

import { describe, expect, it } from 'vitest'
import { isSceneClipboardPayload, SCENE_CLIPBOARD_VERSION } from '../store/clipboard.js'
import { SceneStore } from '../store/scene-store.js'
import { builtinStencils, builtinTemplates } from './builtins.js'
import type { BuiltinStencil, LibraryCategory } from './builtins.js'

const CATEGORIES: LibraryCategory[] = ['flowchart', 'uml', 'erd', 'kanban', 'wireframe']

const allEntries: BuiltinStencil[] = [...builtinStencils, ...builtinTemplates]

const EXPANDED_IDS = [
  'builtin/flowchart/data',
  'builtin/flowchart/database',
  'builtin/uml/interface',
  'builtin/uml/state',
  'builtin/erd/relationship',
  'builtin/wireframe/input',
  'builtin/wireframe/navbar',
  'builtin/flowchart/swimlane',
  'builtin/uml/sequence',
  'builtin/uml/state-machine',
  'builtin/erd/one-to-many',
  'builtin/erd/many-to-many',
  'builtin/wireframe/login',
]

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

  it('ships the expanded breadth set as distinct valid entries', () => {
    const byId = new Map(allEntries.map((entry) => [entry.id, entry]))
    for (const id of EXPANDED_IDS) {
      const entry = byId.get(id)
      expect(entry).toBeDefined()
      expect(CATEGORIES).toContain(entry!.category)
      expect(entry!.payload.elements.length).toBeGreaterThan(0)
      expect(isSceneClipboardPayload(entry!.payload)).toBe(true)
    }
  })

  it('inserts every expanded entry cleanly and remaps bound connectors', () => {
    const byId = new Map(allEntries.map((entry) => [entry.id, entry]))
    for (const id of EXPANDED_IDS) {
      const entry = byId.get(id)!
      const store = new SceneStore()
      const ids = store.insertStencil(entry, { x: 40, y: 40 })
      expect(ids.length).toBe(entry.payload.elements.length)
      const snapshot = store.getSnapshot()
      const inserted = new Set(ids)
      for (const insertedId of ids) {
        const element = snapshot.elements[insertedId]
        expect(element).toBeDefined()
        const start = (element as { start?: { elementId: string } }).start
        const end = (element as { end?: { elementId: string } }).end
        if (start) expect(inserted.has(start.elementId)).toBe(true)
        if (end) expect(inserted.has(end.elementId)).toBe(true)
      }
    }
  })

  it('gives every category multiple entries', () => {
    for (const category of CATEGORIES) {
      const count = allEntries.filter((entry) => entry.category === category).length
      expect(count).toBeGreaterThanOrEqual(2)
    }
    expect(builtinStencils.length).toBeGreaterThanOrEqual(15)
    expect(builtinTemplates.length).toBeGreaterThanOrEqual(8)
  })
})

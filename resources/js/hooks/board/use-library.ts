import { useMemo, useState } from 'react'
import {
  builtinStencils,
  builtinTemplates,
  type BuiltinStencil,
  type BuiltinTemplate,
  type LibraryCategory,
  type Stencil,
} from '@freedraw/engine'
import { useStencilLibrary } from './use-stencil-library.js'

const CATEGORY_ORDER: LibraryCategory[] = ['flowchart', 'uml', 'erd', 'kanban', 'wireframe']

const CATEGORY_LABELS: Record<LibraryCategory, string> = {
  flowchart: 'Flowchart',
  uml: 'UML',
  erd: 'ERD',
  kanban: 'Kanban',
  wireframe: 'Wireframe',
}

export interface LibraryStencilGroup {
  category: LibraryCategory
  label: string
  stencils: BuiltinStencil[]
}

export interface UseLibraryResult {
  query: string
  setQuery(query: string): void
  templates: BuiltinTemplate[]
  stencilGroups: LibraryStencilGroup[]
  userStencils: Stencil[]
  removeStencil(id: string): void
}

function matches(query: string, ...fields: (string | undefined)[]): boolean {
  if (query.length === 0) return true
  const needle = query.toLowerCase()
  return fields.some((field) => (field ? field.toLowerCase().includes(needle) : false))
}

export function useLibrary(): UseLibraryResult {
  const { stencils, removeStencil } = useStencilLibrary()
  const [query, setQuery] = useState('')
  const trimmed = query.trim()

  const templates = useMemo(
    () =>
      builtinTemplates.filter((template) =>
        matches(trimmed, template.name, CATEGORY_LABELS[template.category], template.category),
      ),
    [trimmed],
  )

  const stencilGroups = useMemo(() => {
    const groups: LibraryStencilGroup[] = []
    for (const category of CATEGORY_ORDER) {
      const label = CATEGORY_LABELS[category]
      const grouped = builtinStencils.filter(
        (stencil) =>
          stencil.category === category && matches(trimmed, stencil.name, label, category),
      )
      if (grouped.length > 0) groups.push({ category, label, stencils: grouped })
    }
    return groups
  }, [trimmed])

  const userStencils = useMemo(
    () => stencils.filter((stencil) => matches(trimmed, stencil.name)),
    [trimmed, stencils],
  )

  return { query, setQuery, templates, stencilGroups, userStencils, removeStencil }
}

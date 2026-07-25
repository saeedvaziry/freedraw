import { useCallback } from 'react'
import type { Stencil } from '@freedraw/engine'
import { useLibrary } from '@/hooks/board/use-library.js'
import { useBoardContext } from './board-context.js'
import { LibraryPanel } from './library-panel/library-panel.js'

interface LibraryPanelHostProps {
  closeOnInsert?: boolean
  className?: string
  onClose(): void
}

export function LibraryPanelHost({
  closeOnInsert = false,
  className,
  onClose,
}: LibraryPanelHostProps) {
  const { store, controller, readOnly } = useBoardContext()
  const library = useLibrary()

  const insert = useCallback(
    (stencil: Stencil): void => {
      const center = controller?.viewportCenter ?? { x: 0, y: 0 }
      store.insertStencil(stencil, center)
      if (closeOnInsert) onClose()
    },
    [store, controller, closeOnInsert, onClose],
  )

  if (readOnly) return null

  return (
    <LibraryPanel
      query={library.query}
      templates={library.templates}
      stencilGroups={library.stencilGroups}
      userStencils={library.userStencils}
      className={className}
      onQueryChange={library.setQuery}
      onInsert={insert}
      onRemoveUserStencil={library.removeStencil}
      onClose={onClose}
    />
  )
}

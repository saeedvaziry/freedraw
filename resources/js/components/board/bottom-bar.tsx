import { usePage } from '@inertiajs/react'
import { Wrench } from 'lucide-react'
import { ToolButton } from '@/components/board/ui-kit'
import { useBoardContext } from './board-context.js'
import { ActionsMenu } from './actions-menu.js'
import { BoardUserMenu } from './board-user-menu.js'
import { ToolbarHost } from './toolbar-host.js'

interface BottomBarProps {
  diagramOpen: boolean
  onToggleDiagram(): void
}

/**
 * Compact desktop dock centered at the bottom of the canvas: one pill with the
 * drawing tools (shapes / sticky as upward popovers) plus a single "Actions"
 * button that opens the editing actions — undo, redo, delete, … plus snap /
 * export — as an upward dropdown menu.
 */
export function BottomBar({ diagramOpen, onToggleDiagram }: BottomBarProps) {
  const { store, controller, boardExport, theme } = useBoardContext()
  // Signed-in users reach their account from the sidebar, so the bar's user menu
  // is only needed by guests (to log in or register).
  const isAuthenticated = Boolean(usePage().props.auth?.user)

  return (
    <ToolbarHost
      store={store}
      layout="horizontal"
      diagramOpen={diagramOpen}
      onToggleDiagram={onToggleDiagram}
      trailing={
        <>
          <ActionsMenu
            store={store}
            controller={controller}
            boardExport={boardExport}
            theme={theme}
          >
            <ToolButton label="Actions">
              <Wrench />
            </ToolButton>
          </ActionsMenu>
          {!isAuthenticated ? <BoardUserMenu /> : null}
        </>
      }
    />
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useBoardContext } from '@/components/board/board-context.js'
import type { BoardActionContext } from '@/components/board/board-actions.js'
import { CommandPalette } from './command-palette.js'

export const COMMAND_PALETTE_OPEN_EVENT = 'freedraw:command-palette-open'

export function CommandPaletteHost() {
  const { store, controller, boardExport, theme, readOnly, openImagePicker } = useBoardContext()
  const [open, setOpen] = useState(false)

  const context = useMemo<BoardActionContext>(
    () => ({ store, controller, boardExport, theme, readOnly, openImagePicker }),
    [store, controller, boardExport, theme, readOnly, openImagePicker],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    const onOpenEvent = () => setOpen(true)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpenEvent)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpenEvent)
    }
  }, [])

  return <CommandPalette open={open} onOpenChange={setOpen} context={context} />
}

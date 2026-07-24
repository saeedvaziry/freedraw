import { useEffect, useState } from 'react'
import { buildStencilFromSelection, type ElementId, type SceneSnapshot } from '@freedraw/engine'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useStencilLibrary } from '@/hooks/board/use-stencil-library.js'
import { boardToast } from '@/lib/board-toast'
import { SAVE_STENCIL_EVENT } from './board-actions.js'
import { useBoardContext } from './board-context.js'

interface PendingSelection {
  snapshot: SceneSnapshot
  ids: ElementId[]
}

export function SaveStencilHost() {
  const { store, readOnly } = useBoardContext()
  const { saveStencil } = useStencilLibrary()
  const [pending, setPending] = useState<PendingSelection | null>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    if (readOnly) return
    const open = (): void => {
      const ids = [...store.getUiState().selectedIds]
      if (ids.length === 0) return
      setPending({ snapshot: store.getSnapshot(), ids })
      setName('')
    }
    window.addEventListener(SAVE_STENCIL_EVENT, open)
    return () => window.removeEventListener(SAVE_STENCIL_EVENT, open)
  }, [store, readOnly])

  const close = (): void => setPending(null)

  const save = (): void => {
    if (!pending) return
    const trimmed = name.trim()
    const stencil = buildStencilFromSelection(pending.snapshot, pending.ids, {
      name: trimmed || 'Untitled stencil',
    })
    if (!stencil) {
      boardToast('Nothing to save', 'error')
      close()
      return
    }
    saveStencil(stencil)
    boardToast(`Saved "${stencil.name}" to your library`)
    close()
  }

  return (
    <Dialog
      open={pending != null}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Save as stencil</DialogTitle>
          <DialogDescription>
            Save the selected elements to your local stencil library.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="stencil-name">Name</Label>
            <Input
              id="stencil-name"
              autoFocus
              value={name}
              placeholder="Untitled stencil"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">Save stencil</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

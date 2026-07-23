import { useEffect, useRef, useState } from 'react'
import type { ContextMenuRequest } from '@freedraw/engine'
import { useBoardContext } from '../board-context.js'
import { BoardContextMenu } from './board-context-menu.js'

export function ContextMenuHost() {
  const { controller } = useBoardContext()
  const [state, setState] = useState<{ request: ContextMenuRequest; seq: number } | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    if (!controller) return
    return controller.subscribeContextMenu((request) => {
      if (!request) {
        setState(null)
        return
      }
      seq.current += 1
      setState({ request, seq: seq.current })
    })
  }, [controller])

  if (!controller || !state) return null

  return (
    <BoardContextMenu
      key={state.seq}
      request={state.request}
      onClose={() => controller.closeContextMenu()}
    />
  )
}

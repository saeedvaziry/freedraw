import { useEffect } from 'react'
import {
  type EditorController,
  parseSceneClipboard,
  stringifySceneClipboard,
  type SceneStore,
} from '@freedraw/engine'
import { isEditableTarget } from './useKeyboard.js'

export const BOARD_CLIPBOARD_MIME = 'application/x-freedraw-scene'

export function useBoardClipboard(store: SceneStore, controller: EditorController | null): void {
  useEffect(() => {
    const onCopy = (event: ClipboardEvent): void => {
      if (isEditableTarget(event.target)) return
      const payload = store.copyElements(store.getUiState().selectedIds)
      if (!payload) return
      event.preventDefault()
      event.clipboardData?.setData(BOARD_CLIPBOARD_MIME, stringifySceneClipboard(payload))
      event.clipboardData?.setData('text/plain', 'FreeDraw board elements')
    }

    const onCut = (event: ClipboardEvent): void => {
      if (isEditableTarget(event.target)) return
      const payload = store.cutElements(store.getUiState().selectedIds)
      if (!payload) return
      event.preventDefault()
      event.clipboardData?.setData(BOARD_CLIPBOARD_MIME, stringifySceneClipboard(payload))
      event.clipboardData?.setData('text/plain', 'FreeDraw board elements')
    }

    const onPaste = (event: ClipboardEvent): void => {
      if (isEditableTarget(event.target)) return
      const target = controller?.cursorWorldPoint
      const clipboardData = event.clipboardData
      const raw = clipboardData?.getData(BOARD_CLIPBOARD_MIME)
      if (!raw && hasImageClipboardItem(clipboardData)) return
      const payload = raw ? parseSceneClipboard(raw) : null
      if (raw && !payload) return
      const pastedIds = payload
        ? store.pasteElements({ payload, target })
        : store.pasteElements({ target })
      if (pastedIds.length === 0) return
      event.preventDefault()
    }

    window.addEventListener('copy', onCopy)
    window.addEventListener('cut', onCut)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('copy', onCopy)
      window.removeEventListener('cut', onCut)
      window.removeEventListener('paste', onPaste)
    }
  }, [store, controller])
}

function hasImageClipboardItem(data: DataTransfer | null): boolean {
  if (!data) return false
  return Array.from(data.items).some((item) => item.type.startsWith('image/'))
}

import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  createImage,
  parseSceneClipboard,
  validateImageInput,
  type EditorController,
  type SceneStore,
} from '@freedraw/engine'
import { assetRepo } from '@/lib/persistence'
import { BOARD_CLIPBOARD_MIME } from './use-board-clipboard.js'

interface ImageInsertApi {
  openPicker: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onDragOver: (event: React.DragEvent) => void
  onDrop: (event: React.DragEvent) => void
}

function generateAssetId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `asset_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function useImageInsert(
  controller: EditorController | null,
  store: SceneStore,
): ImageInsertApi {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const insert = useCallback(
    async (blob: Blob, world: { x: number; y: number } | null): Promise<void> => {
      if (!controller) return
      const validation = validateImageInput(blob)
      if (!validation.ok) {
        console.warn(`Image rejected: ${validation.reason}`)
        return
      }

      const bitmap = await createImageBitmap(blob)
      const assetId = generateAssetId()
      await assetRepo.putAsset(assetId, blob)

      const viewport = controller.viewportSize
      const center = world ?? controller.screenToWorld({
        x: viewport.width / 2,
        y: viewport.height / 2,
      })

      const element = createImage({
        assetId,
        x: center.x,
        y: center.y,
        naturalWidth: bitmap.width,
        naturalHeight: bitmap.height,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        style: store.getLastUsedStyle(),
      })
      const centered = {
        ...element,
        x: center.x - element.width / 2,
        y: center.y - element.height / 2,
      }

      controller.cacheImageBitmap(assetId, bitmap)
      store.stopCapturing()
      store.transact((api) => api.addElement(centered))
      store.setUiState({ selectedIds: new Set([centered.id]), activeTool: 'select' })
    },
    [controller, store],
  )

  useEffect(() => {
    if (!controller) return
    controller.setImageBlobLoader((assetId) => assetRepo.getAsset(assetId))
  }, [controller])

  useEffect(() => {
    if (!controller) return

    const onPaste = (event: ClipboardEvent): void => {
      if (event.defaultPrevented) return
      const rawBoardClipboard = event.clipboardData?.getData(BOARD_CLIPBOARD_MIME)
      if (rawBoardClipboard && parseSceneClipboard(rawBoardClipboard)) {
        return
      }
      const items = event.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (!item.type.startsWith('image/')) continue
        const blob = item.getAsFile()
        if (blob) void insert(blob, null)
      }
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [controller, insert])

  const openPicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const onFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (file) void insert(file, null)
    },
    [insert],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      if (!controller) return
      const file = Array.from(event.dataTransfer.files).find((item) =>
        item.type.startsWith('image/'),
      )
      if (!file) return
      const rect = event.currentTarget.getBoundingClientRect()
      const world = controller.screenToWorld({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
      void insert(file, world)
    },
    [controller, insert],
  )

  return useMemo(
    () => ({ openPicker, fileInputRef, onFileInputChange, onDragOver, onDrop }),
    [openPicker, onFileInputChange, onDragOver, onDrop],
  )
}

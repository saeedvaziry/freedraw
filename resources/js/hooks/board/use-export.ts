import { useCallback, useMemo } from 'react'
import {
  createSceneFile,
  parseSceneFile,
  stringifySceneFile,
  SCENE_FILE_EXTENSION,
  SCENE_FILE_MIME,
  SCENE_FILE_VERSION,
  type EditorController,
  type ExportFailure,
  type ExportImageOptions,
  type SceneStore,
} from '@freedraw/engine'
import { boardToast } from '@/lib/board-toast'

type ExportFormat = ExportImageOptions['format']

const EXTENSION: Record<ExportFormat, string> = { png: 'png', jpg: 'jpg' }

export interface BoardExportOptions {
  scale?: number
  selectionOnly?: boolean
}

export interface BoardExport {
  exportImage(
    format: ExportFormat,
    transparent: boolean,
    dark: boolean,
    options?: BoardExportOptions,
  ): Promise<void>
  copyImage(options?: BoardExportOptions): Promise<void>
  exportScene(options?: BoardExportOptions): void
  importScene(file: File): Promise<void>
}

export function useExport(controller: EditorController | null, store: SceneStore): BoardExport {
  const exportImage = useCallback(
    async (
      format: ExportFormat,
      transparent: boolean,
      dark: boolean,
      options?: BoardExportOptions,
    ): Promise<void> => {
      if (!controller) return
      try {
        const result = await controller.exportImage({
          format,
          transparent,
          dark,
          scale: options?.scale,
          selectionOnly: options?.selectionOnly,
        })
        if (!result.ok) {
          boardToast(exportFailureMessage(result), 'error')
          return
        }
        downloadBlob(result.blob, `freedraw.${EXTENSION[format]}`)
        boardToast(`Exported as ${format.toUpperCase()}`)
      } catch (error) {
        console.error('Export failed', error)
        boardToast('Export failed', 'error')
      }
    },
    [controller],
  )

  const copyImage = useCallback(
    async (options?: BoardExportOptions): Promise<void> => {
      if (!controller) return
      try {
        const result = await controller.copyImageToClipboard({
          scale: options?.scale,
          selectionOnly: options?.selectionOnly,
        })
        if (!result.ok) {
          boardToast(copyFailureMessage(result), 'error')
          return
        }
        boardToast('Copied to clipboard')
      } catch (error) {
        console.error('Clipboard copy failed', error)
        boardToast('Copy failed', 'error')
      }
    },
    [controller],
  )

  const exportScene = useCallback(
    (options?: BoardExportOptions): void => {
      const ids = options?.selectionOnly ? store.getUiState().selectedIds : null
      const file = createSceneFile(store.getSnapshot(), ids)
      if (!file) {
        boardToast('Nothing to export', 'error')
        return
      }
      const blob = new Blob([stringifySceneFile(file)], { type: SCENE_FILE_MIME })
      downloadBlob(blob, `freedraw.${SCENE_FILE_EXTENSION}`)
      boardToast('Exported as JSON')
    },
    [store],
  )

  const importScene = useCallback(
    async (file: File): Promise<void> => {
      try {
        const scene = parseSceneFile(await file.text())
        if (!scene) {
          boardToast('Not a FreeDraw file', 'error')
          return
        }
        if (scene.version > SCENE_FILE_VERSION) {
          boardToast('This file was made with a newer version of FreeDraw', 'error')
          return
        }
        store.importScene(scene)
        controller?.zoomToFit()
        boardToast(`Imported ${scene.order.length} element${scene.order.length === 1 ? '' : 's'}`)
      } catch (error) {
        console.error('Import failed', error)
        boardToast('Import failed', 'error')
      }
    },
    [controller, store],
  )

  return useMemo(
    () => ({ exportImage, copyImage, exportScene, importScene }),
    [exportImage, copyImage, exportScene, importScene],
  )
}

function exportFailureMessage(failure: ExportFailure): string {
  if (failure.reason === 'empty') return 'Nothing to export'
  if (failure.reason === 'unsupported') return 'Export is not supported in this browser'
  const suggested = Math.floor(failure.size.maxScale)
  if (suggested < 1) return 'Board too large to export — try exporting a selection'
  return `Board too large at ${failure.size.scale}x — try ${suggested}x or lower`
}

type CopyFailure = ExportFailure | { ok: false; reason: 'clipboard-unsupported' }

function copyFailureMessage(failure: CopyFailure): string {
  if (failure.reason === 'clipboard-unsupported') return 'Clipboard not supported'
  return exportFailureMessage(failure)
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

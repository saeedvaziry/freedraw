import { useCallback, useMemo } from 'react'
import type { EditorController, ExportImageOptions } from '@freedraw/engine'
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
}

export function useExport(controller: EditorController | null): BoardExport {
  const exportImage = useCallback(
    async (
      format: ExportFormat,
      transparent: boolean,
      dark: boolean,
      options?: BoardExportOptions,
    ): Promise<void> => {
      if (!controller) return
      try {
        const blob = await controller.exportImage({
          format,
          transparent,
          dark,
          scale: options?.scale,
          selectionOnly: options?.selectionOnly,
        })
        if (!blob) {
          boardToast('Nothing to export', 'error')
          return
        }
        downloadBlob(blob, `freedraw.${EXTENSION[format]}`)
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
        const copied = await controller.copyImageToClipboard({
          scale: options?.scale,
          selectionOnly: options?.selectionOnly,
        })
        if (!copied) {
          boardToast('Clipboard not supported', 'error')
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

  return useMemo(() => ({ exportImage, copyImage }), [exportImage, copyImage])
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

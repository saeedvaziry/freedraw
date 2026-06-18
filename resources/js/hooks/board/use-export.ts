import { useCallback, useMemo } from 'react'
import type { EditorController, ExportImageOptions } from '@freedraw/engine'
import { useToast } from '@/components/board/ui-kit'

type ExportFormat = ExportImageOptions['format']

const EXTENSION: Record<ExportFormat, string> = { png: 'png', jpg: 'jpg' }

export interface BoardExport {
  exportImage(format: ExportFormat, transparent: boolean, dark: boolean): Promise<void>
  copyImage(): Promise<void>
}

export function useExport(controller: EditorController | null): BoardExport {
  const { toast } = useToast()

  const exportImage = useCallback(
    async (format: ExportFormat, transparent: boolean, dark: boolean): Promise<void> => {
      if (!controller) return
      try {
        const blob = await controller.exportImage({ format, transparent, dark })
        if (!blob) {
          toast('Nothing to export', 'error')
          return
        }
        downloadBlob(blob, `freedraw.${EXTENSION[format]}`)
        toast(`Exported as ${format.toUpperCase()}`)
      } catch (error) {
        console.error('Export failed', error)
        toast('Export failed', 'error')
      }
    },
    [controller, toast],
  )

  const copyImage = useCallback(async (): Promise<void> => {
    if (!controller) return
    try {
      const copied = await controller.copyImageToClipboard()
      if (!copied) {
        toast('Clipboard not supported', 'error')
        return
      }
      toast('Copied to clipboard')
    } catch (error) {
      console.error('Clipboard copy failed', error)
      toast('Copy failed', 'error')
    }
  }, [controller, toast])

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

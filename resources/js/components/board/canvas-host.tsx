import { useEffect, useState, type RefObject } from 'react'
import type { EditorController } from '@freedraw/engine'
import { TextEditorOverlay } from './text-editor-overlay.js'

interface CanvasHostProps {
  sceneRef: RefObject<HTMLCanvasElement | null>
  overlayRef: RefObject<HTMLCanvasElement | null>
  controller: EditorController | null
}

export function CanvasHost({ sceneRef, overlayRef, controller }: CanvasHostProps) {
  const [cursor, setCursor] = useState('default')

  useEffect(() => {
    if (!controller?.subscribeCursorStyle) return
    setCursor(controller.activeCursorStyle)
    return controller.subscribeCursorStyle(setCursor)
  }, [controller])

  return (
    <>
      <canvas ref={sceneRef} className="absolute inset-0 block h-full w-full" />
      <canvas
        ref={overlayRef}
        className="absolute inset-0 block h-full w-full touch-none"
        style={{ cursor }}
      />
      {controller && <TextEditorOverlay controller={controller} />}
    </>
  )
}

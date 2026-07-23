import type { RefObject } from 'react'
import type { EditorController } from '@freedraw/engine'
import { TextEditorOverlay } from './text-editor-overlay.js'

interface CanvasHostProps {
  sceneRef: RefObject<HTMLCanvasElement | null>
  overlayRef: RefObject<HTMLCanvasElement | null>
  controller: EditorController | null
}

export function CanvasHost({ sceneRef, overlayRef, controller }: CanvasHostProps) {
  return (
    <>
      <canvas ref={sceneRef} className="absolute inset-0 block h-full w-full" />
      <canvas ref={overlayRef} className="absolute inset-0 block h-full w-full touch-none" />
      {controller && <TextEditorOverlay controller={controller} />}
    </>
  )
}

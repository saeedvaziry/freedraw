import { useEffect, useState, type RefObject } from 'react'
import type { EditorController } from '@freedraw/engine'
import { CanvasA11yLiveRegion } from './canvas-a11y-live-region.js'
import { TextEditorOverlay } from './text-editor-overlay.js'

const CANVAS_HELP_ID = 'board-canvas-keyboard-help'

const CANVAS_KEY_SHORTCUTS = [
  'PageDown',
  'PageUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Shift+ArrowUp',
  'Shift+ArrowDown',
  'Shift+ArrowLeft',
  'Shift+ArrowRight',
  'Escape',
].join(' ')

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
      <canvas ref={sceneRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
      <canvas
        ref={overlayRef}
        tabIndex={0}
        role="application"
        aria-label="Board canvas"
        aria-roledescription="Drawing canvas"
        aria-describedby={CANVAS_HELP_ID}
        aria-keyshortcuts={CANVAS_KEY_SHORTCUTS}
        className="absolute inset-0 block h-full w-full touch-none focus-visible:-outline-offset-2"
        style={{ cursor }}
      />
      <p id={CANVAS_HELP_ID} className="pointer-events-none sr-only">
        Interactive board canvas. Press Page Down or Page Up to step through the elements on the
        board and select them one at a time. Press an arrow key to move the selection by one point,
        Shift with an arrow key to move it by ten points, and Escape to clear the selection.
      </p>
      <CanvasA11yLiveRegion />
      {controller && <TextEditorOverlay controller={controller} />}
    </>
  )
}

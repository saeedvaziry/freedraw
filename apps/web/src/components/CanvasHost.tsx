import { useEffect, useRef, useState } from 'react'
import { EditorController, type SceneStore } from '@freedraw/engine'
import { TextEditorOverlay } from './TextEditorOverlay.js'
import { useImageInsert } from '../hooks/useImageInsert.js'

interface CanvasHostProps {
  store: SceneStore
  onImagePicker?: (openPicker: () => void) => void
  onController?: (controller: EditorController | null) => void
}

export function CanvasHost({ store, onImagePicker, onController }: CanvasHostProps) {
  const sceneRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [controller, setController] = useState<EditorController | null>(null)
  const { openPicker, fileInputRef, onFileInputChange, onDragOver, onDrop } = useImageInsert(
    controller,
    store,
  )

  useEffect(() => {
    const scene = sceneRef.current
    const overlay = overlayRef.current
    if (!scene || !overlay) return

    const instance = new EditorController(store, scene, overlay)
    const cleanup = instance.mount()
    setController(instance)
    return () => {
      cleanup()
      setController(null)
    }
  }, [store])

  useEffect(() => {
    onImagePicker?.(openPicker)
  }, [onImagePicker, openPicker])

  useEffect(() => {
    onController?.(controller)
  }, [onController, controller])

  return (
    <div className="absolute inset-0" onDragOver={onDragOver} onDrop={onDrop}>
      <canvas ref={sceneRef} className="absolute inset-0 block h-full w-full" />
      <canvas
        ref={overlayRef}
        className="absolute inset-0 block h-full w-full touch-none"
      />
      {controller && <TextEditorOverlay controller={controller} />}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileInputChange}
      />
    </div>
  )
}

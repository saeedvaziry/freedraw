import { useEffect, useRef, type ChangeEvent } from 'react'
import { SCENE_FILE_EXTENSION } from '@freedraw/engine'
import { useBoardContext } from './board-context.js'
import { SCENE_IMPORT_EVENT } from './board-actions.js'

export function SceneImportHost() {
  const { boardExport, readOnly } = useBoardContext()
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (readOnly) return
    const openPicker = (): void => fileInput.current?.click()
    window.addEventListener(SCENE_IMPORT_EVENT, openPicker)
    return () => window.removeEventListener(SCENE_IMPORT_EVENT, openPicker)
  }, [readOnly])

  const onChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void boardExport.importScene(file)
  }

  if (readOnly) return null

  return (
    <input
      ref={fileInput}
      type="file"
      accept={`.${SCENE_FILE_EXTENSION},.json,application/json`}
      className="hidden"
      onChange={onChange}
    />
  )
}

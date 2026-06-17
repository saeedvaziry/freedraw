import { useMemo, useState, useSyncExternalStore } from 'react'
import { importDiagram, serializeDiagram, type EditorController, type SceneStore } from '@freedraw/engine'
import { DiagramPanel } from '@freedraw/ui'

const DOCS_HREF = '/docs/diagram.html'

interface DiagramPanelHostProps {
  store: SceneStore
  controller: EditorController | null
  onClose(): void
}

export function DiagramPanelHost({ store, controller, onClose }: DiagramPanelHostProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const snapshot = useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getSnapshot(),
  )
  const report = useMemo(() => serializeDiagram(snapshot), [snapshot])

  const generate = (): void => {
    const origin = controller?.viewportCenter ?? { x: 0, y: 0 }
    const errors = importDiagram(store, code, origin)
    if (errors.length === 0) {
      setError(null)
      return
    }
    const first = errors[0]!
    setError(`Line ${first.line}: ${first.message}`)
  }

  return (
    <DiagramPanel
      code={code}
      generatedCode={report.text}
      error={error}
      skippedCount={report.skipped.length}
      docsHref={DOCS_HREF}
      onChangeCode={setCode}
      onGenerate={generate}
      onUseGenerated={() => setCode(report.text)}
      onClose={onClose}
    />
  )
}

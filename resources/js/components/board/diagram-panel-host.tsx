import { useMemo, useState, useSyncExternalStore } from 'react'
import { importDiagram, serializeDiagram } from '@freedraw/engine'
import { DiagramPanel, useToast } from '@/components/board/ui-kit'
import { useBoardContext } from './board-context.js'

const DOCS_HREF = '/docs/diagram.html'

interface DiagramPanelHostProps {
  onClose(): void
}

export function DiagramPanelHost({ onClose }: DiagramPanelHostProps) {
  const { store, controller } = useBoardContext()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

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

  const copyCode = async (): Promise<void> => {
    if (report.text.length === 0) return
    try {
      await navigator.clipboard.writeText(report.text)
      toast('Copied to clipboard')
    } catch (cause) {
      console.error('Diagram code copy failed', cause)
      toast('Copy failed', 'error')
    }
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
      onCopyCode={copyCode}
      onClose={onClose}
    />
  )
}

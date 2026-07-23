import { BookOpen, Copy, FileInput, Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FloatingPanel } from '../ui/floating-panel.js'
import { IconButton } from '../ui/icon-button.js'

const smallButtonClass = 'size-7 rounded-md text-foreground/70 coarse:size-7'

export interface DiagramPanelProps {
  code: string
  generatedCode: string
  error: string | null
  skippedCount: number
  docsHref?: string
  onChangeCode(code: string): void
  onGenerate(): void
  onUseGenerated(): void
  onCopyCode(): void
  onClose(): void
}

export function DiagramPanel({
  code,
  generatedCode,
  error,
  skippedCount,
  docsHref,
  onChangeCode,
  onGenerate,
  onUseGenerated,
  onCopyCode,
  onClose,
}: DiagramPanelProps) {
  return (
    <FloatingPanel
      orientation="vertical"
      gap={false}
      className="pointer-events-auto max-h-[calc(100vh-3rem)] w-[26rem] max-w-[calc(100vw-3rem)] gap-3 p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Diagram code</span>
        <IconButton
          aria-label="Close diagram code"
          onClick={onClose}
          className="size-7 rounded-md text-foreground/70 coarse:size-7"
        >
          <X />
        </IconButton>
      </div>

      <textarea
        value={code}
        onChange={(event) => onChangeCode(event.target.value)}
        spellCheck={false}
        wrap="soft"
        placeholder={'flowchart TD\nA[Start] --> B[Done]'}
        className="h-44 w-full resize-none whitespace-pre-wrap break-words rounded-lg border bg-background p-2 font-mono text-xs leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Button type="button" size="sm" onClick={onGenerate} className="gap-2">
        <Play className="size-4" />
        Generate diagram
      </Button>

      <div className="flex flex-col gap-2 border-t border-[color:var(--panel-border)] pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground/70">Current diagram</span>
          <div className="flex items-center gap-0.5">
            <IconButton
              aria-label="Copy code"
              title="Copy code"
              onClick={onCopyCode}
              disabled={generatedCode.length === 0}
              className={smallButtonClass}
            >
              <Copy />
            </IconButton>
            <IconButton
              aria-label="Load into editor"
              title="Load into editor"
              onClick={onUseGenerated}
              disabled={generatedCode.length === 0}
              className={smallButtonClass}
            >
              <FileInput />
            </IconButton>
            {docsHref ? (
              <IconButton asChild aria-label="Diagram code docs" className={smallButtonClass}>
                <a
                  href={docsHref}
                  target="_blank"
                  rel="noreferrer"
                  title="Diagram code docs"
                >
                  <BookOpen />
                </a>
              </IconButton>
            ) : null}
          </div>
        </div>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/40 p-2 font-mono text-xs leading-relaxed text-foreground/80">
          {generatedCode.length > 0 ? generatedCode : 'flowchart TD'}
        </pre>
        {skippedCount > 0 ? (
          <p className="text-xs text-foreground/60">
            {skippedCount} element{skippedCount === 1 ? '' : 's'} not represented in code
          </p>
        ) : null}
      </div>
    </FloatingPanel>
  )
}

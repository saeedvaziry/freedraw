import { BookOpen, Copy, FileInput, Play, X } from 'lucide-react'
import { Button } from '../components/ui/button.js'

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
    <div className="pointer-events-auto flex max-h-[calc(100vh-3rem)] w-[26rem] max-w-[calc(100vw-3rem)] flex-col gap-3 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Diagram code</span>
        <button
          type="button"
          aria-label="Close diagram code"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-4"
        >
          <X />
        </button>
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

      <div className="flex flex-col gap-2 border-t pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground/70">Current diagram</span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Copy code"
              title="Copy code"
              onClick={onCopyCode}
              disabled={generatedCode.length === 0}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4"
            >
              <Copy />
            </button>
            <button
              type="button"
              aria-label="Load into editor"
              title="Load into editor"
              onClick={onUseGenerated}
              disabled={generatedCode.length === 0}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4"
            >
              <FileInput />
            </button>
            {docsHref ? (
              <a
                href={docsHref}
                target="_blank"
                rel="noreferrer"
                aria-label="Diagram code docs"
                title="Diagram code docs"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-4"
              >
                <BookOpen />
              </a>
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
    </div>
  )
}

import { Search, X } from 'lucide-react'
import type { BuiltinTemplate, Stencil } from '@freedraw/engine'
import { Input } from '@/components/ui/input'
import type { LibraryStencilGroup } from '@/hooks/board/use-library.js'
import { FloatingPanel } from '../ui/floating-panel.js'
import { IconButton } from '../ui/icon-button.js'
import { StencilTile } from './stencil-tile.js'

export interface LibraryPanelProps {
  query: string
  templates: BuiltinTemplate[]
  stencilGroups: LibraryStencilGroup[]
  userStencils: Stencil[]
  onQueryChange(query: string): void
  onInsert(stencil: Stencil): void
  onRemoveUserStencil(id: string): void
  onClose(): void
}

export function LibraryPanel({
  query,
  templates,
  stencilGroups,
  userStencils,
  onQueryChange,
  onInsert,
  onRemoveUserStencil,
  onClose,
}: LibraryPanelProps) {
  const empty =
    templates.length === 0 && stencilGroups.length === 0 && userStencils.length === 0

  return (
    <FloatingPanel
      orientation="vertical"
      gap={false}
      className="pointer-events-auto max-h-[calc(100vh-3rem)] w-[22rem] max-w-[calc(100vw-3rem)] gap-3 p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Library</span>
        <IconButton
          aria-label="Close library"
          onClick={onClose}
          className="size-7 rounded-md text-foreground/70 coarse:size-7"
        >
          <X />
        </IconButton>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search library"
          spellCheck={false}
          className="h-8 pl-8 text-sm"
        />
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto">
        {empty ? (
          <p className="py-6 text-center text-xs text-foreground/60">No matches</p>
        ) : null}

        {templates.length > 0 ? (
          <Section title="Templates">
            <Grid>
              {templates.map((template) => (
                <StencilTile key={template.id} stencil={template} onInsert={onInsert} />
              ))}
            </Grid>
          </Section>
        ) : null}

        {stencilGroups.map((group) => (
          <Section key={group.category} title={group.label}>
            <Grid>
              {group.stencils.map((stencil) => (
                <StencilTile key={stencil.id} stencil={stencil} onInsert={onInsert} />
              ))}
            </Grid>
          </Section>
        ))}

        {userStencils.length > 0 ? (
          <Section title="Your stencils">
            <Grid>
              {userStencils.map((stencil) => (
                <StencilTile
                  key={stencil.id}
                  stencil={stencil}
                  onInsert={onInsert}
                  onRemove={onRemoveUserStencil}
                />
              ))}
            </Grid>
          </Section>
        ) : null}
      </div>
    </FloatingPanel>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-foreground/70">{title}</h3>
      {children}
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>
}

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Palette, PencilRuler, Shapes, type LucideIcon } from 'lucide-react'
import type { EditorController, SceneStore } from '@freedraw/engine'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
} from '@/components/board/ui-kit'
import { ActionsBarHost } from './actions-bar-host.js'
import { StylePanelHost } from './style-panel-host.js'
import { ToolbarHost } from './toolbar-host.js'
import type { BoardExport } from '@/hooks/board/use-export.js'

type Section = 'tools' | 'style' | 'edit'

interface MobileBarProps {
  store: SceneStore
  controller: EditorController | null
  boardExport: BoardExport
  theme: 'light' | 'dark'
  onToggleTheme(): void
}

export function MobileBar({
  store,
  controller,
  boardExport,
  theme,
  onToggleTheme,
}: MobileBarProps) {
  const [section, setSection] = useState<Section | null>(null)
  const hasSelection = useHasSelection(store)

  useEffect(() => {
    if (!hasSelection) setSection((current) => (current === 'style' ? null : current))
  }, [hasSelection])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border bg-background/95 p-1.5 shadow-lg backdrop-blur">
        <SectionItem
          label="Tools"
          Icon={Shapes}
          value="tools"
          section={section}
          onChange={setSection}
        >
          <ToolbarHost store={store} layout="horizontal" />
        </SectionItem>

        <SectionItem
          label="Style"
          Icon={Palette}
          value="style"
          section={section}
          disabled={!hasSelection}
          onChange={setSection}
        >
          <StylePanelHost store={store} />
        </SectionItem>

        <SectionItem
          label="Edit"
          Icon={PencilRuler}
          value="edit"
          section={section}
          onChange={setSection}
        >
          <ActionsBarHost
            store={store}
            controller={controller}
            boardExport={boardExport}
            theme={theme}
            onToggleTheme={onToggleTheme}
            compact
          />
        </SectionItem>
      </div>
    </TooltipProvider>
  )
}

interface SectionItemProps {
  label: string
  Icon: LucideIcon
  value: Section
  section: Section | null
  disabled?: boolean
  onChange(next: Section | null): void
  children: ReactNode
}

function SectionItem({ label, Icon, value, section, disabled, onChange, children }: SectionItemProps) {
  const open = section === value
  return (
    <Popover open={open} onOpenChange={(next) => onChange(next ? value : null)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={label}
              aria-pressed={open}
              disabled={disabled}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 coarse:h-11 coarse:w-11 [&_svg]:size-4',
                open && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
              )}
            >
              <Icon />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={12}
        className="flex max-h-[60vh] w-auto max-w-[calc(100vw-1.5rem)] items-center justify-center overflow-auto border-none bg-transparent p-0 shadow-none"
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}

function useHasSelection(store: SceneStore): boolean {
  return useSyncExternalStore(
    (cb) => store.subscribeUi(cb),
    () => store.getUiState().selectedIds.size > 0,
  )
}

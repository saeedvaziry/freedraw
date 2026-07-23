import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Palette, PencilRuler, Shapes, type LucideIcon } from 'lucide-react'
import type { SceneStore } from '@freedraw/engine'
import {
  FloatingPanel,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from '@/components/board/ui-kit'
import { useBoardContext } from './board-context.js'
import { ActionsBarHost } from './actions-bar-host.js'
import { StylePanelHost } from './style-panel-host.js'
import { ToolbarHost } from './toolbar-host.js'

type Section = 'tools' | 'style' | 'edit'

export function MobileBar() {
  const { store, controller, boardExport, theme } = useBoardContext()
  const [section, setSection] = useState<Section | null>(null)
  const hasSelection = useHasSelection(store)

  useEffect(() => {
    if (!hasSelection) setSection((current) => (current === 'style' ? null : current))
  }, [hasSelection])

  return (
    <FloatingPanel className="pointer-events-auto">
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
        <StylePanelHost />
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
          compact
        />
      </SectionItem>
    </FloatingPanel>
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
            <IconButton
              aria-label={label}
              aria-pressed={open}
              active={open}
              disabled={disabled}
              className={cn(!open && 'text-foreground/80')}
            >
              <Icon />
            </IconButton>
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

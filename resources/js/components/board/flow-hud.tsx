import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SpawnDirection } from '@freedraw/engine'
import { cn, FloatingPanel } from '@/components/board/ui-kit'

interface DirectionEntry {
  direction: SpawnDirection
  label: string
  Icon: LucideIcon
}

const DIRECTIONS: DirectionEntry[] = [
  { direction: 'up', label: 'Up', Icon: ArrowUp },
  { direction: 'left', label: 'Left', Icon: ArrowLeft },
  { direction: 'down', label: 'Down', Icon: ArrowDown },
  { direction: 'right', label: 'Right', Icon: ArrowRight },
]

export interface FlowHudProps {
  direction: SpawnDirection
  x: number
  y: number
}

export function FlowHud({ direction, x, y }: FlowHudProps) {
  return (
    <FloatingPanel
      data-test="flow-hud"
      gap={false}
      padding={false}
      aria-live="off"
      className="pointer-events-none absolute z-10 hidden max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-2 px-2 py-1.5 text-[0.6875rem] leading-none whitespace-nowrap text-foreground/70 select-none sm:flex"
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      <Hint keys="Tab">child</Hint>
      <Divider />
      <Hint keys="Enter">sibling</Hint>
      <Divider />
      <Hint keys="Shift + Enter">line</Hint>
      <Divider />
      <span className="flex items-center gap-1">
        <Key>Alt</Key>
        <span className="flex items-center gap-0.5">
          {DIRECTIONS.map((entry) => {
            const active = entry.direction === direction
            return (
              <entry.Icon
                key={entry.direction}
                aria-label={entry.label}
                data-test={`flow-hud-direction-${entry.direction}`}
                data-active={active}
                className={cn(
                  'size-3 transition-colors',
                  active
                    ? 'text-[color:var(--selection-accent)]'
                    : 'text-foreground/30 dark:text-foreground/25',
                )}
              />
            )
          })}
        </span>
      </span>
      <Divider />
      <Hint keys="Esc">done</Hint>
    </FloatingPanel>
  )
}

function Hint({ keys, children }: { keys: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      <Key>{keys}</Key>
      {children}
    </span>
  )
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-[color:var(--panel-border)] bg-foreground/5 px-1 py-0.5 font-sans text-[0.625rem] font-medium text-foreground/80 dark:bg-foreground/10">
      {children}
    </kbd>
  )
}

function Divider() {
  return <span aria-hidden className="h-3 w-px bg-[color:var(--panel-border)]" />
}

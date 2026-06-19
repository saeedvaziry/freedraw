import { useState, type ReactNode } from 'react'
import {
  Code2,
  Hand,
  MousePointer2,
  MoveUpRight,
  Pencil,
  Type,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TooltipProvider } from '../ui/tooltip.js'
import { ToolButton } from './tool-button.js'
import { ShapesPopover } from './shapes-popover.js'
import { StickyPopover, type StickyColorKey } from './sticky-popover.js'
import { FEATURED_SHAPES, FEATURED_SHAPE_TYPES, MORE_SHAPES, SHAPES, type ShapeType } from './shapes.js'

export type ToolKey =
  | 'select'
  | 'hand'
  | 'arrow'
  | 'freedraw'
  | 'text'
  | 'sticky'
  | 'image'
  | 'shape'

export type ToolbarLayout = 'vertical' | 'horizontal'

interface ToolDef {
  key: ToolKey
  label: string
  Icon: LucideIcon
  shortcut: string
}

const TOOLS: ToolDef[] = [
  { key: 'select', label: 'Select', Icon: MousePointer2, shortcut: 'V' },
  { key: 'hand', label: 'Hand', Icon: Hand, shortcut: 'H' },
  { key: 'arrow', label: 'Arrow', Icon: MoveUpRight, shortcut: 'A' },
  { key: 'freedraw', label: 'Draw', Icon: Pencil, shortcut: 'B' },
  { key: 'text', label: 'Text', Icon: Type, shortcut: 'T' },
]

const SHAPE_SHORTCUTS: Record<ShapeType, string> = {
  rect: 'R',
  roundRect: 'U',
  ellipse: 'O',
  diamond: 'D',
  triangle: 'G',
  cylinder: 'C',
  hexagon: 'X',
  parallelogram: 'P',
  star: 'S',
  cloud: 'L',
  heart: 'E',
}

export interface ToolbarProps {
  activeTool: ToolKey
  activeShapeType: ShapeType
  activeStickyColor: StickyColorKey
  layout?: ToolbarLayout
  diagramOpen?: boolean
  /** Extra controls rendered inside the toolbar pill, after the diagram button. */
  trailing?: ReactNode
  onSelectTool(tool: ToolKey): void
  onSelectShape(type: ShapeType): void
  onSelectStickyColor(color: StickyColorKey): void
  onToggleDiagram?(): void
}

export function Toolbar({
  activeTool,
  activeShapeType,
  activeStickyColor,
  layout = 'vertical',
  diagramOpen = false,
  trailing,
  onSelectTool,
  onSelectShape,
  onSelectStickyColor,
  onToggleDiagram,
}: ToolbarProps) {
  const [stickyOpen, setStickyOpen] = useState(false)
  const [shapesOpen, setShapesOpen] = useState(false)
  const horizontal = layout === 'horizontal'

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'pointer-events-auto rounded-2xl border bg-background/95 p-1.5 shadow-lg backdrop-blur',
          horizontal
            ? 'flex max-w-full items-center gap-1 overflow-x-auto'
            : 'grid max-h-[calc(100vh-3rem)] grid-cols-2 gap-1 overflow-y-auto',
        )}
      >
        {TOOLS.map(({ key, label, Icon, shortcut }) => (
          <ToolButton
            key={key}
            label={label}
            shortcut={shortcut}
            active={activeTool === key}
            onClick={() => onSelectTool(key)}
          >
            <Icon />
          </ToolButton>
        ))}
        <StickyPopover
          open={stickyOpen}
          onOpenChange={setStickyOpen}
          side={horizontal ? 'top' : 'right'}
          active={activeTool === 'sticky'}
          activeColor={activeStickyColor}
          onSelectColor={(color) => {
            onSelectStickyColor(color)
            setStickyOpen(false)
          }}
        />
        <Divider horizontal={horizontal} />
        {horizontal ? (
          <>
            {FEATURED_SHAPES.map(({ type, label, Icon }) => (
              <ToolButton
                key={type}
                label={label}
                shortcut={SHAPE_SHORTCUTS[type]}
                active={activeTool === 'shape' && activeShapeType === type}
                onClick={() => onSelectShape(type)}
              >
                <Icon />
              </ToolButton>
            ))}
            <ShapesPopover
              open={shapesOpen}
              onOpenChange={setShapesOpen}
              shapes={MORE_SHAPES}
              activeShapeType={activeShapeType}
              shapeToolActive={
                activeTool === 'shape' && !FEATURED_SHAPE_TYPES.includes(activeShapeType)
              }
              onSelectShape={(type) => {
                onSelectShape(type)
                setShapesOpen(false)
              }}
            />
          </>
        ) : (
          SHAPES.map(({ type, label, Icon }) => (
            <ToolButton
              key={type}
              label={label}
              shortcut={SHAPE_SHORTCUTS[type]}
              active={activeTool === 'shape' && activeShapeType === type}
              onClick={() => onSelectShape(type)}
            >
              <Icon />
            </ToolButton>
          ))
        )}
        {onToggleDiagram ? (
          <>
            <Divider horizontal={horizontal} />
            <ToolButton label="Diagram code" active={diagramOpen} onClick={onToggleDiagram}>
              <Code2 />
            </ToolButton>
          </>
        ) : null}
        {trailing ? (
          <>
            <Divider horizontal={horizontal} />
            {trailing}
          </>
        ) : null}
      </div>
    </TooltipProvider>
  )
}

function Divider({ horizontal }: { horizontal: boolean }) {
  if (horizontal) return <div className="mx-0.5 h-7 w-px shrink-0 bg-border" />
  return <div className="col-span-2 my-1 h-px bg-border" />
}

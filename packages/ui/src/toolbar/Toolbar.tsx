import { useState } from 'react'
import {
  Hand,
  MousePointer2,
  MoveUpRight,
  Pencil,
  Type,
  type LucideIcon,
} from 'lucide-react'
import { TooltipProvider } from '../components/ui/tooltip.js'
import { ToolButton } from './ToolButton.js'
import { StickyPopover, type StickyColorKey } from './StickyPopover.js'
import { SHAPES, type ShapeType } from './shapes.js'

export type ToolKey =
  | 'select'
  | 'hand'
  | 'arrow'
  | 'freedraw'
  | 'text'
  | 'sticky'
  | 'image'
  | 'shape'

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
  onSelectTool(tool: ToolKey): void
  onSelectShape(type: ShapeType): void
  onSelectStickyColor(color: StickyColorKey): void
}

export function Toolbar({
  activeTool,
  activeShapeType,
  activeStickyColor,
  onSelectTool,
  onSelectShape,
  onSelectStickyColor,
}: ToolbarProps) {
  const [stickyOpen, setStickyOpen] = useState(false)
  return (
    <TooltipProvider delayDuration={300}>
      <div className="pointer-events-auto grid max-h-[calc(100vh-3rem)] grid-cols-2 gap-1 overflow-y-auto rounded-2xl border bg-background/95 p-1.5 shadow-lg backdrop-blur">
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
          active={activeTool === 'sticky'}
          activeColor={activeStickyColor}
          onSelectColor={(color) => {
            onSelectStickyColor(color)
            setStickyOpen(false)
          }}
        />
        <div className="col-span-2 my-1 h-px bg-border" />
        {SHAPES.map(({ type, label, Icon }) => (
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
      </div>
    </TooltipProvider>
  )
}

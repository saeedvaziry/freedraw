import * as React from 'react'
import {
  Hand,
  Image as ImageIcon,
  MousePointer2,
  MoveUpRight,
  StickyNote,
  Type,
  type LucideIcon,
} from 'lucide-react'
import { TooltipProvider } from '../components/ui/tooltip.js'
import { ToolButton } from './ToolButton.js'
import { ShapesPopover } from './ShapesPopover.js'
import type { ShapeType } from './shapes.js'

export type ToolKey =
  | 'select'
  | 'hand'
  | 'arrow'
  | 'text'
  | 'sticky'
  | 'image'
  | 'shape'

interface ToolDef {
  key: ToolKey
  label: string
  Icon: LucideIcon
}

const TOOLS: ToolDef[] = [
  { key: 'select', label: 'Select', Icon: MousePointer2 },
  { key: 'hand', label: 'Hand', Icon: Hand },
  { key: 'arrow', label: 'Arrow', Icon: MoveUpRight },
  { key: 'text', label: 'Text', Icon: Type },
  { key: 'sticky', label: 'Sticky note', Icon: StickyNote },
  { key: 'image', label: 'Image', Icon: ImageIcon },
]

export interface ToolbarProps {
  activeTool: ToolKey
  activeShapeType: ShapeType
  onSelectTool(tool: ToolKey): void
  onSelectShape(type: ShapeType): void
}

export function Toolbar({
  activeTool,
  activeShapeType,
  onSelectTool,
  onSelectShape,
}: ToolbarProps) {
  const [shapesOpen, setShapesOpen] = React.useState(false)

  const handleSelectShape = (type: ShapeType): void => {
    onSelectShape(type)
    setShapesOpen(false)
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border bg-background/95 p-1.5 shadow-lg backdrop-blur">
        {TOOLS.map(({ key, label, Icon }) => (
          <ToolButton
            key={key}
            label={label}
            active={activeTool === key}
            onClick={() => onSelectTool(key)}
          >
            <Icon />
          </ToolButton>
        ))}
        <div className="mx-1 h-7 w-px bg-border" />
        <ShapesPopover
          open={shapesOpen}
          onOpenChange={setShapesOpen}
          activeShapeType={activeShapeType}
          shapeToolActive={activeTool === 'shape'}
          onSelectShape={handleSelectShape}
        />
      </div>
    </TooltipProvider>
  )
}

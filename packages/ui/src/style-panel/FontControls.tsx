import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'
import { ColorPicker } from './ColorPicker.js'
import { SegmentedControl, SliderControl } from './controls.js'
import {
  type PanelStyle,
  type PanelStylePatch,
  type TextAlign,
  pickValue,
  resolveNumber,
  resolveString,
} from './types.js'

const FONT_FAMILIES = [
  { value: 'Inter, system-ui, sans-serif', label: 'Sans' },
  { value: 'Georgia, serif', label: 'Serif' },
  { value: 'ui-monospace, monospace', label: 'Mono' },
]

const ALIGNMENTS = [
  { value: 'left' as TextAlign, label: 'Align left', Icon: AlignLeft },
  { value: 'center' as TextAlign, label: 'Align center', Icon: AlignCenter },
  { value: 'right' as TextAlign, label: 'Align right', Icon: AlignRight },
]

export interface FontControlsProps {
  style: PanelStyle
  onChange(patch: PanelStylePatch): void
  onInteractStart(): void
  onInteractEnd(): void
}

export function FontControls({ style, onChange, onInteractStart, onInteractEnd }: FontControlsProps) {
  const family = resolveString(style.fontFamily, FONT_FAMILIES[0]!.value)

  return (
    <div className="flex flex-col gap-3">
      <ColorPicker
        label="Text"
        value={resolveString(style.textColor, '#1e1e1e')}
        onChange={(textColor) => onChange({ textColor })}
      />
      <SliderControl
        label="Font size"
        value={resolveNumber(style.fontSize, 16)}
        min={8}
        max={72}
        onChange={(fontSize) => onChange({ fontSize })}
        onInteractStart={onInteractStart}
        onInteractEnd={onInteractEnd}
      />
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-foreground/70">Font family</span>
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
          {FONT_FAMILIES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-label={option.label}
              aria-pressed={family === option.value}
              onClick={() => onChange({ fontFamily: option.value })}
              className={
                'h-7 flex-1 rounded-md px-2 text-xs font-medium text-foreground/70 transition-colors hover:bg-accent ' +
                (family === option.value ? 'bg-background text-foreground shadow-sm' : '')
              }
              style={{ fontFamily: option.value }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <SegmentedControl
        label="Text align"
        value={pickValue(style.textAlign)}
        options={ALIGNMENTS}
        onChange={(textAlign) => onChange({ textAlign })}
      />
    </div>
  )
}

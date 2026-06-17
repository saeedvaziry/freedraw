import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'
import { ColorPicker } from './color-picker.js'
import { SegmentedControl, SliderControl } from './controls.js'
import {
  type PanelStyle,
  type PanelStylePatch,
  type TextAlign,
  isMixed,
  pickValue,
  resolveNumber,
  resolveString,
} from './types.js'

type FontFamily = (typeof FONT_FAMILIES)[number]['value']

const FONT_FAMILIES = [
  { value: 'Inter, system-ui, sans-serif', label: 'Sans', fontFamily: 'Inter, system-ui, sans-serif' },
  { value: 'Georgia, serif', label: 'Serif', fontFamily: 'Georgia, serif' },
  { value: 'ui-monospace, monospace', label: 'Mono', fontFamily: 'ui-monospace, monospace' },
  { value: "'Architects Daughter', cursive", label: 'Hand', fontFamily: "'Architects Daughter', cursive" },
] as const

const ALIGNMENTS = [
  { value: 'left' as TextAlign, label: 'Align left', Icon: AlignLeft },
  { value: 'center' as TextAlign, label: 'Align center', Icon: AlignCenter },
  { value: 'right' as TextAlign, label: 'Align right', Icon: AlignRight },
]

const px = (value: number) => `${value}px`

export interface FontControlsProps {
  style: PanelStyle
  onChange(patch: PanelStylePatch): void
  onInteractStart(): void
  onInteractEnd(): void
}

function toFontFamily(value: string): FontFamily | null {
  return FONT_FAMILIES.find((option) => option.value === value)?.value ?? null
}

export function FontControls({ style, onChange, onInteractStart, onInteractEnd }: FontControlsProps) {
  const family = isMixed(style.fontFamily)
    ? null
    : toFontFamily(resolveString(style.fontFamily, FONT_FAMILIES[0].value))

  return (
    <div className="flex flex-col gap-3">
      <ColorPicker
        label="Text"
        value={resolveString(style.textColor, '#1e1e1e')}
        mixed={isMixed(style.textColor)}
        onChange={(textColor) => onChange({ textColor })}
      />
      <SliderControl
        label="Font size"
        value={resolveNumber(style.fontSize, 16)}
        mixed={isMixed(style.fontSize)}
        format={px}
        min={8}
        max={72}
        onChange={(fontSize) => onChange({ fontSize })}
        onInteractStart={onInteractStart}
        onInteractEnd={onInteractEnd}
      />
      <SegmentedControl
        label="Font family"
        value={family}
        options={[...FONT_FAMILIES]}
        onChange={(fontFamily) => onChange({ fontFamily })}
      />
      <SegmentedControl
        label="Text align"
        value={pickValue(style.textAlign)}
        options={ALIGNMENTS}
        onChange={(textAlign) => onChange({ textAlign })}
      />
    </div>
  )
}

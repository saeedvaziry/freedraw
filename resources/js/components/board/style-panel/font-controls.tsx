import { AlignCenter, AlignLeft, AlignRight, Bold, Italic } from 'lucide-react'
import { ColorPicker } from './color-picker.js'
import { FieldLabel, SegmentedControl, SliderControl, ToggleControl } from './controls.js'
import {
  type FontStyle,
  type PanelPalette,
  type PanelStyle,
  type PanelStylePatch,
  type TextAlign,
  FONT_WEIGHT_BOLD,
  FONT_WEIGHT_NORMAL,
  isBoldWeight,
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
  palette?: PanelPalette
  onChange(patch: PanelStylePatch): void
  onInteractStart(): void
  onInteractEnd(): void
}

function toFontFamily(value: string): FontFamily | null {
  return FONT_FAMILIES.find((option) => option.value === value)?.value ?? null
}

export function FontControls({
  style,
  palette,
  onChange,
  onInteractStart,
  onInteractEnd,
}: FontControlsProps) {
  const family = isMixed(style.fontFamily)
    ? null
    : toFontFamily(resolveString(style.fontFamily, FONT_FAMILIES[0].value))
  const bold = isBoldWeight(style.fontWeight)
  const italic = pickValue<FontStyle>(style.fontStyle) === 'italic'

  return (
    <div className="flex flex-col gap-3">
      <ColorPicker
        label="Text"
        value={resolveString(style.textColor, '#1e1e1e')}
        mixed={isMixed(style.textColor)}
        palette={palette}
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
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Emphasis</FieldLabel>
        <div className="flex items-center gap-1.5">
          <ToggleControl
            label="Bold"
            Icon={Bold}
            pressed={bold}
            mixed={isMixed(style.fontWeight)}
            onChange={(next) =>
              onChange({ fontWeight: next ? FONT_WEIGHT_BOLD : FONT_WEIGHT_NORMAL })
            }
          />
          <ToggleControl
            label="Italic"
            Icon={Italic}
            pressed={italic}
            mixed={isMixed(style.fontStyle)}
            onChange={(next) => onChange({ fontStyle: next ? 'italic' : 'normal' })}
          />
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

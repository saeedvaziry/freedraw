import { Minus } from 'lucide-react'
import { ColorPicker } from './ColorPicker.js'
import { SegmentedControl, SliderControl } from './controls.js'
import { DashedLineIcon, DottedLineIcon } from './icons.js'
import {
  type PanelStyle,
  type PanelStylePatch,
  type StrokeStyle,
  pickValue,
  resolveNumber,
  resolveString,
} from './types.js'

const STROKE_STYLES = [
  { value: 'solid' as StrokeStyle, label: 'Solid', Icon: Minus },
  { value: 'dashed' as StrokeStyle, label: 'Dashed', Icon: DashedLineIcon },
  { value: 'dotted' as StrokeStyle, label: 'Dotted', Icon: DottedLineIcon },
]

export interface StrokeControlsProps {
  style: PanelStyle
  showFill: boolean
  showRoundness: boolean
  onChange(patch: PanelStylePatch): void
  onInteractStart(): void
  onInteractEnd(): void
}

export function StrokeControls({
  style,
  showFill,
  showRoundness,
  onChange,
  onInteractStart,
  onInteractEnd,
}: StrokeControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <ColorPicker
        label="Stroke"
        value={resolveString(style.stroke, '#1e1e1e')}
        onChange={(stroke) => onChange({ stroke })}
      />
      {showFill && (
        <ColorPicker
          label="Fill"
          value={resolveString(style.fill, 'transparent')}
          allowTransparent
          onChange={(fill) => onChange({ fill })}
        />
      )}
      <SegmentedControl
        label="Stroke style"
        value={pickValue(style.strokeStyle)}
        options={STROKE_STYLES}
        onChange={(strokeStyle) => onChange({ strokeStyle })}
      />
      <SliderControl
        label="Stroke width"
        value={resolveNumber(style.strokeWidth, 2)}
        min={1}
        max={20}
        onChange={(strokeWidth) => onChange({ strokeWidth })}
        onInteractStart={onInteractStart}
        onInteractEnd={onInteractEnd}
      />
      <SliderControl
        label="Opacity"
        value={resolveNumber(style.opacity, 1)}
        min={0}
        max={1}
        step={0.05}
        onChange={(opacity) => onChange({ opacity })}
        onInteractStart={onInteractStart}
        onInteractEnd={onInteractEnd}
      />
      {showRoundness && (
        <SliderControl
          label="Roundness"
          value={resolveNumber(style.roundness, 0)}
          min={0}
          max={64}
          onChange={(roundness) => onChange({ roundness })}
          onInteractStart={onInteractStart}
          onInteractEnd={onInteractEnd}
        />
      )}
    </div>
  )
}

import { SegmentedControl } from './controls.js'
import {
  ArrowheadBarIcon,
  ArrowheadDotIcon,
  ArrowheadNoneIcon,
  ArrowheadTriangleIcon,
} from './icons.js'
import { type ArrowPanelPatch, type ArrowPanelState, type Arrowhead, pickValue } from './types.js'

const HEADS = [
  { value: 'none' as Arrowhead, label: 'None', Icon: ArrowheadNoneIcon },
  { value: 'triangle' as Arrowhead, label: 'Triangle', Icon: ArrowheadTriangleIcon },
  { value: 'dot' as Arrowhead, label: 'Dot', Icon: ArrowheadDotIcon },
  { value: 'bar' as Arrowhead, label: 'Bar', Icon: ArrowheadBarIcon },
]

export interface ArrowControlsProps {
  arrow: ArrowPanelState
  onChange(patch: ArrowPanelPatch): void
}

export function ArrowControls({ arrow, onChange }: ArrowControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        label="Start head"
        value={pickValue(arrow.startArrowhead)}
        options={HEADS}
        onChange={(startArrowhead) => onChange({ startArrowhead })}
      />
      <SegmentedControl
        label="End head"
        value={pickValue(arrow.endArrowhead)}
        options={HEADS}
        onChange={(endArrowhead) => onChange({ endArrowhead })}
      />
    </div>
  )
}

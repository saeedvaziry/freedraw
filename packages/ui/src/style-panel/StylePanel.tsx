import { ArrowControls } from './ArrowControls.js'
import { FontControls } from './FontControls.js'
import { StrokeControls } from './StrokeControls.js'
import type { ArrowPanelPatch, ArrowPanelState, PanelStyle, PanelStylePatch } from './types.js'

export interface StylePanelSelection {
  hasShape: boolean
  hasFill: boolean
  hasRoundness: boolean
  hasText: boolean
  hasArrow: boolean
}

export interface StylePanelProps {
  selection: StylePanelSelection
  style: PanelStyle
  arrow: ArrowPanelState
  onStyleChange(patch: PanelStylePatch): void
  onArrowChange(patch: ArrowPanelPatch): void
  onInteractStart(): void
  onInteractEnd(): void
}

export function StylePanel({
  selection,
  style,
  arrow,
  onStyleChange,
  onArrowChange,
  onInteractStart,
  onInteractEnd,
}: StylePanelProps) {
  return (
    <div className="pointer-events-auto flex w-60 flex-col gap-4 rounded-2xl border bg-background/95 p-4 shadow-lg backdrop-blur">
      <StrokeControls
        style={style}
        showFill={selection.hasFill}
        showRoundness={selection.hasRoundness}
        onChange={onStyleChange}
        onInteractStart={onInteractStart}
        onInteractEnd={onInteractEnd}
      />
      {selection.hasArrow && (
        <>
          <Divider />
          <ArrowControls arrow={arrow} onChange={onArrowChange} />
        </>
      )}
      {selection.hasText && (
        <>
          <Divider />
          <FontControls
            style={style}
            onChange={onStyleChange}
            onInteractStart={onInteractStart}
            onInteractEnd={onInteractEnd}
          />
        </>
      )}
    </div>
  )
}

function Divider() {
  return <div className="h-px w-full bg-border" />
}

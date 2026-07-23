import type { ReactNode } from 'react'
import { ArrowControls } from './arrow-controls.js'
import { FontControls } from './font-controls.js'
import { StrokeControls } from './stroke-controls.js'
import { FloatingPanel } from '../ui/floating-panel.js'
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
  /** Optional pinned header row rendered above the (scrolling) controls. */
  header?: ReactNode
}

export function StylePanel({
  selection,
  style,
  arrow,
  onStyleChange,
  onArrowChange,
  onInteractStart,
  onInteractEnd,
  header,
}: StylePanelProps) {
  return (
    <FloatingPanel
      orientation="vertical"
      padding={false}
      gap={false}
      className="pointer-events-auto max-h-[50vh] w-full max-w-sm sm:max-h-[calc(100vh-3rem)] sm:w-64"
    >
      {header ? (
        <div className="shrink-0 border-b border-[color:var(--panel-border)] px-2 py-1.5">
          {header}
        </div>
      ) : null}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
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
    </FloatingPanel>
  )
}

function Divider() {
  return <div className="h-px w-full bg-[color:var(--panel-border)]" />
}

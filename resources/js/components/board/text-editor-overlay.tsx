import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  invertColor,
  type EditorController,
  type EditRequest,
  type ElementId,
  type SpawnDirection,
} from '@freedraw/engine'
import { Button } from '@/components/ui/button'
import { FlowHud } from './flow-hud.js'

const ARROW_LABEL_BACKGROUND = '#fafafa'

const DEFAULT_SPAWN_DIRECTION: SpawnDirection = 'right'

const HUD_GAP = 10
const HUD_MARGIN = 12
const HUD_HALF_WIDTH = 170
const HUD_HEIGHT = 26

const FLOW_DIRECTIONS: Record<string, SpawnDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

function themed(color: string, dark: boolean): string {
  return dark ? invertColor(color) : color
}

interface TextEditorOverlayProps {
  controller: EditorController
}

interface ActiveEdit {
  request: EditRequest
  value: string
}

const TEXT_PADDING = 6
const LINE_RATIO = 1.25
const MOBILE_EDITOR_MARGIN = 12
const MOBILE_DONE_HEIGHT = 44
const MOBILE_DONE_GAP = 8

interface ViewportRect {
  left: number
  top: number
  width: number
  height: number
}

export function TextEditorOverlay({ controller }: TextEditorOverlayProps) {
  const [edit, setEdit] = useState<ActiveEdit | null>(null)
  const [spawnDirection, setSpawnDirection] = useState<SpawnDirection>(DEFAULT_SPAWN_DIRECTION)
  const coarsePointer = useCoarsePointer()
  const viewport = useVisualViewport(coarsePointer && edit !== null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const committedRef = useRef(false)
  const readyRef = useRef(false)
  const editKey = edit ? `${edit.request.elementId}:${edit.request.target}` : null

  useEffect(() => {
    return controller.subscribeEdit((request) => {
      committedRef.current = false
      readyRef.current = false
      setEdit(request ? { request, value: request.text } : null)
    })
  }, [controller])

  useLayoutEffect(() => {
    if (!editKey) return
    let frame = 0
    const focusAndArm = (): void => {
      const textarea = textareaRef.current
      if (!textarea) return
      textarea.focus()
      if (edit?.request.selectAll === false) {
        const end = textarea.value.length
        textarea.setSelectionRange(end, end)
      } else {
        textarea.select()
      }
      frame = requestAnimationFrame(() => {
        readyRef.current = true
      })
    }
    focusAndArm()
    return () => cancelAnimationFrame(frame)
  }, [editKey])

  useLayoutEffect(() => {
    if (!edit) return
    const flow = controller.flowContext
    setSpawnDirection(
      flow?.editingId === edit.request.elementId ? flow.direction : DEFAULT_SPAWN_DIRECTION,
    )
  }, [controller, editKey])

  if (!edit) return null

  const commit = (): void => {
    if (committedRef.current) return
    committedRef.current = true
    controller.commitText(edit.request.elementId, edit.request.target, edit.value)
  }

  const cancel = (): void => {
    if (committedRef.current) return
    committedRef.current = true
    controller.cancelEdit()
  }

  const isFlowEdit = (): boolean =>
    controller.flowContext?.editingId === edit.request.elementId

  const abandonedPlaceholderId = (): ElementId | null => {
    if (committedRef.current || !isFlowEdit()) return null
    return edit.value.trim().length === 0 ? edit.request.elementId : null
  }

  const onBlur = (): void => {
    if (coarsePointer) {
      requestAnimationFrame(() => {
        if (!committedRef.current) textareaRef.current?.focus()
      })
      return
    }
    if (!readyRef.current) {
      requestAnimationFrame(() => textareaRef.current?.focus())
      return
    }
    const placeholderId = abandonedPlaceholderId()
    commit()
    if (placeholderId) controller.deleteFlowPlaceholder(placeholderId)
  }

  const finish = (): void => {
    const placeholderId = abandonedPlaceholderId()
    commit()
    if (placeholderId) controller.deleteFlowPlaceholder(placeholderId)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      const placeholderId = abandonedPlaceholderId()
      cancel()
      if (placeholderId) controller.deleteFlowPlaceholder(placeholderId)
      return
    }
    const flowDirection = event.altKey ? FLOW_DIRECTIONS[event.key] : undefined
    if (flowDirection) {
      event.preventDefault()
      setSpawnDirection(flowDirection)
      controller.setFlowDirection(flowDirection)
      return
    }
    if (event.key === 'Tab' && !event.metaKey && !event.ctrlKey) {
      event.preventDefault()
      const sourceId = edit.request.elementId
      commit()
      controller.spawnChildAndEdit(sourceId, spawnDirection)
      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (isFlowEdit()) {
        const childId = edit.request.elementId
        commit()
        controller.spawnSiblingAndEdit(childId)
        return
      }
      commit()
    }
  }

  const hudAnchor = flowHudAnchor(controller, edit.request)
  const style = editorStyle(controller, edit.request, edit.value)
  const mobileStyle = coarsePointer ? clampEditorStyle(style, viewport) : style

  return (
    <>
      <textarea
        ref={textareaRef}
        className="pointer-events-auto absolute resize-none overflow-hidden border-none bg-transparent p-0 leading-none outline-none coarse:overflow-auto"
        style={mobileStyle}
        value={edit.value}
        onChange={(event) => {
          const value = event.target.value
          if (edit.request.target === 'text') {
            controller.resizeTextWhileEditing(edit.request.elementId, value)
          } else if (edit.request.target === 'label') {
            controller.resizeShapeForLabel(edit.request.elementId, value)
          }
          setEdit({ request: controller.activeEdit ?? edit.request, value })
        }}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        spellCheck={false}
      />
      {coarsePointer ? (
        <Button
          type="button"
          data-test="text-editor-done"
          className="pointer-events-auto absolute z-20 h-11 min-w-24 shadow-lg"
          style={{
            left: `${viewport.left + viewport.width / 2}px`,
            top: `${viewport.top + viewport.height - MOBILE_EDITOR_MARGIN}px`,
            transform: 'translate(-50%, -100%)',
          }}
          onPointerDown={(event) => event.preventDefault()}
          onClick={finish}
        >
          Done
        </Button>
      ) : null}
      {hudAnchor ? (
        <FlowHud direction={spawnDirection} x={hudAnchor.x} y={hudAnchor.y} />
      ) : null}
    </>
  )
}

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(pointer: coarse)').matches
  })

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(pointer: coarse)')
    const update = (): void => setCoarse(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return coarse
}

function readVisualViewport(): ViewportRect {
  if (typeof window === 'undefined') return { left: 0, top: 0, width: 0, height: 0 }
  const current = window.visualViewport
  if (!current) {
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
  }
  return {
    left: current.offsetLeft,
    top: current.offsetTop,
    width: current.width,
    height: current.height,
  }
}

function useVisualViewport(active: boolean): ViewportRect {
  const [viewport, setViewport] = useState(readVisualViewport)

  useEffect(() => {
    if (!active) return
    const current = window.visualViewport
    const update = (): void => setViewport(readVisualViewport())
    update()
    if (!current) {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    current.addEventListener('resize', update)
    current.addEventListener('scroll', update)
    return () => {
      current.removeEventListener('resize', update)
      current.removeEventListener('scroll', update)
    }
  }, [active])

  return viewport
}

function clampEditorStyle(style: React.CSSProperties, viewport: ViewportRect): React.CSSProperties {
  const rawLeft = numericStyle(style.left)
  const rawTop = numericStyle(style.top)
  const rawWidth = numericStyle(style.width)
  const rawHeight = numericStyle(style.height)
  if (rawLeft === null || rawTop === null || rawWidth === null || rawHeight === null) return style

  const minLeft = viewport.left + MOBILE_EDITOR_MARGIN
  const minTop = viewport.top + MOBILE_EDITOR_MARGIN
  const maxRight = viewport.left + viewport.width - MOBILE_EDITOR_MARGIN
  const maxBottom =
    viewport.top +
    viewport.height -
    MOBILE_EDITOR_MARGIN -
    MOBILE_DONE_HEIGHT -
    MOBILE_DONE_GAP
  const width = Math.min(rawWidth, Math.max(MOBILE_DONE_HEIGHT, maxRight - minLeft))
  const height = Math.min(rawHeight, Math.max(MOBILE_DONE_HEIGHT, maxBottom - minTop))
  const centered = style.transform === 'translate(-50%, -50%)'
  const currentLeft = centered ? rawLeft - width / 2 : rawLeft
  const currentTop = centered ? rawTop - height / 2 : rawTop
  const maxLeft = Math.max(minLeft, maxRight - width)
  const maxTop = Math.max(minTop, maxBottom - height)
  const nextLeft = Math.min(Math.max(currentLeft, minLeft), maxLeft)
  const nextTop = Math.min(Math.max(currentTop, minTop), maxTop)

  return {
    ...style,
    left: `${centered ? nextLeft + width / 2 : nextLeft}px`,
    top: `${centered ? nextTop + height / 2 : nextTop}px`,
    width: `${width}px`,
    height: `${height}px`,
  }
}

function numericStyle(value: React.CSSProperties['left']): number | null {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function flowHudAnchor(
  controller: EditorController,
  request: EditRequest,
): { x: number; y: number } | null {
  if (controller.isReadOnly) return null
  if (request.target !== 'label' || request.labelKind === 'arrow') return null
  const { world } = request
  if (world.width === 0) return null

  const viewport = controller.viewportSize
  const below = controller.worldToScreen({
    x: world.x + world.width / 2,
    y: world.y + world.height,
  })
  const above = controller.worldToScreen({ x: world.x + world.width / 2, y: world.y })

  const minX = Math.min(HUD_HALF_WIDTH + HUD_MARGIN, viewport.width / 2)
  const maxX = Math.max(viewport.width - HUD_HALF_WIDTH - HUD_MARGIN, viewport.width / 2)
  const overflowsBottom = below.y + HUD_GAP + HUD_HEIGHT > viewport.height - HUD_MARGIN
  const y = overflowsBottom ? above.y - HUD_GAP - HUD_HEIGHT : below.y + HUD_GAP

  return {
    x: Math.min(Math.max(below.x, minX), maxX),
    y: Math.max(y, HUD_MARGIN),
  }
}

function editorStyle(
  controller: EditorController,
  request: EditRequest,
  value: string,
): React.CSSProperties {
  const zoom = controller.zoom
  const { style, world, target } = request
  const lineHeight = style.fontSize * LINE_RATIO

  if (target === 'text') {
    const size = controller.measureTextSize(value, style)
    const center =
      controller.elementCenterScreen(request.elementId) ??
      controller.worldToScreen({
        x: world.x + world.width / 2,
        y: world.y + world.height / 2,
      })
    return {
      ...baseStyle(style, zoom, controller.isDark),
      left: `${center.x}px`,
      top: `${center.y}px`,
      width: `${size.width * zoom}px`,
      height: `${size.height * zoom}px`,
      transform: 'translate(-50%, -50%)',
      textAlign: 'center',
      background: 'transparent',
      whiteSpace: 'pre',
    }
  }

  if (target === 'label' && request.labelKind === 'arrow') {
    const screen = controller.worldToScreen({ x: world.x, y: world.y })
    return {
      ...baseStyle(style, zoom, controller.isDark),
      left: `${screen.x}px`,
      top: `${screen.y}px`,
      width: `${world.width * zoom}px`,
      height: `${world.height * zoom}px`,
      textAlign: 'center',
      background: themed(ARROW_LABEL_BACKGROUND, controller.isDark),
      whiteSpace: 'pre',
    }
  }

  if (target === 'label' && world.width === 0) {
    const size = controller.measureTextSize(value, style)
    const width = Math.max(120, size.width) * zoom
    const height = Math.max(lineHeight, size.height) * zoom
    const screen = controller.worldToScreen({ x: world.x, y: world.y })
    return {
      ...baseStyle(style, zoom, controller.isDark),
      left: `${screen.x - width / 2}px`,
      top: `${screen.y - height / 2}px`,
      width: `${width}px`,
      height: `${height}px`,
      textAlign: 'center',
      background: themed(ARROW_LABEL_BACKGROUND, controller.isDark),
      whiteSpace: 'pre-wrap',
    }
  }

  const innerWidth = Math.max(world.width - TEXT_PADDING * 2, 24)
  const lineCount = Math.max(1, value.split('\n').length)
  const textHeight = lineCount * lineHeight
  const boxHeight = Math.max(world.height, textHeight)
  const offsetY = request.verticalAlign !== 'top' ? (boxHeight - textHeight) / 2 : 0
  const screen = controller.worldToScreen({ x: world.x + TEXT_PADDING, y: world.y })

  return {
    ...baseStyle(style, zoom, controller.isDark),
    left: `${screen.x}px`,
    top: `${screen.y + offsetY * zoom}px`,
    width: `${innerWidth * zoom}px`,
    height: `${textHeight * zoom}px`,
    textAlign: request.align,
    background: 'transparent',
    whiteSpace: 'pre',
  }
}

function baseStyle(style: EditRequest['style'], zoom: number, dark: boolean): React.CSSProperties {
  const lineHeight = style.fontSize * LINE_RATIO
  return {
    fontSize: `${style.fontSize * zoom}px`,
    lineHeight: `${lineHeight * zoom}px`,
    fontFamily: style.fontFamily,
    color: themed(style.textColor, dark),
    caretColor: themed(style.textColor, dark),
  }
}

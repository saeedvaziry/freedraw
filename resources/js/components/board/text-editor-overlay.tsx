import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  invertColor,
  type EditorController,
  type EditRequest,
  type ElementId,
  type SpawnDirection,
} from '@freedraw/engine'
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

export function TextEditorOverlay({ controller }: TextEditorOverlayProps) {
  const [edit, setEdit] = useState<ActiveEdit | null>(null)
  const [spawnDirection, setSpawnDirection] = useState<SpawnDirection>(DEFAULT_SPAWN_DIRECTION)
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
    if (!readyRef.current) {
      requestAnimationFrame(() => textareaRef.current?.focus())
      return
    }
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

  return (
    <>
      <textarea
        ref={textareaRef}
        className="pointer-events-auto absolute resize-none overflow-hidden border-none bg-transparent p-0 leading-none outline-none"
        style={editorStyle(controller, edit.request, edit.value)}
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
      {hudAnchor ? (
        <FlowHud direction={spawnDirection} x={hudAnchor.x} y={hudAnchor.y} />
      ) : null}
    </>
  )
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

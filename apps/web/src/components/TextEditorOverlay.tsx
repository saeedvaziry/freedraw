import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  invertColor,
  renderFontFamily,
  type EditorController,
  type EditRequest,
} from '@freedraw/engine'

const ARROW_LABEL_BACKGROUND = '#fafafa'

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
      textarea.select()
      frame = requestAnimationFrame(() => {
        readyRef.current = true
      })
    }
    focusAndArm()
    return () => cancelAnimationFrame(frame)
  }, [editKey])

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

  const onBlur = (): void => {
    if (!readyRef.current) {
      requestAnimationFrame(() => textareaRef.current?.focus())
      return
    }
    commit()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
      return
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      commit()
    }
  }

  return (
    <textarea
      ref={textareaRef}
      className="pointer-events-auto absolute resize-none overflow-hidden border-none bg-transparent p-0 leading-none outline-none"
      style={editorStyle(controller, edit.request, edit.value)}
      value={edit.value}
      onChange={(event) => {
        const value = event.target.value
        setEdit({ request: edit.request, value })
        if (edit.request.target === 'text') {
          controller.resizeTextWhileEditing(edit.request.elementId, value)
        }
      }}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      spellCheck={false}
    />
  )
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

  if (target === 'label' && world.width === 0) {
    const width = 120 * zoom
    const screen = controller.worldToScreen({ x: world.x, y: world.y })
    return {
      ...baseStyle(style, zoom, controller.isDark),
      left: `${screen.x - width / 2}px`,
      top: `${screen.y - (lineHeight * zoom) / 2}px`,
      width: `${width}px`,
      height: `${lineHeight * zoom}px`,
      textAlign: 'center',
      background: themed(ARROW_LABEL_BACKGROUND, controller.isDark),
      whiteSpace: 'pre-wrap',
    }
  }

  const innerWidth = Math.max(world.width - TEXT_PADDING * 2, 24)
  const boxHeight = Math.max(world.height, lineHeight)
  const offsetY = request.verticalAlign !== 'top' ? (boxHeight - lineHeight) / 2 : 0
  const screen = controller.worldToScreen({ x: world.x + TEXT_PADDING, y: world.y })

  return {
    ...baseStyle(style, zoom, controller.isDark),
    left: `${screen.x}px`,
    top: `${screen.y + offsetY * zoom}px`,
    width: `${innerWidth * zoom}px`,
    height: `${lineHeight * zoom}px`,
    textAlign: request.align,
    background: 'transparent',
    whiteSpace: 'pre-wrap',
  }
}

function baseStyle(style: EditRequest['style'], zoom: number, dark: boolean): React.CSSProperties {
  const lineHeight = style.fontSize * LINE_RATIO
  return {
    fontSize: `${style.fontSize * zoom}px`,
    lineHeight: `${lineHeight * zoom}px`,
    fontFamily: renderFontFamily(style.fontFamily, style.sloppiness),
    color: themed(style.textColor, dark),
    caretColor: themed(style.textColor, dark),
  }
}

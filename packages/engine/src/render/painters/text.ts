import { LayoutCache } from '../../text/cache.js'
import { fontString, type MeasureContext } from '../../text/measure.js'
import type { TextAlign, TextLayout, VerticalAlign } from '../../text/layout.js'
import { labelRect } from '../../geometry/shape-outline.js'
import type { Element, Style, TextElement } from '../../model/types.js'
import { ARROW_LABEL_PADDING_X, ARROW_LABEL_PADDING_Y } from '../../text/arrow-label.js'
import type { DrawTarget } from '../draw-target.js'
import { elementColors } from '../draw-cache.js'
import { invertColor } from '../invert.js'

function measureContextFor(ctx: DrawTarget, fontSize: number, fontFamily: string): MeasureContext {
  ctx.font = fontString(fontSize, fontFamily)
  return { measureWidth: (text) => ctx.measureText(text).width }
}

const layoutCache = new LayoutCache()

export function clearTextLayoutCache(): void {
  layoutCache.clear()
}

export const TEXT_PADDING = 6
const ARROW_LABEL_BACKGROUND = '#fafafa'
const ARROW_LABEL_BACKGROUND_DARK = invertColor(ARROW_LABEL_BACKGROUND)

interface TextBlock {
  x: number
  y: number
  width: number
  height: number
  align: TextAlign
  verticalAlign: VerticalAlign
  style: Style
}

function measure(
  ctx: DrawTarget,
  id: string,
  text: string,
  width: number,
  style: Style,
): TextLayout {
  const measureCtx = measureContextFor(ctx, style.fontSize, style.fontFamily)
  return layoutCache.get(
    id,
    { text, width, fontSize: style.fontSize, fontFamily: style.fontFamily },
    measureCtx,
  )
}

export function paintText(ctx: DrawTarget, element: Element, dark: boolean): void {
  const text = element as TextElement
  if (!text.text) return
  paintTextBlock(
    ctx,
    text.id,
    text.text,
    {
      x: text.x,
      y: text.y,
      width: text.width,
      height: text.height,
      align: element.style.textAlign,
      verticalAlign: 'middle',
      style: element.style,
    },
    elementColors(element, dark).textColor,
    Infinity,
  )
}

export function paintLabel(ctx: DrawTarget, element: Element, dark: boolean): void {
  const label = element.label
  if (!label || !label.text) return
  const rect = labelRect(element.type, element)
  paintTextBlock(
    ctx,
    `${element.id}:label`,
    label.text,
    {
      x: rect.x + TEXT_PADDING,
      y: rect.y,
      width: Math.max(0, rect.width - TEXT_PADDING * 2),
      height: rect.height,
      align: label.align,
      verticalAlign: label.verticalAlign,
      style: element.style,
    },
    elementColors(element, dark).textColor,
  )
}

export function paintArrowLabel(
  ctx: DrawTarget,
  element: Element,
  midpoint: { x: number; y: number },
  dark: boolean,
): void {
  const label = element.label
  if (!label || !label.text) return
  const layout = measure(ctx, `${element.id}:label`, label.text, Infinity, element.style)
  const plateWidth = layout.width + ARROW_LABEL_PADDING_X * 2
  const plateHeight = layout.height + ARROW_LABEL_PADDING_Y * 2

  ctx.save()
  ctx.globalAlpha = element.style.opacity
  ctx.fillStyle = dark ? ARROW_LABEL_BACKGROUND_DARK : ARROW_LABEL_BACKGROUND
  ctx.fillRect(midpoint.x - plateWidth / 2, midpoint.y - plateHeight / 2, plateWidth, plateHeight)
  ctx.restore()

  paintLayout(
    ctx,
    layout,
    element.style,
    {
      x: midpoint.x - layout.width / 2,
      y: midpoint.y - layout.height / 2,
      width: layout.width,
      align: 'center',
    },
    elementColors(element, dark).textColor,
  )
}

function paintTextBlock(
  ctx: DrawTarget,
  id: string,
  text: string,
  block: TextBlock,
  color: string,
  wrapWidth: number = block.width,
): void {
  const layout = measure(ctx, id, text, wrapWidth, block.style)
  const top = verticalOffset(block, layout.height)
  paintLayout(
    ctx,
    layout,
    block.style,
    {
      x: block.x,
      y: top,
      width: block.width,
      align: block.align,
    },
    color,
  )
}

function verticalOffset(block: TextBlock, contentHeight: number): number {
  if (block.verticalAlign === 'top') return block.y
  if (block.verticalAlign === 'bottom') return block.y + block.height - contentHeight
  return block.y + (block.height - contentHeight) / 2
}

function paintLayout(
  ctx: DrawTarget,
  layout: TextLayout,
  style: Style,
  box: { x: number; y: number; width: number; align: TextAlign },
  color: string,
): void {
  ctx.save()
  ctx.globalAlpha = style.opacity
  ctx.fillStyle = color
  ctx.font = fontString(style.fontSize, style.fontFamily)
  ctx.textBaseline = 'middle'
  ctx.textAlign = canvasAlign(box.align)
  const anchorX = alignX(box, canvasAlign(box.align))
  layout.lines.forEach((line, index) => {
    const y = box.y + index * layout.lineHeight + layout.lineHeight / 2
    ctx.fillText(line, anchorX, y)
  })
  ctx.restore()
}

function canvasAlign(align: TextAlign): CanvasTextAlign {
  if (align === 'left') return 'left'
  if (align === 'right') return 'right'
  return 'center'
}

function alignX(box: { x: number; width: number }, align: CanvasTextAlign): number {
  if (align === 'left') return box.x
  if (align === 'right') return box.x + box.width
  return box.x + box.width / 2
}

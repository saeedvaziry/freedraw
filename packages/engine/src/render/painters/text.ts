import { LayoutCache } from '../../text/cache.js'
import { canvasMeasureContext, fontString } from '../../text/measure.js'
import type { TextAlign, TextLayout, VerticalAlign } from '../../text/layout.js'
import type { Element, Style, TextElement } from '../../model/types.js'

const layoutCache = new LayoutCache()

export const TEXT_PADDING = 6
export const ARROW_LABEL_PADDING_X = 6
export const ARROW_LABEL_PADDING_Y = 2
const ARROW_LABEL_BACKGROUND = '#fafafa'

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
  ctx: CanvasRenderingContext2D,
  id: string,
  text: string,
  width: number,
  style: Style,
): TextLayout {
  const measureCtx = canvasMeasureContext(ctx, style.fontSize, style.fontFamily)
  return layoutCache.get(
    id,
    { text, width, fontSize: style.fontSize, fontFamily: style.fontFamily },
    measureCtx,
  )
}

export function paintText(ctx: CanvasRenderingContext2D, element: Element): void {
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
    Infinity,
  )
}

export function paintLabel(ctx: CanvasRenderingContext2D, element: Element): void {
  const label = element.label
  if (!label || !label.text) return
  paintTextBlock(ctx, `${element.id}:label`, label.text, {
    x: element.x + TEXT_PADDING,
    y: element.y,
    width: Math.max(0, element.width - TEXT_PADDING * 2),
    height: element.height,
    align: label.align,
    verticalAlign: label.verticalAlign,
    style: element.style,
  })
}

export function paintArrowLabel(
  ctx: CanvasRenderingContext2D,
  element: Element,
  midpoint: { x: number; y: number },
): void {
  const label = element.label
  if (!label || !label.text) return
  const layout = measure(ctx, `${element.id}:label`, label.text, Infinity, element.style)
  const plateWidth = layout.width + ARROW_LABEL_PADDING_X * 2
  const plateHeight = layout.height + ARROW_LABEL_PADDING_Y * 2

  ctx.save()
  ctx.globalAlpha = element.style.opacity
  ctx.fillStyle = ARROW_LABEL_BACKGROUND
  ctx.fillRect(midpoint.x - plateWidth / 2, midpoint.y - plateHeight / 2, plateWidth, plateHeight)
  ctx.restore()

  paintLayout(ctx, layout, element.style, {
    x: midpoint.x - layout.width / 2,
    y: midpoint.y - layout.height / 2,
    width: layout.width,
    align: 'center',
  })
}

function paintTextBlock(
  ctx: CanvasRenderingContext2D,
  id: string,
  text: string,
  block: TextBlock,
  wrapWidth: number = block.width,
): void {
  const layout = measure(ctx, id, text, wrapWidth, block.style)
  const top = verticalOffset(block, layout.height)
  paintLayout(ctx, layout, block.style, {
    x: block.x,
    y: top,
    width: block.width,
    align: block.align,
  })
}

function verticalOffset(block: TextBlock, contentHeight: number): number {
  if (block.verticalAlign === 'top') return block.y
  if (block.verticalAlign === 'bottom') return block.y + block.height - contentHeight
  return block.y + (block.height - contentHeight) / 2
}

function paintLayout(
  ctx: CanvasRenderingContext2D,
  layout: TextLayout,
  style: Style,
  box: { x: number; y: number; width: number; align: TextAlign },
): void {
  ctx.save()
  ctx.globalAlpha = style.opacity
  ctx.fillStyle = style.textColor
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

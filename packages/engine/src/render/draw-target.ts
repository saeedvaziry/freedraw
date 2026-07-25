import type { Rect } from '../geometry/rect.js'
import type { Point } from '../model/types.js'
import { offscreenMeasureContext } from '../text/measure.js'

export interface DrawTransform {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export type ImageHrefResolver = () => string | undefined

export interface DrawTarget {
  globalAlpha: number
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  lineJoin: CanvasLineJoin
  lineCap: CanvasLineCap
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  shadowColor: string
  shadowBlur: number
  shadowOffsetX: number
  shadowOffsetY: number
  readonly canvas: { readonly width: number; readonly height: number }

  save(): void
  restore(): void
  translate(x: number, y: number): void
  rotate(angle: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): void
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void
  closePath(): void
  fill(fillRule?: CanvasFillRule): void
  stroke(): void
  clip(fillRule?: CanvasFillRule): void
  fillRect(x: number, y: number, width: number, height: number): void
  strokeRect(x: number, y: number, width: number, height: number): void
  fillText(text: string, x: number, y: number): void
  drawImage(
    image: CanvasImageSource,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    resolveHref?: ImageHrefResolver,
  ): void
  setLineDash(segments: number[]): void
  measureText(text: string): { readonly width: number }
  getTransform(): DrawTransform
}

export class CanvasDrawTarget implements DrawTarget {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  get globalAlpha(): number {
    return this.ctx.globalAlpha
  }
  set globalAlpha(value: number) {
    this.ctx.globalAlpha = value
  }
  get fillStyle(): string | CanvasGradient | CanvasPattern {
    return this.ctx.fillStyle
  }
  set fillStyle(value: string | CanvasGradient | CanvasPattern) {
    this.ctx.fillStyle = value
  }
  get strokeStyle(): string | CanvasGradient | CanvasPattern {
    return this.ctx.strokeStyle
  }
  set strokeStyle(value: string | CanvasGradient | CanvasPattern) {
    this.ctx.strokeStyle = value
  }
  get lineWidth(): number {
    return this.ctx.lineWidth
  }
  set lineWidth(value: number) {
    this.ctx.lineWidth = value
  }
  get lineJoin(): CanvasLineJoin {
    return this.ctx.lineJoin
  }
  set lineJoin(value: CanvasLineJoin) {
    this.ctx.lineJoin = value
  }
  get lineCap(): CanvasLineCap {
    return this.ctx.lineCap
  }
  set lineCap(value: CanvasLineCap) {
    this.ctx.lineCap = value
  }
  get font(): string {
    return this.ctx.font
  }
  set font(value: string) {
    this.ctx.font = value
  }
  get textAlign(): CanvasTextAlign {
    return this.ctx.textAlign
  }
  set textAlign(value: CanvasTextAlign) {
    this.ctx.textAlign = value
  }
  get textBaseline(): CanvasTextBaseline {
    return this.ctx.textBaseline
  }
  set textBaseline(value: CanvasTextBaseline) {
    this.ctx.textBaseline = value
  }
  get shadowColor(): string {
    return this.ctx.shadowColor
  }
  set shadowColor(value: string) {
    this.ctx.shadowColor = value
  }
  get shadowBlur(): number {
    return this.ctx.shadowBlur
  }
  set shadowBlur(value: number) {
    this.ctx.shadowBlur = value
  }
  get shadowOffsetX(): number {
    return this.ctx.shadowOffsetX
  }
  set shadowOffsetX(value: number) {
    this.ctx.shadowOffsetX = value
  }
  get shadowOffsetY(): number {
    return this.ctx.shadowOffsetY
  }
  set shadowOffsetY(value: number) {
    this.ctx.shadowOffsetY = value
  }
  get canvas(): { readonly width: number; readonly height: number } {
    return this.ctx.canvas
  }

  save(): void {
    this.ctx.save()
  }
  restore(): void {
    this.ctx.restore()
  }
  translate(x: number, y: number): void {
    this.ctx.translate(x, y)
  }
  rotate(angle: number): void {
    this.ctx.rotate(angle)
  }
  beginPath(): void {
    this.ctx.beginPath()
  }
  moveTo(x: number, y: number): void {
    this.ctx.moveTo(x, y)
  }
  lineTo(x: number, y: number): void {
    this.ctx.lineTo(x, y)
  }
  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): void {
    this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y)
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.ctx.quadraticCurveTo(cpx, cpy, x, y)
  }
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void {
    this.ctx.arcTo(x1, y1, x2, y2, radius)
  }
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void {
    this.ctx.arc(x, y, radius, startAngle, endAngle, counterclockwise)
  }
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean,
  ): void {
    this.ctx.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise)
  }
  closePath(): void {
    this.ctx.closePath()
  }
  fill(fillRule?: CanvasFillRule): void {
    if (fillRule) this.ctx.fill(fillRule)
    else this.ctx.fill()
  }
  stroke(): void {
    this.ctx.stroke()
  }
  clip(fillRule?: CanvasFillRule): void {
    if (fillRule) this.ctx.clip(fillRule)
    else this.ctx.clip()
  }
  fillRect(x: number, y: number, width: number, height: number): void {
    this.ctx.fillRect(x, y, width, height)
  }
  strokeRect(x: number, y: number, width: number, height: number): void {
    this.ctx.strokeRect(x, y, width, height)
  }
  fillText(text: string, x: number, y: number): void {
    this.ctx.fillText(text, x, y)
  }
  drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void {
    this.ctx.drawImage(image, dx, dy, dw, dh)
  }
  setLineDash(segments: number[]): void {
    this.ctx.setLineDash(segments)
  }
  measureText(text: string): { readonly width: number } {
    return this.ctx.measureText(text)
  }
  getTransform(): DrawTransform {
    return this.ctx.getTransform()
  }
}

interface GraphicsState {
  matrix: DrawTransform
  globalAlpha: number
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  lineJoin: CanvasLineJoin
  lineCap: CanvasLineCap
  lineDash: number[]
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  shadowColor: string
  shadowBlur: number
  shadowOffsetX: number
  shadowOffsetY: number
  clipId: string | null
}

export interface SvgFontFace {
  family: string
  source: string
  weight?: string | number
  style?: string
}

export interface SvgDrawTargetConfig {
  bounds: Rect
  padding: number
  scale: number
  background: string | null
  fonts?: readonly SvgFontFace[]
}

let defaultFontFaces: readonly SvgFontFace[] = []

export function setSvgFontFaces(faces: readonly SvgFontFace[]): void {
  defaultFontFaces = faces.slice()
}

export function svgFontFaces(): readonly SvgFontFace[] {
  return defaultFontFaces
}

export class SvgDrawTarget implements DrawTarget {
  private readonly viewWidth: number
  private readonly viewHeight: number
  private readonly pixelWidth: number
  private readonly pixelHeight: number
  private readonly background: string | null
  private readonly body: string[] = []
  private readonly defs: string[] = []
  private readonly filters = new Map<string, string>()
  private readonly fonts: readonly SvgFontFace[]
  private readonly usedFamilies = new Set<string>()
  private usesXlink = false
  private idSeq = 0
  private path: string[] = []
  private pen: Point = { x: 0, y: 0 }
  private state: GraphicsState
  private readonly stack: GraphicsState[] = []

  constructor(config: SvgDrawTargetConfig) {
    const minX = config.bounds.x - config.padding
    const minY = config.bounds.y - config.padding
    this.viewWidth = config.bounds.width + config.padding * 2
    this.viewHeight = config.bounds.height + config.padding * 2
    this.pixelWidth = Math.max(1, Math.round(this.viewWidth * config.scale))
    this.pixelHeight = Math.max(1, Math.round(this.viewHeight * config.scale))
    this.background = config.background
    this.fonts = config.fonts ?? defaultFontFaces
    this.state = {
      matrix: { a: 1, b: 0, c: 0, d: 1, e: -minX, f: -minY },
      globalAlpha: 1,
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1,
      lineJoin: 'miter',
      lineCap: 'butt',
      lineDash: [],
      font: '10px sans-serif',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      shadowColor: 'transparent',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      clipId: null,
    }
  }

  get globalAlpha(): number {
    return this.state.globalAlpha
  }
  set globalAlpha(value: number) {
    this.state.globalAlpha = value
  }
  get fillStyle(): string | CanvasGradient | CanvasPattern {
    return this.state.fillStyle
  }
  set fillStyle(value: string | CanvasGradient | CanvasPattern) {
    this.state.fillStyle = value
  }
  get strokeStyle(): string | CanvasGradient | CanvasPattern {
    return this.state.strokeStyle
  }
  set strokeStyle(value: string | CanvasGradient | CanvasPattern) {
    this.state.strokeStyle = value
  }
  get lineWidth(): number {
    return this.state.lineWidth
  }
  set lineWidth(value: number) {
    this.state.lineWidth = value
  }
  get lineJoin(): CanvasLineJoin {
    return this.state.lineJoin
  }
  set lineJoin(value: CanvasLineJoin) {
    this.state.lineJoin = value
  }
  get lineCap(): CanvasLineCap {
    return this.state.lineCap
  }
  set lineCap(value: CanvasLineCap) {
    this.state.lineCap = value
  }
  get font(): string {
    return this.state.font
  }
  set font(value: string) {
    this.state.font = value
  }
  get textAlign(): CanvasTextAlign {
    return this.state.textAlign
  }
  set textAlign(value: CanvasTextAlign) {
    this.state.textAlign = value
  }
  get textBaseline(): CanvasTextBaseline {
    return this.state.textBaseline
  }
  set textBaseline(value: CanvasTextBaseline) {
    this.state.textBaseline = value
  }
  get shadowColor(): string {
    return this.state.shadowColor
  }
  set shadowColor(value: string) {
    this.state.shadowColor = value
  }
  get shadowBlur(): number {
    return this.state.shadowBlur
  }
  set shadowBlur(value: number) {
    this.state.shadowBlur = value
  }
  get shadowOffsetX(): number {
    return this.state.shadowOffsetX
  }
  set shadowOffsetX(value: number) {
    this.state.shadowOffsetX = value
  }
  get shadowOffsetY(): number {
    return this.state.shadowOffsetY
  }
  set shadowOffsetY(value: number) {
    this.state.shadowOffsetY = value
  }
  get canvas(): { readonly width: number; readonly height: number } {
    return { width: this.viewWidth, height: this.viewHeight }
  }

  save(): void {
    this.stack.push({ ...this.state, lineDash: this.state.lineDash.slice() })
  }

  restore(): void {
    const previous = this.stack.pop()
    if (previous) this.state = previous
  }

  translate(x: number, y: number): void {
    this.state.matrix = multiply(this.state.matrix, { a: 1, b: 0, c: 0, d: 1, e: x, f: y })
  }

  rotate(angle: number): void {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    this.state.matrix = multiply(this.state.matrix, { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 })
  }

  beginPath(): void {
    this.path = []
  }

  moveTo(x: number, y: number): void {
    this.pen = { x, y }
    const p = apply(this.state.matrix, x, y)
    this.path.push(`M ${fmt(p.x)} ${fmt(p.y)}`)
  }

  lineTo(x: number, y: number): void {
    this.pen = { x, y }
    const p = apply(this.state.matrix, x, y)
    this.path.push(`L ${fmt(p.x)} ${fmt(p.y)}`)
  }

  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): void {
    this.pen = { x, y }
    const c1 = apply(this.state.matrix, cp1x, cp1y)
    const c2 = apply(this.state.matrix, cp2x, cp2y)
    const p = apply(this.state.matrix, x, y)
    this.path.push(
      `C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(p.x)} ${fmt(p.y)}`,
    )
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.pen = { x, y }
    const c = apply(this.state.matrix, cpx, cpy)
    const p = apply(this.state.matrix, x, y)
    this.path.push(`Q ${fmt(c.x)} ${fmt(c.y)} ${fmt(p.x)} ${fmt(p.y)}`)
  }

  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void {
    const corner = { x: x1, y: y1 }
    const start = pointTowards(corner, this.pen, radius)
    const end = pointTowards(corner, { x: x2, y: y2 }, radius)
    const startP = apply(this.state.matrix, start.x, start.y)
    const cornerP = apply(this.state.matrix, corner.x, corner.y)
    const endP = apply(this.state.matrix, end.x, end.y)
    this.path.push(`L ${fmt(startP.x)} ${fmt(startP.y)}`)
    this.path.push(`Q ${fmt(cornerP.x)} ${fmt(cornerP.y)} ${fmt(endP.x)} ${fmt(endP.y)}`)
    this.pen = end
  }

  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise = false,
  ): void {
    this.appendArc(x, y, radius, radius, startAngle, endAngle, counterclockwise)
  }

  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    _rotation: number,
    startAngle: number,
    endAngle: number,
    counterclockwise = false,
  ): void {
    this.appendArc(x, y, radiusX, radiusY, startAngle, endAngle, counterclockwise)
  }

  private appendArc(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    startAngle: number,
    endAngle: number,
    counterclockwise: boolean,
  ): void {
    let sweep = endAngle - startAngle
    if (counterclockwise && sweep > 0) sweep -= Math.PI * 2
    if (!counterclockwise && sweep < 0) sweep += Math.PI * 2
    const segments = Math.max(2, Math.ceil((Math.abs(sweep) / Math.PI) * 4))
    const step = sweep / segments
    const start = { x: cx + rx * Math.cos(startAngle), y: cy + ry * Math.sin(startAngle) }
    const startP = apply(this.state.matrix, start.x, start.y)
    this.path.push(`${this.path.length === 0 ? 'M' : 'L'} ${fmt(startP.x)} ${fmt(startP.y)}`)
    const kappa = (4 / 3) * Math.tan(step / 4)
    for (let i = 0; i < segments; i += 1) {
      const a0 = startAngle + step * i
      const a1 = a0 + step
      const p0 = { x: cx + rx * Math.cos(a0), y: cy + ry * Math.sin(a0) }
      const p1 = { x: cx + rx * Math.cos(a1), y: cy + ry * Math.sin(a1) }
      const c1 = { x: p0.x - kappa * rx * Math.sin(a0), y: p0.y + kappa * ry * Math.cos(a0) }
      const c2 = { x: p1.x + kappa * rx * Math.sin(a1), y: p1.y - kappa * ry * Math.cos(a1) }
      const c1P = apply(this.state.matrix, c1.x, c1.y)
      const c2P = apply(this.state.matrix, c2.x, c2.y)
      const p1P = apply(this.state.matrix, p1.x, p1.y)
      this.path.push(
        `C ${fmt(c1P.x)} ${fmt(c1P.y)} ${fmt(c2P.x)} ${fmt(c2P.y)} ${fmt(p1P.x)} ${fmt(p1P.y)}`,
      )
    }
    this.pen = { x: cx + rx * Math.cos(endAngle), y: cy + ry * Math.sin(endAngle) }
  }

  closePath(): void {
    this.path.push('Z')
  }

  fill(fillRule?: CanvasFillRule): void {
    this.emitFill(this.path.join(' '), fillRule)
  }

  stroke(): void {
    this.emitStroke(this.path.join(' '))
  }

  clip(fillRule?: CanvasFillRule): void {
    const id = `fd-clip-${this.idSeq++}`
    const rule = fillRule === 'evenodd' ? ' clip-rule="evenodd"' : ''
    this.defs.push(`<clipPath id="${id}"><path d="${this.path.join(' ')}"${rule}/></clipPath>`)
    this.state.clipId = id
  }

  fillRect(x: number, y: number, width: number, height: number): void {
    this.emitFill(this.rectPath(x, y, width, height))
  }

  strokeRect(x: number, y: number, width: number, height: number): void {
    this.emitStroke(this.rectPath(x, y, width, height))
  }

  fillText(text: string, x: number, y: number): void {
    if (text.length === 0) return
    const color = colorString(this.state.fillStyle)
    if (color === 'transparent') return
    const { size, family } = parseFont(this.state.font)
    for (const name of familyNames(family)) this.usedFamilies.add(name)
    const attrs: string[] = []
    attrs.push(this.placement(x, y))
    attrs.push(`font-family="${escapeAttr(family)}"`)
    attrs.push(`font-size="${fmt(size)}"`)
    attrs.push(`fill="${escapeAttr(color)}"`)
    attrs.push(`text-anchor="${textAnchor(this.state.textAlign)}"`)
    attrs.push(`dominant-baseline="${dominantBaseline(this.state.textBaseline)}"`)
    if (this.state.globalAlpha < 1) attrs.push(`opacity="${fmt(this.state.globalAlpha)}"`)
    attrs.push('xml:space="preserve"')
    this.body.push(`<text ${attrs.join(' ')}>${escapeText(text)}</text>`)
  }

  drawImage(
    image: CanvasImageSource,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
    resolveHref?: ImageHrefResolver,
  ): void {
    const href = resolveHref?.() ?? toDataUrl(image)
    if (!href) return
    const encoded = escapeAttr(href)
    this.usesXlink = true
    const attrs: string[] = []
    attrs.push(this.placement(dx, dy))
    attrs.push(`width="${fmt(dw)}"`)
    attrs.push(`height="${fmt(dh)}"`)
    attrs.push(`href="${encoded}"`)
    attrs.push(`xlink:href="${encoded}"`)
    attrs.push('preserveAspectRatio="none"')
    if (this.state.globalAlpha < 1) attrs.push(`opacity="${fmt(this.state.globalAlpha)}"`)
    if (this.state.clipId) attrs.push(`clip-path="url(#${this.state.clipId})"`)
    this.body.push(`<image ${attrs.join(' ')}/>`)
  }

  setLineDash(segments: number[]): void {
    this.state.lineDash = segments.slice()
  }

  measureText(text: string): { readonly width: number } {
    const { size, family } = parseFont(this.state.font)
    return { width: offscreenMeasureContext(size, family).measureWidth(text) }
  }

  getTransform(): DrawTransform {
    return { ...this.state.matrix }
  }

  toSvg(): string {
    const fontStyle = this.fontFaceStyle()
    const content = `${fontStyle}${this.defs.join('')}`
    const defs = content.length > 0 ? `<defs>${content}</defs>` : ''
    const background = this.background
      ? `<rect x="0" y="0" width="${fmt(this.viewWidth)}" height="${fmt(this.viewHeight)}" fill="${escapeAttr(this.background)}"/>`
      : ''
    const xlink = this.usesXlink ? ' xmlns:xlink="http://www.w3.org/1999/xlink"' : ''
    return (
      `<svg xmlns="http://www.w3.org/2000/svg"${xlink} width="${this.pixelWidth}" height="${this.pixelHeight}" ` +
      `viewBox="0 0 ${fmt(this.viewWidth)} ${fmt(this.viewHeight)}">` +
      `${defs}${background}${this.body.join('')}</svg>`
    )
  }

  private fontFaceStyle(): string {
    if (this.fonts.length === 0 || this.usedFamilies.size === 0) return ''
    const rules = this.fonts
      .filter((face) => this.usedFamilies.has(normalizeFamily(face.family)))
      .map(fontFaceRule)
    if (rules.length === 0) return ''
    return `<style>${escapeText(rules.join(''))}</style>`
  }

  private emitFill(d: string, fillRule?: CanvasFillRule): void {
    if (d.length === 0) return
    const color = colorString(this.state.fillStyle)
    if (color === 'transparent') return
    const attrs = [`d="${d}"`, `fill="${escapeAttr(color)}"`]
    if (fillRule === 'evenodd') attrs.push('fill-rule="evenodd"')
    if (this.state.globalAlpha < 1) attrs.push(`opacity="${fmt(this.state.globalAlpha)}"`)
    const filter = this.shadowFilter()
    if (filter) attrs.push(`filter="url(#${filter})"`)
    if (this.state.clipId) attrs.push(`clip-path="url(#${this.state.clipId})"`)
    this.body.push(`<path ${attrs.join(' ')}/>`)
  }

  private emitStroke(d: string): void {
    if (d.length === 0) return
    const color = colorString(this.state.strokeStyle)
    if (color === 'transparent') return
    const attrs = [
      `d="${d}"`,
      'fill="none"',
      `stroke="${escapeAttr(color)}"`,
      `stroke-width="${fmt(this.state.lineWidth)}"`,
    ]
    if (this.state.lineJoin !== 'miter') attrs.push(`stroke-linejoin="${this.state.lineJoin}"`)
    if (this.state.lineCap !== 'butt') attrs.push(`stroke-linecap="${this.state.lineCap}"`)
    if (this.state.lineDash.length > 0) {
      attrs.push(`stroke-dasharray="${this.state.lineDash.map(fmt).join(' ')}"`)
    }
    if (this.state.globalAlpha < 1) attrs.push(`opacity="${fmt(this.state.globalAlpha)}"`)
    if (this.state.clipId) attrs.push(`clip-path="url(#${this.state.clipId})"`)
    this.body.push(`<path ${attrs.join(' ')}/>`)
  }

  private rectPath(x: number, y: number, width: number, height: number): string {
    const m = this.state.matrix
    const a = apply(m, x, y)
    const b = apply(m, x + width, y)
    const c = apply(m, x + width, y + height)
    const d = apply(m, x, y + height)
    return (
      `M ${fmt(a.x)} ${fmt(a.y)} L ${fmt(b.x)} ${fmt(b.y)} ` +
      `L ${fmt(c.x)} ${fmt(c.y)} L ${fmt(d.x)} ${fmt(d.y)} Z`
    )
  }

  private placement(x: number, y: number): string {
    const m = this.state.matrix
    if (m.b === 0 && m.c === 0 && m.a === 1 && m.d === 1) {
      return `x="${fmt(x + m.e)}" y="${fmt(y + m.f)}"`
    }
    const transform = `matrix(${fmt(m.a)} ${fmt(m.b)} ${fmt(m.c)} ${fmt(m.d)} ${fmt(m.e)} ${fmt(m.f)})`
    return `x="${fmt(x)}" y="${fmt(y)}" transform="${transform}"`
  }

  private shadowFilter(): string | null {
    const color = this.state.shadowColor
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null
    if (this.state.shadowBlur === 0 && this.state.shadowOffsetX === 0 && this.state.shadowOffsetY === 0) {
      return null
    }
    const key = `${color}|${this.state.shadowBlur}|${this.state.shadowOffsetX}|${this.state.shadowOffsetY}`
    const existing = this.filters.get(key)
    if (existing) return existing
    const id = `fd-shadow-${this.idSeq++}`
    const deviation = fmt(this.state.shadowBlur / 2)
    this.defs.push(
      `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">` +
        `<feDropShadow dx="${fmt(this.state.shadowOffsetX)}" dy="${fmt(this.state.shadowOffsetY)}" ` +
        `stdDeviation="${deviation}" flood-color="${escapeAttr(color)}"/></filter>`,
    )
    this.filters.set(key, id)
    return id
  }
}

function multiply(a: DrawTransform, b: DrawTransform): DrawTransform {
  return {
    a: a.a * b.a + a.c * b.b,
    b: a.b * b.a + a.d * b.b,
    c: a.a * b.c + a.c * b.d,
    d: a.b * b.c + a.d * b.d,
    e: a.a * b.e + a.c * b.f + a.e,
    f: a.b * b.e + a.d * b.f + a.f,
  }
}

function apply(m: DrawTransform, x: number, y: number): Point {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }
}

function pointTowards(from: Point, to: Point, distance: number): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const ratio = Math.min(distance, length) / length
  return { x: from.x + dx * ratio, y: from.y + dy * ratio }
}

function fmt(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number.isInteger(value) ? `${value}` : `${Number(value.toFixed(3))}`
}

function colorString(style: string | CanvasGradient | CanvasPattern): string {
  return typeof style === 'string' ? style : '#000000'
}

function parseFont(font: string): { size: number; family: string } {
  const match = /([\d.]+)px\s+(.+)$/.exec(font)
  if (!match) return { size: 16, family: 'sans-serif' }
  return { size: Number(match[1]), family: match[2]!.trim() }
}

function normalizeFamily(name: string): string {
  return name.trim().replace(/^["']|["']$/g, '').trim().toLowerCase()
}

function familyNames(family: string): string[] {
  return family
    .split(',')
    .map(normalizeFamily)
    .filter((name) => name.length > 0)
}

function fontFaceRule(face: SvgFontFace): string {
  const parts = [`font-family:'${cssEscape(face.family)}'`, `src:url("${cssEscape(face.source)}")`]
  if (face.weight !== undefined) parts.push(`font-weight:${cssEscape(String(face.weight))}`)
  if (face.style) parts.push(`font-style:${cssEscape(face.style)}`)
  return `@font-face{${parts.join(';')}}`
}

function cssEscape(value: string): string {
  return value.replace(/[\r\n]/g, '').replace(/[\\"']/g, '\\$&')
}

function textAnchor(align: CanvasTextAlign): string {
  if (align === 'left' || align === 'start') return 'start'
  if (align === 'right' || align === 'end') return 'end'
  return 'middle'
}

function dominantBaseline(baseline: CanvasTextBaseline): string {
  if (baseline === 'middle') return 'central'
  if (baseline === 'top' || baseline === 'hanging') return 'text-before-edge'
  if (baseline === 'bottom' || baseline === 'ideographic') return 'text-after-edge'
  return 'alphabetic'
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function toDataUrl(image: CanvasImageSource): string | null {
  if (typeof document === 'undefined') return null
  const source = image as { width?: number; height?: number }
  const width = Math.max(1, Math.round(source.width ?? 0))
  const height = Math.max(1, Math.round(source.height ?? 0))
  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(image, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ColorPicker } from './color-picker.js'
import type { PanelPalette } from './types.js'

function renderPicker(props: Partial<Parameters<typeof ColorPicker>[0]> = {}) {
  const onChange = vi.fn()
  const ui: ReactNode = (
    <TooltipProvider>
      <ColorPicker label="Stroke" value="#1e1e1e" onChange={onChange} {...props} />
    </TooltipProvider>
  )
  render(ui)
  return { onChange }
}

function hexInput(): HTMLInputElement {
  return screen.getByLabelText('Stroke hex') as HTMLInputElement
}

afterEach(() => {
  delete (window as unknown as { EyeDropper?: unknown }).EyeDropper
  vi.restoreAllMocks()
})

describe('ColorPicker hex input', () => {
  it('shows the current value normalised to six digits', () => {
    renderPicker({ value: '#ABC' })

    expect(hexInput().value).toBe('#aabbcc')
  })

  it('applies a shorthand hex on Enter', () => {
    const { onChange } = renderPicker()

    fireEvent.change(hexInput(), { target: { value: '#f0a' } })
    fireEvent.keyDown(hexInput(), { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('#ff00aa')
  })

  it('accepts a six digit hex without the hash on blur', () => {
    const { onChange } = renderPicker()

    fireEvent.change(hexInput(), { target: { value: '1971C2' } })
    fireEvent.blur(hexInput())

    expect(onChange).toHaveBeenCalledWith('#1971c2')
  })

  it('rejects an invalid hex and marks the field', () => {
    const { onChange } = renderPicker()

    fireEvent.change(hexInput(), { target: { value: 'nope' } })
    fireEvent.keyDown(hexInput(), { key: 'Enter' })

    expect(onChange).not.toHaveBeenCalled()
    expect(hexInput().getAttribute('aria-invalid')).toBe('true')
  })

  it('reverts to the current value when an invalid hex is blurred', () => {
    const { onChange } = renderPicker({ value: '#1971c2' })

    fireEvent.change(hexInput(), { target: { value: 'zzz' } })
    fireEvent.blur(hexInput())

    expect(onChange).not.toHaveBeenCalled()
    expect(hexInput().value).toBe('#1971c2')
  })

  it('reverts on Escape without applying', () => {
    const { onChange } = renderPicker({ value: '#1971c2' })

    fireEvent.change(hexInput(), { target: { value: '#000000' } })
    fireEvent.keyDown(hexInput(), { key: 'Escape' })

    expect(onChange).not.toHaveBeenCalled()
    expect(hexInput().value).toBe('#1971c2')
  })

  it('accepts the transparent keyword only when transparency is allowed', () => {
    const { onChange } = renderPicker({ allowTransparent: true, value: 'transparent' })

    fireEvent.change(hexInput(), { target: { value: 'none' } })
    fireEvent.keyDown(hexInput(), { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('transparent')
  })

  it('does not accept the transparent keyword for opaque fields', () => {
    const { onChange } = renderPicker()

    fireEvent.change(hexInput(), { target: { value: 'transparent' } })
    fireEvent.keyDown(hexInput(), { key: 'Enter' })

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('ColorPicker palettes', () => {
  const palette: PanelPalette = {
    recent: ['#112233'],
    document: ['#445566', '#778899'],
  }

  it('renders recent and in-use swatches and applies them', () => {
    const { onChange } = renderPicker({ palette })

    fireEvent.click(screen.getByLabelText('Recent #112233'))
    expect(onChange).toHaveBeenCalledWith('#112233')

    fireEvent.click(screen.getByLabelText('In use #778899'))
    expect(onChange).toHaveBeenCalledWith('#778899')
  })

  it('omits empty palette rows', () => {
    renderPicker({ palette: { recent: [], document: [] } })

    expect(screen.queryByText('Recent')).toBeNull()
    expect(screen.queryByText('In use')).toBeNull()
  })

  it('marks the active palette swatch as pressed', () => {
    renderPicker({ palette, value: '#112233' })

    expect(screen.getByLabelText('Recent #112233').getAttribute('aria-pressed')).toBe('true')
  })
})

describe('ColorPicker eyedropper', () => {
  it('uses the native EyeDropper when the browser exposes one', async () => {
    const open = vi.fn().mockResolvedValue({ sRGBHex: '#2F9E44' })
    ;(window as unknown as { EyeDropper?: unknown }).EyeDropper = class {
      open = open
    }

    const { onChange } = renderPicker()

    fireEvent.click(screen.getByLabelText('Pick stroke from screen'))
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith('#2f9e44'))
    expect(open).toHaveBeenCalled()
  })

  it('falls back to sampling the scene canvas under the pointer', async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = 4
    document.body.append(canvas)
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 4, height: 4, right: 4, bottom: 4, x: 0, y: 0 }) as DOMRect
    const getImageData = vi.fn(() => ({ data: new Uint8ClampedArray([224, 49, 49, 255]) }))
    canvas.getContext = vi.fn(() => ({ getImageData })) as unknown as typeof canvas.getContext
    document.elementsFromPoint = vi.fn(() => [canvas])

    const { onChange } = renderPicker()

    fireEvent.click(screen.getByLabelText('Pick stroke from canvas'))
    await vi.waitFor(() => expect(screen.getByLabelText('Pick stroke from canvas')).toBeTruthy())
    fireEvent.pointerDown(window, { clientX: 1, clientY: 1 })

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith('#e03131'))
    expect(getImageData).toHaveBeenCalledWith(1, 1, 1, 1)
    canvas.remove()
  })

  it('cancels the canvas fallback on Escape', async () => {
    document.elementsFromPoint = vi.fn(() => [])
    const { onChange } = renderPicker()
    const button = screen.getByLabelText('Pick stroke from canvas')

    fireEvent.click(button)
    await vi.waitFor(() => expect(button.getAttribute('aria-pressed')).toBe('true'))
    fireEvent.keyDown(window, { key: 'Escape' })

    await vi.waitFor(() => expect(button.getAttribute('aria-pressed')).toBeNull())
    expect(onChange).not.toHaveBeenCalled()
  })
})

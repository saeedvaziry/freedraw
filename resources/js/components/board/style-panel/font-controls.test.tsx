import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { FontControls } from './font-controls.js'
import { MIXED, type PanelStyle } from './types.js'

function panelStyle(overrides: Partial<PanelStyle> = {}): PanelStyle {
  return {
    stroke: '#1e1e1e',
    fill: 'transparent',
    strokeWidth: 2,
    strokeStyle: 'solid',
    opacity: 1,
    roundness: 0,
    sloppiness: 0,
    fontSize: 20,
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: 400,
    fontStyle: 'normal',
    textColor: '#1e1e1e',
    textAlign: 'center',
    ...overrides,
  }
}

function renderControls(style: PanelStyle) {
  const onChange = vi.fn()
  render(
    <TooltipProvider>
      <FontControls
        style={style}
        onChange={onChange}
        onInteractStart={vi.fn()}
        onInteractEnd={vi.fn()}
      />
    </TooltipProvider>,
  )
  return { onChange }
}

describe('FontControls emphasis', () => {
  it('turns bold on from a regular weight', () => {
    const { onChange } = renderControls(panelStyle())

    fireEvent.click(screen.getByLabelText('Bold'))

    expect(onChange).toHaveBeenCalledWith({ fontWeight: 700 })
  })

  it('turns bold back off', () => {
    const { onChange } = renderControls(panelStyle({ fontWeight: 700 }))

    expect(screen.getByLabelText('Bold').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByLabelText('Bold'))

    expect(onChange).toHaveBeenCalledWith({ fontWeight: 400 })
  })

  it('toggles italic', () => {
    const { onChange } = renderControls(panelStyle())

    fireEvent.click(screen.getByLabelText('Italic'))

    expect(onChange).toHaveBeenCalledWith({ fontStyle: 'italic' })
  })

  it('turns italic back off', () => {
    const { onChange } = renderControls(panelStyle({ fontStyle: 'italic' }))

    expect(screen.getByLabelText('Italic').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByLabelText('Italic'))

    expect(onChange).toHaveBeenCalledWith({ fontStyle: 'normal' })
  })

  it('shows a mixed selection as unpressed and applies bold on the first press', () => {
    const { onChange } = renderControls(panelStyle({ fontWeight: MIXED, fontStyle: MIXED }))

    expect(screen.getByLabelText('Bold').getAttribute('aria-pressed')).toBeNull()
    expect(screen.getByLabelText('Italic').getAttribute('aria-pressed')).toBeNull()

    fireEvent.click(screen.getByLabelText('Bold'))
    expect(onChange).toHaveBeenCalledWith({ fontWeight: 700 })

    fireEvent.click(screen.getByLabelText('Italic'))
    expect(onChange).toHaveBeenCalledWith({ fontStyle: 'italic' })
  })
})

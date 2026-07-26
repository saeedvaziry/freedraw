import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SegmentedControl, SliderControl } from './controls.js'

describe('style panel coarse pointer targets', () => {
  it('expands sliders to a 44px interaction area', () => {
    render(
      <SliderControl
        label="Stroke width"
        value={2}
        min={1}
        max={20}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Stroke width').className).toContain('coarse:h-11')
  })

  it('expands segmented options to 44px', () => {
    render(
      <TooltipProvider>
        <SegmentedControl
          label="Stroke style"
          value="solid"
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'dashed', label: 'Dashed' },
          ]}
          onChange={vi.fn()}
        />
      </TooltipProvider>,
    )

    expect(screen.getByLabelText('Solid').className).toContain('coarse:h-11')
    expect(screen.getByLabelText('Dashed').className).toContain('coarse:h-11')
  })
})

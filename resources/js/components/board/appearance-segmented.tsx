import { Monitor, Moon, Sun } from 'lucide-react'
import type { Appearance } from '@/hooks/use-appearance'
import { useAppearance } from '@/hooks/use-appearance'
import { SegmentedControl, type SegmentedControlOption } from './ui/segmented-control.js'

const tabs: SegmentedControlOption<Appearance>[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
]

export function AppearanceSegmented({ className }: { className?: string }) {
  const { appearance, updateAppearance } = useAppearance()

  return (
    <SegmentedControl
      ariaLabel="Theme"
      fill
      hint="title"
      className={className}
      value={appearance}
      options={tabs}
      onChange={updateAppearance}
    />
  )
}

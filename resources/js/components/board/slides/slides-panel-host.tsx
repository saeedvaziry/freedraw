import { useSlides } from '@/hooks/board/use-slides.js'
import { useBoardContext } from '../board-context.js'
import { SlidesPanel } from './slides-panel.js'

interface SlidesPanelHostProps {
  className?: string
  onClose(): void
}

export function SlidesPanelHost({ className, onClose }: SlidesPanelHostProps) {
  const { store, readOnly } = useBoardContext()
  const slides = useSlides(store)

  if (readOnly) return null

  return (
    <SlidesPanel
      slides={slides.slides}
      canCreate={slides.canCreate}
      className={className}
      onCreate={slides.create}
      onRename={slides.rename}
      onDelete={slides.remove}
      onMove={slides.move}
      onClose={onClose}
    />
  )
}

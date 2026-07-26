import { useEffect, useState } from 'react'
import {
  subscribeCanvasAnnouncements,
  type CanvasAnnouncement,
} from '@/hooks/board/use-canvas-a11y.js'

export function CanvasA11yLiveRegion() {
  const [announcement, setAnnouncement] = useState<CanvasAnnouncement | null>(null)

  useEffect(() => subscribeCanvasAnnouncements(setAnnouncement), [])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-test="canvas-live-region"
      className="pointer-events-none sr-only"
    >
      {announcement ? <span key={announcement.token}>{announcement.message}</span> : null}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import type { EditorController, SpawnMenuRequest } from '@freedraw/engine'
import { SHAPES } from '@/components/board/ui-kit'

interface SpawnMenuProps {
  controller: EditorController
}

export function SpawnMenu({ controller }: SpawnMenuProps) {
  const [request, setRequest] = useState<SpawnMenuRequest | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => controller.subscribeSpawnMenu(setRequest), [controller])

  useEffect(() => {
    if (!request) return
    const close = (): void => controller.closeSpawnMenu()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) close()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [request, controller])

  if (!request) return null

  return (
    <div
      ref={menuRef}
      className="pointer-events-auto absolute z-10 rounded-2xl border bg-popover p-2 shadow-lg backdrop-blur"
      style={{ left: `${request.screen.x}px`, top: `${request.screen.y}px` }}
    >
      <div className="grid grid-cols-4 gap-1">
        {SHAPES.map(({ type, label, Icon }) => (
          <button
            key={type}
            type="button"
            aria-label={label}
            onClick={() =>
              controller.spawnShapeFromMenu(request.sourceId, request.direction, type)
            }
            className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground/80 transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-5"
          >
            <Icon />
          </button>
        ))}
      </div>
    </div>
  )
}

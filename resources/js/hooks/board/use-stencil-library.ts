import { useCallback, useEffect, useState } from 'react'
import type { Stencil } from '@freedraw/engine'

const STORAGE_KEY = 'freedraw:stencil-library:v1'
const CHANGE_EVENT = 'freedraw:stencil-library-change'

interface StoredLibrary {
  version: 1
  stencils: Stencil[]
}

export interface StencilLibrary {
  stencils: Stencil[]
  saveStencil(stencil: Stencil): void
  removeStencil(id: string): void
}

function readLibrary(): Stencil[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<StoredLibrary>
    return Array.isArray(parsed?.stencils) ? parsed.stencils : []
  } catch {
    return []
  }
}

function writeLibrary(stencils: Stencil[]): void {
  if (typeof window === 'undefined') return
  try {
    const payload: StoredLibrary = { version: 1, stencils }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {
    return
  }
}

export function useStencilLibrary(): StencilLibrary {
  const [stencils, setStencils] = useState<Stencil[]>(() => readLibrary())

  useEffect(() => {
    const sync = (): void => setStencils(readLibrary())
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const saveStencil = useCallback((stencil: Stencil): void => {
    const next = [stencil, ...readLibrary().filter((item) => item.id !== stencil.id)]
    writeLibrary(next)
    setStencils(next)
  }, [])

  const removeStencil = useCallback((id: string): void => {
    const next = readLibrary().filter((item) => item.id !== id)
    writeLibrary(next)
    setStencils(next)
  }, [])

  return { stencils, saveStencil, removeStencil }
}

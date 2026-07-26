import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { selectionBounds } from '@freedraw/engine'
import type { Element, ElementId, SceneStore, Slide } from '@freedraw/engine'

export interface UseSlidesResult {
  slides: Slide[]
  canCreate: boolean
  create(): ElementId | null
  rename(id: ElementId, name: string): void
  remove(id: ElementId): void
  move(id: ElementId, offset: number): void
}

interface SlidesView {
  slides: Slide[]
  canCreate: boolean
}

function orderedSlides(store: SceneStore): Slide[] {
  return [...store.getSlides()].sort((a, b) => a.order - b.order)
}

function selectedElements(store: SceneStore): Element[] {
  const snapshot = store.getSnapshot()
  return [...store.getUiState().selectedIds]
    .map((id) => snapshot.elements[id])
    .filter((element): element is Element => Boolean(element))
}

function readView(store: SceneStore): SlidesView {
  return {
    slides: orderedSlides(store),
    canCreate: store.getUiState().selectedIds.size > 0,
  }
}

function sameSlide(a: Slide, b: Slide): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.order === b.order &&
    a.rect.x === b.rect.x &&
    a.rect.y === b.rect.y &&
    a.rect.width === b.rect.width &&
    a.rect.height === b.rect.height
  )
}

function sameView(a: SlidesView, b: SlidesView): boolean {
  if (a.canCreate !== b.canCreate) return false
  if (a.slides.length !== b.slides.length) return false
  return a.slides.every((slide, index) => {
    const other = b.slides[index]
    return other != null && sameSlide(slide, other)
  })
}

export function useSlides(store: SceneStore): UseSlidesResult {
  const view = useMemo(
    () => store.select(readView, { equals: sameView, channels: ['doc', 'selection'] }),
    [store],
  )
  const state = useSyncExternalStore(view.subscribe, view.getSnapshot)

  const create = useCallback((): ElementId | null => {
    const rect = selectionBounds(selectedElements(store))
    if (!rect) return null
    return store.addSlide(rect)
  }, [store])

  const rename = useCallback(
    (id: ElementId, name: string): void => {
      const trimmed = name.trim()
      if (trimmed.length === 0) return
      store.renameSlide(id, trimmed)
    },
    [store],
  )

  const remove = useCallback((id: ElementId): void => store.deleteSlide(id), [store])

  const move = useCallback(
    (id: ElementId, offset: number): void => {
      const ordered = orderedSlides(store).map((slide) => slide.id)
      const index = ordered.indexOf(id)
      if (index < 0) return
      const target = index + offset
      if (target < 0 || target >= ordered.length) return
      const next = [...ordered]
      next.splice(index, 1)
      next.splice(target, 0, id)
      store.reorderSlides(next)
    },
    [store],
  )

  return { slides: state.slides, canCreate: state.canCreate, create, rename, remove, move }
}

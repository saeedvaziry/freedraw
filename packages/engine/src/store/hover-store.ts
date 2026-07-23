import type { ElementId } from '../model/types.js'

type Subscriber = () => void

export class HoverStore {
  private hovered: ElementId | null = null
  private readonly subscribers = new Set<Subscriber>()

  get(): ElementId | null {
    return this.hovered
  }

  set(id: ElementId | null): void {
    if (this.hovered === id) return
    this.hovered = id
    this.subscribers.forEach((cb) => cb())
  }

  subscribe(cb: Subscriber): () => void {
    this.subscribers.add(cb)
    return () => this.subscribers.delete(cb)
  }

  clear(): void {
    this.subscribers.clear()
  }
}

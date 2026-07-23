import { createContext, useContext, type ReactNode } from 'react'
import type { EditorController, SceneStore } from '@freedraw/engine'
import type { BoardExport } from '@/hooks/board/use-export.js'
import type { PageSync } from '@/lib/persistence'

export type BoardScope = 'view' | 'edit'

export interface BoardContextValue {
  store: SceneStore
  controller: EditorController | null
  boardExport: BoardExport
  theme: 'light' | 'dark'
  readOnly: boolean
  scope: BoardScope
  openImagePicker: () => void
  sync: PageSync | null
}

const BoardContext = createContext<BoardContextValue | null>(null)

export function BoardProvider({
  value,
  children,
}: {
  value: BoardContextValue
  children: ReactNode
}) {
  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>
}

export function useBoardContext(): BoardContextValue {
  const context = useContext(BoardContext)
  if (!context) throw new Error('useBoardContext must be used within a BoardProvider')
  return context
}

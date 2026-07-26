import { Wand2 } from 'lucide-react'
import { canTidy, tidyDiagram } from '@freedraw/engine'
import type { BoardAction } from '../board-actions.js'

export const TIDY_ACTION: BoardAction = {
  id: 'tidy-diagram',
  label: 'Tidy diagram',
  icon: Wand2,
  group: 'edit',
  requiresEdit: true,
  when: ({ store, readOnly }) =>
    !readOnly && canTidy(store.getSnapshot(), store.getUiState().selectedIds),
  run: ({ store }) => {
    tidyDiagram(store, { seeds: store.getUiState().selectedIds })
  },
}

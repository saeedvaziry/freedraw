import { createBinding } from '../connectors/binding.js'
import { createArrow, createId, createShape, createText } from '../model/factory.js'
import { defaultAppState } from '../model/schema.js'
import { buildStencil } from '../store/stencil.js'
import type { Stencil, Template } from '../store/stencil.js'
import type {
  ArrowElement,
  Element,
  ElementId,
  SceneSnapshot,
  ShapeElement,
} from '../model/types.js'

export type LibraryCategory = 'flowchart' | 'uml' | 'erd' | 'kanban' | 'wireframe'

export type BuiltinStencil = Stencil & { category: LibraryCategory }
export type BuiltinTemplate = Template & { category: LibraryCategory }

const BINDING_GAP = 6

interface EntryInput {
  id: string
  name: string
  category: LibraryCategory
  elements: Element[]
}

function labeled(shape: ShapeElement, text: string): ShapeElement {
  shape.label = { text, align: 'center', verticalAlign: 'middle' }
  return shape
}

function grouped(elements: Element[]): Element[] {
  const groupId = createId()
  for (const element of elements) element.groupId = groupId
  return elements
}

function connect(source: ShapeElement, target: ShapeElement): ArrowElement {
  const sourcePort = { x: source.x + source.width / 2, y: source.y + source.height }
  const targetPort = { x: target.x + target.width / 2, y: target.y }
  return createArrow({
    points: [sourcePort, targetPort],
    start: createBinding(source, sourcePort, BINDING_GAP, targetPort),
    end: createBinding(target, targetPort, BINDING_GAP, sourcePort),
    routing: 'orthogonal',
  })
}

function divider(width: number, y: number): ArrowElement {
  return createArrow({
    type: 'line',
    points: [
      { x: 0, y },
      { x: width, y },
    ],
  })
}

function snapshotOf(elements: Element[]): SceneSnapshot {
  const map: Record<ElementId, Element> = {}
  const order: ElementId[] = []
  for (const element of elements) {
    map[element.id] = element
    order.push(element.id)
  }
  return { elements: map, order, appState: defaultAppState() }
}

function stencilEntry(input: EntryInput): BuiltinStencil {
  const stencil = buildStencil(
    snapshotOf(input.elements),
    input.elements.map((element) => element.id),
    { name: input.name, kind: 'stencil' },
  )
  if (!stencil) throw new Error(`unable to build builtin stencil: ${input.id}`)
  return { ...stencil, id: input.id, category: input.category }
}

function templateEntry(input: EntryInput): BuiltinTemplate {
  const stencil = buildStencil(
    snapshotOf(input.elements),
    input.elements.map((element) => element.id),
    { name: input.name, kind: 'template' },
  )
  if (!stencil) throw new Error(`unable to build builtin template: ${input.id}`)
  return { ...stencil, kind: 'template', id: input.id, category: input.category }
}

function flowchartTerminator(): Element[] {
  return [
    labeled(
      createShape({ type: 'roundRect', x: 0, y: 0, width: 160, height: 60, style: { roundness: 30 } }),
      'Start / End',
    ),
  ]
}

function flowchartProcess(): Element[] {
  return [labeled(createShape({ type: 'roundRect', x: 0, y: 0, width: 160, height: 80 }), 'Process')]
}

function flowchartDecision(): Element[] {
  return [labeled(createShape({ type: 'diamond', x: 0, y: 0, width: 180, height: 110 }), 'Decision?')]
}

function flowchartSkeleton(): Element[] {
  const start = labeled(
    createShape({ type: 'roundRect', x: 10, y: 0, width: 160, height: 60, style: { roundness: 30 } }),
    'Start',
  )
  const process = labeled(
    createShape({ type: 'roundRect', x: 10, y: 160, width: 160, height: 80 }),
    'Process',
  )
  const decision = labeled(
    createShape({ type: 'diamond', x: 0, y: 320, width: 180, height: 110 }),
    'Decision?',
  )
  const end = labeled(
    createShape({ type: 'roundRect', x: 10, y: 510, width: 160, height: 60, style: { roundness: 30 } }),
    'End',
  )
  const arrows = [connect(start, process), connect(process, decision), connect(decision, end)]
  return grouped([start, process, decision, end, ...arrows])
}

function umlClass(): Element[] {
  const width = 200
  const box = createShape({ type: 'rect', x: 0, y: 0, width, height: 160 })
  const title = createText({ x: 0, y: 12, width, height: 28, text: 'ClassName', style: { fontSize: 20 } })
  const attributes = createText({
    x: 12,
    y: 62,
    width: width - 24,
    height: 40,
    text: '- id: number\n- name: string',
    style: { fontSize: 16, textAlign: 'left' },
  })
  const methods = createText({
    x: 12,
    y: 122,
    width: width - 24,
    height: 24,
    text: '+ save(): void',
    style: { fontSize: 16, textAlign: 'left' },
  })
  return grouped([box, title, divider(width, 52), attributes, divider(width, 110), methods])
}

function erdEntity(): Element[] {
  const width = 180
  const box = createShape({ type: 'rect', x: 0, y: 0, width, height: 130 })
  const title = createText({ x: 0, y: 12, width, height: 26, text: 'Entity', style: { fontSize: 20 } })
  const fields = createText({
    x: 12,
    y: 56,
    width: width - 24,
    height: 64,
    text: 'PK  id\n    name\n    created_at',
    style: { fontSize: 16, textAlign: 'left' },
  })
  return grouped([box, title, divider(width, 46), fields])
}

function kanbanCard(): Element[] {
  const card = createShape({
    type: 'roundRect',
    x: 0,
    y: 0,
    width: 200,
    height: 80,
    style: { roundness: 10 },
  })
  const title = createText({
    x: 12,
    y: 14,
    width: 176,
    height: 24,
    text: 'Task title',
    style: { fontSize: 18, textAlign: 'left' },
  })
  const meta = createText({
    x: 12,
    y: 46,
    width: 176,
    height: 20,
    text: 'Assignee',
    style: { fontSize: 14, textAlign: 'left' },
  })
  return grouped([card, title, meta])
}

function boardCard(x: number, y: number, text: string): Element[] {
  const card = createShape({
    type: 'roundRect',
    x,
    y,
    width: 196,
    height: 64,
    style: { roundness: 8 },
  })
  const title = createText({
    x: x + 12,
    y: y + 20,
    width: 172,
    height: 24,
    text,
    style: { fontSize: 16, textAlign: 'left' },
  })
  return [card, title]
}

function kanbanBoard(): Element[] {
  const columns = ['To Do', 'In Progress', 'Done']
  const columnWidth = 220
  const columnGap = 24
  const columnHeight = 420
  const elements: Element[] = []
  columns.forEach((name, index) => {
    const x = index * (columnWidth + columnGap)
    elements.push(
      createShape({
        type: 'roundRect',
        x,
        y: 0,
        width: columnWidth,
        height: columnHeight,
        style: { roundness: 12 },
      }),
    )
    elements.push(
      createText({
        x: x + 16,
        y: 16,
        width: columnWidth - 32,
        height: 26,
        text: name,
        style: { fontSize: 20, textAlign: 'left' },
      }),
    )
  })
  elements.push(...boardCard(12, 60, 'Task 1'))
  elements.push(...boardCard(12, 150, 'Task 2'))
  return grouped(elements)
}

function wireframeCard(): Element[] {
  const width = 220
  const card = createShape({
    type: 'roundRect',
    x: 0,
    y: 0,
    width,
    height: 200,
    style: { roundness: 12 },
  })
  const media = createShape({ type: 'rect', x: 16, y: 16, width: width - 32, height: 90 })
  const title = createText({
    x: 16,
    y: 118,
    width: width - 32,
    height: 24,
    text: 'Card title',
    style: { fontSize: 18, textAlign: 'left' },
  })
  const body = createText({
    x: 16,
    y: 148,
    width: width - 32,
    height: 40,
    text: 'Supporting text goes here.',
    style: { fontSize: 14, textAlign: 'left' },
  })
  return grouped([card, media, title, body])
}

function wireframeButton(): Element[] {
  return [
    labeled(
      createShape({ type: 'roundRect', x: 0, y: 0, width: 140, height: 44, style: { roundness: 8 } }),
      'Button',
    ),
  ]
}

export const builtinStencils: BuiltinStencil[] = [
  stencilEntry({
    id: 'builtin/flowchart/terminator',
    name: 'Terminator',
    category: 'flowchart',
    elements: flowchartTerminator(),
  }),
  stencilEntry({
    id: 'builtin/flowchart/process',
    name: 'Process',
    category: 'flowchart',
    elements: flowchartProcess(),
  }),
  stencilEntry({
    id: 'builtin/flowchart/decision',
    name: 'Decision',
    category: 'flowchart',
    elements: flowchartDecision(),
  }),
  stencilEntry({ id: 'builtin/uml/class', name: 'Class', category: 'uml', elements: umlClass() }),
  stencilEntry({ id: 'builtin/erd/entity', name: 'Entity', category: 'erd', elements: erdEntity() }),
  stencilEntry({ id: 'builtin/kanban/card', name: 'Card', category: 'kanban', elements: kanbanCard() }),
  stencilEntry({
    id: 'builtin/wireframe/card',
    name: 'Card',
    category: 'wireframe',
    elements: wireframeCard(),
  }),
  stencilEntry({
    id: 'builtin/wireframe/button',
    name: 'Button',
    category: 'wireframe',
    elements: wireframeButton(),
  }),
]

export const builtinTemplates: BuiltinTemplate[] = [
  templateEntry({
    id: 'builtin/flowchart/skeleton',
    name: 'Flowchart skeleton',
    category: 'flowchart',
    elements: flowchartSkeleton(),
  }),
  templateEntry({
    id: 'builtin/kanban/board',
    name: 'Kanban board',
    category: 'kanban',
    elements: kanbanBoard(),
  }),
]

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

function connectRight(source: ShapeElement, target: ShapeElement): ArrowElement {
  const sourcePort = { x: source.x + source.width, y: source.y + source.height / 2 }
  const targetPort = { x: target.x, y: target.y + target.height / 2 }
  return createArrow({
    points: [sourcePort, targetPort],
    start: createBinding(source, sourcePort, BINDING_GAP, targetPort),
    end: createBinding(target, targetPort, BINDING_GAP, sourcePort),
    routing: 'orthogonal',
  })
}

function connectUp(source: ShapeElement, target: ShapeElement): ArrowElement {
  const sourcePort = { x: source.x + source.width / 2, y: source.y }
  const targetPort = { x: target.x + target.width / 2, y: target.y + target.height }
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

function flowchartData(): Element[] {
  return [labeled(createShape({ type: 'parallelogram', x: 0, y: 0, width: 170, height: 70 }), 'Data')]
}

function flowchartDatabase(): Element[] {
  return [labeled(createShape({ type: 'cylinder', x: 0, y: 0, width: 120, height: 140 }), 'Database')]
}

function umlInterface(): Element[] {
  const width = 200
  const box = createShape({ type: 'rect', x: 0, y: 0, width, height: 150 })
  const stereotype = createText({
    x: 0,
    y: 10,
    width,
    height: 20,
    text: '«interface»',
    style: { fontSize: 14 },
  })
  const title = createText({ x: 0, y: 32, width, height: 26, text: 'Repository', style: { fontSize: 20 } })
  const methods = createText({
    x: 12,
    y: 78,
    width: width - 24,
    height: 60,
    text: '+ find(id): T\n+ save(entity): void\n+ delete(id): void',
    style: { fontSize: 16, textAlign: 'left' },
  })
  return grouped([box, stereotype, title, divider(width, 68), methods])
}

function umlState(): Element[] {
  return [
    labeled(
      createShape({ type: 'roundRect', x: 0, y: 0, width: 160, height: 70, style: { roundness: 16 } }),
      'State',
    ),
  ]
}

function erdRelationship(): Element[] {
  return [labeled(createShape({ type: 'diamond', x: 0, y: 0, width: 180, height: 110 }), 'Relationship')]
}

function wireframeInput(): Element[] {
  const width = 240
  const field = createShape({ type: 'roundRect', x: 0, y: 0, width, height: 48, style: { roundness: 8 } })
  const placeholder = createText({
    x: 14,
    y: 14,
    width: width - 28,
    height: 20,
    text: 'Placeholder',
    style: { fontSize: 16, textAlign: 'left' },
  })
  return grouped([field, placeholder])
}

function wireframeNavbar(): Element[] {
  const width = 480
  const bar = createShape({ type: 'rect', x: 0, y: 0, width, height: 56 })
  const brand = createText({
    x: 16,
    y: 16,
    width: 160,
    height: 24,
    text: 'Brand',
    style: { fontSize: 20, textAlign: 'left' },
  })
  const links = createText({
    x: width - 248,
    y: 18,
    width: 232,
    height: 20,
    text: 'Home    Docs    About',
    style: { fontSize: 16, textAlign: 'right' },
  })
  return grouped([bar, brand, links])
}

function erdBox(
  x: number,
  y: number,
  title: string,
  fields: string,
): { box: ShapeElement; elements: Element[] } {
  const width = 180
  const box = createShape({ type: 'rect', x, y, width, height: 130 })
  const heading = createText({ x, y: y + 12, width, height: 26, text: title, style: { fontSize: 18 } })
  const line = createArrow({
    type: 'line',
    points: [
      { x, y: y + 46 },
      { x: x + width, y: y + 46 },
    ],
  })
  const body = createText({
    x: x + 12,
    y: y + 56,
    width: width - 24,
    height: 64,
    text: fields,
    style: { fontSize: 16, textAlign: 'left' },
  })
  return { box, elements: [box, heading, line, body] }
}

function umlLifeline(x: number, name: string, bottom: number): Element[] {
  const width = 120
  const head = labeled(createShape({ type: 'rect', x, y: 0, width, height: 44 }), name)
  const centerX = x + width / 2
  const line = createArrow({
    type: 'line',
    points: [
      { x: centerX, y: 44 },
      { x: centerX, y: bottom },
    ],
    style: { strokeStyle: 'dashed' },
  })
  return [head, line]
}

function sequenceMessage(fromX: number, toX: number, y: number, text: string, dashed = false): Element[] {
  const arrow = createArrow({
    points: [
      { x: fromX, y },
      { x: toX, y },
    ],
    style: dashed ? { strokeStyle: 'dashed' } : {},
  })
  const label = createText({
    x: Math.min(fromX, toX),
    y: y - 24,
    width: Math.abs(toX - fromX),
    height: 20,
    text,
    style: { fontSize: 14 },
  })
  return [arrow, label]
}

function umlSequence(): Element[] {
  const bottom = 320
  const client = umlLifeline(0, 'Client', bottom)
  const server = umlLifeline(240, 'Server', bottom)
  const clientX = 60
  const serverX = 300
  const messages = [
    ...sequenceMessage(clientX, serverX, 110, 'request()'),
    ...sequenceMessage(serverX, clientX, 190, 'response', true),
    ...sequenceMessage(clientX, serverX, 270, 'ack()'),
  ]
  return grouped([...client, ...server, ...messages])
}

function umlStateMachine(): Element[] {
  const initial = createShape({ type: 'ellipse', x: 68, y: 0, width: 24, height: 24 })
  const idle = labeled(
    createShape({ type: 'roundRect', x: 0, y: 90, width: 160, height: 64, style: { roundness: 16 } }),
    'Idle',
  )
  const active = labeled(
    createShape({ type: 'roundRect', x: 0, y: 244, width: 160, height: 64, style: { roundness: 16 } }),
    'Active',
  )
  const final = createShape({ type: 'ellipse', x: 68, y: 398, width: 24, height: 24 })
  const arrows = [connect(initial, idle), connect(idle, active), connect(active, final)]
  return grouped([initial, idle, active, final, ...arrows])
}

function flowchartSwimlane(): Element[] {
  const laneWidth = 700
  const laneHeight = 150
  const headWidth = 140
  const headA = labeled(
    createShape({ type: 'rect', x: 0, y: 0, width: headWidth, height: laneHeight }),
    'Customer',
  )
  const bodyA = createShape({
    type: 'rect',
    x: headWidth,
    y: 0,
    width: laneWidth - headWidth,
    height: laneHeight,
  })
  const headB = labeled(
    createShape({ type: 'rect', x: 0, y: laneHeight, width: headWidth, height: laneHeight }),
    'System',
  )
  const bodyB = createShape({
    type: 'rect',
    x: headWidth,
    y: laneHeight,
    width: laneWidth - headWidth,
    height: laneHeight,
  })
  const place = labeled(
    createShape({ type: 'roundRect', x: 200, y: 44, width: 150, height: 62, style: { roundness: 10 } }),
    'Place order',
  )
  const validate = labeled(
    createShape({ type: 'roundRect', x: 200, y: 194, width: 150, height: 62, style: { roundness: 10 } }),
    'Validate',
  )
  const charge = labeled(
    createShape({ type: 'roundRect', x: 440, y: 194, width: 150, height: 62, style: { roundness: 10 } }),
    'Charge',
  )
  const confirm = labeled(
    createShape({ type: 'roundRect', x: 440, y: 44, width: 150, height: 62, style: { roundness: 10 } }),
    'Confirm',
  )
  const arrows = [connect(place, validate), connectRight(validate, charge), connectUp(charge, confirm)]
  return grouped([headA, bodyA, headB, bodyB, place, validate, charge, confirm, ...arrows])
}

function erdOneToMany(): Element[] {
  const user = erdBox(0, 0, 'User', 'PK  id\n    name\n    email')
  const order = erdBox(0, 280, 'Order', 'PK  id\n    FK user_id\n    total')
  const link = connect(user.box, order.box)
  const one = createText({ x: 100, y: 138, width: 30, height: 20, text: '1', style: { fontSize: 16 } })
  const many = createText({ x: 100, y: 250, width: 30, height: 20, text: 'N', style: { fontSize: 16 } })
  return grouped([...user.elements, ...order.elements, link, one, many])
}

function erdManyToMany(): Element[] {
  const user = erdBox(0, 40, 'User', 'PK  id\n    name')
  const junction = erdBox(250, 40, 'user_product', 'FK  user_id\nFK  product_id')
  const product = erdBox(500, 40, 'Product', 'PK  id\n    title')
  const left = connectRight(user.box, junction.box)
  const right = connectRight(junction.box, product.box)
  const many = createText({ x: 196, y: 112, width: 30, height: 20, text: 'N', style: { fontSize: 16 } })
  const more = createText({ x: 446, y: 112, width: 30, height: 20, text: 'M', style: { fontSize: 16 } })
  return grouped([...user.elements, ...junction.elements, ...product.elements, left, right, many, more])
}

function wireframeLogin(): Element[] {
  const width = 300
  const panel = createShape({ type: 'roundRect', x: 0, y: 0, width, height: 296, style: { roundness: 16 } })
  const heading = createText({
    x: 24,
    y: 28,
    width: width - 48,
    height: 30,
    text: 'Sign in',
    style: { fontSize: 24, textAlign: 'left' },
  })
  const emailField = createShape({
    type: 'roundRect',
    x: 24,
    y: 84,
    width: width - 48,
    height: 44,
    style: { roundness: 8 },
  })
  const emailText = createText({
    x: 38,
    y: 96,
    width: width - 76,
    height: 20,
    text: 'Email',
    style: { fontSize: 14, textAlign: 'left' },
  })
  const passwordField = createShape({
    type: 'roundRect',
    x: 24,
    y: 144,
    width: width - 48,
    height: 44,
    style: { roundness: 8 },
  })
  const passwordText = createText({
    x: 38,
    y: 156,
    width: width - 76,
    height: 20,
    text: 'Password',
    style: { fontSize: 14, textAlign: 'left' },
  })
  const submit = labeled(
    createShape({ type: 'roundRect', x: 24, y: 212, width: width - 48, height: 48, style: { roundness: 8 } }),
    'Log in',
  )
  return grouped([panel, heading, emailField, emailText, passwordField, passwordText, submit])
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
  stencilEntry({
    id: 'builtin/flowchart/data',
    name: 'Data',
    category: 'flowchart',
    elements: flowchartData(),
  }),
  stencilEntry({
    id: 'builtin/flowchart/database',
    name: 'Database',
    category: 'flowchart',
    elements: flowchartDatabase(),
  }),
  stencilEntry({
    id: 'builtin/uml/interface',
    name: 'Interface',
    category: 'uml',
    elements: umlInterface(),
  }),
  stencilEntry({ id: 'builtin/uml/state', name: 'State', category: 'uml', elements: umlState() }),
  stencilEntry({
    id: 'builtin/erd/relationship',
    name: 'Relationship',
    category: 'erd',
    elements: erdRelationship(),
  }),
  stencilEntry({
    id: 'builtin/wireframe/input',
    name: 'Input',
    category: 'wireframe',
    elements: wireframeInput(),
  }),
  stencilEntry({
    id: 'builtin/wireframe/navbar',
    name: 'Nav bar',
    category: 'wireframe',
    elements: wireframeNavbar(),
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
  templateEntry({
    id: 'builtin/flowchart/swimlane',
    name: 'Swimlane',
    category: 'flowchart',
    elements: flowchartSwimlane(),
  }),
  templateEntry({
    id: 'builtin/uml/sequence',
    name: 'Sequence diagram',
    category: 'uml',
    elements: umlSequence(),
  }),
  templateEntry({
    id: 'builtin/uml/state-machine',
    name: 'State machine',
    category: 'uml',
    elements: umlStateMachine(),
  }),
  templateEntry({
    id: 'builtin/erd/one-to-many',
    name: 'One to many',
    category: 'erd',
    elements: erdOneToMany(),
  }),
  templateEntry({
    id: 'builtin/erd/many-to-many',
    name: 'Many to many',
    category: 'erd',
    elements: erdManyToMany(),
  }),
  templateEntry({
    id: 'builtin/wireframe/login',
    name: 'Login form',
    category: 'wireframe',
    elements: wireframeLogin(),
  }),
]

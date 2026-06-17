import '@fontsource/architects-daughter/400.css'
import { buildScene, mount } from '@freedraw/diagram'

const DIAGRAM_LANGUAGE = 'freedraw'

interface Segment {
  type: 'text' | 'diagram'
  content: string
}

function splitSegments(markdown: string): Segment[] {
  const fence = /```(\w+)?\n([\s\S]*?)```/g
  const segments: Segment[] = []
  let lastIndex = 0

  for (let match = fence.exec(markdown); match; match = fence.exec(markdown)) {
    const [block, language = '', code = ''] = match
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: markdown.slice(lastIndex, match.index) })
    }
    const isDiagram = language === DIAGRAM_LANGUAGE
    segments.push({
      type: isDiagram ? 'diagram' : 'text',
      content: isDiagram ? code : block,
    })
    lastIndex = match.index + block.length
  }

  if (lastIndex < markdown.length) {
    segments.push({ type: 'text', content: markdown.slice(lastIndex) })
  }
  return segments
}

function renderDiagram(parent: HTMLElement, code: string): void {
  const container = document.createElement('div')
  container.className = 'block'
  parent.appendChild(container)

  const { errors } = buildScene(code)
  if (errors.length > 0) {
    const message = errors.map((error) => `line ${error.line}: ${error.message}`).join('\n')
    const pre = document.createElement('pre')
    pre.className = 'error'
    pre.textContent = message
    container.appendChild(pre)
    return
  }

  mount(container, code, { scale: 2, padding: 24, background: '#ffffff' })
}

function renderText(parent: HTMLElement, text: string): void {
  const trimmed = text.trim()
  if (!trimmed) return
  const paragraph = document.createElement('p')
  paragraph.textContent = trimmed
  parent.appendChild(paragraph)
}

function render(markdown: string): void {
  const output = document.getElementById('output')
  if (!output) return
  output.innerHTML = ''
  for (const segment of splitSegments(markdown)) {
    if (segment.type === 'diagram') renderDiagram(output, segment.content)
    else renderText(output, segment.content)
  }
}

const SAMPLE = `# Deploy flow

A diagram embedded in markdown, rendered by @freedraw/diagram.

\`\`\`freedraw
flowchart TD
A[Push] --> B{CI passes?}
B -->|yes| C[Deploy]
B -->|no| A
C --> D[(Production)]
\`\`\`

Fan-out pipelines read well left to right.

\`\`\`freedraw
flowchart LR
api[API] --> users[Users]
api --> orders[Orders]
api --> billing[Billing]
\`\`\`
`

const source = document.getElementById('source') as HTMLTextAreaElement | null
if (source) {
  source.value = SAMPLE
  source.addEventListener('input', () => render(source.value))
  render(source.value)
}

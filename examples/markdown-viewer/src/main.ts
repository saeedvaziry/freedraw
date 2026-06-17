import '@fontsource/architects-daughter/400.css'
import { buildScene, mount, type BuildSceneOptions, type RenderOptions } from '@freedraw/diagram'

const DIAGRAM_LANGUAGE = 'freedraw'

const RENDER: RenderOptions = { scale: 2, padding: 24, background: '#ffffff' }

const SKETCHY_STYLE: BuildSceneOptions['style'] = {
  sloppiness: 0.5,
  fontFamily: "'Architects Daughter', cursive",
}

interface Segment {
  type: 'text' | 'diagram'
  content: string
  sketchy?: boolean
}

function splitSegments(markdown: string): Segment[] {
  const fence = /```([\w-]+)?(?: +(\w+))?\n([\s\S]*?)```/g
  const segments: Segment[] = []
  let lastIndex = 0

  for (let match = fence.exec(markdown); match; match = fence.exec(markdown)) {
    const [block, language = '', modifier = '', code = ''] = match
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: markdown.slice(lastIndex, match.index) })
    }
    const isDiagram = language === DIAGRAM_LANGUAGE
    segments.push({
      type: isDiagram ? 'diagram' : 'text',
      content: isDiagram ? code : block,
      sketchy: modifier === 'sketchy',
    })
    lastIndex = match.index + block.length
  }

  if (lastIndex < markdown.length) {
    segments.push({ type: 'text', content: markdown.slice(lastIndex) })
  }
  return segments
}

function renderDiagram(parent: HTMLElement, code: string, sketchy: boolean): void {
  const container = document.createElement('div')
  container.className = 'block'
  parent.appendChild(container)

  const scene = buildScene(code, sketchy ? { style: SKETCHY_STYLE } : {})
  if (scene.errors.length > 0) {
    const message = scene.errors.map((error) => `line ${error.line}: ${error.message}`).join('\n')
    const pre = document.createElement('pre')
    pre.className = 'error'
    pre.textContent = message
    container.appendChild(pre)
    return
  }

  mount(container, scene, RENDER)
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
    if (segment.type === 'diagram') renderDiagram(output, segment.content, segment.sketchy ?? false)
    else renderText(output, segment.content)
  }
}

const SAMPLE = `# Deploy flow

A diagram embedded in markdown, rendered by @freedraw/diagram. The default look is
clean — no sloppiness and a sans-serif font.

\`\`\`freedraw
flowchart TD
A[Push] --> B{CI passes?}
B -->|yes| C[Deploy]
B -->|no| A
C --> D[(Production)]
\`\`\`

Add \`sketchy\` after the language to render the same diagram with the hand-drawn style
(raised sloppiness + the Architects Daughter font), passed via the \`style\` option.

\`\`\`freedraw sketchy
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

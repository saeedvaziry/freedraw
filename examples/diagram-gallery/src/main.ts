import { buildScene, mount, type RenderOptions } from '@freedraw/diagram'

const RENDER: RenderOptions = { scale: 2, padding: 24, background: '#ffffff' }

interface Sample {
  title: string
  code: string
}

const SAMPLES: Sample[] = [
  {
    title: 'Deployment tree (TD)',
    code: `flowchart TD
projectDefault[Project Default]
applicationMdbin[Application mdbin]
environmentTest[Environment Test]
environmentProd[Environment Prod]
deploymentServerA[Deployment Server A]
deploymentServerC[Deployment Server C]
applicationSimple[Application simple]
environmentDefault[Environment Default]
projectDefault --> applicationMdbin
applicationMdbin --> environmentTest
applicationMdbin --> environmentProd
environmentTest --> deploymentServerA
environmentProd --> deploymentServerC
projectDefault --> applicationSimple
applicationSimple --> environmentDefault`,
  },
  {
    title: 'CI pipeline with cycle (TD)',
    code: `flowchart TD
push[Push] --> ci{CI passes?}
ci -->|yes| deploy[Deploy]
ci -->|no| push
deploy --> prod[(Production)]`,
  },
  {
    title: 'Service fan-out (LR)',
    code: `flowchart LR
api[API] --> users[Users]
api --> orders[Orders]
api --> billing[Billing]
billing --> ledger[(Ledger)]`,
  },
  {
    title: 'Mixed shapes (TD)',
    code: `flowchart TD
start((Start))
gate{Approve?}
queue{{Queue}}
db[(Database)]
note[/Receipt/]
start --> gate
gate --> queue
queue --> db
gate --> note`,
  },
  {
    title: 'Org chart (TD)',
    code: `flowchart TD
ceo[CEO]
cto[CTO]
cfo[CFO]
eng[Engineering]
data[Data]
finance[Finance]
ceo --> cto
ceo --> cfo
cto --> eng
cto --> data
cfo --> finance`,
  },
  {
    title: 'Right-to-left (RL)',
    code: `flowchart RL
out[Output] --> step3[Reduce]
step3 --> step2[Map]
step2 --> step1[Source]`,
  },
  {
    title: 'Bottom-up (BT)',
    code: `flowchart BT
seed[Seedling] --> sprout[Sprout]
sprout --> tree[Tree]
tree --> fruit((Fruit))`,
  },
  {
    title: 'Edge styles (TD)',
    code: `flowchart TD
a[Source] --> b[Solid]
a -.-> c[Dotted]
a ==> d[Thick]
a --o e[Circle]
a --x f[Cross]`,
  },
  {
    title: 'Wide hierarchy (TD)',
    code: `flowchart TD
root[Platform]
root --> web[Web]
root --> mobile[Mobile]
root --> infra[Infra]
web --> spa[SPA]
web --> ssr[SSR]
mobile --> ios[iOS]
mobile --> android[Android]
infra --> k8s[K8s]
infra --> cdn[CDN]`,
  },
  {
    title: 'Linear flow with labels (LR)',
    code: `flowchart LR
draft[Draft] -->|submit| review{Review}
review -->|approve| publish[Publish]
review -->|reject| draft`,
  },
]

function renderSample(grid: HTMLElement, sample: Sample): void {
  const card = document.createElement('div')
  card.className = 'card'

  const heading = document.createElement('h2')
  heading.textContent = sample.title
  card.appendChild(heading)

  const surface = document.createElement('div')
  surface.className = 'surface'
  card.appendChild(surface)

  const code = document.createElement('pre')
  code.textContent = sample.code
  card.appendChild(code)

  grid.appendChild(card)

  const scene = buildScene(sample.code)
  if (scene.errors.length > 0) {
    const error = document.createElement('div')
    error.className = 'error'
    error.textContent = scene.errors.map((e) => `line ${e.line}: ${e.message}`).join('\n')
    surface.appendChild(error)
    return
  }
  mount(surface, scene, RENDER)
}

function render(): void {
  const grid = document.getElementById('grid')
  if (!grid) return
  for (const sample of SAMPLES) renderSample(grid, sample)
}

render()

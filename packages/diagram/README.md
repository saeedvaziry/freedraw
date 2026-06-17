# @freedraw/diagram

Embeddable renderer for [FreeDraw](https://github.com/saeedvaziry/freedraw) diagram
code — a focused subset of [Mermaid](https://mermaid.js.org/syntax/flowchart.html)
flowchart syntax. Turn text into a diagram on an HTML5 canvas, with the same
hand-drawn look as the FreeDraw editor.

It is meant for embedding: render diagrams inside a markdown viewer, a docs site, a
chat UI, or anywhere you can put a canvas. The editor (tools, undo, persistence) is
**not** included — only parsing and rendering.

```bash
npm install @freedraw/diagram --ignore-scripts
```

## Quick start

```ts
import { mount } from '@freedraw/diagram'

mount(document.getElementById('chart')!, `
flowchart TD
A[Start] --> B{Ready?}
B -->|yes| C[Ship]
B -->|no| A
`)
```

For a runnable example, see [`examples/markdown-viewer`](../../examples/markdown-viewer).

## API

### `renderToCanvas(input, options?) => HTMLCanvasElement | null`

Renders diagram code (or a prebuilt scene) to a fit-to-content canvas. Returns `null`
when the input has parse errors or is empty.

```ts
const canvas = renderToCanvas('flowchart LR\nA --> B', { scale: 2 })
if (canvas) document.body.appendChild(canvas)
```

### `renderToDataURL(input, options?) => string | null`

Same render, returned as a `data:` URL — drop it straight into an `<img src>`.

### `renderToBlob(input, options?) => Promise<Blob | null>`

Same render, returned as a `Blob` for downloads or uploads.

### `mount(container, input, options?) => HTMLCanvasElement | null`

Renders and appends the canvas to `container`, sizing it to logical pixels.

### `buildScene(text, options?) => { snapshot, errors }`

The lower-level step: parse text into a renderable scene (with arrow routes resolved).
Use it to read parse `errors` before rendering, or to render the same scene repeatedly:

```ts
const scene = buildScene(code, { style: { sloppiness: 0.5 } })
if (scene.errors.length === 0) renderToCanvas(scene)
```

`style` and `direction` are build-time settings: pass them to `buildScene` (or to
`renderToCanvas`/`mount` when you give it raw code). When you render a prebuilt scene,
those render options are ignored — the scene is already laid out — so apply them here.

### Re-exports

`parseDiagram` and `serializeDiagram` (canvas → code) are re-exported from the engine,
along with the `Element`, `Style`, `SceneSnapshot`, `Direction` and related types.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `scale` | `2` | Device-pixel scale of the output canvas. |
| `padding` | `16` | Padding around the content, in diagram units. |
| `background` | `null` | Fill color, or `null` for transparent. |
| `dark` | `false` | Invert colors for dark backgrounds. |
| `format` | `'png'` | `'png'` or `'jpg'` — used by `renderToBlob` / `renderToDataURL`. |
| `quality` | `0.92` | JPEG quality (0–1). |
| `direction` | from code | Override layout direction (`TD`, `LR`, …). |
| `style` | see below | Partial style overrides (`sloppiness`, `fontFamily`, stroke, fill, …). |
| `layout` | see below | Box sizing and spacing (`uniform`, `minNodeSize`, `layerGap`, `siblingGap`). |

## Style

The `style` option is merged over the diagram defaults, so you only pass the fields you
want to change. The defaults are a clean, neutral look — no hand-drawn sloppiness and a
system sans-serif font:

| Field | Default | Description |
| --- | --- | --- |
| `sloppiness` | `0` | Hand-drawn roughness. `0` is clean/precise; raise toward `1` for a sketchy look. |
| `fontFamily` | `ui-sans-serif, system-ui, …` | Text font. |
| `fontSize` | `14` | Text size in diagram units. |

```ts
renderToCanvas(code, { style: { sloppiness: 0.5, fontFamily: 'Inter, sans-serif' } })
```

## Layout

The `layout` option controls box sizing and spacing. The defaults are compact: each node
is sized to its own label, with a small minimum and tight gaps.

| Field | Default | Description |
| --- | --- | --- |
| `uniform` | `false` | When `true`, every box is sized to the largest node (a grid look). |
| `minNodeSize` | `{ width: 80, height: 40 }` | Minimum box size; labels grow the box beyond it. |
| `layerGap` | `60` | Gap between layers (rows in `TD`, columns in `LR`). |
| `siblingGap` | `48` | Gap between siblings in the same layer. |

```ts
renderToCanvas(code, {
  layout: { layerGap: 100, siblingGap: 80, minNodeSize: { height: 56 } },
})
```

### Hand-drawn look

To match the FreeDraw editor's sketchy style, raise `sloppiness` and use the handwritten
**Architects Daughter** font. The browser must have the font loaded — either load it
yourself (e.g. `import '@fontsource/architects-daughter/400.css'`) or it falls back to a
system font:

```ts
renderToCanvas(code, {
  style: { sloppiness: 0.5, fontFamily: "'Architects Daughter', cursive" },
})
```

## Requirements

Rendering uses the DOM canvas (`document.createElement('canvas')`), so it runs in a
browser. It is not designed for server-side rendering or workers without a canvas
polyfill.

## The diagram language

The syntax (and what does / doesn't round-trip) is documented in
[`SKILL.md`](./SKILL.md), which ships with the package as a reference for AI agents and
humans alike. In short: flowcharts only, and serialization (canvas → code) is
intentionally lossy — positions, colors, freehand, images, sticky notes and unbound
arrows are not represented in code.

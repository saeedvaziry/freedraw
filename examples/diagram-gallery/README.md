# Diagram gallery example

A grid of diverse diagrams rendered with [`@freedraw/diagram`](../../packages/diagram) —
every direction (`TD`, `LR`, `RL`, `BT`), each node shape, and every edge style. Use it to
verify visually that arrows connect along the layout's main axis and route correctly.

```bash
npm run build        # build @freedraw/engine and @freedraw/diagram first (turbo handles ordering)
npm run -w @freedraw/example-diagram-gallery dev
```

Each card shows the rendered canvas above its source code, so a wrong route is easy to spot
next to the text that produced it. Edit `src/main.ts` to add or tweak samples.

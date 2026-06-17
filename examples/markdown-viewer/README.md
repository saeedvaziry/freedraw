# Markdown viewer example

A minimal demo that embeds [`@freedraw/diagram`](../../packages/diagram) in a markdown
preview. Fenced ` ```freedraw ` code blocks are rendered to a canvas; everything else is
shown as text.

```bash
npm run build        # build @freedraw/engine and @freedraw/diagram first (turbo handles ordering)
npm run -w @freedraw/example-markdown-viewer dev
```

The interesting part is `src/main.ts`: it scans the markdown for fenced diagram blocks
and calls `mount(container, scene, options)` for each — the same way any external consumer
would. Diagrams render with the clean defaults (no sloppiness, sans-serif font); adding
`sketchy` after the language (` ```freedraw sketchy `) passes a `style` override to render
the hand-drawn look. That handwritten font is loaded via `@fontsource/architects-daughter`;
without it text falls back to a system font.

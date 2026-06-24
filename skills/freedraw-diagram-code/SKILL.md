---
name: freedraw-diagram-code
description: Write and read FreeDraw diagram code — a focused subset of Mermaid flowchart syntax that converts text to diagrams and back. Use when a user wants to generate a FreeDraw board from text, edit a diagram as code, or understand the syntax FreeDraw's "Diagram code" panel accepts.
---

# FreeDraw Diagram Code

FreeDraw's "Diagram code" panel converts text into a diagram on the canvas and serializes the canvas back to text. The language is a focused subset of [Mermaid](https://mermaid.js.org/syntax/flowchart.html) flowchart syntax. Only flowcharts are supported (no sequence, class, state, gantt, etc.).

Paste code into the panel and click **Generate diagram** to render it. The panel's "Current diagram" view shows the canvas serialized back to this syntax.

## When to use

- The user asks to create a FreeDraw diagram from a description ("draw a flow for X").
- The user wants to edit an existing FreeDraw diagram as text.
- The user pastes Mermaid and asks whether FreeDraw will accept it.

Produce code in the exact syntax below. Prefer the **canonical forms** (marked ✅) — they are what FreeDraw emits when serializing, so using them keeps round-trips stable.

## Document shape

```
flowchart <DIRECTION>
<node declarations>
<edges>
```

- Line 1 is the header: `flowchart` or `graph`, then a direction. If omitted, direction defaults to `TD`.
- One statement per line. A statement is either a node declaration or an edge. Statements may also be ended with `;`.
- Lines beginning with `%%` are comments and are ignored. Blank lines are ignored.

## Direction

| Keyword | Meaning |
| --- | --- |
| `TD` ✅ / `TB` | Top to bottom |
| `BT` | Bottom to top |
| `LR` | Left to right |
| `RL` | Right to left |

Layout is automatic. In `TD`, a parent sits centered above its children, which spread across a row. In `LR`, children stack in a column to the right. Choose `LR` for wide fan-outs and step-by-step flows; `TD` for hierarchies and decisions.

## Nodes

A node is an identifier optionally followed by a bracketed label. The bracket style selects the shape. Identifiers match `[A-Za-z0-9_]+` and must start with a letter or digit.

| Syntax | Shape | Canonical |
| --- | --- | --- |
| `A[Text]` | rectangle | ✅ |
| `A(Text)` | rounded rectangle | ✅ |
| `A([Text])` | rounded rectangle (stadium alias) | |
| `A((Text))` | ellipse | ✅ |
| `A{Text}` | diamond | ✅ |
| `A{{Text}}` | hexagon | ✅ |
| `A[/Text/]` | parallelogram | ✅ |
| `A[(Text)]` | cylinder | ✅ |
| `A>Text]` | triangle | ✅ |

Rules:

- Declare a node's label on first mention, then reference it by id alone. `A[Start]` once, then `A` afterwards.
- A bare id with no bracket (e.g. `A`) creates a plain rectangle if the node is new, or reuses an existing node.
- To put brackets or symbols inside a label, wrap it in double quotes: `A["count (n)"]`. Inside quotes, escape an inner `"` by using a single quote.
- Brackets are matched longest-first, so `((` is an ellipse (not two rounded rects) and `[(` is a cylinder.

## Edges

An edge connects two nodes with an operator that sets the line style and arrowheads.

| Syntax | Line | Arrowheads | Canonical |
| --- | --- | --- | --- |
| `A --> B` | solid | end: arrow | ✅ |
| `A --- B` | solid | none | ✅ |
| `A -.-> B` | dotted | end: arrow | ✅ |
| `A ==> B` | thick | end: arrow | ✅ |
| `A --o B` | solid | end: circle | ✅ |
| `A --x B` | solid | end: cross | ✅ |
| `A <--> B` | solid | both: arrow | ✅ |

### Edge labels

Two forms parse; the pipe form is canonical.

```
A -->|yes| B      ✅
A -- yes --> B
A == yes ==> B
```

### Chaining

Connect several nodes on one line. Each adjacent pair becomes its own edge.

```
A --> B --> C --> D
```

`A --> B --> C` is equivalent to `A --> B` and `B --> C`.

## What does not round-trip

Serialization (canvas → code) is intentionally lossy:

- Exact positions, sizes, rotation, colors, opacity, and fonts are not stored in the code. Re-generating lays the diagram out fresh.
- Elements with no text equivalent are skipped and not emitted: freehand drawings, images, sticky notes, plain text elements, and arrows that are not bound to two nodes on both ends.
- When serializing, node ids are derived from labels (e.g. `User DB` → `userDb`), de-duplicated (`save`, `save2`), and unlabeled nodes become `n1`, `n2`, …

## Worked examples

Decision flow (`TD`):

```
flowchart TD
A[Start] --> B{Ready?}
B -->|yes| C[Ship]
B -->|no| A
```

Fan-out (`LR`), the parent centered with children stacked:

```
flowchart LR
api[API] --> users[Users]
api --> orders[Orders]
api --> billing[Billing]
```

Mixed shapes and edge styles:

```
flowchart TD
db[(Database)]
cache((Cache))
queue{{Queue}}
api[API] --> cache
api -.-> db
api ==> queue
```

## Authoring checklist for agents

- Start every diagram with a `flowchart <DIRECTION>` header.
- Use canonical shape and edge tokens (the ✅ rows) so the user's edits round-trip cleanly.
- Give each node a stable id; declare the label once, reference by id after.
- Pick `LR` for fan-outs and pipelines, `TD` for hierarchies and decisions.
- Do not invent syntax outside this document (no `subgraph`, no `class`/`style` directives, no markdown in labels) — unsupported lines produce a parse error and nothing is added to the canvas.

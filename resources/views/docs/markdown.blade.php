<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <title>{{ $title }}</title>
    <style>
      :root {
        --bg: #ffffff;
        --fg: #0a0a0a;
        --muted: #6b7280;
        --border: #e5e7eb;
        --surface: #f6f7f9;
        --accent: #2563eb;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #0a0a0a;
          --fg: #f4f4f5;
          --muted: #9ca3af;
          --border: #27272a;
          --surface: #18181b;
          --accent: #60a5fa;
        }
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: var(--bg);
        color: var(--fg);
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        line-height: 1.6;
      }
      main {
        max-width: 860px;
        margin: 0 auto;
        padding: 3rem 1.5rem 5rem;
      }
      a {
        color: var(--accent);
      }
      h1 {
        font-size: 2rem;
        margin: 0 0 1rem;
      }
      h2 {
        font-size: 1.25rem;
        margin: 2.5rem 0 0.75rem;
        padding-top: 1.25rem;
        border-top: 1px solid var(--border);
      }
      h3 {
        font-size: 1rem;
        margin: 1.75rem 0 0.5rem;
      }
      p,
      ul,
      ol {
        color: var(--fg);
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.9em;
        background: var(--surface);
        padding: 0.1rem 0.35rem;
        border-radius: 0.3rem;
      }
      pre {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 0.6rem;
        padding: 1rem;
        overflow-x: auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.85rem;
        line-height: 1.5;
      }
      pre code {
        background: none;
        padding: 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 0.5rem 0;
        font-size: 0.9rem;
      }
      th,
      td {
        text-align: left;
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid var(--border);
        vertical-align: top;
      }
      th {
        color: var(--muted);
        font-weight: 600;
      }
      td code {
        white-space: nowrap;
      }
    </style>
  </head>
  <body>
    <main>
      {!! $body !!}
    </main>
  </body>
</html>

import type { Element } from '../model/types.js'

export function nodeLabel(element: Element): string {
  if (element.type === 'text') return element.text
  return element.label?.text ?? ''
}

export function deriveIds(nodes: Element[]): Map<string, string> {
  const ids = new Map<string, string>()
  const used = new Set<string>()
  let fallback = 0

  for (const node of nodes) {
    const slug = slugify(nodeLabel(node))
    const base = slug.length > 0 ? slug : `n${(fallback += 1)}`
    ids.set(node.id, unique(base, used))
  }

  return ids
}

function unique(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base)
    return base
  }
  let suffix = 2
  while (used.has(`${base}${suffix}`)) suffix += 1
  const next = `${base}${suffix}`
  used.add(next)
  return next
}

function slugify(text: string): string {
  const words = text.split(/[^A-Za-z0-9]+/).filter((word) => word.length > 0)
  if (words.length === 0) return ''
  const camel = words
    .map((word, index) => (index === 0 ? word.toLowerCase() : capitalize(word)))
    .join('')
  return /^[A-Za-z]/.test(camel) ? camel : `n${camel}`
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

export interface FuzzyResult {
  score: number
  matched: number[]
}

const CONSECUTIVE_BONUS = 8
const BOUNDARY_BONUS = 6
const START_BONUS = 4

function isWordBoundary(text: string, index: number): boolean {
  if (index === 0) return true
  const previous = text[index - 1]
  const current = text[index]
  if (previous === ' ' || previous === '-' || previous === '_' || previous === '/') return true
  return /[a-z0-9]/.test(previous) && /[A-Z]/.test(current)
}

export function fuzzyMatch(query: string, text: string): FuzzyResult | null {
  const needle = query.toLowerCase()
  const haystack = text.toLowerCase()

  if (needle.length === 0) return { score: 0, matched: [] }
  if (needle.length > haystack.length) return null

  const matched: number[] = []
  let score = 0
  let queryIndex = 0
  let previousMatch = -2

  for (let textIndex = 0; textIndex < haystack.length && queryIndex < needle.length; textIndex++) {
    if (haystack[textIndex] !== needle[queryIndex]) continue

    let point = 1
    if (previousMatch === textIndex - 1) point += CONSECUTIVE_BONUS
    if (isWordBoundary(text, textIndex)) point += BOUNDARY_BONUS
    if (textIndex === 0) point += START_BONUS

    score += point
    matched.push(textIndex)
    previousMatch = textIndex
    queryIndex++
  }

  if (queryIndex < needle.length) return null

  score -= (haystack.length - needle.length) * 0.1
  return { score, matched }
}

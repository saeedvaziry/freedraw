function metaCsrfToken(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''
}

export function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)

  if (!match) return metaCsrfToken()

  try {
    return decodeURIComponent(match[1])
  } catch {
    return metaCsrfToken()
  }
}

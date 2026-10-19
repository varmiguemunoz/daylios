export function splitName(name: string | null | undefined): {
  firstName: string | null
  lastName: string | null
} {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { firstName: null, lastName: null }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') || null }
}

export const normalizeAddress = (value: string): string => value.trim().toLowerCase()

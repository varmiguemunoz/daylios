/** Lectores pequeños de query/body compartidos por los controladores de la Consultora. */

export const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v !== '' ? v : undefined

export const int = (v: unknown): number | undefined => {
  const n = Number(v)
  return v !== undefined && v !== '' && Number.isFinite(n) ? Math.floor(n) : undefined
}

export const flag = (v: unknown): boolean => v === '1' || v === 'true' || v === true

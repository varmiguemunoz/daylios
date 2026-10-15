import { lookup } from './conditions'
import type { Scope } from './model'

const VARIABLE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c])
}

function stringify(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.map(stringify).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function render(template: string, scope: Scope, options: { html?: boolean } = {}): string {
  return template.replace(VARIABLE, (_, path: string) => {
    const value = stringify(lookup(scope, path))
    return options.html ? escapeHtml(value) : value
  })
}

export function variablesIn(template: string): string[] {
  return [...template.matchAll(VARIABLE)].map((m) => m[1])
}

export function stepVariable(nodeId: string, key: string): string {
  return `steps.${nodeId}.${key}`
}

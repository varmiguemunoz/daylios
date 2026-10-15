import type { Branch, Condition, ConditionGroup, ConditionValue, Scope } from './model'

const DAY = 24 * 60 * 60 * 1000

export function lookup(scope: Scope, path: string): unknown {
  let current: unknown = scope
  for (const key of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

function text(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.join(', ')
  return String(value).trim().toLowerCase()
}

function number(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function time(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const t = typeof value === 'number' ? value : Date.parse(String(value))
  return Number.isFinite(t) ? t : null
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text)
  if (isEmpty(value)) return []
  return [text(value)]
}

function wanted(value: ConditionValue | undefined): string[] {
  if (Array.isArray(value)) return value.map(text)
  if (value === undefined || value === null || value === '') return []
  return [text(value)]
}

function pair(value: ConditionValue | undefined): [unknown, unknown] {
  return Array.isArray(value) ? [value[0], value[1]] : [undefined, undefined]
}

function between(actual: unknown, value: ConditionValue | undefined): boolean {
  const [lo, hi] = pair(value)
  const a = number(actual)
  const l = number(lo)
  const h = number(hi)
  if (a !== null && l !== null && h !== null) return a >= l && a <= h
  const at = time(actual)
  const lt = time(lo)
  const ht = time(hi)
  return at !== null && lt !== null && ht !== null && at >= lt && at <= ht
}

export function testCondition(condition: Condition, scope: Scope): boolean {
  const actual = lookup(scope, condition.field)
  const value = condition.value
  const now = time(scope.now) ?? Date.now()
  switch (condition.operator) {
    case 'is_empty':
      return isEmpty(actual)
    case 'is_not_empty':
      return !isEmpty(actual)
    case 'is':
      if (typeof value === 'boolean') return Boolean(actual) === value
      return text(actual) === text(value)
    case 'is_not':
      return text(actual) !== text(value)
    case 'contains':
      return text(actual).includes(text(value))
    case 'not_contains':
      return !text(actual).includes(text(value))
    case 'starts_with':
      return text(actual).startsWith(text(value))
    case 'eq':
    case 'neq':
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const a = number(actual)
      const b = number(value)
      if (a === null || b === null) return condition.operator === 'neq'
      if (condition.operator === 'eq') return a === b
      if (condition.operator === 'neq') return a !== b
      if (condition.operator === 'gt') return a > b
      if (condition.operator === 'gte') return a >= b
      if (condition.operator === 'lt') return a < b
      return a <= b
    }
    case 'between':
      return between(actual, value)
    case 'before':
    case 'after': {
      const a = time(actual)
      const b = time(value)
      if (a === null || b === null) return false
      return condition.operator === 'before' ? a < b : a > b
    }
    case 'within_days':
    case 'older_than_days': {
      const a = time(actual)
      const days = number(value)
      if (a === null || days === null) return false
      const age = now - a
      return condition.operator === 'within_days' ? age >= 0 && age <= days * DAY : age > days * DAY
    }
    case 'includes': {
      const have = list(actual)
      return wanted(value).every((v) => have.includes(v))
    }
    case 'excludes': {
      const have = list(actual)
      return wanted(value).every((v) => !have.includes(v))
    }
  }
}

export function evaluateGroup(group: ConditionGroup, scope: Scope): boolean {
  if (group.conditions.length === 0) return true
  return group.join === 'and'
    ? group.conditions.every((c) => testCondition(c, scope))
    : group.conditions.some((c) => testCondition(c, scope))
}

export function evaluate(groups: ConditionGroup[], scope: Scope): boolean {
  return groups.every((g) => evaluateGroup(g, scope))
}

export const NONE_PORT = 'none'

export function pickBranch(branches: Branch[], scope: Scope): string {
  const hit = branches.find((b) => b.groups.length > 0 && evaluate(b.groups, scope))
  return hit ? hit.id : NONE_PORT
}

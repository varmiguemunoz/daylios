import type { Rule } from './marketing'

export const MAX_RULE_DEPTH = 5

export interface RuleOutcome {
  tags: string[]

  added: string[]

  removed: string[]

  events: string[]

  promote: string | null

  fired: string[]
}

export function runRules(rules: Rule[], current: string[], incoming: string[]): RuleOutcome {
  const active = rules.filter((r) => r.active).sort((a, b) => a.position - b.position)
  const tags = new Set(current)
  const fired = new Set<string>()
  const events: string[] = []
  let promote: string | null = null

  const queue: { tag: string; depth: number }[] = []
  const enter = (tag: string, depth: number): void => {
    if (tags.has(tag)) return
    tags.add(tag)
    if (depth <= MAX_RULE_DEPTH) queue.push({ tag, depth })
  }
  for (const tag of incoming) enter(tag, 0)

  while (queue.length) {
    const { tag, depth } = queue.shift()!
    for (const rule of active) {
      if (rule.triggerTag !== tag || fired.has(rule.id)) continue
      fired.add(rule.id)
      for (const action of rule.actions) {
        if (action.type === 'add_tag') enter(action.tag, depth + 1)
        else if (action.type === 'remove_tag') tags.delete(action.tag)
        else if (action.type === 'fire_event' && !events.includes(action.event))
          events.push(action.event)
        else if (action.type === 'promote') promote = action.stage
      }
    }
  }

  const before = new Set(current)
  const final = [...tags]
  return {
    tags: final,
    added: final.filter((t) => !before.has(t)),
    removed: current.filter((t) => !tags.has(t)),
    events,
    promote,
    fired: active.filter((r) => fired.has(r.id)).map((r) => r.id)
  }
}

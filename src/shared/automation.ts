import type { Rule } from './marketing'

/** Profundidad máxima de encadenamiento (un tag añadido por una regla que activa otra…). */
export const MAX_RULE_DEPTH = 5

export interface RuleOutcome {
  /** Tags finales (slugs). */
  tags: string[]
  /** Tags nuevos respecto a `current` (incluye los de entrada que no tenía). */
  added: string[]
  /** Tags de `current` que las reglas quitaron. */
  removed: string[]
  /** Eventos de Resend pedidos por reglas `fire_event` (sin repetidos). */
  events: string[]
  /** Etapa de la última regla `promote` que se disparó, o null. */
  promote: string | null
  /** Reglas que se dispararon, en orden. */
  fired: string[]
}

/**
 * Motor de reglas por tag. Puro: lo usan la app y el Worker.
 *
 * Recorre en anchura los tags que entran. Para cada uno, las reglas activas con ese
 * `triggerTag` se aplican por `position`. Cada regla se dispara como mucho una vez por
 * ejecución y la profundidad está limitada, así un ciclo (A añade B, B añade A) termina.
 * Un tag que entra y sale en la misma ejecución no cuenta como añadido.
 */
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

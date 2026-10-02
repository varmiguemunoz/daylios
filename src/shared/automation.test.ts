import { describe, expect, it } from 'vitest'
import { runRules } from './automation'
import type { Rule } from './marketing'

const rule = (
  id: string,
  triggerTag: string,
  actions: Rule['actions'],
  extra: Partial<Rule> = {}
): Rule => ({
  id,
  name: id,
  position: 0,
  active: true,
  triggerTag,
  actions,
  createdAt: '',
  updatedAt: '',
  ...extra
})

describe('runRules', () => {
  it('encadena reglas y junta eventos', () => {
    const out = runRules(
      [
        rule('a', 'webinar', [
          { type: 'add_tag', tag: 'nurture' },
          { type: 'fire_event', event: 'x' }
        ]),
        rule('b', 'nurture', [
          { type: 'fire_event', event: 'y' },
          { type: 'promote', stage: 'Discovery' }
        ])
      ],
      [],
      ['webinar']
    )
    expect(out.tags).toEqual(['webinar', 'nurture'])
    expect(out.added).toEqual(['webinar', 'nurture'])
    expect(out.events).toEqual(['x', 'y'])
    expect(out.promote).toBe('Discovery')
    expect(out.fired).toEqual(['a', 'b'])
  })

  it('termina con ciclos y respeta reglas inactivas', () => {
    const out = runRules(
      [
        rule('a', 'x', [{ type: 'add_tag', tag: 'y' }]),
        rule('b', 'y', [
          { type: 'remove_tag', tag: 'x' },
          { type: 'add_tag', tag: 'x' }
        ]),
        rule('c', 'y', [{ type: 'add_tag', tag: 'z' }], { active: false })
      ],
      [],
      ['x']
    )
    expect(out.tags.sort()).toEqual(['x', 'y'])
    expect(out.fired).toEqual(['a', 'b'])
  })

  it('un tag que ya tenía no dispara reglas; remove_tag quita de los actuales', () => {
    const out = runRules(
      [
        rule('a', 'vip', [{ type: 'add_tag', tag: 'z' }]),
        rule('b', 'new', [{ type: 'remove_tag', tag: 'old' }])
      ],
      ['vip', 'old'],
      ['vip', 'new']
    )
    expect(out.fired).toEqual(['b'])
    expect(out.added).toEqual(['new'])
    expect(out.removed).toEqual(['old'])
  })

  it('limita la profundidad', () => {
    const chain = Array.from({ length: 10 }, (_, i) =>
      rule(`r${i}`, `t${i}`, [{ type: 'add_tag', tag: `t${i + 1}` }])
    )
    const out = runRules(chain, [], ['t0'])
    // t0 (0) → t1 … t5 (5) disparan; t6 entra pero ya no dispara.
    expect(out.tags).toContain('t6')
    expect(out.tags).not.toContain('t7')
  })
})

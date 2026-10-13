import { describe, expect, it } from 'vitest'
import { noteRefs, rewriteMarkdownLinks } from './vault-links'
import { normalizePath, relativePath } from './workspace'
import { noteFileName, setNoteTitle } from './notes'

describe('rutas de la bóveda', () => {
  it('normalizePath no deja salir de la raíz', () => {
    expect(normalizePath('a/./b/../c')).toBe('a/c')
    expect(normalizePath('../x')).toBeNull()
    expect(normalizePath('/etc/passwd')).toBeNull()
    expect(normalizePath('a/../../x')).toBeNull()
  })

  it('relativePath', () => {
    expect(relativePath('Ventas', 'Adjuntos/a.png')).toBe('../Adjuntos/a.png')
    expect(relativePath('', 'Adjuntos/a.png')).toBe('Adjuntos/a.png')
    expect(relativePath('A/B', 'A/c.png')).toBe('../c.png')
  })
})

describe('enlaces de notas', () => {
  const md =
    '# Nota\n![foto](../Adjuntos/mi%20foto.png) y [web](https://x.com) y [otra](Plan.md#paso)'

  it('noteRefs resuelve solo los locales', () => {
    expect(noteRefs(md, 'Ventas')).toEqual(['Adjuntos/mi foto.png', 'Ventas/Plan.md'])
  })

  it('reescribe al mover la imagen', () => {
    const moved = new Map([['Adjuntos/mi foto.png', 'Imágenes/mi foto.png']])
    expect(rewriteMarkdownLinks(md, 'Ventas', 'Ventas', moved)).toContain(
      '![foto](../Imágenes/mi%20foto.png)'
    )
  })

  it('reescribe al mover la nota (los relativos siguen apuntando bien)', () => {
    const out = rewriteMarkdownLinks(md, 'Ventas', 'Ventas/2026', new Map())
    expect(out).toContain('(../../Adjuntos/mi%20foto.png)')
    expect(out).toContain('(../Plan.md#paso)')
    expect(out).toContain('(https://x.com)')
  })
})


describe('título y nombre de nota', () => {
  it('noteFileName usa el título limpio', () => {
    expect(noteFileName('# Plan: Q4 / ventas\n\nx')).toBe('Plan- Q4 - ventas')
    expect(noteFileName('')).toBe('Sin título')
  })

  it('setNoteTitle cambia la primera línea y conserva su marca', () => {
    expect(setNoteTitle('# Viejo\n\ntexto', 'Nuevo')).toBe('# Nuevo\n\ntexto')
    expect(setNoteTitle('\n\nViejo sin marca', 'Nuevo')).toBe('\n\nNuevo')
    expect(setNoteTitle('```\ncode\n```\n## Título', 'Otro')).toBe('```\ncode\n```\n## Otro')
    expect(setNoteTitle('', 'Nueva')).toBe('# Nueva\n\n')
  })
})

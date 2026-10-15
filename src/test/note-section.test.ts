import { describe, expect, it } from 'vitest'
import { sectionOf } from '../shared/note-section'

const body = ['# Nota', 'intro', '## Uno', 'a', '### Uno punto uno', 'b', '## Dos', 'c'].join('\n')

describe('sección de una nota incrustada', () => {
  it('corta desde el encabezado hasta el siguiente del mismo nivel', () => {
    expect(sectionOf(body, '#Uno')).toBe('## Uno\na\n### Uno punto uno\nb')
    expect(sectionOf(body, '#Dos')).toBe('## Dos\nc')
  })

  it('acepta rutas de encabezados anidados y no distingue mayúsculas', () => {
    expect(sectionOf(body, '#Uno#uno PUNTO uno')).toBe('### Uno punto uno\nb')
  })

  it('sin subpath, con bloque o sin coincidencia devuelve la nota entera', () => {
    expect(sectionOf(body, undefined)).toBe(body)
    expect(sectionOf(body, '#^abc')).toBe(body)
    expect(sectionOf(body, '#Nada')).toBe(body)
  })
})

import type { MenuEntry } from '../../../ui'
import type { AlignMode } from './align'

export interface PaneMenu {
  readOnly: boolean
  canPaste: boolean
  snapGrid: boolean
  snapObjects: boolean
  addCard: () => void
  addNote: () => void
  addMedia: () => void
  addLink: () => void
  addGroup: () => void
  paste: () => void
  toggleSnapGrid: () => void
  toggleSnapObjects: () => void
  toggleReadOnly: () => void
  fit: () => void
}

export function paneItems(m: PaneMenu): MenuEntry[] {
  const add: MenuEntry[] = m.readOnly
    ? []
    : [
        { label: 'Añadir tarjeta', onSelect: m.addCard },
        { label: 'Añadir nota de la bóveda', onSelect: m.addNote },
        { label: 'Añadir imagen o archivo', onSelect: m.addMedia },
        { label: 'Añadir página web', onSelect: m.addLink },
        { label: 'Crear grupo', onSelect: m.addGroup },
        null,
        ...(m.canPaste ? [{ label: 'Pegar', onSelect: m.paste }, null] : [])
      ]
  return [
    ...add,
    { label: 'Ajustar a la rejilla', checked: m.snapGrid, onSelect: m.toggleSnapGrid },
    { label: 'Ajustar a objetos', checked: m.snapObjects, onSelect: m.toggleSnapObjects },
    { label: 'Solo lectura', checked: m.readOnly, onSelect: m.toggleReadOnly },
    null,
    { label: 'Encuadrar todo', onSelect: m.fit }
  ]
}

export interface NodeMenu {
  readOnly: boolean
  count: number
  canEdit: boolean
  canConvert: boolean
  canGroup: boolean
  zoom: () => void
  edit: () => void
  convert: () => void
  cut: () => void
  copy: () => void
  duplicate: () => void
  group: () => void
  remove: () => void
}

export function nodeItems(m: NodeMenu): MenuEntry[] {
  const single = m.count === 1
  if (m.readOnly)
    return [
      { label: 'Encuadrar selección', onSelect: m.zoom },
      ...(single && m.canEdit ? [{ label: 'Abrir', onSelect: m.edit }] : []),
      { label: 'Copiar', onSelect: m.copy }
    ]
  return [
    { label: 'Encuadrar selección', onSelect: m.zoom },
    ...(single && m.canEdit ? [{ label: 'Editar', onSelect: m.edit }] : []),
    ...(single && m.canConvert ? [{ label: 'Convertir en nota', onSelect: m.convert }] : []),
    null,
    { label: 'Cortar', onSelect: m.cut },
    { label: 'Copiar', onSelect: m.copy },
    { label: 'Duplicar', onSelect: m.duplicate },
    ...(m.canGroup ? [{ label: 'Crear grupo', onSelect: m.group }] : []),
    null,
    { label: 'Borrar', danger: true, onSelect: m.remove }
  ]
}

export interface EdgeMenuActions {
  readOnly: boolean
  label: () => void
  follow: () => void
  remove: () => void
}

export function edgeItems(m: EdgeMenuActions): MenuEntry[] {
  if (m.readOnly) return [{ label: 'Seguir conexión', onSelect: m.follow }]
  return [
    { label: 'Editar rótulo', onSelect: m.label },
    { label: 'Seguir conexión', onSelect: m.follow },
    null,
    { label: 'Borrar', danger: true, onSelect: m.remove }
  ]
}

export const ALIGN_ITEMS: { label: string; mode: AlignMode | 'x' | 'y' }[] = [
  { label: 'Alinear a la izquierda', mode: 'left' },
  { label: 'Centrar en horizontal', mode: 'center' },
  { label: 'Alinear a la derecha', mode: 'right' },
  { label: 'Alinear arriba', mode: 'top' },
  { label: 'Centrar en vertical', mode: 'middle' },
  { label: 'Alinear abajo', mode: 'bottom' },
  { label: 'Distribuir en horizontal', mode: 'x' },
  { label: 'Distribuir en vertical', mode: 'y' }
]

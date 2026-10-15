import { kbd } from '../../../lib/platform'

export interface Shortcut {
  keys: string
  label: string
}

export const SHORTCUTS: { title: string; items: Shortcut[] }[] = [
  {
    title: 'Lienzo',
    items: [
      { keys: 'Rueda', label: 'Desplazar' },
      { keys: kbd('⌘ Rueda'), label: 'Zoom' },
      { keys: kbd('⇧1'), label: 'Encuadrar todo' },
      { keys: kbd('⇧2'), label: 'Encuadrar la selección' },
      { keys: kbd('⌘0'), label: 'Zoom al 100 %' }
    ]
  },
  {
    title: 'Selección',
    items: [
      { keys: kbd('⇧ Clic'), label: 'Añadir o quitar de la selección' },
      { keys: 'Arrastrar en el fondo', label: 'Seleccionar un área' },
      { keys: kbd('⌘A'), label: 'Seleccionar todo' },
      { keys: 'Esc', label: 'Quitar la selección' }
    ]
  },
  {
    title: 'Mover',
    items: [
      { keys: 'Flechas', label: 'Mover 20' },
      { keys: kbd('⇧ Flechas'), label: 'Mover 100' },
      { keys: kbd('⇧ Arrastrar'), label: 'Mover en un solo eje' },
      { keys: kbd('⌥ Arrastrar'), label: 'Clonar' },
      { keys: kbd('⌃ Arrastrar'), label: 'Mover sin ajustar' }
    ]
  },
  {
    title: 'Editar',
    items: [
      { keys: 'Doble clic en el fondo', label: 'Nueva tarjeta' },
      { keys: 'Doble clic en una conexión', label: 'Editar el rótulo' },
      { keys: kbd('⌘C  ⌘X  ⌘V'), label: 'Copiar, cortar y pegar en el puntero' },
      { keys: kbd('⌘D'), label: 'Duplicar' },
      { keys: kbd('⌘G'), label: 'Agrupar' },
      { keys: '⌫', label: 'Borrar' },
      { keys: kbd('⌘Z'), label: 'Deshacer' },
      { keys: kbd('⇧⌘Z  ⌘Y'), label: 'Rehacer' }
    ]
  }
]

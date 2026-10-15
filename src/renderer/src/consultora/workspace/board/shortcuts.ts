export interface Shortcut {
  keys: string
  label: string
}

export const SHORTCUTS: { title: string; items: Shortcut[] }[] = [
  {
    title: 'Lienzo',
    items: [
      { keys: 'Rueda', label: 'Desplazar' },
      { keys: '⌘ Rueda', label: 'Zoom' },
      { keys: '⇧1', label: 'Encuadrar todo' },
      { keys: '⇧2', label: 'Encuadrar la selección' },
      { keys: '⌘0', label: 'Zoom al 100 %' }
    ]
  },
  {
    title: 'Selección',
    items: [
      { keys: '⇧ Clic', label: 'Añadir o quitar de la selección' },
      { keys: 'Arrastrar en el fondo', label: 'Seleccionar un área' },
      { keys: '⌘A', label: 'Seleccionar todo' },
      { keys: 'Esc', label: 'Quitar la selección' }
    ]
  },
  {
    title: 'Mover',
    items: [
      { keys: 'Flechas', label: 'Mover 20' },
      { keys: '⇧ Flechas', label: 'Mover 100' },
      { keys: '⇧ Arrastrar', label: 'Mover en un solo eje' },
      { keys: '⌥ Arrastrar', label: 'Clonar' },
      { keys: '⌃ Arrastrar', label: 'Mover sin ajustar' }
    ]
  },
  {
    title: 'Editar',
    items: [
      { keys: 'Doble clic en el fondo', label: 'Nueva tarjeta' },
      { keys: 'Doble clic en una conexión', label: 'Editar el rótulo' },
      { keys: '⌘C  ⌘X  ⌘V', label: 'Copiar, cortar y pegar en el puntero' },
      { keys: '⌘D', label: 'Duplicar' },
      { keys: '⌘G', label: 'Agrupar' },
      { keys: '⌫', label: 'Borrar' },
      { keys: '⌘Z', label: 'Deshacer' },
      { keys: '⇧⌘Z  ⌘Y', label: 'Rehacer' }
    ]
  }
]

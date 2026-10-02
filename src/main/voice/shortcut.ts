import { globalShortcut, systemPreferences } from 'electron'

/**
 * Atajo global de «mantener pulsado para hablar».
 *
 * macOS no avisa a los atajos globales de Electron cuando se SUELTA la tecla, así que se combinan dos piezas:
 * - Pulsar: `globalShortcut` (además se «come» la tecla: no se escribe un espacio en la app de delante).
 * - Soltar: `uiohook-napi`, que escucha el teclado del sistema (solo lectura). Necesita el permiso de Accesibilidad.
 *
 * Sin ese permiso (o si uiohook no carga) funciona como interruptor: pulsar empieza, pulsar otra vez termina.
 */

interface Handlers {
  start: () => void
  stop: () => void
}

export interface ShortcutState {
  registered: boolean
  mode: 'hold' | 'toggle'
}

/** Partes del atajo (formato Electron) → nombre de tecla de uiohook. */
const KEY_NAMES: Record<string, string[]> = {
  alt: ['Alt', 'AltRight'],
  option: ['Alt', 'AltRight'],
  command: ['Meta', 'MetaRight'],
  cmd: ['Meta', 'MetaRight'],
  commandorcontrol: ['Meta', 'MetaRight'],
  cmdorctrl: ['Meta', 'MetaRight'],
  control: ['Ctrl', 'CtrlRight'],
  ctrl: ['Ctrl', 'CtrlRight'],
  shift: ['Shift', 'ShiftRight'],
  space: ['Space']
}

type Hook = {
  uIOhook: { start: () => void; stop: () => void; on: (event: string, cb: (e: { keycode: number }) => void) => void }
  UiohookKey: Record<string, number>
}

let hook: Hook | null = null
let hookStarted = false
/** Última vez que uiohook vio una tecla: si no ve nada, no está funcionando (falta permiso). */
let lastHookEvent = 0
let releaseCodes = new Set<number>()
let onRelease: (() => void) | null = null

/** Carga y arranca uiohook una sola vez, solo si hay permiso de Accesibilidad. */
async function startHook(): Promise<boolean> {
  if (hookStarted) return true
  if (!systemPreferences.isTrustedAccessibilityClient(false)) return false
  try {
    hook = (await import('uiohook-napi')) as unknown as Hook
    hook.uIOhook.on('keydown', () => (lastHookEvent = Date.now()))
    hook.uIOhook.on('keyup', (e) => {
      lastHookEvent = Date.now()
      if (releaseCodes.has(e.keycode)) onRelease?.()
    })
    hook.uIOhook.start()
    hookStarted = true
    return true
  } catch {
    return false
  }
}

let current: string | null = null

/**
 * Registra (o vuelve a registrar) el atajo. Devuelve si quedó registrado y en qué modo.
 * `accelerator` en formato Electron: "Alt+Space", "CommandOrControl+Shift+P"…
 */
export async function registerVoiceShortcut(accelerator: string, handlers: Handlers): Promise<ShortcutState> {
  unregisterVoiceShortcut()
  const hold = await startHook()

  // Teclas cuyo «soltar» termina la grabación: cualquiera de las del atajo.
  releaseCodes = new Set(
    accelerator
      .split('+')
      .flatMap((part) => KEY_NAMES[part.toLowerCase()] ?? [part.length === 1 ? part.toUpperCase() : part])
      .map((name) => hook?.UiohookKey[name])
      .filter((code): code is number => typeof code === 'number')
  )

  let active = false
  let startedAt = 0
  let holding = false

  const stop = (): void => {
    if (!active) return
    active = false
    onRelease = null
    handlers.stop()
  }

  const registered = globalShortcut.register(accelerator, () => {
    if (!active) {
      active = true
      startedAt = Date.now()
      // ¿Funciona uiohook ahora? Si vio la tecla modificadora hace un momento, sí: modo mantener.
      holding = hold && Date.now() - lastHookEvent < 2000
      onRelease = holding ? stop : null
      handlers.start()
    } else if (!holding && Date.now() - startedAt > 700) {
      stop() // modo interruptor: segunda pulsación (ignora la repetición automática de la tecla)
    }
  })

  current = registered ? accelerator : null
  return { registered, mode: hold ? 'hold' : 'toggle' }
}

export function unregisterVoiceShortcut(): void {
  if (current) globalShortcut.unregister(current)
  current = null
  onRelease = null
}

/** Al salir de la app. */
export function disposeVoiceShortcut(): void {
  unregisterVoiceShortcut()
  if (hookStarted) hook?.uIOhook.stop()
}

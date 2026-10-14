import { globalShortcut, systemPreferences } from 'electron'

interface Handlers {
  start: () => void
  stop: () => void
}

export interface ShortcutState {
  registered: boolean
  mode: 'hold' | 'toggle'
}

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
  uIOhook: {
    start: () => void
    stop: () => void
    on: (event: string, cb: (e: { keycode: number }) => void) => void
  }
  UiohookKey: Record<string, number>
}

let hook: Hook | null = null
let hookStarted = false

let lastHookEvent = 0
let releaseCodes = new Set<number>()
let onRelease: (() => void) | null = null

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

export async function registerVoiceShortcut(
  accelerator: string,
  handlers: Handlers
): Promise<ShortcutState> {
  unregisterVoiceShortcut()
  const hold = await startHook()

  // Teclas cuyo «soltar» termina la grabación: cualquiera de las del atajo.
  releaseCodes = new Set(
    accelerator
      .split('+')
      .flatMap(
        (part) => KEY_NAMES[part.toLowerCase()] ?? [part.length === 1 ? part.toUpperCase() : part]
      )
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

export function disposeVoiceShortcut(): void {
  unregisterVoiceShortcut()
  if (hookStarted) hook?.uIOhook.stop()
}

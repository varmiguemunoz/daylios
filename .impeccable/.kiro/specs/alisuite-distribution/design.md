# Diseño · Alisuite para macOS y Windows

## Hallazgos de la revisión del código

| área | archivo | problema en Windows o con el nombre nuevo |
|---|---|---|
| empaquetado | `electron-builder.yml` | sin sección `win`; `appId` genérico `com.electron.app`; `productName: daily-os` |
| datos | `main/index.ts` | `app.getPath('userData')` cambiaría a `Alisuite` al renombrar y la app arrancaría vacía |
| MCP | `mcp/client.ts` | ruta fija `~/Library/Application Support/daily-os/connection.json` |
| permisos | `permissions.ts`, `voice/shortcut.ts`, `voice/voice.ts` | `isTrustedAccessibilityClient` y `askForMediaAccess` solo existen en macOS |
| protocolo | `main/index.ts` | `open-url` solo existe en macOS; en Windows la URL llega en `second-instance` |
| ventana | `consultora-window.ts` | `titleBarStyle: 'hiddenInset'` en Windows deja la ventana sin botones |
| cabecera | `consultora/shell/AppShell.tsx` | `pl-[80px]` reserva el hueco de los semáforos de macOS |
| bandeja | `window.ts` | `placeUnder` coloca la ventana debajo del icono; en Windows el icono está abajo |
| bandeja | `window.ts` | icono plantilla de macOS; en Windows necesita color |
| menú | sin `Menu.setApplicationMenu` para Windows | Electron muestra Archivo, Editar, Ver |
| atajos | `config.ts` | `Alt+Space` choca con Windows |
| textos | 16 archivos del renderer | ⌘ y ⌥ fijos |
| notificaciones | `main/index.ts` | falta `app.setAppUserModelId` |
| carpeta por defecto | `config.ts` | `~/Desktop/alimunozadvisory` no es el Escritorio con OneDrive |
| Workspace | `services/vault.ts`, `syncNow` | detecta renombres por inode; en NTFS el número supera 2^53 sin `bigint` |
| rutas | `documents.ts` | `relative()` devuelve `\` al renderer |
| binarios | `ffmpeg-static`, `better-sqlite3`, `uiohook-napi` | se instalan para la plataforma donde corre `npm install`; por eso se construye en Windows |
| instalación | `scripts/install.sh` | solo macOS: launchd y configuración de Claude |

## Cambios

### Identidad y datos

- `electron-builder.yml`: `appId: com.alimunozadvisory.alisuite`, `productName: Alisuite`.
- `main/index.ts`, antes de `ready`: `app.setPath('userData', join(app.getPath('appData'),
  DATA_DIR))` con `DATA_DIR = 'daily-os'` en `shared`. Lo usa también `mcp/client.ts`.
- `app.setAppUserModelId('com.alimunozadvisory.alisuite')` en Windows.
- Textos DayliOS visibles pasan a Alisuite: títulos de ventana, bandeja, menú, notificaciones,
  Ajustes. Los nombres internos, el esquema `daylios://` y las claves guardadas no cambian.
- Cambiar el `appId` en macOS hace que el sistema vuelva a pedir micrófono, pantalla y accesibilidad
  una vez.

### Iconos

- `build/icon.png` de 1024 por 1024 generado desde el logo con margen del 10 %. electron-builder
  produce `.icns` y `.ico` a partir de él; se borran los antiguos para no mezclarlos.
- `resources/trayTemplate.png` y `@2x`: silueta negra con alfa para macOS.
- `resources/tray-win.png` de 32 por 32 a color para Windows.
- Los PNG se generan una vez con un script en `scripts/` y se versionan.

### Plataforma

`main/platform.ts` con `isMac`, `isWindows` y envoltorios seguros:

```ts
export const accessibilityTrusted = (prompt: boolean): boolean
export const askMicrophone = (): Promise<boolean>
```

En Windows la accesibilidad cuenta como concedida y el micrófono se consulta con
`getMediaAccessStatus`.

### Protocolo

`handleProtocolUrl(url)` único. macOS lo llama desde `open-url`; Windows desde `second-instance`
buscando `daylios://` en `argv`, y desde `process.argv` en el primer arranque.

### Ventanas

- Consultora en Windows: `titleBarStyle: 'hidden'` y `titleBarOverlay` con los colores del tema y
  38 px de alto. El preload expone `platform`; `AppShell` usa `pl-[80px]` en macOS y `pr-[140px]`
  en Windows.
- `Menu.setApplicationMenu(null)` en Windows.
- Ventana compacta: si el icono de la bandeja está en la mitad inferior de la pantalla, se coloca
  encima.

### Atajos

- `shared/keys.ts`: `modLabel(platform)` y `altLabel(platform)`, más un componente `Shortcut` que
  sustituye los ⌘ y ⌥ fijos en los 16 archivos.
- Atajo de voz por defecto en Windows: `Ctrl+Shift+Space`. Los usuarios de macOS conservan el suyo.

### Arranque al iniciar sesión

`app.setLoginItemSettings({ openAtLogin })` con interruptor en Ajustes, activado la primera vez. En
macOS no sustituye a `scripts/install.sh`, que sigue para tu equipo personal.

### Conectar con Claude

`main/claude-config.ts` escribe en `claude_desktop_config.json`, en `~/Library/Application
Support/Claude` o `%APPDATA%\Claude`, la entrada `alisuite` con el ejecutable de la app,
`ELECTRON_RUN_AS_NODE=1` y la ruta de `mcp.js` dentro de `app.asar`. Conserva las demás entradas.

### Windows y archivos

- `vault.scan` y `local-files.ts` usan `stat` con `bigint` y guardan el inode como texto.
- `safeFolderName` y las rutas relativas, ver la spec `client-workspace-folders`.

### Actualizaciones

- `electron-updater` en `dependencies`. Es la única dependencia nueva y no hay alternativa en el
  proyecto: Electron no trae actualización para Windows.
- `main/updater.ts`: comprueba al arrancar y cada 6 horas, descarga y avisa con una notificación y en
  Ajustes. Desactivado en desarrollo.
- En macOS solo funciona con la app firmada, P1. Sin firma, Ajustes muestra el enlace a la versión
  nueva.

### Construcción

`electron-builder.yml`:

```yaml
win:
  target: [{ target: nsis, arch: [x64] }]
  icon: build/icon.png
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: always
  createStartMenuShortcut: true
  shortcutName: Alisuite
  artifactName: Alisuite-Setup-${version}.${ext}
mac:
  target: [dmg, zip]
dmg:
  artifactName: Alisuite-${version}-${arch}.${ext}
publish:
  provider: github
```

`.github/workflows/release.yml`: con un tag `v*`, una matriz `macos-latest` y `windows-latest` que
instala, corre `npm run check` y `npm test`, construye y publica. Un segundo workflow corre check y
pruebas en cada push en las dos plataformas.

## Pruebas

| tipo | qué |
|---|---|
| unidad | `modLabel`, `handleProtocolUrl` con argv de Windows, ruta de `connection.json` por plataforma |
| unidad | `claude-config.ts` conserva otras entradas y es idempotente |
| unidad | colocación de la ventana compacta con bandeja arriba y abajo |
| CI | toda la suite en Windows: detecta rutas con `\`, inodes y nombres |
| manual | checklist en Windows real |

## Riesgos

| riesgo | mitigación |
|---|---|
| perder datos al renombrar | `userData` fijo en `daily-os` antes de `ready` |
| SmartScreen en Windows | documentar Más información, Ejecutar de todas formas; certificado más adelante |
| Gatekeeper en macOS sin firma | P1; mientras, instrucciones de clic derecho, Abrir |
| suite de pruebas falla en Windows la primera vez | es el objetivo de correrla en CI; se corrige antes de publicar |
| módulos nativos | se compilan en cada sistema dentro de CI, nunca en cruzado |

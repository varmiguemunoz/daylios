#!/usr/bin/env bash
# DayliOS · instalación como servicio en macOS
#
# 1. Compila la app y la copia a /Applications
# 2. La registra como LaunchAgent: arranca al iniciar sesión y, si se cierra o falla, launchd la vuelve a abrir
# 3. Configura el servidor MCP en Claude (claude_desktop_config.json)
#
# Uso: npm run service:install   (se puede correr las veces que quieras: reinstala encima)
set -euo pipefail

APP_NAME="daily-os"
LABEL="com.bloomilite.daylios"
APP_PATH="/Applications/${APP_NAME}.app"
APP_BIN="${APP_PATH}/Contents/MacOS/${APP_NAME}"
MCP_JS="${APP_PATH}/Contents/Resources/app.asar/out/main/mcp.js"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
LOG="${HOME}/Library/Logs/daylios.log"
CLAUDE_CONFIG="${HOME}/Library/Application Support/Claude/claude_desktop_config.json"
DOMAIN="gui/$(id -u)"

step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

# ---- 0. Requisitos ----
[[ "$(uname -s)" == "Darwin" ]] || fail "Este script es solo para macOS."
command -v node >/dev/null || fail "No encuentro node. Instálalo (p. ej. con nvm) y vuelve a intentarlo."
command -v npm  >/dev/null || fail "No encuentro npm."

cd "$(dirname "$0")/.."

# ---- 1. Compilar ----
step "Instalando dependencias"
npm install

step "Compilando la app"
# Sin firma de Apple (uso personal): evita que electron-builder busque certificados en el llavero.
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:unpack

BUILT_APP="$(find dist -maxdepth 2 -type d -name "${APP_NAME}.app" | head -n 1)"
[[ -n "$BUILT_APP" ]] || fail "No encontré ${APP_NAME}.app dentro de dist/."

# ---- 2. Parar la versión anterior (si hay) ----
step "Deteniendo la versión anterior"
launchctl bootout "${DOMAIN}/${LABEL}" 2>/dev/null || true
# Solo la app, no el proceso MCP (que usa el mismo binario pero con mcp.js como argumento).
pkill -f "${APP_BIN}\$" 2>/dev/null || true
sleep 1

# ---- 3. Copiar a /Applications ----
step "Instalando en ${APP_PATH}"
rm -rf "$APP_PATH"
ditto "$BUILT_APP" "$APP_PATH"
xattr -dr com.apple.quarantine "$APP_PATH" 2>/dev/null || true
# Firma local (ad-hoc): en Apple Silicon todo binario necesita al menos esta firma.
codesign --force --deep --sign - "$APP_PATH" >/dev/null 2>&1 || true

# ---- 4. Servicio (LaunchAgent) ----
step "Registrando el servicio ${LABEL}"
mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${APP_BIN}</string>
  </array>
  <!-- Arranca al iniciar sesión -->
  <key>RunAtLoad</key>
  <true/>
  <!-- Si se cierra (o falla), launchd la vuelve a abrir -->
  <key>KeepAlive</key>
  <true/>
  <!-- Espera mínima entre reinicios, para no entrar en bucle si algo falla al arrancar -->
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <!-- App con ventana: solo en la sesión gráfica del usuario -->
  <key>LimitLoadToSessionType</key>
  <string>Aqua</string>
  <key>ProcessType</key>
  <string>Interactive</string>
  <key>StandardOutPath</key>
  <string>${LOG}</string>
  <key>StandardErrorPath</key>
  <string>${LOG}</string>
</dict>
</plist>
PLIST

launchctl bootstrap "$DOMAIN" "$PLIST"
launchctl enable "${DOMAIN}/${LABEL}"
launchctl kickstart -k "${DOMAIN}/${LABEL}"

# ---- 5. MCP en Claude ----
step "Configurando el MCP en Claude"
mkdir -p "$(dirname "$CLAUDE_CONFIG")"
[[ -f "$CLAUDE_CONFIG" ]] && cp "$CLAUDE_CONFIG" "${CLAUDE_CONFIG}.bak"

CONFIG="$CLAUDE_CONFIG" BIN="$APP_BIN" MCP="$MCP_JS" node <<'NODE'
const fs = require('fs')
const file = process.env.CONFIG
let config = {}
if (fs.existsSync(file)) {
  const raw = fs.readFileSync(file, 'utf8').trim()
  config = raw ? JSON.parse(raw) : {}
}
config.mcpServers = config.mcpServers || {}
config.mcpServers.daylios = {
  command: process.env.BIN,
  args: [process.env.MCP],
  env: { ELECTRON_RUN_AS_NODE: '1' }
}
fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n')
NODE

# ---- Listo ----
printf '\n\033[1;32m✓ DayliOS instalado y corriendo como servicio.\033[0m\n'
cat <<INFO

  App:       ${APP_PATH}
  Servicio:  ${PLIST}
  Logs:      ${LOG}
  Datos:     ~/Library/Application Support/${APP_NAME}/daylios.db
  MCP:       "daylios" en ${CLAUDE_CONFIG}
             (copia de seguridad: claude_desktop_config.json.bak)

  → Cierra Claude por completo (⌘Q) y ábrelo de nuevo para que cargue el MCP.
  → "Salir" en el menubar cierra la app, pero el servicio la vuelve a abrir en ~10 s.
    Para detenerla de verdad: npm run service:uninstall

INFO

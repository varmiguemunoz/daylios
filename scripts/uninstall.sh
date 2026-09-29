#!/usr/bin/env bash
# DayliOS · desinstalación completa en macOS
#
# Quita el servicio, la app de /Applications, el MCP de Claude y los logs.
# Pregunta antes de borrar tus tareas (la base de datos).
#
# Uso: npm run service:uninstall            (pregunta por los datos)
#      npm run service:uninstall -- --purge (borra también los datos, sin preguntar)
set -euo pipefail

APP_NAME="daily-os"
LABEL="com.bloomilite.daylios"
APP_PATH="/Applications/${APP_NAME}.app"
APP_BIN="${APP_PATH}/Contents/MacOS/${APP_NAME}"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
LOG="${HOME}/Library/Logs/daylios.log"
DATA_DIR="${HOME}/Library/Application Support/${APP_NAME}"
CLAUDE_CONFIG="${HOME}/Library/Application Support/Claude/claude_desktop_config.json"
DOMAIN="gui/$(id -u)"

step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$1"; }

[[ "$(uname -s)" == "Darwin" ]] || { echo "Este script es solo para macOS." >&2; exit 1; }

# ---- 1. Servicio ----
step "Deteniendo y quitando el servicio"
launchctl bootout "${DOMAIN}/${LABEL}" 2>/dev/null || true
rm -f "$PLIST"
pkill -f "${APP_BIN}" 2>/dev/null || true   # app y proceso MCP

# ---- 2. App ----
step "Borrando ${APP_PATH}"
rm -rf "$APP_PATH"

# ---- 3. MCP en Claude ----
step "Quitando el MCP de Claude"
if [[ -f "$CLAUDE_CONFIG" ]] && command -v node >/dev/null; then
  cp "$CLAUDE_CONFIG" "${CLAUDE_CONFIG}.bak"
  CONFIG="$CLAUDE_CONFIG" node <<'NODE'
const fs = require('fs')
const file = process.env.CONFIG
const raw = fs.readFileSync(file, 'utf8').trim()
const config = raw ? JSON.parse(raw) : {}
if (config.mcpServers) delete config.mcpServers.daylios
fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n')
NODE
elif [[ -f "$CLAUDE_CONFIG" ]]; then
  echo "  No encuentro node: quita a mano la entrada \"daylios\" de ${CLAUDE_CONFIG}"
fi

# ---- 4. Logs ----
rm -f "$LOG"

# ---- 5. Datos (tus tareas) ----
if [[ -d "$DATA_DIR" ]]; then
  purge="n"
  if [[ "${1:-}" == "--purge" ]]; then
    purge="y"
  else
    read -r -p $'\n¿Borrar también tus tareas (daylios.db)? Esto no se puede deshacer. [s/N] ' answer
    [[ "$answer" =~ ^[sSyY]$ ]] && purge="y"
  fi
  if [[ "$purge" == "y" ]]; then
    rm -rf "$DATA_DIR"
    echo "  Datos borrados."
  else
    echo "  Datos conservados en: ${DATA_DIR}"
  fi
fi

printf '\n\033[1;32m✓ DayliOS desinstalado.\033[0m\n'
echo "  → Reinicia Claude (⌘Q y abrir) para que deje de cargar el MCP."
echo

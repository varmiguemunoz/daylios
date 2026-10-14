
#!/usr/bin/env bash

set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 1

ESLINT="./node_modules/.bin/eslint"
PRETTIER="./node_modules/.bin/prettier"
REPORT_DIR=".git/quality-reports"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="$REPORT_DIR/report-$TIMESTAMP.md"
JSON_REPORT="$REPORT_DIR/eslint-$TIMESTAMP.json"

mkdir -p "$REPORT_DIR"

if [[ ! -x "$ESLINT" || ! -x "$PRETTIER" ]]; then
  echo "ERROR: ESLint o Prettier no están instalados localmente."
  exit 1
fi

echo "=== 1. Formateando archivos ==="

if "$PRETTIER" src/ --write \
  --ignore-path .prettierignore \
  > "$REPORT_DIR/prettier-$TIMESTAMP.log" 2>&1; then
  FORMAT_STATUS="OK"
else
  FORMAT_STATUS="ERROR"
fi

echo "=== 2. Ejecutando ESLint ==="

if "$ESLINT" src/ --format json \
  > "$JSON_REPORT" \
  2> "$REPORT_DIR/eslint-$TIMESTAMP.log"; then
  LINT_STATUS="OK"
else
  LINT_STATUS="ISSUES"
fi

echo "=== 3. Generando reporte ==="

node - "$JSON_REPORT" "$REPORT" "$FORMAT_STATUS" <<'NODE'
const fs = require("node:fs");

const [jsonPath, reportPath, formatStatus] =
  process.argv.slice(2);

let results;

try {
  results = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
} catch {
  console.error("No fue posible interpretar el reporte JSON de ESLint.");
  process.exit(1);
}

const affected = results.filter(
  (file) => file.errorCount > 0 || file.warningCount > 0
);

const errors = results.reduce(
  (sum, file) => sum + file.errorCount, 0
);

const warnings = results.reduce(
  (sum, file) => sum + file.warningCount, 0
);

const lines = [
  "# Quality Check Report",
  "",
  `Fecha: ${new Date().toISOString()}`,
  `Formateo: ${formatStatus}`,
  `Archivos analizados: ${results.length}`,
  `Archivos afectados: ${affected.length}`,
  `Errores: ${errors}`,
  `Advertencias: ${warnings}`,
  "",
  "## Archivos afectados",
  ""
];

if (affected.length === 0) {
  lines.push("No se encontraron errores ni advertencias de ESLint.");
}

for (const file of affected) {
  lines.push(`### ${file.filePath}`);
  lines.push(`Errores: ${file.errorCount} | Advertencias: ${file.warningCount}`);

  for (const message of file.messages) {
    const location = `${message.line ?? 0}:${message.column ?? 0}`;
    const rule = message.ruleId ?? "configuración";
    lines.push(`- Línea ${location}: ${message.message} (${rule})`);
  }

  lines.push("");
}

fs.writeFileSync(reportPath, lines.join("\n") + "\n");

console.log(`Archivos analizados: ${results.length}`);
console.log(`Archivos afectados: ${affected.length}`);
console.log(`Errores: ${errors}`);
console.log(`Advertencias: ${warnings}`);
console.log(`Reporte: ${reportPath}`);
NODE

REPORT_STATUS=$?

echo ""
echo "=== Resultado ==="
echo "Formateo: $FORMAT_STATUS"
echo "Lint: $LINT_STATUS"

if [[ "$FORMAT_STATUS" != "OK" || "$LINT_STATUS" != "OK" || "$REPORT_STATUS" != 0 ]]; then
  exit 1
fi

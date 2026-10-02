-- D1 del Worker leads-hub. Aplicar con:
--   npx wrangler d1 execute leads-hub --remote --file=schema.sql

-- Config que empuja la app (fuentes con hash del secreto, reglas, mapa tag → segment).
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Cola para la app: leads y cambios de estado. La app los borra al confirmarlos (ack).
CREATE TABLE IF NOT EXISTS inbox (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inbox_created ON inbox (created_at);

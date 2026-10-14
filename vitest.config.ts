import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// Los tests corren dentro de Electron en modo Node (`npm test`): better-sqlite3
// está compilado para el ABI de Electron, no para el Node del sistema.
export default defineConfig({
  resolve: { alias: { '@shared': resolve('src/shared') } },
  test: {
    // Todas las pruebas viven en src/test, también las del dominio de services/cloud.
    // La lógica del Worker (workers/leads-hub) no depende de Cloudflare y se prueba aquí.
    include: ['src/test/**/*.test.ts', 'workers/*/src/**/*.test.ts'],
    environment: 'node',
    pool: 'forks'
  }
})

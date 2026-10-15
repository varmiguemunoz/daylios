import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const electron = createRequire(import.meta.url)('electron')
const { status } = spawnSync(
  electron,
  ['node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)],
  { stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }
)
process.exit(status ?? 1)

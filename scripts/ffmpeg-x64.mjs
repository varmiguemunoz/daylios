import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const dir = join(root, '.ffmpeg-x64')
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
const version = lock.packages['node_modules/ffmpeg-static'].version

mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'ffmpeg-x64', private: true }))
execSync(`npm install --no-save --foreground-scripts ffmpeg-static@${version}`, {
  cwd: dir,
  stdio: 'inherit',
  env: { ...process.env, npm_config_arch: 'x64', npm_config_platform: 'darwin' }
})

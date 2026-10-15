/* eslint-disable @typescript-eslint/no-require-imports */
const { copyFileSync, existsSync } = require('fs')
const { join } = require('path')

const X64 = 1

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin' || context.arch !== X64 || process.arch === 'x64')
    return
  const source = join(__dirname, '..', '.ffmpeg-x64', 'node_modules', 'ffmpeg-static', 'ffmpeg')
  if (!existsSync(source)) {
    throw new Error('Falta ffmpeg para Intel. Ejecuta antes: node scripts/ffmpeg-x64.mjs')
  }
  const app = `${context.packager.appInfo.productFilename}.app`
  const target = join(
    context.appOutDir,
    app,
    'Contents',
    'Resources',
    'app.asar.unpacked',
    'node_modules',
    'ffmpeg-static',
    'ffmpeg'
  )
  copyFileSync(source, target)
}

import { cp } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'tsup'
import DefaultConfig from '../../tsup-default.config'

const outDir = '../../out/intellizen-zenscript'
const builtinsSrc = resolve(__dirname, 'src', 'builtins')
const builtinsDest = resolve(__dirname, outDir, 'builtins')

export default defineConfig({
  ...DefaultConfig,
  outDir,
  noExternal: ['vscode-languageserver', 'langium', '@intellizen/shared'],
  async onSuccess() {
    return cp(builtinsSrc, builtinsDest, { recursive: true })
  },
})

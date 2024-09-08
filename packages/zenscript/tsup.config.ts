import { defineConfig } from 'tsup'
import DefaultConfig from '../../tsup-default.config'

export default defineConfig({
  ...DefaultConfig,
  outDir: '../../out/intellizen-zenscript',
  noExternal: ['vscode-languageserver', 'langium', '@intellizen/shared'],
})

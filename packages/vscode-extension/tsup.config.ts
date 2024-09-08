import { defineConfig } from 'tsup'
import DefaultConfig from '../../tsup-default.config'

export default defineConfig({
  ...DefaultConfig,
  outDir: '../../out/extension',
  noExternal: ['vscode-languageclient', '@intellizen/shared'],
})

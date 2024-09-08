import { env } from 'node:process'
import { defineConfig } from 'tsup'

export const DEV_MODE = env.NODE_ENV === 'development'

export default defineConfig({
  bundle: true,
  splitting: false,
  format: ['cjs'],
  entry: ['src/main.ts'],
  dts: false,
  clean: true,
  shims: false,
  external: ['vscode'],
  noExternal: [],
  sourcemap: DEV_MODE,
  minify: !DEV_MODE,
  outExtension: ({ format }) => {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
    }
  },
})

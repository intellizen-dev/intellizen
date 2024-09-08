import { env } from 'node:process'
import { defineConfig } from 'tsup'

export const DEV_MODE = env.NODE_ENV === 'development'

export default defineConfig({
  entry: DEV_MODE ? ['src/**/*.ts'] : ['src/main.ts'],
  format: ['cjs'],
  bundle: !DEV_MODE,
  shims: false,
  dts: false,
  external: ['vscode'],
  splitting: !DEV_MODE,
  sourcemap: DEV_MODE,
  clean: true,
  minify: !DEV_MODE,
  noExternal: [],
  outExtension: ({ format }) => {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
    }
  },
})

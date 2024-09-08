import { defineConfig } from 'tsup'
import { DEV_MODE } from '../../tsup-default.config'

export default defineConfig({
  entry: ['src/**/*.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: DEV_MODE,
  clean: true,
  minify: false,
  splitting: false,
})

import type { Options } from 'tsup'

export default {
  entry: [
    'src/main.ts',
  ],
  format: ['cjs'],
  bundle: true,
  shims: false,
  dts: false,
  external: [
    'vscode',
  ],
  // TODO: when build we should't expose sourcemap
  sourcemap: true,
  clean: true,
  // TODO: when dev we should't bundle any package
  noExternal: [],
  outExtension: ({ format }) => {
    return {
      js: format === 'cjs' ? '.cjs' : '.js',
    }
  },
} as Options

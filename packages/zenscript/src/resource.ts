import type { URI } from 'langium'
import { resolve } from 'node:path'
import z from 'zod'

export const builtinsPath = resolve(__dirname, 'builtins')

export const StringConstants = Object.freeze({
  Folder: {
    scripts: 'scripts',
  },
  File: {
    intellizen: 'intellizen.json',
    brackets: 'brackets.json',
    preprocessors: 'preprocessors.json',
  },
})

// region Workspace Config
export const IntelliZenJsonSchema = z.object({
  srcRoots: z.string().array(),
})

export interface WorkspaceConfig {
  srcRoots: URI[]
  extra: {
    brackets?: URI
    preprocessors?: URI
  }
}
// endregion

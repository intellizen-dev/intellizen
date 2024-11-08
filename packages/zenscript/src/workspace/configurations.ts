import type { URI } from 'langium'
import z from 'zod'

export const StringConstants = Object.freeze({
  Folder: {
    scripts: 'scripts',
    dzs_scripts: 'dzs_scripts',
  },
  File: {
    intellizen: 'intellizen.json',
    brackets: 'brackets.json',
    preprocessors: 'preprocessors.json',
  },
})

export const IntelliZenSchema = z.object({
  srcRoots: z.string().array(),
})

export type IntelliZenConfig = z.infer<typeof IntelliZenSchema>

export interface ParsedConfig {
  srcRoots: URI[]
  extra: {
    brackets?: URI
    preprocessors?: URI
  }
}

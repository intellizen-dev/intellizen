import z from 'zod'
import type { URI } from 'langium'

export const StringConstants = Object.freeze({
  Config: {
    intellizen: 'intellizen.json',
  },
  Folder: {
    scripts: 'scripts',
    dzs_scripts: 'dzs_scripts',
  },
})

export const IntelliZenSchema = z.object({
  srcRoots: z.string().array(),
  extra: z.object({
    brackets: z.string().optional(),
    preprocessors: z.string().optional(),
  }).optional(),
})

export type IntelliZenConfig = z.infer<typeof IntelliZenSchema>

export interface ParsedConfig {
  srcRoots: URI[]
  extra: {
    brackets?: URI
    preprocessors?: URI
  }
}

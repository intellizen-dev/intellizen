import z from 'zod'
import { URI } from 'langium'

export const StringConstants = Object.freeze({
  Config: {
    intellizen: 'intellizen.json',
  },
  Folder: {
    scripts: 'scripts',
    dzs_scripts: 'dzs_scripts',
  },
})

const zodUriParse = z.string().refine(val => URI.isUri(URI.file(val)))

export const IntelliZenSchema = z.object({
  rootDirs: zodUriParse.array(),
  extra: z.object({
    brackets: zodUriParse.optional(),
    preprocessors: zodUriParse.optional(),
  }).optional(),
})

export type IntelliZenConfig = z.infer<typeof IntelliZenSchema>

export interface ParsedConfig {
  rootDirs: URI[]
  extra: {
    brackets?: URI
    preprocessors?: URI
  }
}

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

// region Brackets
export const BracketsJsonSchema = z.object({
  type: z.string(),
  regex: z.string(),
  entries: z.object({
    _id: z.string(),
    _name: z.string().optional(),
  }).passthrough().array(),
}).array()

export interface BracketMirror {
  type: string
  regex: RegExp
  entries: Map<string, BracketEntry>
}

export interface BracketEntry {
  name?: string
  properties: Record<string, string[]>
}
// endregion

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

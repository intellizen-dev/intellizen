import { resolve } from 'node:path'
import z from 'zod'

export const builtinsPath = resolve(__dirname, 'builtins')

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
  properties: object
}

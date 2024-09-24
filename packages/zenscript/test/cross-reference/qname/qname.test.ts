import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { LangiumDocument } from 'langium'
import { describe, expect, it } from 'vitest'
import { createParseHelper } from '../../utils'
import type { Script } from '../../../src/generated/ast'

const parse = createParseHelper()

const a_zs = await parseFile(path.resolve(__dirname, 'scripts', 'a.zs'))
const b_zs = await parseFile(path.resolve(__dirname, 'scripts', 'b.zs'))

async function parseFile(filePath: string): Promise<LangiumDocument<Script>> {
  const content = readFileSync(filePath).toString()
  const uri = pathToFileURL(filePath).toString()
  return parse(content, { documentUri: uri })
}

describe('test', () => {
  it('it', () => {
    const importDecl = b_zs.parseResult.value.imports[0]
    expect(importDecl.refer.ref?.$container?.$document).toBe(a_zs)
  })
})

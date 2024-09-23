import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { LangiumDocument } from 'langium'
import { assertNoErrors, createParseHelper } from '../../utils'
import type { ClassType, Script, VariableDeclaration } from '../../../src/generated/ast'

const parse = createParseHelper()

const provider_zs = await parseFile(path.resolve(__dirname, 'scripts', 'provider.zs'))
const user_zs = await parseFile(path.resolve(__dirname, 'scripts', 'user.zs'))

async function parseFile(filePath: string): Promise<LangiumDocument<Script>> {
  const content = readFileSync(filePath).toString()
  const uri = pathToFileURL(filePath).toString()
  return parse(content, { documentUri: uri })
}

describe('check cross reference of class type', () => {
  it('should no errors', () => {
    assertNoErrors(provider_zs)
    assertNoErrors(user_zs)
  })

  it('script be imported', () => {
    const script_be_imported = user_zs.parseResult.value.statements[0] as VariableDeclaration
    expect(script_be_imported.$container?.$document).toBe(user_zs)

    const referenced = (script_be_imported.typeRef as ClassType).ref.ref
    expect(referenced?.$container.$document).toBe(provider_zs)
    expect(referenced?.name).toBe('Alpha')
  })

  it('script be imported as alias', () => {
    const script_be_imported_as_alias = user_zs.parseResult.value.statements[1] as VariableDeclaration
    expect(script_be_imported_as_alias.$container?.$document).toBe(user_zs)

    const referenced = (script_be_imported_as_alias.typeRef as ClassType).ref.ref
    expect(referenced?.$container.$document).toBe(provider_zs)
    expect(referenced?.name).toBe('Alpha')
  })

  it('class be imported', () => {
    const class_be_imported = user_zs.parseResult.value.statements[2] as VariableDeclaration
    expect(class_be_imported.$container?.$document).toBe(user_zs)

    const referenced = (class_be_imported.typeRef as ClassType).ref.ref
    expect(referenced?.$container.$document).toBe(provider_zs)
    expect(referenced?.name).toBe('Alpha')
  })

  it('class be imported as alias', () => {
    const class_be_imported_as_alias = user_zs.parseResult.value.statements[3] as VariableDeclaration
    expect(class_be_imported_as_alias.$container?.$document).toBe(user_zs)

    const referenced = (class_be_imported_as_alias.typeRef as ClassType).ref.ref
    expect(referenced?.$container.$document).toBe(provider_zs)
    expect(referenced?.name).toBe('Alpha')
  })
})

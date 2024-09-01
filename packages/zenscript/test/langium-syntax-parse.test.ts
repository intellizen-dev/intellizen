import { parseHelper } from 'langium/test'
import { NodeFileSystem } from 'langium/node'
import { describe, expect, it } from 'vitest'

import type { LangiumDocument } from 'langium'
import type { PrimitiveType, ReferenceType, Script } from '../src/generated/ast'
import { createIntelliZenServices } from '../src/module'

const service = createIntelliZenServices(NodeFileSystem)
const parse = parseHelper<Script>(service.intelliZen)

async function parseModel(input: string) {
  return parse(input, { validation: true })
}

async function assertNoErrors(model: LangiumDocument<Script>) {
  expect(model.parseResult.lexerErrors).toHaveLength(0)
  expect(model.parseResult.parserErrors).toHaveLength(0)
  expect(model.diagnostics ?? []).toHaveLength(0)
}

describe('langium syntax parse', async () => {
  it('missing semicolon', async () => {
    const model = await parseModel('val a as int')
    expect(model.parseResult.lexerErrors).toHaveLength(0)
    expect(model.parseResult.parserErrors).toHaveLength(1)
  })

  it('import declaration', async () => {
    const model = await parseModel('import foo.bar.baz;')
    const parsedImport = model.parseResult.value.imports[0]
    await assertNoErrors(model)
    expect(parsedImport.parts).toStrictEqual(['foo', 'bar', 'baz'])
  })

  it('function declaration', async () => {
    const model = await parseModel(`
      function foo(a as int) as int {}
      static function bar() as void {}
      global function baz(c as OtherType) as any {}
    `.trim())
    await assertNoErrors(model)

    const [foo, bar, baz] = model.parseResult.value.functions
    expect(foo.prefix).toBeUndefined()
    expect(foo.name).toBe('foo')
    expect(foo.parameters.length).toBe(1)
    expect(foo.parameters[0].name).toBe('a')
    expect(foo.parameters[0].typeRef?.$type).toBe('PrimitiveType')
    expect((foo.parameters[0].typeRef as PrimitiveType).primitive).toBe('int')
    expect(foo.returnTypeRef?.$type).toBe('PrimitiveType')
    expect((foo.returnTypeRef as PrimitiveType).primitive).toBe('int')

    expect(bar.prefix).toBe('static')
    expect(bar.name).toBe('bar')
    expect(bar.parameters.length).toBe(0)
    expect(bar.returnTypeRef?.$type).toBe('PrimitiveType')
    expect((bar.returnTypeRef as PrimitiveType).primitive).toBe('void')

    expect(baz.prefix).toBe('global')
    expect(baz.name).toBe('baz')
    expect(baz.parameters.length).toBe(1)
    expect(baz.parameters[0].name).toBe('c')
    expect(baz.parameters[0].typeRef?.$type).toBe('ReferenceType')
    expect((baz.parameters[0].typeRef as ReferenceType).names).toStrictEqual(['OtherType'])
    expect(baz.returnTypeRef?.$type).toBe('PrimitiveType')
    expect((baz.returnTypeRef as PrimitiveType).primitive).toBe('any')
  })
})

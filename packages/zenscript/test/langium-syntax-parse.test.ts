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

  if (model.diagnostics?.[0]?.data?.code !== 'linking-error') {
    expect(model.diagnostics ?? []).toHaveLength(0)
  }
}

describe('langium syntax parse', async () => {
  it('missing semicolon', async () => {
    const model = await parseModel('val a as int')
    expect(model.parseResult.lexerErrors).toHaveLength(0)
    expect(model.parseResult.parserErrors).toHaveLength(1)
  })

  it('import declaration', async () => {
    const model = await parseModel('import foo.bar.baz;')
    const refImport = model.parseResult.value.imports[0]
    await assertNoErrors(model)
    expect(refImport.ref.$refText).toStrictEqual('foo.bar.baz')
  })

  it('function declaration', async () => {
    const model = await parseModel(`
      function foo(a as int) as int {}
      static function bar() as void {}
      global function baz(c as OtherType) as any {}
    `)
    await assertNoErrors(model)

    const [foo, bar, baz] = model.parseResult.value.functions
    expect(foo.prefix).toBeUndefined()
    expect(foo.name).toBe('foo')
    expect(foo.parameters.length).toBe(1)
    expect(foo.parameters[0].name).toBe('a')
    expect(foo.parameters[0].typeRef?.$type).toBe('PrimitiveType')
    expect((foo.parameters[0].typeRef as PrimitiveType).value).toBe('int')
    expect(foo.returnTypeRef?.$type).toBe('PrimitiveType')
    expect((foo.returnTypeRef as PrimitiveType).value).toBe('int')

    expect(bar.prefix).toBe('static')
    expect(bar.name).toBe('bar')
    expect(bar.parameters.length).toBe(0)
    expect(bar.returnTypeRef?.$type).toBe('PrimitiveType')
    expect((bar.returnTypeRef as PrimitiveType).value).toBe('void')

    expect(baz.prefix).toBe('global')
    expect(baz.name).toBe('baz')
    expect(baz.parameters.length).toBe(1)
    expect(baz.parameters[0].name).toBe('c')
    expect(baz.parameters[0].typeRef?.$type).toBe('ReferenceType')
    expect((baz.parameters[0].typeRef as ReferenceType).ref.$refText).toBe('OtherType')
    expect(baz.returnTypeRef?.$type).toBe('PrimitiveType')
    expect((baz.returnTypeRef as PrimitiveType).value).toBe('any')
  })

  it('expand function declaration', async () => {
    const model = await parseModel(`
      $expand string$reverse() as string {}
      $expand OtherType$foo(foo as OtherType.ChildType) as void {}
    `)
    await assertNoErrors(model)

    const [string$Reverse, otherType$Foo] = model.parseResult.value.expands
    expect(string$Reverse.name).toBe('reverse')
    expect(string$Reverse.typeRef?.$type).toBe('PrimitiveType')
    expect((string$Reverse.typeRef as PrimitiveType).value).toBe('string')
    expect(string$Reverse.parameters.length).toBe(0)
    expect(string$Reverse.returnTypeRef?.$type).toBe('PrimitiveType')
    expect((string$Reverse.returnTypeRef as PrimitiveType).value).toBe('string')

    expect(otherType$Foo.name).toBe('foo')
    expect(otherType$Foo.typeRef?.$type).toBe('ReferenceType')
    expect((otherType$Foo.typeRef as ReferenceType).ref.$refText).toStrictEqual('OtherType')
    expect(otherType$Foo.parameters.length).toBe(1)
    expect(otherType$Foo.parameters[0].name).toBe('foo')
    expect(otherType$Foo.parameters[0].typeRef?.$type).toBe('ReferenceType')
    expect((otherType$Foo.parameters[0].typeRef as ReferenceType).ref.$refText).toStrictEqual('OtherType.ChildType')
    expect(otherType$Foo.returnTypeRef?.$type).toBe('PrimitiveType')
    expect((otherType$Foo.returnTypeRef as PrimitiveType).value).toBe('void')
  })
})

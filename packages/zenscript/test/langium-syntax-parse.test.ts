import { parseHelper } from 'langium/test'
import { NodeFileSystem } from 'langium/node'
import { describe, expect, it, suite } from 'vitest'

import type { LangiumDocument } from 'langium'
import type { PrimitiveType, ReferenceType, Script, TypeReference } from '../src/generated/ast'
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

function expectTypeToBe(matches: string, type?: TypeReference) {
  if (type?.$type === 'PrimitiveType') {
    expect((type as PrimitiveType).value).toBe(matches)
  }
  else if (type?.$type === 'ReferenceType') {
    expect((type as ReferenceType).ref.$refText).toBe(matches)
  }
}

describe('test with langium syntax parse', async () => {
  it('missing semicolon', async () => {
    const model = await parseModel('val a as int')
    expect(model.parseResult.lexerErrors).toHaveLength(0)
    expect(model.parseResult.parserErrors).toHaveLength(1)
  })

  it('import declaration', async () => {
    const model = await parseModel('import foo.bar.baz;')
    const refImport = model.parseResult.value.imports[0]
    await assertNoErrors(model)
    expect(refImport.ref.$refText).toBe('foo.bar.baz')
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
    expectTypeToBe('int', foo.parameters[0].typeRef)
    expectTypeToBe('int', foo.returnTypeRef)

    expect(bar.prefix).toBe('static')
    expect(bar.name).toBe('bar')
    expect(bar.parameters.length).toBe(0)
    expectTypeToBe('void', bar.returnTypeRef)

    expect(baz.prefix).toBe('global')
    expect(baz.name).toBe('baz')
    expect(baz.parameters.length).toBe(1)
    expect(baz.parameters[0].name).toBe('c')
    expectTypeToBe('OtherType', baz.parameters[0].typeRef)
    expectTypeToBe('any', baz.returnTypeRef)
  })

  it('expand function declaration', async () => {
    const model = await parseModel(`
      $expand string$reverse() as string {}
      $expand OtherType$foo(foo as OtherType.ChildType) as void {}
    `)
    await assertNoErrors(model)

    const [string$Reverse, otherType$Foo] = model.parseResult.value.expands
    expect(string$Reverse.name).toBe('reverse')
    expectTypeToBe('string', string$Reverse.typeRef)
    expect(string$Reverse.parameters.length).toBe(0)
    expectTypeToBe('string', string$Reverse.returnTypeRef)

    expect(otherType$Foo.name).toBe('foo')
    expectTypeToBe('string', string$Reverse.typeRef)
    expect(otherType$Foo.parameters.length).toBe(1)
    expect(otherType$Foo.parameters[0].name).toBe('foo')
    expectTypeToBe('OtherType.ChildType', otherType$Foo.parameters[0].typeRef)
    expectTypeToBe('void', otherType$Foo.returnTypeRef)
  })

  it('class declaration', async () => {
    const model = await parseModel(`
      zenClass Foo {}
      zenClass Bar extends Foo, Baz {} // zenutils
    `)

    await assertNoErrors(model)
    const [foo, bar] = model.parseResult.value.classes
    expect(foo.name).toBe('Foo')
    expect(foo.superTypes).toStrictEqual([])

    expect(bar.name).toBe('Bar')
    expect(bar.superTypes.map(subType => subType.$refText)).toStrictEqual(['Foo', 'Baz'])
  })
})

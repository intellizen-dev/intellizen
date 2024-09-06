import { describe, expect, it } from 'vitest'

import { assertNoErrors, assertVariableDeclaration, createParseHelper, expectTypeToBe } from '../utils'
import type { ForStatement, IfStatement } from '../../src/generated/ast'

const parse = createParseHelper()

async function parseModel(input: string) {
  return parse(input, { validation: true })
}

describe('parse ZenScript top-level of script ', () => {
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
    const [string$reverse, otherType$foo] = model.parseResult.value.expands

    expect(string$reverse.name).toBe('reverse')
    expectTypeToBe('string', string$reverse.typeRef)
    expect(string$reverse.parameters.length).toBe(0)
    expectTypeToBe('string', string$reverse.returnTypeRef)

    expect(otherType$foo.name).toBe('foo')
    expectTypeToBe('string', string$reverse.typeRef)
    expect(otherType$foo.parameters.length).toBe(1)
    expect(otherType$foo.parameters[0].name).toBe('foo')
    expectTypeToBe('OtherType.ChildType', otherType$foo.parameters[0].typeRef)
    expectTypeToBe('void', otherType$foo.returnTypeRef)
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

  it('statements', async () => {
    const model = await parseModel(`
      if (true) {}
      else if (false) {}
      else {}

      {}
      while(true) {}
      
      for i in 0 to 10 {}
      for item in Array {}

      global a as int = 1;
      static b as string = '2';
      var c as bool = true;
      val d = false;
    `)
    await assertNoErrors(model)
    const [
      ifStatement,
      blockStatement,
      whileStatement,
      forStatementEachNumber,
      forStatementEachArray,
      global$VariableDeclaration,
      static$VariableDeclaration,
      var$VariableDeclaration,
      val$VariableDeclaration,
    ] = model.parseResult.value.statements

    expect(ifStatement.$type).toBe('IfStatement')
    let _ifStatement = ifStatement as IfStatement
    while (_ifStatement.elseBody!.$type === 'IfStatement') {
      _ifStatement = (_ifStatement.elseBody as IfStatement)!
      expect(ifStatement.$type).toBe('IfStatement')
    }
    expect(_ifStatement.elseBody?.$type).toBe('BlockStatement')

    expect(blockStatement.$type).toBe('BlockStatement')
    expect(whileStatement.$type).toBe('WhileStatement')

    expect(forStatementEachNumber.$type).toBe('ForStatement')
    expect((forStatementEachNumber as ForStatement).variables.map(item => item.name)).toStrictEqual(['i'])
    expect(forStatementEachArray.$type).toBe('ForStatement')
    expect((forStatementEachArray as ForStatement).variables.map(item => item.name)).toStrictEqual(['item'])

    assertVariableDeclaration(global$VariableDeclaration, 'global', 'a', 'int')
    assertVariableDeclaration(static$VariableDeclaration, 'static', 'b', 'string')
    assertVariableDeclaration(var$VariableDeclaration, 'var', 'c', 'bool')
    assertVariableDeclaration(val$VariableDeclaration, 'val', 'd', undefined)
  })
})

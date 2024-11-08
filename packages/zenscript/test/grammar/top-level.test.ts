import type { ForStatement, IfStatement, VariableDeclaration } from '../../src/generated/ast'
import { describe, expect, it } from 'vitest'
import { isExpandFunctionDeclaration } from '../../src/generated/ast'
import { assertClassTypeReference, assertNoErrors, assertVariableDeclaration, createParseHelper } from '../utils'

const parse = createParseHelper()

async function parseModel(input: string) {
  return parse(input, { validation: true })
}

describe('parse top-level of script with ZenScript', () => {
  it('import declaration', async () => {
    const model = await parseModel('import foo.bar.baz;')
    const refImport = model.parseResult.value.imports[0]
    await assertNoErrors(model)
    expect(refImport.path.map(p => p.$refText)).toStrictEqual(['foo', 'bar', 'baz'])
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
    assertClassTypeReference(foo.parameters[0].typeRef, 'int')
    assertClassTypeReference(foo.returnTypeRef, 'int')

    expect(bar.prefix).toBe('static')
    expect(bar.name).toBe('bar')
    expect(bar.parameters.length).toBe(0)
    assertClassTypeReference(bar.returnTypeRef, 'void')

    expect(baz.prefix).toBe('global')
    expect(baz.name).toBe('baz')
    expect(baz.parameters.length).toBe(1)
    expect(baz.parameters[0].name).toBe('c')
    assertClassTypeReference(baz.parameters[0].typeRef, 'OtherType')
    assertClassTypeReference(baz.returnTypeRef, 'any')
  })

  it('expand function declaration', async () => {
    const model = await parseModel(`
      $expand string$reverse() as string {}
      $expand OtherType$foo(foo as OtherType.ChildType) as void {}
    `)
    await assertNoErrors(model)
    const [string$reverse, otherType$foo] = model.parseResult.value.expands.filter(isExpandFunctionDeclaration)

    expect(string$reverse.name).toBe('reverse')
    assertClassTypeReference(string$reverse.typeRef, 'string')
    expect(string$reverse.parameters.length).toBe(0)
    assertClassTypeReference(string$reverse.returnTypeRef, 'string')

    expect(otherType$foo.name).toBe('foo')
    assertClassTypeReference(string$reverse.typeRef, 'string')
    expect(otherType$foo.parameters.length).toBe(1)
    expect(otherType$foo.parameters[0].name).toBe('foo')
    assertClassTypeReference(otherType$foo.parameters[0].typeRef, 'OtherType.ChildType')
    assertClassTypeReference(otherType$foo.returnTypeRef, 'void')
  })

  it('class declaration', async () => {
    const model = await parseModel(`
      zenClass Foo {}
      zenClass Bar extends Foo, Baz, Other.Child {} // zenutils
    `)
    await assertNoErrors(model)

    const [foo, bar] = model.parseResult.value.classes
    expect(foo.name).toBe('Foo')
    expect(foo.superTypes).toStrictEqual([])

    expect(bar.name).toBe('Bar')
    expect(bar.superTypes.map(subType => subType.path.map(p => p.$refText))).toStrictEqual([['Foo'], ['Baz'], ['Other', 'Child']])
  })

  it('class with members', async () => {
    const model = await parseModel(`
      zenClass Foo {
        static foo as string = 'foo';
        
        zenConstructor() {}

        function bar() as Foo {
          return this;
        }
      }
    `)
    await assertNoErrors(model)

    const classFoo = model.parseResult.value.classes[0]
    expect(classFoo.name).toBe('Foo')
    expect(classFoo.members.length).toBe(3)

    const [foo, constructor, bar] = classFoo.members
    expect(foo.$type).toBe('FieldDeclaration')
    expect(constructor.$type).toBe('ConstructorDeclaration')
    expect(bar.$type).toBe('FunctionDeclaration')
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
    expect((forStatementEachNumber as ForStatement).parameters.map(item => item.name)).toStrictEqual(['i'])
    expect(forStatementEachArray.$type).toBe('ForStatement')
    expect((forStatementEachArray as ForStatement).parameters.map(item => item.name)).toStrictEqual(['item'])

    assertVariableDeclaration(global$VariableDeclaration, { prefix: 'global', name: 'a' })
    assertClassTypeReference((global$VariableDeclaration as VariableDeclaration).typeRef, 'int')

    assertVariableDeclaration(static$VariableDeclaration, { prefix: 'static', name: 'b' })
    assertClassTypeReference((static$VariableDeclaration as VariableDeclaration).typeRef, 'string')

    assertVariableDeclaration(var$VariableDeclaration, { prefix: 'var', name: 'c' })
    assertClassTypeReference((var$VariableDeclaration as VariableDeclaration).typeRef, 'bool')

    assertVariableDeclaration(val$VariableDeclaration, { prefix: 'val', name: 'd' })
    expect((val$VariableDeclaration as VariableDeclaration).typeRef).toBeUndefined()
  })
})

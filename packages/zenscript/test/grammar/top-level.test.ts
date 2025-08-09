import type { LangiumDocument } from 'langium'
import type { ForStatement, IfStatement, Script, VariableDeclaration } from '../../src/generated/ast'
import { describe, expect, it } from 'vitest'
import { FunctionDeclaration, isExpandFunctionDeclaration } from '../../src/generated/ast'
import { assertClassTypeReference, assertNoErrors, assertVariableDeclaration, createTestParser } from '../utils'

const parse = createTestParser()

describe('parse top-level of script with ZenScript', () => {
  it('import declaration', async () => {
    const model = await parse('import foo.bar.baz;') as LangiumDocument<Script>
    const refImport = model.parseResult.value.imports[0]
    await assertNoErrors(model)
    expect(refImport.path.map(p => p.$refText)).toStrictEqual(['foo', 'bar', 'baz'])
  })

  it('function declaration', async () => {
    const foo = (await parse('function foo(a as int) as int {}', { ext: '.zs', rule: FunctionDeclaration.$type })).parseResult.value as FunctionDeclaration
    const bar = (await parse('static function bar() as void', { ext: '.dzs', rule: FunctionDeclaration.$type })).parseResult.value as FunctionDeclaration
    const baz = (await parse('global function baz(c as OtherType) as any', { ext: '.dzs', rule: FunctionDeclaration.$type })).parseResult.value as FunctionDeclaration

    expect(foo.variance).toBeUndefined()
    expect(foo.name).toBe('foo')
    expect(foo.params.length).toBe(1)
    expect(foo.params[0].name).toBe('a')
    assertClassTypeReference(foo.params[0].type, 'int')
    assertClassTypeReference(foo.retType, 'int')

    expect(bar.variance).toBe('static')
    expect(bar.name).toBe('bar')
    expect(bar.params.length).toBe(0)
    assertClassTypeReference(bar.retType, 'void')

    expect(baz.variance).toBe('global')
    expect(baz.name).toBe('baz')
    expect(baz.params.length).toBe(1)
    expect(baz.params[0].name).toBe('c')
    assertClassTypeReference(baz.params[0].type, 'OtherType')
    assertClassTypeReference(baz.retType, 'any')
  })

  it('expand function declaration', async () => {
    const model = await parse(`
      $expand string$reverse() as string {}
      $expand OtherType$foo(foo as OtherType.ChildType) as void {}
    `) as LangiumDocument<Script>
    await assertNoErrors(model)
    const [string$reverse, otherType$foo] = model.parseResult.value.expands.filter(isExpandFunctionDeclaration)

    expect(string$reverse.name).toBe('reverse')
    assertClassTypeReference(string$reverse.type, 'string')
    expect(string$reverse.params.length).toBe(0)
    assertClassTypeReference(string$reverse.retType, 'string')

    expect(otherType$foo.name).toBe('foo')
    assertClassTypeReference(string$reverse.type, 'string')
    expect(otherType$foo.params.length).toBe(1)
    expect(otherType$foo.params[0].name).toBe('foo')
    assertClassTypeReference(otherType$foo.params[0].type, 'OtherType.ChildType')
    assertClassTypeReference(otherType$foo.retType, 'void')
  })

  it('class declaration', async () => {
    const model = await parse(`
      zenClass Foo {}
      zenClass Bar extends Foo, Baz, Other.Child {} // zenutils
    `, { ext: '.dzs' }) as LangiumDocument<Script>
    await assertNoErrors(model)

    const [foo, bar] = model.parseResult.value.classes
    expect(foo.name).toBe('Foo')
    expect(foo.superTypes).toStrictEqual([])

    expect(bar.name).toBe('Bar')
    expect(bar.superTypes.map(subType => subType.path.map(p => p.$refText))).toStrictEqual([['Foo'], ['Baz'], ['Other', 'Child']])
  })

  it('class with members', async () => {
    const model = await parse(`
      zenClass Foo {
        static foo as string = 'foo';
        
        zenConstructor() {}

        function bar() as Foo {
          return this;
        }
      }
    `, { ext: '.zs' }) as LangiumDocument<Script>
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
    const model = await parse(`
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
    `, { ext: '.zs' }) as LangiumDocument<Script>
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
    expect((forStatementEachNumber as ForStatement).params.map(item => item.name)).toStrictEqual(['i'])
    expect(forStatementEachArray.$type).toBe('ForStatement')
    expect((forStatementEachArray as ForStatement).params.map(item => item.name)).toStrictEqual(['item'])

    assertVariableDeclaration(global$VariableDeclaration, { variance: 'global', name: 'a' })
    assertClassTypeReference((global$VariableDeclaration as VariableDeclaration).type, 'int')

    assertVariableDeclaration(static$VariableDeclaration, { variance: 'static', name: 'b' })
    assertClassTypeReference((static$VariableDeclaration as VariableDeclaration).type, 'string')

    assertVariableDeclaration(var$VariableDeclaration, { variance: 'var', name: 'c' })
    assertClassTypeReference((var$VariableDeclaration as VariableDeclaration).type, 'bool')

    assertVariableDeclaration(val$VariableDeclaration, { variance: 'val', name: 'd' })
    expect((val$VariableDeclaration as VariableDeclaration).type).toBeUndefined()
  })
})

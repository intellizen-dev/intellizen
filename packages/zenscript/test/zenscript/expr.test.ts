import { describe, expect, it } from 'vitest'

import { assertNoErrors, assertTypeRef, createParseHelper } from '../utils'
import type { ArrayLiteral, BooleanLiteral, CallExpression, Expression, ExpressionStatement, FunctionExpression, LocalVariable, MapLiteral, MemberAccess, NullLiteral, NumberLiteral, ParenthesizedExpression, StringLiteral } from '../../src/generated/ast'

const parse = createParseHelper()

async function parseModel(input: string) {
  return parse(input, { validation: true })
}

async function parseExpr<T extends Expression = Expression>(input: string) {
  return (await parseExprs<T>(input))[0] as T
}

async function parseExprs<T extends Expression = Expression>(input: string) {
  const model = await parseModel(input)
  await assertNoErrors(model)
  const exprStmts = model.parseResult.value.statements
  for (const exprStmt of exprStmts) {
    expect(exprStmt.$type).toBe('ExpressionStatement')
  }
  return exprStmts.map(stmt => (stmt as ExpressionStatement).expr) as T[]
}

describe.only('parse expression of script with ZenScript ', () => {
  it('numeric literal', async () => {
    const numericLiterals = await parseExprs<NumberLiteral>(`
      // integer
      0;
      0x0;
      0L;
      0l;

      // TODO: floating, waiting fix
    `)
    expect(numericLiterals).toHaveLength(4)
    const [zero$standard, zero$hex, zero$Long, zero$long] = numericLiterals
    expect(zero$standard.value).toBe('0')
    expect(zero$hex.value).toBe('0x0')
    expect(zero$Long.value).toBe('0L')
    expect(zero$long.value).toBe('0l')
  })

  it('string literal', async () => {
    const stringLiterals = await parseExprs<StringLiteral>(`
      'hello';
      "world";
    `)
    expect(stringLiterals).toHaveLength(2)
    const [hello, world] = stringLiterals
    expect(hello.value).toBe('hello')
    expect(world.value).toBe('world')
  })

  it('boolean literal', async () => {
    const booleanLiterals = await parseExprs<BooleanLiteral>(`
      true;
      false;  
    `)
    expect(booleanLiterals).toHaveLength(2)
    const [trueLiteral, falseLiteral] = booleanLiterals
    expect(trueLiteral.value).toBe(true)
    expect(falseLiteral.value).toBe(false)
  })

  it('null literal', async () => {
    const nullLiteral = await parseExpr<NullLiteral>('null;')
    expect(nullLiteral.value).toBe('null')
  })

  it('array literal', async () => {
    const arrayLiteral = await parseExprs<ArrayLiteral>(`
      [];
      [1, 2, 3];  
    `)
    expect(arrayLiteral).toHaveLength(2)
    const [empty, withElements] = arrayLiteral
    expect(empty.values).toHaveLength(0)
    expect(withElements.values).toHaveLength(3)
    for (const element in withElements.values) {
      expect(element).toMatch(/\d/)
    }
  })

  it('map literal', async () => {
    const mapLiteral = await parseExprs<MapLiteral>(`
      {};
      {a: 1, b: 2};  
    `)
    expect(mapLiteral).toHaveLength(2)
    const [empty, withElements] = mapLiteral
    expect(empty.entries).toHaveLength(0)
    expect(withElements.entries).toHaveLength(2)
    withElements.entries.forEach(({ value, key }) => {
      expect(value.$type).toBe('NumberLiteral')
      expect(key.$type).toBe('LocalVariable')
      expect((key as LocalVariable).ref.$refText).toMatch(/\w/)
    })
  })

  it.skip('string template', async () => {
    // TODO: waiting fix
    // eslint-disable-next-line no-template-curly-in-string, unused-imports/no-unused-vars
    const expr = await parseExpr('`hello, ${world}`!')
  })

  it('parenthesized expression', async () => {
    const parenthesizedExpr = await parseExpr<ParenthesizedExpression>('( null );')
    expect(parenthesizedExpr.$type).toBe('ParenthesizedExpression')
    expect(parenthesizedExpr.expr.$type).toBe('NullLiteral')
  })

  it('function expression', async () => {
    const functionExpr = await parseExpr<FunctionExpression>('function (foo as int) as void {};')
    expect(functionExpr.$type).toBe('FunctionExpression')
    expect(functionExpr.parameters.length).toBe(1)
    const foo = functionExpr.parameters[0]
    expect(foo.name).toBe('foo')
    assertTypeRef('int', foo.typeRef)
    assertTypeRef('void', functionExpr.returnTypeRef)
  })

  it('call expression', async () => {
    const callExprs = await parseExprs<CallExpression>(`
      call();
      call(1, 2, 3);
    `)
    expect(callExprs).toHaveLength(2)
    const [noArgs, withArgs] = callExprs
    expect((noArgs.receiver as LocalVariable).ref.$refText).toBe('call')
    expect((withArgs.receiver as LocalVariable).ref.$refText).toBe('call')
    expect(withArgs.arguments).toHaveLength(3)
    for (const arg of withArgs.arguments) {
      expect(arg.$type).toBe('NumberLiteral')
    }
  })

  it('member access expression', async () => {
    const memberAccessExpr = await parseExpr<MemberAccess>('foo.bar;')
    expect(memberAccessExpr.ref.$refText).toBe('bar')
    expect((memberAccessExpr.receiver as LocalVariable).ref.$refText).toBe('foo')
  })
})

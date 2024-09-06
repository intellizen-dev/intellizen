import { describe, expect, it } from 'vitest'

import { assertLocalVariableText, assertNoErrors, assertTypeRef, createParseHelper } from '../utils'
import type { ArrayAccess, ArrayLiteral, Assignment, BooleanLiteral, CallExpression, ConditionalExpression, Expression, ExpressionStatement, FunctionExpression, InfixExpression, InstanceofExpression, LocalVariable, MapLiteral, MemberAccess, NullLiteral, NumberLiteral, ParenthesizedExpression, PrefixExpression, StringLiteral, StringTemplate, TypeCastExpression } from '../../src/generated/ast'

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
      assertLocalVariableText(key, /\w/)
      expect(value.$type).toBe('NumberLiteral')
    })
  })

  it('string template', async () => {
    // eslint-disable-next-line no-template-curly-in-string
    const expr = await parseExpr<StringTemplate>('`hello, ${world}!`;')

    const [left, localVariable, right] = expr.content
    expect(left).toBe('hello, ')
    assertLocalVariableText(localVariable as Expression, 'world')
    expect(right).toBe('!')
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
    assertLocalVariableText(noArgs.receiver, 'call')
    assertLocalVariableText(withArgs.receiver, 'call')
    expect(withArgs.arguments).toHaveLength(3)
    for (const arg of withArgs.arguments) {
      expect(arg.$type).toBe('NumberLiteral')
    }
  })

  it('member access expression', async () => {
    const memberAccessExpr = await parseExpr<MemberAccess>('foo.bar;')
    expect(memberAccessExpr.ref.$refText).toBe('bar')
    assertLocalVariableText(memberAccessExpr.receiver, 'foo')
  })

  it('infix expression', async () => {
    const infixExprs = await parseExprs<InfixExpression>(`
      0 to 10;
      10 .. 20;  
    `)
    expect(infixExprs).toHaveLength(2)
    const [to, dotD] = infixExprs

    expect(to.op).toBe('to')
    expect(to.left.$type).toBe('NumberLiteral')
    expect(to.right.$type).toBe('NumberLiteral')
    expect(dotD.op).toBe('..')
    expect(dotD.left.$type).toBe('NumberLiteral')
    expect(dotD.right.$type).toBe('NumberLiteral')
  })

  it('type cast expression', async () => {
    const typeCastExpr = await parseExprs<TypeCastExpression>(`
      foo as int;
      bar as OtherType;  
    `)
    expect(typeCastExpr).toHaveLength(2)
    const [int, otherType] = typeCastExpr

    assertLocalVariableText(int.expr, 'foo')
    assertTypeRef('int', int.typeRef)
    assertLocalVariableText(otherType.expr, 'bar')
    assertTypeRef('OtherType', otherType.typeRef)
  })

  it('array access', async () => {
    const arrayAccessExpr = await parseExpr<ArrayAccess>('foo[0];')
    assertLocalVariableText(arrayAccessExpr.array, 'foo')
    expect(arrayAccessExpr.index.$type).toBe('NumberLiteral')
  })

  it('instanceof expression', async () => {
    const instanceofExpr = await parseExpr<InstanceofExpression>('foo instanceof int;')
    assertLocalVariableText(instanceofExpr.expr, 'foo')
    assertTypeRef('int', instanceofExpr.typeRef)
  })

  it('operator priority', async () => {
    const expr = await parseExpr<Assignment>(`
      !true ? foo || bar : foo += 2;
    `)
    expect(expr.$type).toBe('Assignment')
    expect(expr.op).toBe('+=')

    const leftExpr = expr.left as ConditionalExpression

    const leftExprLeft = leftExpr.first as PrefixExpression
    expect(leftExprLeft.op).toBe('!')
    expect(leftExprLeft.expr.$type).toBe('BooleanLiteral')

    const second = leftExpr.second as InfixExpression
    expect(second.op).toBe('||')
    assertLocalVariableText(second.left, 'foo')
    assertLocalVariableText(second.right, 'bar')

    const third = leftExpr.third as LocalVariable
    assertLocalVariableText(third, 'foo')

    expect(expr.right.$type).toBe('NumberLiteral')
  })
})

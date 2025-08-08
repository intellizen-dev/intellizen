import type { MemberAccess } from '../../src/generated/ast'
import { describe, expect, it } from 'vitest'
import { ArrayLiteral, Assignment, BooleanLiteral, CallExpression, ConditionalExpression, Expression, FloatLiteral, FunctionExpression, IndexExpression, InfixExpression, InstanceofExpression, IntegerLiteral, IntRangeExpression, MapLiteral, NullLiteral, ParenthesizedExpression, PrefixExpression, ReferenceExpression, StringLiteral, StringTemplate, TypeCastExpression, UnquotedString } from '../../src/generated/ast'
import { assertClassTypeReference, assertReferenceExpressionText, createTestParser } from '../utils'

const parse = createTestParser()

describe('parse expression of script with ZenScript ', () => {
  it('integer literal', async () => {
    const examples = [
      '0',
      '0x0',
      '0l',
      '0L',
    ]
    const astNodes = await Promise.all(examples.map(async (it) => {
      return (await parse(it, { rule: Expression.$type })).parseResult.value as IntegerLiteral
    }))
    expect(astNodes.every(it => it.$type === IntegerLiteral.$type)).toBeTruthy()
    const [
      int$standard,
      int$hex,
      int$long,
      int$Long,
    ] = astNodes
    expect(int$standard.value).toBe('0')
    expect(int$hex.value).toBe('0x0')
    expect(int$long.value).toBe('0l')
    expect(int$Long.value).toBe('0L')
  })

  it('float literal', async () => {
    const examples = [
      '0.0',
      '0.0f',
      '0.0F',
      '1.0E-1',
      '1.0E-1f',
    ]
    const astNodes = await Promise.all(examples.map(async (it) => {
      return (await parse(it, { rule: Expression.$type })).parseResult.value as FloatLiteral
    }))
    expect(astNodes.every(it => it.$type === FloatLiteral.$type)).toBeTruthy()

    const [
      float$standard,
      float$symbol,
      float$Symbol,
      float$scientific,
      float$ScientificSymbol,
    ] = astNodes
    expect(float$standard.value).toBe('0.0')
    expect(float$symbol.value).toBe('0.0f')
    expect(float$Symbol.value).toBe('0.0F')
    expect(float$scientific.value).toBe('1.0E-1')
    expect(float$ScientificSymbol.value).toBe('1.0E-1f')
  })

  it('string literal', async () => {
    const examples = [
      `'hello'`,
      `"world"`,
      `"\\b\\f\\n\\r\\t\\'\\"\\u6C49\\u5B57"`,
    ]
    const astNodes = await Promise.all(examples.map(async (it) => {
      return (await parse(it, { rule: Expression.$type })).parseResult.value as StringLiteral
    }))
    expect(astNodes.every(it => it.$type === StringLiteral.$type)).toBeTruthy()

    const [hello, world, escape] = astNodes
    expect(hello.value).toBe('hello')
    expect(world.value).toBe('world')
    expect(escape.value).toBe('\b\f\n\r\t\'\"汉字')
  })

  it('boolean literal', async () => {
    const examples = [
      'true',
      'false',
    ]
    const astNodes = await Promise.all(examples.map(async (it) => {
      return (await parse(it, { rule: Expression.$type })).parseResult.value as BooleanLiteral
    }))
    expect(astNodes.every(it => it.$type === BooleanLiteral.$type)).toBeTruthy()
    const [trueLiteral, falseLiteral] = astNodes
    expect(trueLiteral.value).toBe(true)
    expect(falseLiteral.value).toBe(false)
  })

  it('null literal', async () => {
    const astNodes = (await parse('null', { rule: Expression.$type })).parseResult.value as NullLiteral
    expect(astNodes.$type).toBe(NullLiteral.$type)
    expect(astNodes.value).toBe('null')
  })

  it('array literal', async () => {
    const examples = [
      '[]',
      '[1, 2, 3]',
    ]

    const astNodes = await Promise.all(examples.map(async (it) => {
      return (await parse(it, { rule: Expression.$type })).parseResult.value as ArrayLiteral
    }))
    expect(astNodes.every(it => it.$type === ArrayLiteral.$type)).toBeTruthy()
    const [empty, withElements] = astNodes
    expect(empty.values).toHaveLength(0)
    expect(withElements.values).toHaveLength(3)
    for (const element in withElements.values) {
      expect(element).toMatch(/\d/)
    }
  })

  it('map literal', async () => {
    const examples = [
      '{}',
      '{a: 1, b: 2}',
    ]

    const astNodes = await Promise.all(examples.map(async (it) => {
      return (await parse(it, { rule: Expression.$type })).parseResult.value as MapLiteral
    }))
    expect(astNodes.every(it => it.$type === MapLiteral.$type)).toBeTruthy()
    const [empty, withElements] = astNodes
    expect(empty.entries).toHaveLength(0)
    expect(withElements.entries).toHaveLength(2)
    withElements.entries.forEach(({ key, value }) => {
      expect(key.$type).toBe(UnquotedString.$type)
      expect(value.$type).toBe(IntegerLiteral.$type)
    })
  })

  it('string template', async () => {
    const examples = [
      `\`hello, \${world}!\``,
      `\`\\b\\f\\n\\r\\t\\$\\'\\\"\\\`\\u6c49\\u5b57\``,
    ]

    const astNodes = await Promise.all(examples.map(async (it) => {
      return (await parse(it, { rule: Expression.$type })).parseResult.value as StringTemplate
    }))
    expect(astNodes.every(it => it.$type === StringTemplate.$type))

    const [helloWorld, escape] = astNodes
    expect(helloWorld.content).toHaveLength(3)
    const [hello, world, tail] = helloWorld.content
    expect(hello).toBe('hello, ')
    assertReferenceExpressionText((world as Expression), 'world')
    expect(tail).toBe('!')

    expect(escape.content).toHaveLength(1)
    const [escaped] = escape.content
    expect(escaped).toBe('\b\f\n\r\t$\'"`汉字')
  })

  it('parenthesized expression', async () => {
    const parenthesizedExpr = (await parse('(null)', { rule: Expression.$type })).parseResult.value as ParenthesizedExpression
    expect(parenthesizedExpr.$type).toBe(ParenthesizedExpression.$type)
    expect(parenthesizedExpr.expr.$type).toBe(NullLiteral.$type)
  })

  it('function expression', async () => {
    const expr = (await parse('(function (foo as int) as void {})', { rule: Expression.$type })).parseResult.value as ParenthesizedExpression
    expect(expr.$type).toBe(ParenthesizedExpression.$type)

    const functionExpr = expr.expr as FunctionExpression
    expect(functionExpr.$type).toBe(FunctionExpression.$type)
    expect(functionExpr.params.length).toBe(1)
    const foo = functionExpr.params[0]
    expect(foo.name).toBe('foo')
    assertClassTypeReference(foo.type, 'int')
    assertClassTypeReference(functionExpr.retType, 'void')
  })

  it('call expression', async () => {
    const examples = [
      'call()',
      'call(1, 2, 3)',
    ]
    const astNodes = await Promise.all(examples.map(async (it) => {
      return (await parse(it, { rule: Expression.$type })).parseResult.value as CallExpression
    }))
    expect(astNodes.every(it => it.$type === CallExpression.$type)).toBeTruthy()
    const [noArgs, withArgs] = astNodes
    assertReferenceExpressionText(noArgs.receiver, 'call')
    assertReferenceExpressionText(withArgs.receiver, 'call')
    expect(withArgs.args).toHaveLength(3)
    for (const arg of withArgs.args) {
      expect(arg.$type).toBe(IntegerLiteral.$type)
    }
  })

  // class "any" is not defined.
  it.skip('member access expression', async () => {
    const memberAccessExpr = (await parse('foo.bar', { rule: Expression.$type })).parseResult.value as MemberAccess
    expect(memberAccessExpr.entity.$refText).toBe('bar')
    assertReferenceExpressionText(memberAccessExpr.receiver, 'foo')
  })

  it('int range expression', async () => {
    const examples = [
      '0 to 10',
      '10 .. 20',
    ]

    const astNodes = await Promise.all(examples.map(async (it) => {
      return (await parse(it, { rule: Expression.$type })).parseResult.value as IntRangeExpression
    }))
    expect(astNodes.every(it => it.$type === IntRangeExpression.$type)).toBeTruthy()
    const [to, dotD] = astNodes

    expect(to.operator).toBe('to')
    expect(to.from.$type).toBe(IntegerLiteral.$type)
    expect(to.to.$type).toBe(IntegerLiteral.$type)
    expect(dotD.operator).toBe('..')
    expect(dotD.from.$type).toBe(IntegerLiteral.$type)
    expect(dotD.to.$type).toBe(IntegerLiteral.$type)
  })

  it('type cast expression', async () => {
    const examples = [
      'foo as int',
      'bar as OtherType',
    ]

    const astNodes = await Promise.all(examples.map(async (it) => {
      return (await parse(it, { rule: Expression.$type })).parseResult.value as TypeCastExpression
    }))
    expect(astNodes.every(it => it.$type === TypeCastExpression.$type)).toBeTruthy()
    const [int, otherType] = astNodes

    assertReferenceExpressionText(int.expr, 'foo')
    assertClassTypeReference(int.type, 'int')
    assertReferenceExpressionText(otherType.expr, 'bar')
    assertClassTypeReference(otherType.type, 'OtherType')
  })

  it('indexing expression', async () => {
    const examples = [
      'foo[0]',
      'foo[0][1]',
    ]
    const astNodes = await Promise.all(examples.map(async (it) => {
      return (await parse(it, { rule: Expression.$type })).parseResult.value as IndexExpression
    }))
    expect(astNodes.every(it => it.$type === IndexExpression.$type)).toBeTruthy()
    const [foo1, foo2] = astNodes
    expect(foo1.receiver.$type).toBe(ReferenceExpression.$type)
    expect(foo1.index.$type).toBe(IntegerLiteral.$type)
    expect(foo2.receiver.$type).toBe(IndexExpression.$type)
    expect(foo2.index.$type).toBe(IntegerLiteral.$type)
  })

  it('instanceof expression', async () => {
    const astNode = (await parse('foo instanceof Foo', { rule: Expression.$type })).parseResult.value as InstanceofExpression
    expect(astNode.$type).toBe(InstanceofExpression.$type)
    assertReferenceExpressionText(astNode.expr, 'foo')
    assertClassTypeReference(astNode.type, 'Foo')
  })

  it('operator priority', async () => {
    const assignment = (await parse('!true ? foo || bar : foo += 2', { rule: 'Expression' })).parseResult.value as Assignment
    expect(assignment.$type).toBe(Assignment.$type)
    expect(assignment.operator).toBe('+=')
    expect(assignment.right.$type).toBe(IntegerLiteral.$type)

    const conditional = assignment.left as ConditionalExpression
    expect(conditional.$type).toBe(ConditionalExpression.$type)

    const condition = conditional.condition as PrefixExpression
    expect(condition.$type).toBe(PrefixExpression.$type)
    expect(condition.operator).toBe('!')
    expect(condition.expr.$type).toBe(BooleanLiteral.$type)

    const thenBody = conditional.thenBody as InfixExpression
    expect(thenBody.$type).toBe(InfixExpression.$type)
    expect(thenBody.operator).toBe('||')
    assertReferenceExpressionText(thenBody.left, 'foo')
    assertReferenceExpressionText(thenBody.right, 'bar')

    const elseBody = conditional.elseBody as ReferenceExpression
    assertReferenceExpressionText(elseBody, 'foo')
  })
})

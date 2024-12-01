import type { AstNode } from 'langium'
import type { MemberAccess, ReferenceExpression, Statement } from '../../../src/generated/ast'
import path from 'node:path'
import { AstUtils } from 'langium'
import { assert, describe, expect, it, suite } from 'vitest'
import { isCallExpression, isConstructorDeclaration, isFunctionDeclaration } from '../../../src/generated/ast'
import { assertNoErrors, createTestServices, getDocument } from '../../utils'

const services = await createTestServices(__dirname)

function findOverloadForCall(call: Statement): AstNode {
  const callExpr = AstUtils.streamAst(call).find(isCallExpression)
  expect(callExpr).toBeDefined()
  expect(callExpr?.receiver?.$type).toMatch(/ReferenceExpression|MemberAccess/)
  const receiver = callExpr!.receiver as ReferenceExpression | MemberAccess
  const target = receiver.target.ref
  expect(target).toBeDefined()
  return target!
}

describe('check overload', async () => {
  const document_overload_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'overload.zs'))
  const script_overload_zs = document_overload_zs.parseResult.value

  it('syntax', () => {
    assertNoErrors(document_overload_zs)
    expect(script_overload_zs.statements[0].$type).toBe('VariableDeclaration')
  })

  suite('overload_basic', () => {
    it('normal', () => {
      const foo = findOverloadForCall(script_overload_zs.statements[1])
      assert(isFunctionDeclaration(foo))
      expect(foo.name).toBe('foo')
      expect(foo.parameters.length).toBe(0)

      const foo1 = findOverloadForCall(script_overload_zs.statements[2])
      assert(isFunctionDeclaration(foo1))
      expect(foo1.name).toBe('foo')
      expect(foo1.parameters.length).toBe(1)

      const foo2 = findOverloadForCall(script_overload_zs.statements[3])
      assert(isFunctionDeclaration(foo2))
      expect(foo2.name).toBe('foo')
      expect(foo2.parameters.length).toBe(2)
      expect(foo2.parameters[1].typeRef?.$cstNode?.text).toBe('int')

      const foo3 = findOverloadForCall(script_overload_zs.statements[4])
      assert(isFunctionDeclaration(foo3))
      expect(foo3.name).toBe('foo')
      expect(foo3.parameters.length).toBe(2)
      expect(foo3.parameters[1].typeRef?.$cstNode?.text).toBe('double')
    })

    it('varargs', () => {
      const varargs_low_priorty = findOverloadForCall(script_overload_zs.statements[5])
      assert(isFunctionDeclaration(varargs_low_priorty))
      expect(varargs_low_priorty.name).toBe('varargs')
      expect(varargs_low_priorty.parameters.length).toBe(1)

      const varargs_full = findOverloadForCall(script_overload_zs.statements[6])
      assert(isFunctionDeclaration(varargs_full))
      expect(varargs_full.name).toBe('varargs')
      expect(varargs_full.parameters.length).toBe(2)
      expect(varargs_full.parameters[1].varargs).toBe(true)

      const varargs_more = findOverloadForCall(script_overload_zs.statements[7])
      assert(isFunctionDeclaration(varargs_more))
      expect(varargs_more.name).toBe('varargs')
      expect(varargs_more.parameters.length).toBe(2)
      expect(varargs_more.parameters[1].varargs).toBe(true)

      const varargs_less = findOverloadForCall(script_overload_zs.statements[8])
      assert(isFunctionDeclaration(varargs_less))
      expect(varargs_less.name).toBe('varargs_miss')
      expect(varargs_less.parameters.length).toBe(1)
      expect(varargs_less.parameters[0].varargs).toBe(true)
    })

    it('optional', () => {
      const optional_eq = findOverloadForCall(script_overload_zs.statements[9])
      assert(isFunctionDeclaration(optional_eq))
      expect(optional_eq.name).toBe('optional')
      expect(optional_eq.parameters.length).toBe(2)
      expect(optional_eq.parameters[1].defaultValue).toBeDefined()

      const optional_low_priorty = findOverloadForCall(script_overload_zs.statements[10])
      assert(isFunctionDeclaration(optional_low_priorty))
      expect(optional_low_priorty.name).toBe('optional')
      expect(optional_low_priorty.parameters.length).toBe(1)

      const optional_less = findOverloadForCall(script_overload_zs.statements[11])
      assert(isFunctionDeclaration(optional_less))
      expect(optional_less.name).toBe('optional_miss')
      expect(optional_less.parameters.length).toBe(1)
      expect(optional_less.parameters[0].defaultValue).toBeDefined()

      const optional_convert_1 = findOverloadForCall(script_overload_zs.statements[12])
      assert(isFunctionDeclaration(optional_convert_1))
      expect(optional_convert_1.name).toBe('optional_convert')
      expect(optional_convert_1.parameters.length).toBe(2)
      expect(optional_convert_1.parameters[1].defaultValue).toBeDefined()

      const optional_convert_2 = findOverloadForCall(script_overload_zs.statements[13])
      assert(isFunctionDeclaration(optional_convert_2))
      expect(optional_convert_2.name).toBe('optional_convert')
      expect(optional_convert_2.parameters.length).toBe(2)
      expect(optional_convert_2.parameters[1].defaultValue).toBeDefined()

      const optional_vs_varargs = findOverloadForCall(script_overload_zs.statements[14])
      assert(isFunctionDeclaration(optional_vs_varargs))
      expect(optional_vs_varargs.name).toBe('varargs_vs_optional')
      expect(optional_vs_varargs.parameters.length).toBe(1)
      expect(optional_vs_varargs.parameters[0].varargs).toBeTruthy()
      expect(optional_vs_varargs.parameters[0].defaultValue).toBeFalsy()
    })
  })
})

describe('check static overload', async () => {
  const document_overload_static_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'overload_static.zs'))
  const script_overload_zs = document_overload_static_zs.parseResult.value

  it('syntax', () => {
    assertNoErrors(document_overload_static_zs)
  })

  it('import overload', () => {
    const foo1 = findOverloadForCall(script_overload_zs.statements[0])
    assert(isFunctionDeclaration(foo1))
    expect(foo1.name).toBe('foo')
    expect(foo1.parameters.length).toBe(0)

    const foo2 = findOverloadForCall(script_overload_zs.statements[1])
    assert(isFunctionDeclaration(foo2))
    expect(foo2.name).toBe('foo')
    expect(foo2.parameters.length).toBe(1)
  })

  it('member access', () => {
    const foo1 = findOverloadForCall(script_overload_zs.statements[2])
    assert(isFunctionDeclaration(foo1))
    expect(foo1.name).toBe('foo')
    expect(foo1.parameters.length).toBe(0)

    const foo2 = findOverloadForCall(script_overload_zs.statements[3])
    assert(isFunctionDeclaration(foo2))
    expect(foo2.name).toBe('foo')
    expect(foo2.parameters.length).toBe(1)
  })
})

describe('check ctor overload', async () => {
  const document_overload_ctor_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'overload_ctor.zs'))
  const script_overload_zs = document_overload_ctor_zs.parseResult.value

  it('syntax', () => {
    assertNoErrors(document_overload_ctor_zs)
  })

  it('ctor overload import', () => {
    const foo1 = findOverloadForCall(script_overload_zs.statements[0])
    assert(isConstructorDeclaration(foo1))
    expect(foo1.parameters.length).toBe(0)

    const foo2 = findOverloadForCall(script_overload_zs.statements[1])
    assert(isConstructorDeclaration(foo2))
    expect(foo2.parameters.length).toBe(1)
  })

  it('ctor overload member access', () => {
    const foo1 = findOverloadForCall(script_overload_zs.statements[2])
    assert(isConstructorDeclaration(foo1))
    expect(foo1.parameters.length).toBe(0)

    const foo2 = findOverloadForCall(script_overload_zs.statements[3])
    assert(isConstructorDeclaration(foo2))
    expect(foo2.parameters.length).toBe(1)
  })
})

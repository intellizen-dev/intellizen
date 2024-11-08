import type { Assignment, CallExpression, ExpressionStatement, FunctionExpression, VariableDeclaration } from '../../../src/generated/ast'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertNoErrors, createTestServices, getDocument } from '../../utils'

const services = await createTestServices(__dirname)

describe('check inferring class lambda declaration', async () => {
  const document_class_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'class.zs'))
  const script_class_zs = document_class_zs.parseResult.value
  const statement_variable_declaration = script_class_zs.statements[0] as VariableDeclaration
  const statement_assignment = script_class_zs.statements[1] as ExpressionStatement
  const statement_call_expression = script_class_zs.statements[2] as ExpressionStatement

  it('should no errors', () => {
    assertNoErrors(document_class_zs)
  })

  it('check inferring VariableDeclaration', () => {
    const functionExpression = statement_variable_declaration.initializer as FunctionExpression
    const x = functionExpression.parameters[0]
    const y = functionExpression.parameters[1]
    const type_x = services.typing.TypeComputer.inferType(x)
    const type_y = services.typing.TypeComputer.inferType(y)
    expect(type_x?.toString()).toBe('float')
    expect(type_y?.toString()).toBe('double')
  })

  it('check inferring Assignment', () => {
    const functionExpression = (statement_assignment.expr as Assignment).right as FunctionExpression
    const u = functionExpression.parameters[0]
    const v = functionExpression.parameters[1]
    const type_u = services.typing.TypeComputer.inferType(u)
    const type_v = services.typing.TypeComputer.inferType(v)
    expect(type_u?.toString()).toBe('float')
    expect(type_v?.toString()).toBe('double')
  })

  it('check inferring CallExpression', () => {
    const functionExpression = (statement_call_expression.expr as CallExpression).arguments[0] as FunctionExpression
    const i = functionExpression.parameters[0]
    const j = functionExpression.parameters[1]
    const type_i = services.typing.TypeComputer.inferType(i)
    const type_j = services.typing.TypeComputer.inferType(j)
    expect(type_i?.toString()).toBe('float')
    expect(type_j?.toString()).toBe('double')
  })
})

describe('check inferring function type', async () => {
  const document_type_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'type.zs'))
  const script_type_zs = document_type_zs.parseResult.value
  const statement_variable_declaration = script_type_zs.statements[0] as VariableDeclaration
  const statement_assignment = script_type_zs.statements[1] as ExpressionStatement
  const statement_call_expression = script_type_zs.statements[2] as ExpressionStatement

  it('should no errors', () => {
    assertNoErrors(document_type_zs)
  })

  it('check inferring VariableDeclaration', () => {
    const functionExpression = statement_variable_declaration.initializer as FunctionExpression
    const z = functionExpression.parameters[0]
    const type_z = services.typing.TypeComputer.inferType(z)
    expect(type_z?.toString()).toBe('int')
  })

  it('check inferring Assignment', () => {
    const functionExpression = (statement_assignment.expr as Assignment).right as FunctionExpression
    const w = functionExpression.parameters[0]
    const type_w = services.typing.TypeComputer.inferType(w)
    expect(type_w?.toString()).toBe('int')
  })

  it('check inferring CallExpression', () => {
    const functionExpression = (statement_call_expression.expr as CallExpression).arguments[0] as FunctionExpression
    const k = functionExpression.parameters[0]
    const type_k = services.typing.TypeComputer.inferType(k)
    expect(type_k?.toString()).toBe('int')
  })
})

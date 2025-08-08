import type { ExpressionStatement, FieldDeclaration, FunctionDeclaration, MemberAccess } from '../../../src/generated/ast'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertNoErrors, createTestServicesWithWorkspace, getDocument } from '../../utils'

const services = await createTestServicesWithWorkspace(__dirname)

describe('check qualified name reference', async () => {
  const document_LogUtils_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'utils', 'LogUtils.zs'))
  const document_log_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'log.zs'))
  const script_log_zs = document_log_zs.parseResult.value
  const statement_utils_LogUtils_createLogHelper = script_log_zs.statements[0] as ExpressionStatement
  const statement_utils_LogUtils_LogHelper_default = script_log_zs.statements[1] as ExpressionStatement
  const statement_utils_LogUtils_LogHelper_create = script_log_zs.statements[2] as ExpressionStatement

  it('should no errors', () => {
    assertNoErrors(document_LogUtils_zs)
    assertNoErrors(document_log_zs)
  })

  it('check toplevel function', () => {
    const expr_createLogHelper = statement_utils_LogUtils_createLogHelper.expr as MemberAccess
    const ref_createLogHelper = expr_createLogHelper.entity.ref as FunctionDeclaration
    expect(ref_createLogHelper.name).toBe('createLogHelper')
  })

  it('check zenClass static field', () => {
    const expr_default = statement_utils_LogUtils_LogHelper_default.expr as MemberAccess
    const ref_default = expr_default.entity.ref as FieldDeclaration
    expect(ref_default.name).toBe('default')
  })

  it('check zenClass static function', () => {
    const expr_create = statement_utils_LogUtils_LogHelper_create.expr as MemberAccess
    const ref_create = expr_create.entity.ref as FieldDeclaration
    expect(ref_create.name).toBe('create')
  })
})

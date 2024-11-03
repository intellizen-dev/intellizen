import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertNoErrors, createTestServices, getDocument } from '../../utils'
import type { VariableDeclaration } from '../../../src/generated/ast'

const services = await createTestServices(__dirname)

describe(`check inferring array access expression`, async () => {
  const document_indexing_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'indexing.zs'))
  const script_indexing_zs = document_indexing_zs.parseResult.value
  const statement_val_d = script_indexing_zs.statements[3] as VariableDeclaration
  const statement_val_i = script_indexing_zs.statements[4] as VariableDeclaration
  const statement_val_s = script_indexing_zs.statements[5] as VariableDeclaration

  it('should no errors', () => {
    assertNoErrors(document_indexing_zs)
  })

  it('check indexing array', () => {
    const type_d = services.typing.TypeComputer.inferType(statement_val_d)
    expect(type_d?.toString()).toBe('double')
  })

  it('check indexing list', () => {
    const type_i = services.typing.TypeComputer.inferType(statement_val_i)
    expect(type_i?.toString()).toBe('int')
  })

  it('check indexing map', () => {
    const type_s = services.typing.TypeComputer.inferType(statement_val_s)
    expect(type_s?.toString()).toBe('string')
  })
})

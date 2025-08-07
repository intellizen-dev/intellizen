import type { CallExpression, ExpressionStatement } from '../../../src/generated/ast'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertNoErrors, createTestServices, getDocument } from '../../utils'

const services = await createTestServices(__dirname)

describe(`check dynamic arguments`, async () => {
  const document_argument_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'argument.zs'))
  const script_argument_zs = document_argument_zs.parseResult.value
  const statement_apply_up = script_argument_zs.statements[0] as ExpressionStatement
  const expression_apply_up = statement_apply_up.expr as CallExpression

  it('should no errors', () => {
    assertNoErrors(document_argument_zs)
  })

  it('check inferring dynamic argument', () => {
    const up = expression_apply_up.args[0]
    const type_up = services.typing.TypeComputer.inferType(up)
    expect(up).toBeDefined()
    expect(type_up?.toString()).toBe('Facing')
  })
})

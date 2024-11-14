import type { ExpressionStatement, FunctionDeclaration, ReferenceExpression } from '../../../src/generated/ast'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertNoErrors, createTestServices, getDocument } from '../../utils'

const services = await createTestServices(__dirname)

describe(`check dynamic this in class`, async () => {
  const document_this_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'this.zs'))
  const script_this_zs = document_this_zs.parseResult.value

  it('should no errors', () => {
    assertNoErrors(document_this_zs)
  })

  it('check inferring dynamic this', () => {
    const statement_this = (script_this_zs.classes[0].members[0] as FunctionDeclaration).body[0] as ExpressionStatement
    const expression_this = statement_this.expr as ReferenceExpression
    const type = services.typing.TypeComputer.inferType(expression_this)
    expect(expression_this.target.ref).toBeDefined()
    expect(type?.toString()).toBe('Str')
  })
})

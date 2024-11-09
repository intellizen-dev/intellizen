import type { ExpressionStatement, MemberAccess } from '../../../src/generated/ast'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertNoErrors, createTestServices, getDocument } from '../../utils'

const services = await createTestServices(__dirname)

describe(`check synthetic member`, async () => {
  const document_synthetic_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'synthetic.zs'))
  const script_synthetic_zs = document_synthetic_zs.parseResult.value
  const statement_justAny_foo_bar = script_synthetic_zs.statements[1] as ExpressionStatement
  const expression_justAny_foo_bar = statement_justAny_foo_bar.expr as MemberAccess

  it('should no errors', () => {
    assertNoErrors(document_synthetic_zs)
  })

  it('check inferring synthetic member', () => {
    const bar = expression_justAny_foo_bar.target.ref
    const type_bar = services.typing.TypeComputer.inferType(bar)
    expect(bar).toBeDefined()
    expect(type_bar?.toString()).toBe('any')
  })
})

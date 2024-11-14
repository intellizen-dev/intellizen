import type { ExpressionStatement, MemberAccess } from '../../../src/generated/ast'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ContextCache } from '../../../src/utils/cache'
import { assertNoErrors, createTestServices, getDocument } from '../../utils'

const services = await createTestServices(__dirname)

describe(`check dynamic member`, async () => {
  const document_member_zs = await getDocument(services, path.resolve(__dirname, 'scripts', 'member.zs'))
  const script_member_zs = document_member_zs.parseResult.value
  const statement_justAny_foo_bar = script_member_zs.statements[1] as ExpressionStatement
  const expression_justAny_foo_bar = statement_justAny_foo_bar.expr as MemberAccess

  it('should no errors', () => {
    assertNoErrors(document_member_zs)
  })

  it('check inferring dynamic member', () => {
    const bar = expression_justAny_foo_bar.target.ref
    const type_bar = services.typing.TypeComputer.inferType(bar, new ContextCache())
    expect(bar).toBeDefined()
    expect(type_bar?.toString()).toBe('any')
  })
})

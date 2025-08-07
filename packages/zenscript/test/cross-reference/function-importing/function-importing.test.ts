import type { CallExpression, ExpressionStatement, MemberAccess, ReferenceExpression } from '../../../src/generated/ast'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertNoErrors, createTestServices, getDocument } from '../../utils'

const services = await createTestServices(__dirname)

describe('function importing', async () => {
  const document = await getDocument(services, path.resolve(__dirname, 'scripts', 'function-importing.zs'))
  const script = document.parseResult.value

  let line = Number.NaN
  const next = () => ((script.statements[line++] as ExpressionStatement).expr as CallExpression)

  it('syntax', () => {
    assertNoErrors(document)
  })

  it('existing functions', () => {
    line = 0
    const add = next().receiver as ReferenceExpression
    expect(add.entity.ref).toBeDefined()

    const plus = next().receiver as ReferenceExpression
    expect(plus.entity.ref).toBeDefined()

    const scripts_lib_add = next().receiver as MemberAccess
    expect(scripts_lib_add.entity.ref).toBeDefined()
  })

  it('not existing functions', () => {
    line = 3
    const sub = next().receiver as ReferenceExpression
    expect(sub.entity.ref).toBeUndefined()

    const minus = next().receiver as ReferenceExpression
    expect(minus.entity.ref).toBeUndefined()

    const scripts_lib_sub = next().receiver as MemberAccess
    expect(scripts_lib_sub.entity.ref).toBeUndefined()
  })
})

import type { AstNode } from 'langium'
import type { Expression, ExpressionStatement, MemberAccess } from '../../../src/generated/ast'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isConstructorDeclaration, isFunctionDeclaration } from '../../../src/generated/ast'
import { isStatic } from '../../../src/utils/ast'
import { createTestServices, getDocument } from '../../utils'

const services = await createTestServices(__dirname)

function getMembers(expression: Expression): AstNode[] {
  return services.references.MemberProvider.streamMembers(expression).toArray()
}

describe(`static accessing`, async () => {
  const document = await getDocument(services, path.resolve(__dirname, 'scripts', 'static_accessing.zs'))
  const script = document.parseResult.value

  it('accessing top-level static variable RED', () => {
    const statement_red = script.statements[0] as ExpressionStatement
    const expression_red = statement_red.expr as MemberAccess
    const members_red = getMembers(expression_red)
    expect(members_red.length, 'should have exactly 1 member').toBe(1)
    expect(members_red[0], 'should be a constructor').satisfies(isConstructorDeclaration)
  })

  it('accessing class Color', () => {
    const statement_color = script.statements[1] as ExpressionStatement
    const expression_color = statement_color.expr as MemberAccess
    const members_color = getMembers(expression_color)
    expect(members_color.length, 'should have exactly 1 member').toBe(1)
    expect(members_color[0], 'should be a function').satisfies(isFunctionDeclaration)
    expect(members_color[0], 'should be static').satisfies(isStatic)
  })

  it('accessing class static function randomColor', () => {
    const statement_random_color = script.statements[2] as ExpressionStatement
    const expression_random_color = statement_random_color.expr as MemberAccess
    const members_random_color = getMembers(expression_random_color)
    expect(members_random_color.length, 'should have exactly 1 member').toBe(1)
    expect(members_random_color[0], 'should be a constructor').satisfies(isConstructorDeclaration)
  })

  it('accessing top-level static variable NOTHING', () => {
    const statement_nothing = script.statements[3] as ExpressionStatement
    const expression_nothing = statement_nothing.expr as MemberAccess
    const members_nothing = getMembers(expression_nothing)
    expect(members_nothing.length, 'should have no members').toBe(0)
  })
})
